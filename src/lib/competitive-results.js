import competitiveResults from '../../data/competitive-results.json' with { type: 'json' };
export { competitiveResults };
export { competitiveMapRecords } from './competitive-maps.js';
const key = value => String(value ?? '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '');
const isAll = value => !value || ['all', 'allteams', 'allregions', 'alltime', 'allseasons', 'allmodes', 'allmaps', 'any'].includes(key(value));

export function filterCompetitiveSeries(series = [], filters = {}) {
  const selectedDays = Array.isArray(filters.days) ? filters.days : [];
  const rawWindow = Array.isArray(filters.days) ? filters.window : filters.days ?? filters.window;
  const days = isAll(rawWindow) ? 0 : Number(String(rawWindow).match(/\d+/)?.[0]) || 0;
  const latest = Math.max(0, ...series.filter(row => row.status === 'completed').map(row => Date.parse(row.date)).filter(Number.isFinite));
  const cutoff = days && latest ? latest - Math.max(0, days - 1) * 86400000 : 0;
  return series.filter(row => {
    if (!isAll(filters.team) && ![row.teamA, row.teamB, row.teamAId, row.teamBId].some(value => key(value) === key(filters.team))) return false;
    if (!isAll(filters.region) && key(row.region) !== key(filters.region)) return false;
    if (filters.status && filters.status !== 'all' && row.status !== filters.status) return false;
    if (!isAll(filters.map) && !row.maps.some(map => [map.name, map.mapId].some(value => key(value) === key(filters.map)))) return false;
    if (selectedDays.length && !selectedDays.includes(row.date)) return false;
    if (cutoff && Date.parse(row.date) < cutoff) return false;
    if (filters.search && ![row.teamA, row.teamB, row.event, row.region, row.stage, ...row.maps.map(map => map.name)].join(' ').toLowerCase().includes(String(filters.search).toLowerCase())) return false;
    return true;
  });
}

export function competitiveTeamStats(series = [], teams = []) {
  const rows = new Map();
  const getRow = (id, name, region) => {
    if (!rows.has(id)) {
      const team = teams.find(team => team.id === id) || teams.find(team => [team.name, team.shortName, ...(team.aliases || [])].some(alias => key(alias) === key(name)));
      rows.set(id, { ...(team || {}), id: team?.id || id, name: team?.name || name, region: team?.region || region, team: team || null, played: 0, matches: 0, wins: 0, losses: 0, winRate: null, mapWins: 0, mapLosses: 0, history: [], upcoming: [] });
    }
    return rows.get(id);
  };
  for (const match of series) for (const side of ['A', 'B']) {
    const id = match[`team${side}Id`], name = match[`team${side}`];
    if (!id || key(id) === 'tbd') continue;
    const row = getRow(id, name, match.region);
    if (match.status !== 'completed') { row.upcoming.push(match); continue; }
    row.played += 1; row.matches += 1; row.wins += Number(key(match.winner) === key(name)); row.losses += Number(key(match.winner) !== key(name));
    row.mapWins += match[`score${side}`] || 0; row.mapLosses += match[`score${side === 'A' ? 'B' : 'A'}`] || 0;
    row.history.push(match);
  }
  return [...rows.values()].map(row => ({ ...row, winRate: row.played ? row.wins / row.played * 100 : null, history: row.history.sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt)), upcoming: row.upcoming.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)) })).sort((a, b) => b.wins - a.wins || b.winRate - a.winRate || a.name.localeCompare(b.name));
}
