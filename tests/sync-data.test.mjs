import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { atomicUpdate, canonicalHero, contentHash, fetchText, normalizeData, parseCatalog, summarizePatch, sync, validateData } from '../scripts/sync-data.mjs';
import { canonicalHeroName, heroLookupIndex } from '../src/lib/hero-identity.js';
import { applyOfficialCatalog, parseGorrCooldownConflict, parseOfficialMaps, syncOfficialCatalog } from '../scripts/official-catalog.mjs';

function fixture() {
  const feeds = {
    directory: { ok: true, teams: [{ key: 'alpha', name: 'Alpha', short: 'A', region: 'NA', players: [{ name: 'Player One' }] }, { key: 'beta', name: 'Beta', short: 'B', region: 'EU', players: [{ name: 'Player Two' }] }], players: [{ name: 'Player One' }, { name: 'Player Two' }] },
    dashboard: { ok: true, raw_fields: ['Team', 'Opponent', 'Hero Played', 'Player', 'Kills', 'Deaths', 'Assists', 'ReplayID', 'Role', 'Result'], raw: [['A', 'B', 'Hulk', 'Player One', 12, 3, 5, '12345', 'Vanguard', 'Win']] },
    matchIndex: { ok: true, rows: [{ code: '12345', played_date: '2026-09-27', map: 'Example Map', mode: 'Convoy', season: 'S10.0' }] },
    summary: { ok: true, matches: [{ code: '12345', replay_code: '12345', match_date: '2026-09-27', team_a: 'Alpha', team_b: 'Beta', score_a: 3, score_b: 2, score_order: 'high-low', winner_side: 'B', duration_s: 600, bans: { A: [{ hero: 'Hulk', type: 'ban', slot: 0 }] } }] },
    kits: { ok: true, license: 'CC-BY-SA', attribution: 'Fixture factual data', baseStats: { Hulk: { health: '700' } }, heroes: Object.fromEntries(Array.from({ length: 20 }, (_, index) => [index ? `Hero ${index}` : 'Hulk', [{ name: 'Example Ability', type: 'Ability', key: 'E', stats: [{ label: 'Damage', value: '40' }, { label: 'Cooldown', value: '12s' }] }]])) },
    patches: { ok: true, officialIndexUrl: 'https://www.marvelrivals.com/gameupdate/', patches: [{ patch: '2026-09-01', date: '2026-09-01', title: 'Example patch', sections: [{ hero: 'Hulk', scope: 'hero', label: 'Hulk', changes: [{ text: 'Reduce base health from 750 to 700.', tag: 'nerf' }] }] }] },
    streams: { channel: { live: true, name: 'Player One', viewers: 10, game: 'Marvel Rivals', started_at: '2026-09-27T00:00:00Z' } },
    streamDirectory: { ok: true, profiles: [{ channel: 'channel', role: 'vanguard', nationality: 'Iceland' }] },
    teamupDefinitions: { ok: true, icons: [{ name: 'Gamma Fastball', hero: 'Hulk', partner: 'Wolverine', url: 'https://example.com/teamup.webp' }] },
  };
  const catalog = { heroes: [{ name: 'Hulk', baseName: 'Hulk', role: 'Vanguard', image: 'https://example.com/hulk.webp', variant: false }], maps: [{ id: 'example-map', name: 'Example Map', image: null }], assets: {} };
  return { feeds, catalog };
}

test('normalizes actual source contracts without deriving winner from high-low score', () => {
  const data = normalizeData(...Object.values(fixture()), { now: '2026-09-27T12:00:00Z' });
  assert.equal(validateData(data), true);
  assert.equal(data.matches[0].winner, 'Beta');
  assert.equal(data.matches[0].scoreOrder, 'high-low');
  assert.equal(data.matches[0].players[0].kills, 12);
  assert.equal(data.matches[0].players[0].damage, null);
  assert.equal(data.heroes[0].stats.health, '700');
  assert.match(data.heroes[0].abilities[0].description, /Cooldown: 12s/);
  assert.equal(data.streams[0].role, 'Vanguard');
  assert.equal(data.patches[0].changes[0].text, 'Reduce base health from 750 to 700.');
  assert.equal(data.teamUps[0].name, 'Gamma Fastball');
  assert.equal(data.teamUps[0].partner, 'Wolverine');
  assert.equal(data.teamUps[0].winRate, undefined);
});

test('keeps public redactions even when an auxiliary field exposes an actual replay code', () => {
  const { feeds, catalog } = fixture();
  feeds.summary.matches[0].code = 'public-tlc-1';
  feeds.summary.matches[0].result_redacted = true;
  const match = normalizeData(feeds, catalog).matches[0];
  assert.equal(match.replayCode, null);
  assert.equal(match.scoreA, null);
  assert.equal(match.winner, null);
});

