import test from 'node:test';
import assert from 'node:assert/strict';
import { compositionStats, filterMatches, heroEntries, heroStats, mapStats, playerStats, sortRows, teamStats, winningTeam } from './analytics.js';

const match = (overrides = {}) => ({ id: '1', date: '2026-09-27', teamA: 'Alpha', teamB: 'Beta', scoreA: 3, scoreB: 1, winner: 'Beta', map: 'Central Park', mode: 'Convergence', season: 'S10.0', region: 'NA', players: [], ...overrides });

test('match filters combine dimensions and anchor time windows to the newest source record', () => {
  const matches = [match(), match({ id: '2', date: '2026-08-01' }), match({ id: '3', teamA: 'Gamma', map: 'Yggsgard' })];
  assert.deepEqual(filterMatches(matches, { team: 'alpha', region: 'na', mode: 'Convergence', season: 'S10.0', map: 'Central Park', window: '7d' }).map(row => row.id), ['1']);
  assert.equal(filterMatches(matches, { search: 'gamma' }).length, 1);
  assert.equal(filterMatches(matches, { window: 'all', region: 'All regions' }).length, 3);
  assert.equal(filterMatches(matches, { window: '7', days: [] }).length, 2);
  assert.equal(filterMatches(matches, { window: 'all', days: ['2026-08-01'] }).length, 1);
  assert.equal(filterMatches([match(),match({id:'old',date:'2026-09-20'})],{window:'7',days:[]}).length,1);
  assert.equal(filterMatches([match({players:[{name:'a',hero:'Loki'}]})],{search:'loki'}).length,1);
  assert.equal(filterMatches([match({bans:[{hero:'Hela',type:'save'}]})],{search:'hela'}).length,1);
});

test('score order never determines the winner', () => {
  assert.equal(winningTeam(match()), 'Beta');
  assert.equal(winningTeam(match({ winner: null })), '');
  const stats = teamStats([match()], [{ name: 'Alpha' }, { name: 'Beta' }]);
  assert.equal(stats.find(team => team.name === 'Alpha').wins, 0);
  assert.equal(stats.find(team => team.name === 'Beta').winRate, 100);
});

test('map averages exclude unpublished scores without discarding match counts', () => {
  const rows = mapStats([match(), match({ id: '2', scoreA: null, scoreB: 2, winner: null })]);
  assert.equal(rows[0].matches, 2);
  assert.equal(rows[0].averageScore, 4);
  assert.equal(rows[0].averageMargin, 2);
  assert.equal(rows[0].teams, 2);
});

test('ban statistics exclude saves and locks and preserve explicit zero wins', () => {
  const game = match({ bans: [{ hero: 'Loki', type: 'save', team: 'Alpha' }, { hero: 'Hela', type: 'ban', team: 'Alpha' }, { hero: 'Hela', type: 'lock', team: 'Beta' }], players: [{ name: 'a', team: 'Alpha', hero: 'Loki' }, { name: 'b', team: 'Beta', hero: 'Loki' }] });
  assert.deepEqual(heroEntries(game, 'bans').map(entry => entry.name), ['Hela']);
  const stats = heroStats([game], [{ name: 'Loki', role: 'Strategist' }]);
  const loki = stats.rows.find(row => row.name === 'Loki');
  assert.equal(loki.picks, 2);
  assert.equal(loki.matches, 1);
  assert.equal(loki.pickRate, 100);
  assert.equal(loki.winRate, 50);
  assert.equal(loki.bans, 0);
  assert.equal(stats.rows.find(row => row.name === 'Hela').bans, 1);
});

test('unknown hero team does not create an invented hero win rate', () => {
  const stats = heroStats([match({ picks: ['Loki'] })]);
  assert.equal(stats.rows[0].winRate, null);
  assert.equal(stats.rows[0].decided, 0);
});

