import { readFile, writeFile, rename, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { canonicalHeroName } from '../src/lib/hero-identity.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const DEFAULT_API = 'https://api.arianwever.com/';
export const DEFAULT_REFERENCE = 'https://arianwever.com/';
export const FEEDS = Object.freeze({
  dashboard: 'dashboard-payload.php?projection=home-v1',
  directory: 'directory.php',
  matchIndex: 'public-stats-v2.php?kind=matches&compact=1',
  summary: 'public-detail-stats.php?kind=summary',
  kits: 'public-hero-kits.php',
  patches: 'public-patches.php',
  streams: 'player-meta.php?kind=twitch-live',
  streamDirectory: 'player-meta.php?kind=live-directory',
  teamupDefinitions: 'public-teamup-icons.php',
});
export const slug = value => String(value ?? '').normalize('NFKD').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const text = value => String(value ?? '').trim();
const numeric = value => value === '' || value === null || value === undefined || !Number.isFinite(Number(value)) ? null : Number(value);
export const canonicalHero = (name, knownHeroes = []) => canonicalHeroName(name, knownHeroes);
const array = value => Array.isArray(value) ? value : [];
const sort = items => items.sort((a, b) => text(a.id || a.name).localeCompare(text(b.id || b.name), 'en'));
const safeUrl = (value, base = DEFAULT_REFERENCE) => {
  if (!value) return null;
  try { const url = new URL(value, base); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; } catch { return null; }
};

// Parse only literal factual records. Remote JavaScript is never evaluated.
export function parseCatalog(heroScript, manifestScript, mapScript, reference = DEFAULT_REFERENCE) {
  const heroes = [];
  const heroList = heroScript.match(/HEROES\s*=\s*\[([\s\S]*?)\]\s*[,;]/)?.[1];
  if (!heroList) throw new Error('Reference hero catalog changed: HEROES array not found');
  for (const block of heroList.matchAll(/\{([^{}]*)\}/g)) {
    const field = name => block[1].match(new RegExp(`${name}:\\s*"([^"\\n]*)"`))?.[1];
    const name = field('name'), role = field('role'), file = field('file');
    if (!name || !['Vanguard', 'Duelist', 'Strategist'].includes(role)) continue;
    heroes.push({ name, role, image: safeUrl(`Graphics/Character Icons/${file}`, reference), baseName: field('bio') || name, variant: /variant:\s*!0/.test(block[1]) });
  }
  const assets = {};
  for (const section of ['heroes', 'maps', 'hero_thumbnails', 'home_full_art']) {
    const body = manifestScript.match(new RegExp(`(?:^|[,{\\s])${section}:\\s*\\{([\\s\\S]*?)\\n\\s*\\}`))?.[1] || '';
    assets[section] = Object.fromEntries([...body.matchAll(/(?:"([^"\n]+)"|([a-zA-Z_][\w]*)):\s*"([^"\n]+)"/g)].map(match => [slug(match[1] || match[2]), safeUrl(match[3], reference)]));
  }
  const maps = [];
  const mapList = mapScript.match(/var maps\s*=\s*\[([\s\S]*?)\];/)?.[1] || '';
  for (const block of mapList.matchAll(/\{([^{}]*)\}/g)) {
    const name = block[1].match(/display:\s*"([^"\n]+)"/)?.[1];
    const asset = block[1].match(/asset:\s*"([^"\n]+)"/)?.[1];
    if (name) maps.push({ id: slug(name), name, image: assets.maps[slug(asset)] || null });
  }
  if (heroes.length < 30 || maps.length < 5) throw new Error('Reference catalog unexpectedly incomplete; keeping previous data');
  return { heroes, maps, assets };
}

export async function fetchText(url, { fetchImpl = fetch, attempts = 3, timeoutMs = 25_000, maxBytes = 12_000_000 } = {}) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs), headers: { Accept: 'application/json,text/html,text/javascript', 'User-Agent': 'LuciferFPS-PublicDataSync/1.0' }, credentials: 'omit', redirect: 'error' });
      if (!response.ok) {
        const error = new Error(`Upstream returned HTTP ${response.status}`);
        error.retryable = [429, 500, 502, 503, 504].includes(response.status);
        throw error;
      }
      const contentLength = Number(response.headers.get('content-length'));
      if (contentLength > maxBytes) throw Object.assign(new Error('Upstream response exceeds size limit'), { retryable: false });
      // Read incrementally, so a missing Content-Length cannot cause an unbounded allocation.
      const chunks = []; let length = 0;
      for await (const chunk of response.body) {
        length += chunk.byteLength;
        if (length > maxBytes) throw Object.assign(new Error('Upstream response exceeds size limit'), { retryable: false });
        chunks.push(chunk);
      }
      return Buffer.concat(chunks).toString('utf8');
    } catch (error) {
      lastError = error;
      if (error.retryable === false || attempt === attempts - 1) break;
      await new Promise(done => setTimeout(done, 400 * 2 ** attempt));
    }
  }
  throw lastError;
}