test('maps draft actions through source draft-role ownership instead of display team order', () => {
  const { feeds, catalog } = fixture();
  Object.assign(feeds.summary.matches[0], { draft_side_model: 'draft_role', team_a_draft_role: 'B', team_b_draft_role: 'A' });
  const match = normalizeData(feeds, catalog).matches[0];
  assert.equal(match.bans[0].side, 'A');
  assert.equal(match.bans[0].team, 'Beta');
  assert.equal(match.draft.teamASide, 'B');
  assert.equal(match.winner, 'Beta');
});

test('canonicalizes a punctuation-only draft alias without splitting the Star-Lord ban identity', () => {
  const { feeds, catalog } = fixture();
  catalog.heroes.push({ name: 'Star-Lord', role: 'Duelist', baseName: 'Star-Lord', variant: false });
  feeds.summary.matches[0].bans.A[0].hero = 'Starlord';
  const data = normalizeData(feeds, catalog);
  assert.equal(data.matches[0].bans[0].hero, 'Star-Lord');
  assert.equal(canonicalHero('starlord', catalog.heroes), 'Star-Lord');
  assert.equal(canonicalHeroName('star lord', catalog.heroes), 'Star-Lord');
  assert.equal(canonicalHeroName('Unknown-Hero', catalog.heroes), 'Unknown-Hero');
  assert.equal(canonicalHeroName('A B', ['A-B', 'AB']), 'A B');
  assert.equal(canonicalHeroName(null, catalog.heroes), null);
  const starLord = { id: 'star-lord', name: 'Star-Lord' };
  const index = heroLookupIndex([starLord]);
  assert.equal(index.starlord, starLord);
  assert.equal(index['star-lord'], starLord);
});

test('uses unique directory spelling for case-only raw player aliases without losing source name', () => {
  const { feeds, catalog } = fixture();
  feeds.dashboard.raw[0][3] = 'player one';
  const data = normalizeData(feeds, catalog);
  assert.equal(data.players.length, 2);
  const player = data.players.find(person => person.name === 'Player One');
  assert.equal(player.stats.kills, 12);
  assert.deepEqual(player.aliases, ['player one']);
  assert.equal(data.matches[0].players[0].sourceName, 'player one');
});

test('rejects malformed or empty source feeds before publishing', () => {
  const { feeds, catalog } = fixture();
  feeds.summary.matches = [];
  assert.throws(() => normalizeData(feeds, catalog), /refusing to overwrite/i);
});

test('content hash ignores fetch times but detects a real data change', () => {
  const { feeds, catalog } = fixture();
  const first = normalizeData(feeds, catalog, { now: '2026-09-27T00:00:00Z' });
  const later = normalizeData(feeds, catalog, { now: '2026-09-28T00:00:00Z' });
  assert.equal(contentHash(first), contentHash(later));
  later.matches[0].duration += 1;
  assert.notEqual(contentHash(first), contentHash(later));
});