test('composition pairs contain teammates only and retain observed match history', () => {
  const game = match({ players: [{ name: 'a', team: 'Alpha', hero: 'Loki' }, { name: 'b', team: 'Alpha', hero: 'Hela' }, { name: 'c', team: 'Beta', hero: 'Groot' }, { name: 'd', team: 'Beta', hero: 'Mantis' }] });
  const stats = compositionStats([game]);
  assert.equal(stats.pairs.length, 2);
  assert.ok(!stats.pairs.some(pair => pair.heroes.includes('Loki') && pair.heroes.includes('Groot')));
  assert.equal(stats.pairs.find(pair => pair.heroes.includes('Loki')).winRate, 0);
  assert.equal(stats.pairs.find(pair => pair.heroes.includes('Groot')).winRate, 100);
  assert.deepEqual(stats.pairs[0].matchIds, ['1']);
});

test('player totals distinguish missing fields from published zero and ignore unfiltered directory totals', () => {
  const games = [match({ players: [{ name: 'a', team: 'Alpha', hero: 'Loki', role: 'Strategist', kills: 0, deaths: 2, assists: 3, healing: null }] })];
  const stats = playerStats(games, [{ name: 'a', role: 'Unreported', stats: { kills: 9999 } }, { name: 'b', stats: { kills: 100 } }]);
  const a = stats.find(player => player.name === 'a'); const b = stats.find(player => player.name === 'b');
  assert.equal(a.kills, 0);
  assert.equal(a.healing, null);
  assert.equal(a.winRate, 0);
  assert.equal(a.role, 'Strategist');
  assert.equal(a.kda, 1.5);
  assert.deepEqual(a.heroes, ['Loki']);
  assert.equal(b.kills, null);
  assert.equal(b.matches, 0);
  assert.equal(b.winRate, null);
});

test('sorting keeps unreported values last and never mutates its input', () => {
  const rows = [{ name: 'a', value: null }, { name: 'b', value: 0 }, { name: 'c', value: 9 }];
  assert.deepEqual(sortRows(rows, { key: 'value', direction: 'asc' }).map(row => row.name), ['b', 'c', 'a']);
  assert.deepEqual(sortRows(rows, { key: 'value', direction: 'desc' }).map(row => row.name), ['c', 'b', 'a']);
  assert.equal(rows[0].name, 'a');
});

test('player per10 rates use matching published totals and full-match exposure only', () => {
  const games = [match({ duration: 300, players: [{ name: 'a', kills: 5, deaths: 0, accuracy: 50 }] }), match({ id: '2', duration: 600, players: [{ name: 'a', kills: 10, deaths: null, accuracy: 70 }] }), match({ id: '3', duration: null, players: [{ name: 'a', kills: 100 }] })];
  const a = playerStats(games)[0];
  assert.equal(a.kills, 115);
  assert.equal(a.killsPer10, 10);
  assert.equal(a.deathsPer10, 0);
  assert.equal(a.accuracy, 60);
  assert.equal(a.healingPer10, null);
});

test('remaining unverified exact player names stay distinct', () => {
  assert.equal(playerStats([], [{name:'Player'}, {name:'player'}]).length, 2);
});

test('role families require complete six-row role samples and team filtering changes counts', () => {
  const players = Array.from({length:6}, (_,index) => ({name:`a${index}`,team:'Alpha',hero:`hero${index}`,role:index<2?'Vanguard':index<4?'Duelist':'Strategist'}));
  players.push(...Array.from({length:6},(_,index)=>({name:`b${index}`,team:'Beta',hero:`hero${index}`,role:index<2?'Vanguard':index<4?'Duelist':'Strategist'})));
  const all = compositionStats([match({players})]);
  assert.equal(all.roleFamilies[0].matches, 2);
  assert.equal(compositionStats([match({players})],[],{team:'Alpha'}).roleFamilies[0].matches,1);
  assert.equal(compositionStats([match({players:players.slice(0,5)})]).roleFamilies.length,0);
});