async function getCatalog(reference, options) {
  const [home, heroes] = await Promise.all([fetchText(new URL('home', reference), options), fetchText(new URL('heroes', reference), options)]);
  const script = (html, pattern) => {
    const paths = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/g)].map(match => match[1]);
    const path = paths.find(value => pattern.test(value));
    if (!path) throw new Error('Reference public catalog script not found');
    const url = new URL(path, reference);
    if (url.origin !== new URL(reference).origin) throw new Error('Unexpected catalog origin');
    return url;
  };
  const [heroScript, manifest, mapScript] = await Promise.all([
    fetchText(script(heroes, /^heroes\./), options),
    fetchText(script(home, /^data\/asset-manifest\./), options),
    fetchText(script(home, /^sheet-config\./), options),
  ]);
  return parseCatalog(heroScript, manifest, mapScript, reference);
}

function checkFeed(name, value) {
  if (!value || typeof value !== 'object' || value.ok === false) throw new Error(`Invalid ${name} feed`);
  const required = { dashboard: 'raw', directory: 'teams', matchIndex: 'rows', summary: 'matches', patches: 'patches' };
  if (required[name] && (!Array.isArray(value[required[name]]) || value[required[name]].length === 0)) throw new Error(`Empty or invalid ${name} feed; refusing to overwrite last good data`);
  if (name === 'kits' && (!value.heroes || Object.keys(value.heroes).length < 20)) throw new Error('Hero kits are unexpectedly incomplete');
  if (name === 'teamupDefinitions' && (!Array.isArray(value.icons) || !value.icons.length)) throw new Error('Public team-up definitions are unexpectedly incomplete');
  return value;
}

function summarizeStats(stats) {
  const facts = array(stats).filter(stat => ['damage', 'cooldown', 'healing amount', 'maximum distance', 'energy cost', 'duration'].includes(text(stat.label).toLowerCase())).slice(0, 3);
  return facts.map(stat => `${stat.label}: ${stat.value}`).join(' · ') || 'Inspect the published ability statistics and linked source.';
}

export function summarizePatch(value) {
  // Balance changes are plain factual records; omit publisher jokes and closing commentary.
  // Keep the mechanic, direction, units and from/to figures together.
  const cleaned = text(value).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ');
  const sentences = cleaned.split(/(?<=[.!?])\s+(?=[A-Z])/);
  const facts = [];
  for (const sentence of sentences) {
    if (/^(?:Now |So |Who |Looks like |Time to |No more |Talk about |Enjoy |Happy |Good luck)/i.test(sentence)) continue;
    if (facts.length && !/(?:increase|reduc|damage|healing|cooldown|duration|health|shield|range|speed|ability|attack|fix|remove|energy|target|charge|effect|immune|immunity|stun|slow)/i.test(sentence)) continue;
    facts.push(sentence);
    if (facts.join(' ').length > 600) break;
  }
  return (facts.join(' ') || sentences[0] || 'See source patch.').replace(/\b(?:Significantly|Drastically|absurdly)\s+/gi, '').slice(0, 1000);
}