test('failed sync retains last good bytes and unchanged sync does not rewrite the file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lucifer-sync-'));
  try {
    const output = join(dir, 'siteData.json');
    const { feeds, catalog } = fixture();
    await sync({ feeds, catalog, output, now: '2026-09-27T00:00:00Z' });
    const before = await readFile(output, 'utf8');
    const beforeStat = await stat(output);
    const noChange = await sync({ feeds, catalog, output, now: '2026-09-28T00:00:00Z' });
    assert.equal(noChange.changed, false);
    assert.equal((await stat(output)).mtimeMs, beforeStat.mtimeMs);
    feeds.dashboard.ok = false;
    await assert.rejects(sync({ feeds, catalog, output }), /Invalid dashboard/);
    assert.equal(await readFile(output, 'utf8'), before);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('protects against a valid-looking upstream partial response that removes most data', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lucifer-shrink-'));
  try {
    const path = join(dir, 'data.json');
    const { feeds, catalog } = fixture();
    const first = normalizeData(feeds, catalog);
    first.matches = Array.from({ length: 5 }, (_, index) => ({ ...first.matches[0], id: `match-${index}` }));
    await atomicUpdate(path, first);
    const before = await readFile(path, 'utf8');
    await assert.rejects(atomicUpdate(path, normalizeData(feeds, catalog)), /shrank/);
    assert.equal(await readFile(path, 'utf8'), before);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('literal catalog parsing does not execute remote JavaScript', () => {
  const heroScript = `throw new Error('must never execute'); var HEROES = [${Array.from({ length: 30 }, (_, index) => `{ name: "Hero ${index}", role: "Duelist", file: "hero${index}.webp" }`).join(',')}];`;
  const mapScript = `var maps = [${Array.from({ length: 5 }, (_, index) => `{ display: "Map ${index}", asset: "map ${index}" }`).join(',')}];`;
  assert.equal(parseCatalog(heroScript, 'window.ASSET_MANIFEST = {};', mapScript).heroes.length, 30);
  assert.throws(() => parseCatalog('var HEROES=[];', '', ''), /incomplete|not found/);
});

test('fetch size cap works with and without content-length', async () => {
  await assert.rejects(fetchText('https://example.com', { attempts: 1, maxBytes: 5, fetchImpl: async () => new Response('larger-than-five') }), /size limit/);
  await assert.rejects(fetchText('https://example.com', { attempts: 1, maxBytes: 5, fetchImpl: async () => new Response('short', { headers: { 'content-length': '1000' } }) }), /size limit/);
});

test('non-retryable HTTP failure returns safely without a write', async () => {
  await assert.rejects(fetchText('https://example.com', { attempts: 1, fetchImpl: async () => new Response('', { status: 403 }) }), /HTTP 403/);
});

test('patch summary retains mechanical change context and excludes appended commentary', () => {
  assert.equal(summarizePatch('Reduce base health from 850 to 825. Now the party can begin!'), 'Reduce base health from 850 to 825.');
});

test('official map catalog resolves regional names and shared artwork without merging separate maps', () => {
  const html = `<div class="part-maps">${['The God Quarry', 'YGGSGARD: YGGDRASILL PATH AND ROYAL PALACE', 'Times Square', 'The God Quarry'].map(name => `<div class="map-img"><img src="https://www.marvelrivals.com/map.jpg"><h3>${name}<a href="#"></a></h3></div>`).join('')}</div>`;
  const layouts = '<a href="/maps/god-quarry/">God Quarry</a>';
  const maps = parseOfficialMaps(html, layouts);
  assert.equal(maps.length, 4);
  assert.deepEqual(maps.map(map => map.id), ['god-quarry', 'royal-palace', 'times-square', 'yggdrasill-path']);
  assert.equal(maps.find(map => map.id === 'god-quarry').layoutAvailability, 'source-listed');
  assert.equal(maps.find(map => map.id === 'royal-palace').layoutAvailability, 'unavailable');
  assert.equal(maps.find(map => map.id === 'times-square').classification, 'social');
  assert.deepEqual(maps.find(map => map.id === 'god-quarry').modes, ['Domination']);
});

test('official supplementation preserves source competitive records and does not imply a ranked map pool', () => {
  const { feeds, catalog } = fixture(), original = normalizeData(feeds, catalog);
  const official = { updatedAt: '2026-10-16T00:00:00Z', heroes: [], maps: [{ id: 'times-square', name: 'Times Square', image: 'https://www.marvelrivals.com/square.jpg', sourceUrl: 'https://www.marvelrivals.com/', catalogSource: 'official', modes: ['Social hub'], classification: 'social' }], sourceConflicts: [] };
  const next = applyOfficialCatalog(original, official);
  assert.equal(next.maps.length, 2);
  assert.deepEqual(next.matches, original.matches);
  assert.deepEqual(next.teams, original.teams);
  assert.deepEqual(next.players, original.players);
  assert.deepEqual(next.heroes[0].stats, original.heroes[0].stats);
  assert.deepEqual(next.maps.find(map => map.id === 'example-map'), original.maps[0]);
  assert.deepEqual(next.maps.find(map => map.id === 'times-square').stats, { matches: 0 });
  assert.equal(next.maps.find(map => map.id === 'times-square').classification, 'social');
  assert.equal(next.meta.syncedAt, original.meta.syncedAt);
  assert.equal(original.maps.length, 1);
  assert.equal(normalizeData(feeds, catalog, { officialCatalog: official }).maps.length, 2);
});

test('Gorr official balance identity resolves history while conflicting cooldown provenance stays distinct', () => {
  const { feeds, catalog } = fixture();
  catalog.heroes.push({ name: 'Gorr', baseName: 'Gorr', role: 'Duelist' });
  feeds.kits.heroes.Gorr = [{ name: 'Living Abyss', stats: [{ label: 'Cooldown', value: '13s' }] }];
  feeds.patches.patches[0].sections.push({ hero: 'Gorr the God Butcher', scope: 'hero', label: 'Gorr the God Butcher', changes: [{ text: 'Reduce Living Abyss cooldown from 15s to 12s.', tag: 'buff' }] });
  const data = normalizeData(feeds, catalog), gorr = data.heroes.find(hero => hero.name === 'Gorr');
  assert.equal(gorr.balanceHistory.length, 1);
  assert.equal(gorr.balanceHistory[0].changes[0].hero, 'Gorr');
  assert.equal(gorr.balanceHistory[0].changes[0].sourceHero, 'Gorr the God Butcher');
  const conflicts = parseGorrCooldownConflict('<h3>Living Abyss</h3><td>Cooldown</td><td>13s</td>', '<h1>Marvel Rivals Version 20261009 Balance Post</h1><p>Reduce Living Abyss cooldown from 15s to 12s.</p>', 'https://www.marvelrivals.com/gorr.html', 'https://www.marvelrivals.com/balance.html');
  const next = applyOfficialCatalog(data, { maps: [], sourceConflicts: conflicts });
  // Conflict application requires a verified catalog; a malformed empty catalog
  // must not silently alter otherwise valid data.
  assert.equal(next, data);
  const enriched = applyOfficialCatalog(data, { maps: data.maps, heroes: [], sourceConflicts: conflicts }).heroes.find(hero => hero.name === 'Gorr');
  assert.equal(enriched.abilities[0].stats[0].value, '13s');
  assert.equal(enriched.sourceConflicts[0].patchValue, '12s');
  assert.equal(enriched.sourceConflicts[0].effectiveDate, '2026-10-09');
  assert.deepEqual(parseGorrCooldownConflict('Living Abyss Cooldown 12s', 'Version 20261009 Reduce Living Abyss cooldown from 15s to 12s.', 'hero', 'patch'), []);
});

test('official outage still materializes cached discoveries and repeated outages preserve bytes and timestamps', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lucifer-official-outage-'));
  try {
    const catalogPath = join(dir, 'official.json'), dataPath = join(dir, 'siteData.json');
    const data = normalizeData(...Object.values(fixture())), catalog = { schemaVersion: 1, updatedAt: '2026-10-15T00:00:00Z', heroes: [], sourceConflicts: [], maps: [{ id: 'god-quarry', name: 'God Quarry', image: 'https://www.marvelrivals.com/quarry.jpg', sourceUrl: 'https://www.marvelrivals.com/', catalogSource: 'official', modes: ['Domination'] }] };
    await writeFile(catalogPath, JSON.stringify(catalog, null, 2) + '\n');
    await writeFile(dataPath, JSON.stringify(data, null, 2) + '\n');
    const fetchImpl = async () => new Response('', { status: 503 });
    const result = await syncOfficialCatalog({ catalogPath, dataPath, fetchImpl });
    assert.equal(result.catalogChanged, false);
    assert.equal(result.siteChanged, true);
    assert.equal(result.data.maps.length, 2);
    assert.deepEqual(result.data.matches, data.matches);
    assert.match(result.warnings[0], /cached verified catalog retained/);
    const before = await readFile(dataPath, 'utf8'), beforeStat = await stat(dataPath);
    const again = await syncOfficialCatalog({ catalogPath, dataPath, fetchImpl, now: '2026-10-17T00:00:00Z' });
    assert.equal(again.changed, false);
    assert.equal(await readFile(dataPath, 'utf8'), before);
    assert.equal((await stat(dataPath)).mtimeMs, beforeStat.mtimeMs);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('unchanged successful official research does not generate timestamp-only commits', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lucifer-official-stable-'));
  try {
    const catalogPath = join(dir, 'official.json'), dataPath = join(dir, 'siteData.json');
    await writeFile(dataPath, JSON.stringify(normalizeData(...Object.values(fixture())), null, 2) + '\n');
    const home = '<div class="part-maps">' + Array.from({ length: 20 }, (_, i) => `<div class="map-img"><img src="https://www.marvelrivals.com/map${i}.jpg"><h3>Map ${i}<a href="#"></a></h3></div>`).join('');
    const heroes = Array.from({ length: 40 }, (_, i) => `<div class="heroNewsList"><a data-name="Hero ${i}" data-url="https://www.marvelrivals.com/hero${i}.html">${'<img src="https://www.marvelrivals.com/image.png">'.repeat(3)}</a></div>`).join('');
    const layouts = Array.from({ length: 20 }, (_, i) => `<a href="/maps/map-${i}/">Map ${i}</a>`).join('');
    const fetchImpl = async url => new Response(url === 'https://www.marvelrivals.com/' ? home : url === 'https://www.marvelrivals.com/heroes/' ? heroes : layouts);
    await syncOfficialCatalog({ catalogPath, dataPath, fetchImpl, now: '2026-10-16T00:00:00Z' });
    const before = await readFile(catalogPath, 'utf8'), beforeStat = await stat(catalogPath);
    const result = await syncOfficialCatalog({ catalogPath, dataPath, fetchImpl, now: '2026-10-17T00:00:00Z' });
    assert.equal(result.changed, false);
    assert.equal(await readFile(catalogPath, 'utf8'), before);
    assert.equal((await stat(catalogPath)).mtimeMs, beforeStat.mtimeMs);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
