import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { RESULT_SOURCES, parseCompetitivePage, resolveCompetitiveTeam, deduplicateSeries, syncCompetitiveResults } from '../scripts/sync-competitive-results.mjs';
import { competitiveResults, competitiveTeamStats, filterCompetitiveSeries } from '../src/lib/competitive-results.js';

const teams = [{ id: 'navi', name: 'Natus Vincere', aliases: [] }, { id: 'virtus_pro', name: 'Virtus.pro', aliases: [] }, { id: 'exg', name: 'ExG', aliases: ['Cafe Rose'] }, { id: 'hypertune', name: 'Team Hypertune', aliases: [] }];
const row = ({ a = 'Natus Vincere', b = 'Virtus.pro', at = '2026-10-17T13:00:00Z', score = '3:0', live = false, maps = '' } = {}) => `<div class="mr${live ? ' live' : ''}" data-ts="${Date.parse(at) / 1000}"><span class="t1"><span class="el"><span>${a}</span></span></span><span class="sc">${score.startsWith('Bo') ? `<span>${score}</span>` : score.split(':').map(n => `<b class="">${n}</b>`).join('<i>:</i>')}</span><span class="t2"><span class="el"><span>${b}</span></span></span></div>${maps}`;
const page = (results = row(), schedule = '') => `<h1>Ignite 2026 Stage 2 EMEA</h1><section id="results">${results}</section><section id="schedule">${schedule}</section>`;
const options = { teams, now: '2026-10-18T19:00:00.000Z' };
const source = RESULT_SOURCES[1];

test('event abbreviations preserve identities without merging Equinox with legacy Cafe Rose/ExG', () => {
  assert.deepEqual(resolveCompetitiveTeam('EXG', RESULT_SOURCES[0], teams), { id: 'equinox-gaming', name: 'Equinox Gaming' });
  assert.equal(resolveCompetitiveTeam('ExG', source, teams).id, 'exg');
  assert.equal(resolveCompetitiveTeam('HYT', source, teams).id, 'hypertune');
});

test('completed results deduplicate across source aliases and reject contradictory scores', () => {
  const records = parseCompetitivePage(page(row({ a: 'NAVI' }) + row()), source, options).series;
  assert.equal(deduplicateSeries(records).length, 1);
  assert.throws(() => deduplicateSeries([records[0], { ...records[0], scoreA: 0, scoreB: 3 }]), /Conflicting/);
});

test('active named fixture is awaiting a result, stale placeholders are absent, fixtures do not affect win rate', () => {
  const schedule = row({ at: '2026-10-18T17:00:00Z', score: 'Bo7', live: true }) + row({ a: 'Dreamland', b: 'TBD', at: '2026-10-17T17:00:00Z', score: 'Bo5' }) + row({ b: 'TBD', at: '2026-10-19T00:00:00Z', score: 'Bo7' });
  const records = parseCompetitivePage(page(row(), schedule), source, options).series;
  assert.equal(records.length, 3);
  assert.equal(records.find(record => record.status === 'awaiting-result').winner, null);
  assert.equal(records.filter(record => record.status === 'scheduled').length, 1);
  const navi = competitiveTeamStats(records, teams).find(team => team.id === 'navi');
  assert.equal(navi.played, 1); assert.equal(navi.wins, 1); assert.equal(navi.winRate, 100); assert.equal(navi.upcoming.length, 2);
});

test('unplayed 0–0 map is excluded and published map order stays attached to its teams', () => {
  const maps = `<div class="mgh"><span>Game 1 · Heart of Heaven</span><span class="mgs"><b class="">0</b>:<b class="">0</b></span></div><div class="mgh"><span>Game 2 · Yggdrasil Path</span><span class="mgs"><b class="">2</b>:<b class="w">3</b></span></div>`;
  const records = parseCompetitivePage(page(row({ maps })), source, { ...options, maps: [{ id: 'yggdrasill-path', name: 'Yggdrasill Path' }] }).series;
  assert.equal(records[0].maps.length, 1); assert.equal(records[0].maps[0].name, 'Yggdrasill Path'); assert.equal(records[0].maps[0].winner, 'Virtus.pro'); assert.equal(records[0].breakdownComplete, false);
});

test('parser refuses empty pages, future results and unfinished tied series', () => {
  assert.throws(() => parseCompetitivePage('<html>denied</html>', source, options), /contract/);
  assert.throws(() => parseCompetitivePage(page(row({ score: '0:0' })), source, options), /no valid/);
  assert.throws(() => parseCompetitivePage(page(row({ at: '2026-10-19T12:00:00Z' })), source, options), /no valid/);
});

test('checked snapshot contains consistent unique completed series and no fabricated player rows', () => {
  assert.equal(new Set(competitiveResults.series.map(record => record.id)).size, competitiveResults.series.length);
  assert.equal(competitiveResults.coverage.completedSeries, competitiveResults.series.filter(record => record.status === 'completed').length);
  for (const record of competitiveResults.series) {
    assert.ok(record.sourceUrl.startsWith('https://esportswatchguide.com/'));
    assert.equal('players' in record, false);
    if (record.status === 'completed') assert.equal(record.winner, record.scoreA > record.scoreB ? record.teamA : record.teamB);
    else { assert.equal(record.winner, null); assert.equal(record.scoreA, null); assert.equal(record.scoreB, null); }
    assert.equal(record.maps.some(map => map.scoreA === 0 && map.scoreB === 0), false);
  }
});

test('series filters keep UTC dates and scopes separate from the archived map sample', () => {
  const records = parseCompetitivePage(page(), source, options).series;
  assert.equal(filterCompetitiveSeries(records, { team: 'navi', days: ['2026-10-17'] }).length, 1);
  assert.equal(filterCompetitiveSeries(records, { team: 'navi', days: ['2026-10-18'] }).length, 0);
  assert.equal(filterCompetitiveSeries(records, { region: 'NA' }).length, 0);
});

test('sync keeps last-good source during an outage and leaves no-op data byte-identical', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lucifer-competitive-'));
  const root = pathToFileURL(`${directory}/`);
  try {
    await mkdir(join(directory, 'data'));
    await writeFile(join(directory, 'data/siteData.json'), JSON.stringify({ teams, maps: [] }));
    const fetchImpl = async () => new Response(page(), { headers: { 'content-type': 'text/html' } });
    const first = await syncCompetitiveResults({ root, now: options.now, fetchImpl });
    assert.equal(first.changed, true);
    const before = await readFile(join(directory, 'data/competitive-results.json'), 'utf8');
    const second = await syncCompetitiveResults({ root, now: '2026-10-18T20:00:00.000Z', fetchImpl });
    assert.equal(second.changed, false); assert.equal(await readFile(join(directory, 'data/competitive-results.json'), 'utf8'), before);
    const failed = await syncCompetitiveResults({ root, now: options.now, fetchImpl: async () => new Response('unavailable', { status: 503 }) });
    assert.equal(failed.data.coverage.completedSeries, first.data.coverage.completedSeries);
    assert.ok(failed.data.sources.every(source => source.state === 'last-good'));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