export function normalizeData(feeds, catalog, { now = new Date().toISOString(), reference = DEFAULT_REFERENCE, api = DEFAULT_API } = {}) {
  for (const [name, feed] of Object.entries(feeds)) checkFeed(name, feed);
  const { directory, dashboard, summary, matchIndex, kits, patches } = feeds;
  const resolveHero = value => canonicalHero(value, catalog.heroes);
  const personKey = value => text(value).normalize('NFKC').toLocaleLowerCase('en-US');
  const directoryNames = new Map();
  array(directory.players).forEach(person => { const key = personKey(person.name); directoryNames.set(key, directoryNames.has(key) ? null : person.name); });
  const canonicalPerson = value => directoryNames.get(personKey(value)) || text(value);
  const teams = sort(array(directory.teams).map(team => ({
    id: team.key || slug(team.name), name: team.name, shortName: team.short || team.name, logo: safeUrl(team.logo, reference), region: team.region || 'Unreported',
    aliases: array(team.aliases), roster: array(team.players).map(person => ({ name: canonicalPerson(person.name), image: safeUrl(person.icon, reference), region: person.region || team.region || 'Unreported' })),
    rosterHistory: array(team.roster_history).map(history => ({ ...history, players: array(history.players).map(person => ({ name: canonicalPerson(person.name), image: safeUrl(person.icon, reference) })) })),
    rosterSince: team.roster_since || null, rosterSeason: team.roster_season || null,
    links: Object.fromEntries(Object.entries(team.links || {}).map(([key, value]) => [key, safeUrl(value)]).filter(([, value]) => value)), stats: {},
  })));
  const teamByLabel = new Map();
  teams.forEach(team => [team.name, team.shortName, team.id, ...team.aliases].forEach(label => teamByLabel.set(slug(label), team)));
  const findTeam = label => teamByLabel.get(slug(label));
  const headers = dashboard.raw_fields;
  if (!Array.isArray(headers) || !headers.includes('ReplayID') || !headers.includes('Player')) throw new Error('Raw stat field contract changed');
  const rawRows = dashboard.raw.map(row => Object.fromEntries(headers.map((field, index) => [field, row[index]])));
  const rawByCode = new Map();
  rawRows.forEach(row => { const code = text(row.ReplayID); if (!rawByCode.has(code)) rawByCode.set(code, []); rawByCode.get(code).push(row); });
  const indexByCode = new Map();
  array(matchIndex.rows).forEach(row => { if (!indexByCode.has(text(row.code))) indexByCode.set(text(row.code), row); });
  const normalizedRows = rawRows.map(row => ({
    name: canonicalPerson(row.Player), sourceName: text(row.Player), team: findTeam(row.Team)?.name || text(row.Team), hero: text(row['Hero Played']) === 'Deadpool' ? ({ Vanguard: 'Tankpool', Duelist: 'Duelpool', Strategist: 'Healpool' }[text(row.Role)] || 'Deadpool') : resolveHero(text(row['Hero Played'])), role: text(row.Role) || 'Unreported',
    kills: numeric(row.Kills), deaths: numeric(row.Deaths), assists: numeric(row.Assists), finalHits: numeric(row['Final Hits']), damage: numeric(row.Damage), damageBlocked: numeric(row['Damage Blocked']), healing: numeric(row.Healing), accuracy: numeric(row.Accuracy), result: text(row.Result).toLowerCase(), code: text(row.ReplayID), detailedHeroes: row['Detailed Heroes'] || null,
  }));
  const rowsByCode = Map.groupBy ? Map.groupBy(normalizedRows, row => row.code) : normalizedRows.reduce((map, row) => map.set(row.code, [...(map.get(row.code) || []), row]), new Map());
  const matches = array(summary.matches).filter(match => !match.quarantined).map(match => {
    const id = text(match.code), index = indexByCode.get(id) || {}, teamA = findTeam(match.team_a), teamB = findTeam(match.team_b);
    const winner = match.result_redacted ? null : match.winner_side === 'A' ? match.team_a : match.winner_side === 'B' ? match.team_b : null;
    const rows = rowsByCode.get(id) || rowsByCode.get(text(match.replay_code)) || [];
    // Preserve public pseudonyms/redactions. Do not use an exposed auxiliary replay field to undo them.
    const replayCode = id.startsWith('public-') || match.result_redacted ? null : text(match.replay_code || id);
    // Source A/B draft roles often differ from the displayed match team order.
    const teamADraftSide = match.team_a_draft_role || match.team_a_draft_side || null;
    const teamBDraftSide = match.team_b_draft_role || match.team_b_draft_side || null;
    const draftTeam = side => side === teamADraftSide ? teamA?.name || match.team_a : side === teamBDraftSide ? teamB?.name || match.team_b : null;
    const bans = Object.entries(match.bans || {}).flatMap(([side, actions]) => array(actions).map(action => ({ hero: resolveHero(action.hero), team: draftTeam(side), side, type: action.type || 'ban', slot: action.slot, variant: action.variant || null })));
    const players = rows.length ? rows.map(({ code, ...row }) => row) : ['a', 'b'].flatMap(side => array(match[`players_${side}`]).map(person => ({ name: canonicalPerson(person.player), sourceName: person.player, team: side === 'a' ? match.team_a : match.team_b, hero: null, role: 'Unreported', kills: null, deaths: null, assists: null, damage: null, healing: null })));
    return {
      id, date: match.match_date || index.played_date, playedTime: match.played_time || null,
      teamA: teamA?.name || match.team_a, teamB: teamB?.name || match.team_b, teamAId: teamA?.id || slug(match.team_a), teamBId: teamB?.id || slug(match.team_b),
      scoreA: match.result_redacted ? null : numeric(match.score_a), scoreB: match.result_redacted ? null : numeric(match.score_b), scoreOrder: match.score_order || 'unreported', winner: findTeam(winner)?.name || winner,
      map: index.map || match.map_raw || 'Unreported', mode: index.mode || 'Unreported', season: index.season || match.season || 'Unreported', region: teamA?.region || teamB?.region || 'Unreported',
      source: match.source || index.source || 'public', matchType: match.match_type || 'Unreported', replayCode, duration: numeric(match.duration_s), players, bans,
      draft: { complete: Boolean(match.draft_complete), format: match.draft_format || null, label: match.draft_format_label || null, redacted: Boolean(match.draft_redacted), actionsPerSide: match.draft_actions_per_side || null, sideModel: match.draft_side_model || null, teamASide: teamADraftSide, teamBSide: teamBDraftSide },
      seriesId: match.series_key || null, seriesOrder: numeric(match.series_order), redacted: Boolean(match.redacted_tlc || match.result_redacted),
    };
  }).sort((a, b) => b.date.localeCompare(a.date) || (b.playedTime || '').localeCompare(a.playedTime || '') || a.id.localeCompare(b.id));
  const changesFor = patch => array(patch.sections).flatMap(section => array(section.changes).map((change, index) => ({
    id: `${slug(section.label)}-${index}`, hero: section.hero || null, section: section.label, scope: section.scope, type: change.tag || 'neutral',
    text: summarizePatch(change.text),
    facts: [...text(change.text).matchAll(/(?:\d+(?:\.\d+)?(?:\s?(?:%|m\/s|s|m|HP))?)/g)].map(value => value[0]).slice(0, 20),
  })));
  const patchRecords = array(patches.patches).map(patch => ({ id: patch.patch || patch.date, date: patch.date, title: patch.title, url: safeUrl(patch.officialUrl || patches.officialIndexUrl), urlIsIndex: !patch.officialUrl, highlights: array(patch.highlights), source: patch.source || patches.source, changes: changesFor(patch) })).sort((a, b) => b.date.localeCompare(a.date));
  const heroRecords = catalog.heroes.map(hero => {
    const name = hero.baseName || hero.name, heroRows = normalizedRows.filter(row => row.hero === hero.name || row.hero === name), games = heroRows.length;
    const wins = heroRows.filter(row => row.result === 'win').length;
    const sourceVariant = { Tankpool: '0', Duelpool: '1', Healpool: '2' }[hero.name];
    const baseStatVariants = array(kits.baseStatVariants?.[name]).filter(variant => sourceVariant === undefined || variant.sourceVariant === sourceVariant);
    const stats = { ...kits.baseStats?.[name], ...(sourceVariant !== undefined ? baseStatVariants[0]?.stats : {}), appearances: games, wins, winRate: games ? wins / games * 100 : null, sample: 'recorded player appearances; not global ranked' };
    const abilities = array(kits.heroes?.[hero.name] || kits.heroes?.[name]).filter(ability => sourceVariant === undefined || !array(ability.sourceVariants).length || ability.sourceVariants.includes(sourceVariant)).map((ability, index) => ({ id: `${slug(hero.name)}-${slug(ability.name)}-${index}`, name: ability.name, key: ability.key, type: ability.type, description: summarizeStats(ability.stats), stats: array(ability.stats), sourceVariants: ability.sourceVariants || null, teamupIcon: safeUrl(ability.teamupIcon), patchEffects: array(ability.patchEffects).map(effect => ({ patch: effect.patch, type: effect.tag, url: safeUrl(effect.sourceUrl) })) }));
    return { id: slug(hero.name), name: hero.name, role: hero.role, image: hero.image, thumbnail: catalog.assets.hero_thumbnails?.[slug(name)] || null, art: catalog.assets.home_full_art?.[slug(name)] || null, baseName: name, variant: hero.variant, description: `${hero.role} · ${abilities.length} published ability records.`, stats, baseStatVariants, abilities, forms: kits.forms?.[hero.name] || kits.forms?.[name] || null,
      balanceHistory: patchRecords.filter(patch => patch.changes.some(change => change.hero === name)).map(patch => ({ id: patch.id, date: patch.date, title: patch.title, url: patch.url, changes: patch.changes.filter(change => change.hero === name) })), sourceUrl: 'https://www.marvelrivals.com/heroes/' };
  });
  const maps = catalog.maps.map(map => { const mapMatches = matches.filter(match => slug(match.map) === map.id); return { ...map, mode: [...new Set(mapMatches.map(match => match.mode))].join(' / ') || 'Unreported', stats: { matches: mapMatches.length } }; });
  teams.forEach(team => { const played = matches.filter(match => match.teamAId === team.id || match.teamBId === team.id), decided = played.filter(match => match.winner); team.stats = { matches: played.length, wins: played.filter(match => match.winner === team.name).length, winRate: decided.length ? decided.filter(match => match.winner === team.name).length / decided.length * 100 : null }; });
  const playerNames = [...new Set([...array(directory.players).map(person => person.name), ...normalizedRows.map(row => row.name)])];
  const players = sort(playerNames.map(name => {
    const person = array(directory.players).find(person => person.name === name) || {}, team = teams.find(team => team.roster.some(person => person.name === name)), rows = normalizedRows.filter(row => row.name === name), games = rows.length;
    const sum = key => rows.reduce((total, row) => total + (row[key] || 0), 0), roles = rows.map(row => row.role).filter(role => role !== 'Unreported');
    return { id: `${slug(name) || 'player'}-${createHash('sha256').update(name).digest('hex').slice(0, 8)}`, name, aliases: [...new Set(rows.map(row => row.sourceName))].filter(alias => alias !== name), team: team?.name || null, teamId: team?.id || null, role: roles.length ? [...roles].sort((a, b) => roles.filter(role => role === b).length - roles.filter(role => role === a).length)[0] : 'Unreported', region: person.region || team?.region || 'Unreported', image: safeUrl(person.icon, reference), stats: { appearances: games, kills: sum('kills'), deaths: sum('deaths'), assists: sum('assists'), damage: sum('damage'), healing: sum('healing'), damageBlocked: sum('damageBlocked'), wins: rows.filter(row => row.result === 'win').length, winRate: games ? rows.filter(row => row.result === 'win').length / games * 100 : null }, heroes: [...new Set(rows.map(row => row.hero))].filter(Boolean) };
  }));
  const staff = sort(array(directory.staff).map(person => ({ id: `${slug(person.name) || 'staff'}-${createHash('sha256').update(person.name).digest('hex').slice(0, 8)}`, name: person.name, image: safeUrl(person.icon, reference), region: person.region || 'Unreported', role: 'Staff' })));
  const teamUps = sort(array(feeds.teamupDefinitions?.icons).map(item => ({ id: `${slug(item.name)}-${slug(item.hero)}-${slug(item.partner)}`, name: item.name, hero: resolveHero(item.hero), partner: resolveHero(item.partner), image: safeUrl(item.url), source: 'Published official-hero metadata via Weverboard public-teamup-icons' })));
  const teamUpSummary = array(summary.teamup_summary).map(row => ({ team: findTeam(row.team)?.name || row.team, maps: numeric(row.maps), wins: numeric(row.wins), losses: numeric(row.losses), winRate: numeric(row.pct), sample: 'Source aggregate; does not identify individual team-up selections or follow client filters.' }));
  const streamProfiles = feeds.streamDirectory?.profiles || {};
  const streams = Object.entries(feeds.streams || {}).filter(([, stream]) => stream && typeof stream === 'object' && stream.live).map(([channel, stream]) => {
    const profile = array(streamProfiles).find(profile => profile.channel === channel);
    const role = profile?.role ? profile.role.slice(0, 1).toUpperCase() + profile.role.slice(1).toLowerCase() : 'Unreported';
    return { id: channel, channel, name: stream.name || channel, url: `https://www.twitch.tv/${encodeURIComponent(channel)}`, live: true, game: stream.game, title: stream.title, viewers: numeric(stream.viewers), startedAt: stream.started_at, thumbnail: safeUrl(stream.thumbnail), team: stream.team || profile?.team || null, role, nationality: profile?.nationality || null, capturedAt: now };
  });
  const result = {
    meta: { schemaVersion: 1, name: 'Lucifer.fps', syncedAt: now, source: reference, publicOnly: true, attribution: ['Public match and directory data: Weverboard / Arian Wever.', kits.attribution, patches.attribution].filter(Boolean), dataLicense: kits.license || 'See source terms', sample: 'Public competitive matches available from the reference; not a global ranked population.', timeZone: 'Source match times have no declared timezone.', counts: { matches: matches.length, playerAppearances: normalizedRows.length, heroes: heroRecords.length, teams: teams.length, players: players.length, staff: staff.length, patches: patchRecords.length }, limitations: ['Restricted or redacted source fields remain unavailable.', 'Scores may be published in high-low order; winners use the explicit source result.', 'Patch changes retain factual mechanics; full publisher articles are linked.', 'Stream status is a snapshot at the last successful sync.'], sources: Object.entries(FEEDS).map(([id, path]) => ({ id, url: new URL(path, api).href })) },
    heroes: sort(heroRecords), maps: sort(maps), matches, teams, players, staff, teamUps, teamUpSummary, patches: patchRecords, streams,
    streamDirectory: streamProfiles,
  };
  validateData(result);
  return result;
}

