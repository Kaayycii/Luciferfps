import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const HOSTS = new Set(['www.marvelrivals.com', 'marvelrivals.com', 'www.marvelrivalsesports.com', 'marvelrivalsesports.com']);
export const SOURCES = Object.freeze([
  // The home feed can publish a patch before the category index catches up.
  { id: 'game-home', url: 'https://www.marvelrivals.com/', category: 'announcements' },
  { id: 'game-updates', url: 'https://www.marvelrivals.com/gameupdate/', category: 'patches' },
  { id: 'game-balance', url: 'https://www.marvelrivals.com/balancepost/', category: 'balance' },
  { id: 'game-announcements', url: 'https://www.marvelrivals.com/announcements/', category: 'announcements' },
  { id: 'ignite-official', url: 'https://www.marvelrivalsesports.com/news/official/index.html', category: 'esports' },
]);

export function officialUrl(value, base = SOURCES[0].url) {
  try {
    const url = new URL(value, base);
    if (url.protocol !== 'https:' || !HOSTS.has(url.hostname) || url.username || url.password || (url.port && url.port !== '443')) return null;
    url.hostname = url.hostname.replace(/^(?!www\.)/, 'www.');
    url.search = ''; url.hash = '';
    return url.href;
  } catch { return null; }
}

export function dateOnly(value) {
  const match = String(value || '').match(/^(\d{4})[-/]?(\d{2})[-/]?(\d{2})$/);
  if (!match) return null;
  const day = `${match[1]}-${match[2]}-${match[3]}`;
  const timestamp = Date.parse(`${day}T00:00:00.000Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === day ? day : null;
}

function plain(html) {
  return String(html).replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '')
    .replace(/<[^>]*>/g, ' ').replace(/&#(x[\da-f]+|\d+);?/gi, (_, number) => {
      const point = number[0].toLowerCase() === 'x' ? parseInt(number.slice(1), 16) : Number(number);
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : '';
    }).replace(/&(amp|lt|gt|quot|apos|nbsp);/gi, (_, entity) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' })[entity.toLowerCase()])
    .replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function parseOfficialIndex(html, source) {
  if (typeof html !== 'string' || html.length > 2_000_000) throw new Error('Official index exceeds parser limit');
  const records = new Map();
  const document = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  for (const anchor of document.matchAll(/<a\b([^>]*?)>([\s\S]*?)<\/a\s*>/gi)) {
    const href = anchor[1].match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
    const url = href && officialUrl(href, source.url);
    if (!url) continue;
    const path = new URL(url).pathname;
    const article = path.match(/^\/(?:m\/)?(?:(?:gameupdate|balancepost|announcements|devdiaries|events|news|match)\/)?(\d{8})\/\d+_(\d+)\.html$/);
    if (!article) continue;
    const body = anchor[2];
    const heading = body.match(/<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/i)?.[1]
      || body.match(/<(?:p|div|span)\b[^>]*class=["'][^"']*\btitle\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:p|div|span)>/i)?.[1]
      || anchor[1].match(/\btitle=["']([^"']+)["']/i)?.[1]
      || body.replace(/<(?:p|div|span)\b[^>]*class=["'][^"']*\b(?:date|time|desc)\b[^"']*["'][^>]*>[\s\S]*?<\/(?:p|div|span)>/gi, '');
    const title = plain(heading).slice(0, 250);
    const dateInBody = body.match(/\b(\d{4}[-/]\d{2}[-/]\d{2})\b/)?.[1];
    const publishedAt = dateOnly(dateInBody) || dateOnly(article[1]);
    if (!title || title.length < 5 || !publishedAt) continue;
    const esports = new URL(url).hostname === 'www.marvelrivalsesports.com';
    const category = esports ? 'esports' : /\/balancepost\//.test(path) || /\bBalance Post\b/i.test(title) ? 'balance'
      : /\/gameupdate\//.test(path) || /\bPatch Notes\b/i.test(title) ? 'patches' : /\/devdiaries\//.test(path) || /Dev Vision/i.test(title) ? 'development' : source.category;
    const id = `${esports ? 'ignite' : 'game'}-${article[2]}`;
    const effectiveAt = ['patches', 'balance'].includes(category) ? dateOnly(title.match(/\bVersion\s+(\d{8})\b/i)?.[1]) : null;
    const item = { id, title, url, publishedAt, category, ...(effectiveAt ? { effectiveAt } : {}), sourceIds: [source.id] };
    const previous = records.get(id);
    if (!previous || urlQuality(url) > urlQuality(previous.url)) records.set(id, item);
  }
  const articles = [...records.values()].sort(articleOrder).slice(0, 40);
  if (!articles.length) throw new Error('Official index contains no recognized article records; keeping last good feed');
  return articles;
}

const urlQuality = url => /\/(?:gameupdate|balancepost|announcements|devdiaries|events)\//.test(url) ? 2 : /\/m\//.test(url) ? 0 : 1;
const articleOrder = (a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id);
const fingerprint = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export async function fetchOfficialIndex(url, { fetchImpl = fetch, timeoutMs = 20_000, maxBytes = 2_000_000 } = {}) {
  const safe = officialUrl(url);
  if (!safe) throw new Error('Official source URL is not permitted');
  const response = await fetchImpl(safe, { redirect: 'error', credentials: 'omit', signal: AbortSignal.timeout(timeoutMs), headers: { Accept: 'text/html', 'User-Agent': 'LuciferFPS-OfficialUpdates/1.0' } });
  if (!response.ok) throw new Error(`Official source returned HTTP ${response.status}`);
  if (!/text\/html|application\/xhtml\+xml/i.test(response.headers.get('content-type') || '')) throw new Error('Official source did not return HTML');
  if (Number(response.headers.get('content-length')) > maxBytes) throw new Error('Official source exceeds download limit');
  const chunks = []; let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.byteLength;
    if (bytes > maxBytes) throw new Error('Official source exceeds download limit');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

// These are dated, manually reviewed notes, not generated opinions or copied articles.
// Scheduled discovery updates article metadata. It never silently rewrites reviewed game facts.
export const REVIEWED_FACTS = Object.freeze([
  {
    id: 'patch-20261022', title: 'October 22 patch: movement fixes and Competitive achievement repair', category: 'patches',
    summary: 'Black Cat can again use wall portals immediately after Fortune’s Favor – Phantom Pursuit. Black Widow’s Widow’s Bite Slam receives a directional fix, and Hawkeye’s bow display is repaired. Competitive Team Wipes count toward ACE achievements when an opponent has already left. This patch lists no numerical hero balance changes or IGNITE tournament-version announcement.',
    sourceUrl: 'https://www.marvelrivals.com/gameupdate/20261021/41548_1317253.html', publishedAt: '2026-10-21', effectiveAt: '2026-10-22T09:00:00Z', reviewedAt: '2026-10-26', relatedHeroIds: ['black-cat', 'black-widow', 'hawkeye'],
  },
  {
    id: 'endgame-20261022', title: 'Endgame event: limited weekly mode sessions', category: 'season',
    summary: 'The event runs October 22–November 26 at 09:00 UTC. The mode began October 24 and has limited sessions over four weeks. The published UTC windows are 01:00–03:00, 10:00–12:00 and 18:00–20:00. Event duration does not mean the mode is continuously available; check the official schedule before queuing.',
    sourceUrl: 'https://www.marvelrivals.com/gameupdate/20261021/41548_1317253.html', publishedAt: '2026-10-21', effectiveAt: '2026-10-22T09:00:00Z', reviewedAt: '2026-10-26',
    event: { startAt: '2026-10-22', endAt: '2026-11-26', datePrecision: 'day' },
  },
  {
    id: 'ignite-stage-2-emea-champion-2026', title: 'Stage 2 EMEA complete: NAVI defeats Virtus.pro 4–1', category: 'esports',
    summary: 'NAVI’s official team report confirms a 4–1 grand-final win over Virtus.pro. Its final standings list NAVI, Virtus.pro, Pulsar and Shikigami in the top four. Stage 2 has concluded; the next confirmed major event is the November 23–29 Grand Finals. A series score does not establish individual performance or current contracts.',
    sourceUrl: 'https://navi.gg/en/publications/navi-ignite-s2-emea-champions', publishedAt: '2026-10-20', effectiveAt: '2026-10-18', reviewedAt: '2026-10-26',
  },
  {
    id: 'ignite-grand-finals-2026', title: 'IGNITE Grand Finals: Stockholm, November 23–29', category: 'esports',
    summary: 'The event host announces the IGNITE Grand Finals for November 23–29 in Stockholm. DreamHack Stockholm hosts the public main stage on November 27–29. These are event dates, not individual match start times; the announcement does not specify the tournament game version.',
    sourceUrl: 'https://dreamhack.com/stockholm/updates/2026/10/06/marvel-rivals-ignite-grand-finals-are-coming-to-dreamhack-stockholm/', publishedAt: '2026-10-06', effectiveAt: '2026-11-23', reviewedAt: '2026-10-26',
    event: { startAt: '2026-11-23', endAt: '2026-11-29', datePrecision: 'day' },
  },
  {
    id: 'patch-20261015', title: 'October 15 patch: hero fixes and map collisions', category: 'patches',
    summary: 'This patch fixes Jeff’s Blood Hunt Reservoir interaction, Black Widow’s excessive movement from Widow’s Bite Slam, and collision problems that could trap heroes. It also starts the Halloween event. No new balance table is published in these notes.',
    sourceUrl: 'https://www.marvelrivals.com/gameupdate/20261014/41548_1316588.html', publishedAt: '2026-10-14', effectiveAt: '2026-10-15T09:00:00Z', reviewedAt: '2026-10-16', relatedHeroIds: ['jeff-the-land-shark', 'black-widow'],
  },
  {
    id: 'season-10-5-20261009', title: 'Season 10.5: live-game update', category: 'season',
    summary: 'Season 10.5 adds an Infinity War mode with six duo squads, each racing to collect six Infinity Stones. Alchemax Headquarters joins 18 vs. 18. Gorr gains a Shadow Harvest targeting-sensitivity setting, and Winter Soldier receives response improvements under high latency.',
    sourceUrl: 'https://www.marvelrivals.com/gameupdate/20261006/41548_1315865.html', publishedAt: '2026-10-06', effectiveAt: '2026-10-09T09:00:00Z', reviewedAt: '2026-10-16', relatedHeroIds: ['gorr', 'winter-soldier'],
  },
  {
    id: 'stage-2-2026-playoffs', title: 'IGNITE Stage 2 playoffs: October 8–18', category: 'esports',
    summary: 'The official Stage 2 guide lists October 8–18 for playoffs, with the Pacific final on October 11 and Americas, EMEA, and China finals on October 18. Playoffs use double elimination, BO5 series, and BO7 grand finals. Twelve Grand Finals places are allocated: four Americas, four EMEA, two Pacific, and two China.',
    sourceUrl: 'https://www.marvelrivalsesports.com/20260908/42828_1313342.html', publishedAt: '2026-09-08', effectiveAt: '2026-10-08', reviewedAt: '2026-10-16',
    event: { startAt: '2026-10-08', endAt: '2026-10-18', datePrecision: 'day', gameVersion: 'Season 10', regions: ['AMER', 'EMEA', 'PAC', 'CN'] },
  },
  {
    id: 'stage-2-2026-version', title: 'Tournament version differs from the live client', category: 'esports',
    summary: 'The Stage 2 guide specifies Season 10 across all regions. Do not assume live-client Season 10.5 balance applies to tournament matches. Thebes enters the Stage 2 pool; the guide also announces a new Domination map for playoffs without naming it in the text.',
    sourceUrl: 'https://www.marvelrivalsesports.com/20260908/42828_1313342.html', publishedAt: '2026-09-08', effectiveAt: '2026-09-17', reviewedAt: '2026-10-16',
    event: { startAt: '2026-09-17', endAt: '2026-10-18', datePrecision: 'day', gameVersion: 'Season 10' },
  },
  {
    id: 'god-quarry-20260924', title: 'God Quarry: new Domination map', category: 'maps',
    summary: 'God Quarry was added as a Domination map on September 24. Its dedicated Quick Match event ended September 29; that limited event window is separate from the map’s release.',
    sourceUrl: 'https://www.marvelrivals.com/gameupdate/20260923/41548_1314808.html', publishedAt: '2026-09-23', effectiveAt: '2026-09-24T09:00:00Z', reviewedAt: '2026-10-16', relatedMapIds: ['god-quarry'],
  },
  {
    id: 'alchemax-headquarters-20261009', title: 'Alchemax Headquarters joins 18 vs. 18', category: 'maps',
    summary: 'The October 9 update adds Alchemax Headquarters to 18 vs. 18. This is a mode-specific map addition; the announcement does not establish it as a ranked six-player map.',
    sourceUrl: 'https://www.marvelrivals.com/gameupdate/20261006/41548_1315865.html', publishedAt: '2026-10-06', effectiveAt: '2026-10-09T09:00:00Z', reviewedAt: '2026-10-16', relatedMapIds: ['alchemax-headquarters'],
  },
  {
    id: 'balance-20261009-overview', title: 'October 9 hero balance: what to recheck', category: 'heroes',
    summary: 'Iron Man’s Micro-Missile Barrage gains automatic tracking. Phoenix trades Spark-triggered self-healing for temporary bonus health. Jubilee gains healing during Sparking Sprint. The balance post covers additional hero and Team-Up changes; consult its full values before updating a practice routine.',
    sourceUrl: 'https://www.marvelrivals.com/balancepost/20261006/41667_1315864.html', publishedAt: '2026-10-06', effectiveAt: '2026-10-09', reviewedAt: '2026-10-16', relatedHeroIds: ['iron-man', 'phoenix', 'jubilee'],
  },
  {
    id: 'gorr-living-abyss-source-conflict', title: 'Gorr: official cooldown sources disagree', category: 'heroes',
    summary: 'The October 9 balance post changes Living Abyss from 15 to 12 seconds. The official hero page displays 13 seconds. These official sources disagree, so the cooldown remains flagged for verification rather than silently replaced with a guessed value.',
    sourceUrl: 'https://www.marvelrivals.com/balancepost/20261006/41667_1315864.html', publishedAt: '2026-10-06', effectiveAt: '2026-10-09', reviewedAt: '2026-10-26', relatedHeroIds: ['gorr'],
    conflict: { field: 'Living Abyss cooldown', status: 'unresolved', alternatives: [
      { value: '12 seconds', sourceUrl: 'https://www.marvelrivals.com/balancepost/20261006/41667_1315864.html', publishedAt: '2026-10-06' },
      { value: '13 seconds', sourceUrl: 'https://www.marvelrivals.com/20260911/41360_1313617.html', publishedAt: '2026-09-11' },
    ] },
  },
]);

export async function buildOfficialSnapshot(previous = {}, { fetchImpl = fetch, now = new Date().toISOString(), sources = SOURCES, facts = REVIEWED_FACTS } = {}) {
  const previousArticles = Array.isArray(previous.articles) ? previous.articles : [];
  const merged = new Map(previousArticles.filter(item => officialUrl(item.url) && dateOnly(item.publishedAt)).map(item => [item.id, structuredClone(item)]));
  const reports = await Promise.all(sources.map(async source => {
    const old = previous.sources?.find(item => item.id === source.id);
    try {
      const html = await fetchOfficialIndex(source.url, { fetchImpl });
      const articles = parseOfficialIndex(html, source);
      const contentFingerprint = fingerprint(articles);
      return { articles, report: { ...source, status: 'ok', articleCount: articles.length, articleIds: articles.map(item => item.id), contentFingerprint, lastContentChangeAt: old?.contentFingerprint === contentFingerprint && old?.lastContentChangeAt ? old.lastContentChangeAt : now } };
    } catch (error) {
      const message = /HTTP \d{3}|exceeds|no recognized|did not return HTML/.test(error.message) ? error.message : 'Official source could not be fetched';
      return { articles: [], report: { ...source, ...(old || {}), status: 'error', articleCount: old?.articleCount || 0, error: message } };
    }
  }));
  for (const { articles } of reports) for (const item of articles) {
    const old = merged.get(item.id);
    const preferred = old && urlQuality(old.url) > urlQuality(item.url) ? old : item;
    merged.set(item.id, { ...preferred, sourceIds: [...new Set([...(old?.sourceIds || []), ...item.sourceIds])].sort() });
  }
  // Keep each source's latest good page even if another source keeps publishing while
  // it is unavailable. Remaining capacity is recent article history, not a fake feed.
  const protectedIds = new Set(reports.flatMap(item => item.report.articleIds || []));
  const ordered = [...merged.values()].sort(articleOrder);
  const protectedArticles = ordered.filter(item => protectedIds.has(item.id));
  const historicalArticles = ordered.filter(item => !protectedIds.has(item.id)).slice(0, Math.max(0, 240 - protectedArticles.length));
  const snapshot = { schemaVersion: 1, sources: reports.map(item => item.report), articles: [...protectedArticles, ...historicalArticles].sort(articleOrder), facts: structuredClone(facts) };
  const priorComparable = { schemaVersion: previous.schemaVersion, sources: previous.sources, articles: previous.articles, facts: previous.facts };
  const changed = JSON.stringify(snapshot) !== JSON.stringify(priorComparable);
  return { snapshot: { schemaVersion: snapshot.schemaVersion, updatedAt: changed ? now : previous.updatedAt, sources: snapshot.sources, articles: snapshot.articles, facts: snapshot.facts }, changed };
}

export async function syncOfficialUpdates({ output = resolve(ROOT, 'data/rivals-updates.json'), ...options } = {}) {
  let previous = {};
  try { previous = JSON.parse(await readFile(output, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const result = await buildOfficialSnapshot(previous, options);
  if (result.changed) {
    await mkdir(dirname(output), { recursive: true });
    const temporary = `${output}.tmp`;
    await writeFile(temporary, `${JSON.stringify(result.snapshot, null, 2)}\n`);
    await rename(temporary, output);
  }
  return { changed: result.changed, articles: result.snapshot.articles.length, facts: result.snapshot.facts.length, sources: result.snapshot.sources.map(({ id, status, articleCount, error }) => ({ id, status, articleCount, ...(error ? { error } : {}) })) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(await syncOfficialUpdates(), null, 2)); }
  catch (error) { console.error(`Official update snapshot was not changed: ${error.message}`); process.exitCode = 1; }
}
