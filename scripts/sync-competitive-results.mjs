import { readFile, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const ROOT = new URL('../', import.meta.url);
export const RESULT_SOURCES = [
  ['americas', 'Americas', 'NA'], ['emea', 'EMEA', 'EU'], ['china', 'China', 'China'],
  ['pacific', 'Pacific', 'Pacific'], ['pacific-asia', 'Pacific Asia', 'Asia'],
].map(([id, label, region]) => ({ id, label: `Ignite 2026 Stage 2 · ${label}`, region, url: `https://esportswatchguide.com/marvel-rivals/events/mr-ignite-2026-stage-2-${id}/` }));
const key = value => String(value ?? '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '');
const decode = value => String(value ?? '').replace(/&#(x[0-9a-f]+|\d+);/gi, (_, code) => String.fromCodePoint(code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code))).replace(/&(?:amp|quot|apos|lt|gt|nbsp);/g, entity => ({ '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>', '&nbsp;': ' ' })[entity]);
const strip = value => decode(String(value ?? '').replace(/<[^>]*>/g, '')).trim();
const safeUrl = value => { try { const url = new URL(decode(value)); return url.protocol === 'https:' ? url.href : null; } catch { return null; } };
const sourceAliases = { navi: 'navi', hypertune: 'hypertune', hyt: 'hypertune', rad: 'rad', tco: 'chosen_ones', dsb: 'disband', plsr: 'pulsar', pspac: 'planet_sainage_pac', shawrmaz: 'the_shawrmaz', bkl: 'biharkelonde', df: 'delicious_food', dma: 'dawn_mercy_accord', aconyx: 'aconyx', aimx: 'aimmiracle_x', ar: 'aura_rivals', mona: 'monarch', shat: 'straw_hats', equinoxgaming: 'equinox-gaming' };

export function resolveCompetitiveTeam(value, source, teams = []) {
  // EXG is a source abbreviation for Equinox in this particular event. It must
  // never merge with the older Cafe Rose / ExG organization in the map archive.
  const alias = source.id === 'americas' && key(value) === 'exg' ? 'equinox-gaming' : sourceAliases[key(value)];
  const team = alias ? teams.find(team => team.id === alias) : teams.find(team => [team.id, team.name, team.shortName, ...(team.aliases || [])].some(name => key(name) === key(value)));
  return team ? { id: team.id, name: team.name } : { id: alias || String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-'), name: alias === 'equinox-gaming' ? 'Equinox Gaming' : value };
}

function rowsInSection(html, name) {
  const section = html.match(new RegExp(`id="${name}"[^>]*>([\\s\\S]*?)<\\/section>`))?.[1];
  if (!section) return [];
  return [...section.matchAll(/<div class="mr(?: [^"]*)?"[\s\S]*?(?=<div class="m[rd](?: [^"]*)?"|$)/g)].map(match => match[0]);
}

export function parseCompetitivePage(html, source, { teams = [], maps = [], now = new Date().toISOString() } = {}) {
  if (!/<h1\b[\s\S]*?Ignite 2026 Stage 2/i.test(html) || !html.includes('id="results"')) throw new Error(`${source.id}: results page contract changed`);
  const series = []; const rejected = [];
  const parseRow = (block, status) => {
    if (status === 'completed' && /^<div class="mr [^"]*\blive\b/.test(block)) status = 'scheduled';
    const timestamp = Number(block.match(/\bdata-ts="(\d+)"/)?.[1]);
    const scheduledAt = Number.isFinite(timestamp) && timestamp > 0 ? new Date(timestamp * 1000).toISOString() : null;
    if (!scheduledAt || scheduledAt < '2026-09-01' || scheduledAt > '2026-10-20') return;
    if (status === 'completed' && scheduledAt > now) { rejected.push('future completed result'); return; }
    // The source retains obsolete placeholder schedule rows; never display them
    // as live fixtures. Past unresolved fixtures are not guessed to be results.
    const labels = [...block.matchAll(/<span class="t[12][^"]*">[\s\S]*?<span>([^<]+)<\/span>/g)].slice(0, 2).map(match => strip(match[1]));
    if (labels.length !== 2 || labels.every(name => name === 'TBD')) { rejected.push('missing named competitors'); return; }
    if (status === 'scheduled' && scheduledAt < now) {
      if (labels.includes('TBD') || Date.parse(now) - Date.parse(scheduledAt) > 6 * 60 * 60 * 1000) return;
      status = 'awaiting-result';
    }
    const [teamA, teamB] = labels.map(name => resolveCompetitiveTeam(name, source, teams));
    if (teamA.id === teamB.id) { rejected.push('identical competitors'); return; }
    const scoreBlock = block.match(/<span class="sc">([\s\S]*?)<\/span>/)?.[1] || '';
    const scores = [...scoreBlock.matchAll(/<b[^>]*>(\d+)<\/b>/g)].map(match => Number(match[1]));
    if (status === 'completed' && (scores.length !== 2 || scores[0] === scores[1] || Math.max(...scores) > 4 || Math.max(...scores) < 2 || labels.includes('TBD'))) { rejected.push('invalid completed score'); return; }
    const [scoreA, scoreB] = status === 'completed' ? scores : [null, null];
    const bestOf = status === 'completed' ? Math.max(scoreA, scoreB) * 2 - 1 : Number(scoreBlock.match(/Bo(\d+)/)?.[1]) || null;
    const mapRows = [...block.matchAll(/<div class="mgh"><span>([\s\S]*?)<\/span><span class="mgs">([\s\S]*?)<\/span>/g)].map(([_, name, score]) => {
      const publishedName = strip(name).replace(/^Game \d+\s*·\s*/, '');
      const mapKey = key(publishedName).replace('yggdrasilpath', 'yggdrasillpath');
      const map = maps.find(map => key(map.name) === mapKey);
      const scores = [...score.matchAll(/<b class="([^"]*)">(\d+)<\/b>/g)].map(match => ({ won: match[1].split(' ').includes('w'), score: Number(match[2]) }));
      if (scores.length !== 2) return null;
      const winner = scores[0].won !== scores[1].won ? scores[0].won ? teamA.name : teamB.name : null;
      if (scores.every(value => value.score === 0) && !winner) return null;
      return { name: map?.name || publishedName, mapId: map?.id || null, scoreA: scores[0].score, scoreB: scores[1].score, winner };
    }).filter(Boolean);
    let stage = scheduledAt < '2026-10-15' ? 'Group stage' : 'Playoffs';
    let event = source.label;
    if (source.id === 'pacific') { stage = scheduledAt >= '2026-10-08' ? 'Playoffs' : scheduledAt < '2026-09-21' ? 'Oceania regional' : 'Asia regional'; event = 'Ignite 2026 Stage 2 · Pacific'; }
    if (source.id === 'pacific-asia') { stage = 'Asia regional'; event = 'Ignite 2026 Stage 2 · Pacific'; }
    const id = createHash('sha256').update([event, scheduledAt, ...[teamA.id, teamB.id].sort()].join('|')).digest('hex').slice(0, 18);
    series.push({ id: `ignite26-${id}`, date: scheduledAt.slice(0, 10), scheduledAt, teamA: teamA.name, teamB: teamB.name, teamAId: teamA.id, teamBId: teamB.id, scoreA, scoreB, winner: status === 'completed' ? scoreA > scoreB ? teamA.name : teamB.name : null, status, bestOf, event, region: source.region, stage, sourceUrl: `${source.url}#${status === 'completed' ? 'results' : 'schedule'}`, sourceId: source.id, vodUrl: safeUrl(block.match(/href="(https:\/\/(?:youtu\.be|www\.youtube\.com)[^"]+)"/)?.[1]), maps: mapRows, breakdownComplete: status === 'completed' && mapRows.length === scoreA + scoreB && mapRows.every(map => map.winner) });
  };
  rowsInSection(html, 'results').forEach(block => parseRow(block, 'completed'));
  rowsInSection(html, 'schedule').forEach(block => parseRow(block, 'scheduled'));
  if (!series.some(match => match.status === 'completed')) throw new Error(`${source.id}: no valid completed results; keeping last good source`);
  return { series, rejected };
}

export function deduplicateSeries(series) {
  const groups = new Map();
  for (const row of series) {
    const id = [row.event, row.scheduledAt, ...[row.teamAId, row.teamBId].sort()].join('|');
    const previous = groups.get(id);
    if (previous && previous.status === 'completed' && row.status === 'completed') {
      const scoreFor = (match, team) => match.teamAId === team ? match.scoreA : match.scoreB;
      if (scoreFor(previous, row.teamAId) !== row.scoreA || scoreFor(previous, row.teamBId) !== row.scoreB) throw new Error(`Conflicting published result for ${id}`);
    }
    if (!previous || previous.status !== 'completed' && row.status === 'completed' || row.status === previous.status && row.maps.length > previous.maps.length) groups.set(id, row);
  }
  return [...groups.values()].sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt) || a.id.localeCompare(b.id));
}

async function fetchPage(url, fetchImpl) {
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(20_000), headers: { Accept: 'text/html', 'User-Agent': 'LuciferFPS-CompetitiveResults/1.0' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (Number(response.headers.get('content-length')) > 2_000_000) throw new Error('Source response too large');
  const chunks = []; let bytes = 0;
  for await (const chunk of response.body) { bytes += chunk.byteLength; if (bytes > 2_000_000) throw new Error('Source response too large'); chunks.push(chunk); }
  return Buffer.concat(chunks).toString('utf8');
}

export async function syncCompetitiveResults({ fetchImpl = fetch, now = new Date().toISOString(), root = ROOT } = {}) {
  const target = new URL('data/competitive-results.json', root);
  const previous = await readFile(target, 'utf8').then(JSON.parse).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
  const catalog = JSON.parse(await readFile(new URL('data/siteData.json', root), 'utf8'));
  const results = await Promise.allSettled(RESULT_SOURCES.map(async source => {
    const result = parseCompetitivePage(await fetchPage(source.url, fetchImpl), source, { teams: catalog.teams, maps: catalog.maps, now });
    const previousRows = previous?.sourceSnapshots?.[source.id] || previous?.series?.filter(row => row.sourceId === source.id) || [];
    if (result.series.filter(row => row.status === 'completed').length < previousRows.filter(row => row.status === 'completed').length) throw new Error('Completed result count shrank; review source before replacing history');
    return { source, ...result };
  }));
  const sources = []; const all = []; const failures = []; const sourceSnapshots = {};
  results.forEach((result, index) => {
    const source = RESULT_SOURCES[index];
    if (result.status === 'fulfilled') {
      all.push(...result.value.series);
      sourceSnapshots[source.id] = deduplicateSeries(result.value.series);
      sources.push({ ...source, state: 'ok', rejectedRows: result.value.rejected.length });
    } else {
      failures.push(`${source.id}: ${result.reason.message}`);
      const oldRows = (previous?.sourceSnapshots?.[source.id] || (previous?.series || []).filter(row => row.sourceId === source.id)).filter(row => row.status === 'completed' || row.scheduledAt >= now || row.status === 'awaiting-result' && Date.parse(now) - Date.parse(row.scheduledAt) <= 6 * 60 * 60 * 1000);
      all.push(...oldRows);
      sourceSnapshots[source.id] = oldRows;
      sources.push({ ...source, state: oldRows.length ? 'last-good' : 'unavailable', error: result.reason.message });
    }
  });
  const series = deduplicateSeries(all);
  if (!series.some(row => row.status === 'completed')) throw new Error('No verified competitive results available; refusing empty snapshot');
  const completed = series.filter(row => row.status === 'completed');
  const coverage = { event: 'Marvel Rivals Ignite 2026 Stage 2', completedSeries: completed.length, scheduledSeries: series.filter(row => row.status === 'scheduled').length, awaitingResultSeries: series.filter(row => row.status === 'awaiting-result').length, teams: new Set(series.flatMap(row => [row.teamAId, row.teamBId]).filter(id => id !== 'tbd')).size, mapResults: completed.reduce((sum, row) => sum + row.maps.length, 0), throughDate: completed[0]?.date || null, scope: 'Published series results and available map scores only. This does not refresh player scoreboards, rosters, hero picks, bans or ranked statistics.', attribution: 'Match facts: Esports Watch Guide / Liquipedia, CC BY-SA 3.0. Structured and deduplicated by Lucifer.fps.', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/' };
  const next = { schemaVersion: 1, updatedAt: now, checkedAt: now, latestResultAt: completed[0]?.scheduledAt || null, coverage, sources, corroboration: previous?.corroboration || [], sourceSnapshots, series };
  if (previous && JSON.stringify({ ...next, updatedAt: '', checkedAt: '' }) === JSON.stringify({ ...previous, updatedAt: '', checkedAt: '' })) { console.log(`Competitive results checked: ${completed.length} completed series; unchanged.`); return { changed: false, data: previous, failures }; }
  const temporary = new URL('data/competitive-results.json.tmp', root);
  await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`);
  await rename(temporary, target);
  console.log(`Competitive results saved: ${completed.length} completed series, ${coverage.scheduledSeries} scheduled, through ${coverage.throughDate}.`);
  failures.forEach(failure => console.warn(`Retained last good data: ${failure}`));
  return { changed: true, data: next, failures };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) syncCompetitiveResults().catch(error => { console.error(error.message); process.exitCode = 1; });