export function validateData(data) {
  if (data?.meta?.schemaVersion !== 1) throw new Error('Unsupported site data schema');
  for (const key of ['heroes', 'maps', 'matches', 'teams', 'players', 'patches', 'streams']) {
    if (!Array.isArray(data[key])) throw new Error(`Missing ${key} collection`);
    if (key !== 'streams' && !data[key].length) throw new Error(`Refusing empty ${key} collection`);
    const ids = data[key].map(row => row.id);
    if (ids.some(id => !id) || new Set(ids).size !== ids.length) throw new Error(`Duplicate or missing ${key} ID`);
  }
  if (data.heroes.some(hero => !['Vanguard', 'Duelist', 'Strategist'].includes(hero.role))) throw new Error('Invalid hero role');
  for (const key of ['staff', 'teamUps']) if (data[key] !== undefined) {
    if (!Array.isArray(data[key]) || new Set(data[key].map(item => item.id)).size !== data[key].length || data[key].some(item => !item.id)) throw new Error(`Invalid ${key} collection`);
  }
  if (data.matches.some(match => !/^\d{4}-\d{2}-\d{2}$/.test(match.date) || !match.teamA || !match.teamB)) throw new Error('Invalid match record');
  return true;
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  return value;
}
export function contentHash(data) {
  const value = structuredClone(data);
  delete value.meta.syncedAt;
  for (const stream of value.streams || []) delete stream.capturedAt;
  return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

export async function atomicUpdate(path, next, { minimumRatio = 0.8 } = {}) {
  validateData(next);
  let previous;
  try { previous = JSON.parse(await readFile(path, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (previous) {
    validateData(previous);
    for (const key of ['heroes', 'matches', 'teams', 'players', 'staff', 'teamUps']) {
      if ((next[key]?.length || 0) < (previous[key]?.length || 0) * minimumRatio) throw new Error(`${key} shrank by more than ${Math.round((1 - minimumRatio) * 100)}%; inspect upstream before approving a reset`);
    }
    if (contentHash(previous) === contentHash(next)) return { changed: false, data: previous };
  }
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  try { await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, { flag: 'wx' }); await rename(temporary, path); } finally { await rm(temporary, { force: true }); }
  return { changed: true, data: next };
}

export async function sync({ output = resolve(ROOT, 'data/siteData.json'), reference = process.env.REFERENCE_SITE_URL || DEFAULT_REFERENCE, api = process.env.SOURCE_API_URL || DEFAULT_API, fetchImpl = fetch, now = new Date().toISOString(), catalog: providedCatalog, feeds: providedFeeds } = {}) {
  const options = { fetchImpl };
  const feeds = providedFeeds || {};
  if (!providedFeeds) {
    // Sequential public API reads avoid overloading a community-maintained service.
    for (const [name, path] of Object.entries(FEEDS)) {
      try {
        const response = await fetchText(new URL(path, api), options);
        feeds[name] = checkFeed(name, JSON.parse(response));
      } catch (error) { throw new Error(`${name} feed failed: ${error.message}`); }
    }
  }
  const catalog = providedCatalog || await getCatalog(reference, options);
  const normalized = normalizeData(feeds, catalog, { now, reference, api });
  return atomicUpdate(output, normalized);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await sync();
    console.log(result.changed ? `Updated public data: ${result.data.matches.length} matches, ${result.data.heroes.length} hero records.` : 'Public data unchanged; no file written.');
  } catch (error) {
    console.error(`Data sync failed; the last good snapshot remains unchanged. ${error.message}`);
    process.exitCode = 1;
  }
}
