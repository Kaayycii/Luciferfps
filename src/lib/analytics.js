const text = value => String(value?.name ?? value?.label ?? value?.id ?? value ?? '');
const key = value => text(value).trim().toLowerCase();
const isAll = value => !value || ['all', 'all teams', 'all regions', 'all modes', 'all maps', 'all seasons', 'all time', 'any'].includes(key(value));
export const label = text;
export const same = (left, right) => key(left) === key(right);
export const pct = (value, total) => total ? (value / total) * 100 : null;
export const displayPct = value => Number.isFinite(value) ? `${value.toFixed(1)}%` : '—';
export const matchTeams = match => [text(match.teamA), text(match.teamB)].filter(Boolean);
// Some public feeds store the score high-to-low, independently of team order.
export const winningTeam = match => ['draw', 'tie', 'unreported', 'unknown'].includes(key(match.winner)) ? '' : text(match.winner);

/** Date windows are anchored to the latest reported match, so archived datasets remain useful. */
export function filterMatches(matches = [], filters = {}) {
  const latest = Math.max(0, ...matches.map(match => Date.parse(match.date)).filter(Number.isFinite));
  const selectedDays = Array.isArray(filters.days) ? filters.days : [];
  const rawWindow = Array.isArray(filters.days) ? filters.window : filters.days ?? filters.window;
  const days = isAll(rawWindow) ? 0 : Number(String(rawWindow).match(/\d+/)?.[0]) || 0;
  const cutoff = days && latest ? latest - Math.max(0, days - 1) * 86400000 : 0;
  return matches.filter(match => {
    if (!isAll(filters.team) && ![...matchTeams(match), match.teamAId, match.teamBId].some(team => same(team, filters.team))) return false;
    for (const field of ['region', 'mode', 'map', 'season']) {
      if (!isAll(filters[field]) && !same(match[field], filters[field])) return false;
    }
    if (cutoff && (!Number.isFinite(Date.parse(match.date)) || Date.parse(match.date) < cutoff)) return false;
    if (selectedDays.length && !selectedDays.includes(String(match.date).slice(0, 10))) return false;
    if (filters.search && ![match.id, match.teamA, match.teamB, match.map, match.mode, match.region, match.season, ...(match.players || []).flatMap(player => [player.name, player.hero, player.role]), ...(Array.isArray(match.bans) ? match.bans.map(action => action.hero) : [])].map(text).join(' ').toLowerCase().includes(key(filters.search))) return false;
    return true;
  });
}

export function sortRows(rows, sort = { key: 'matches', direction: 'desc' }) {
  return [...rows].sort((left, right) => {
    const a = left[sort.key]; const b = right[sort.key];
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    const result = typeof a === 'number' && typeof b === 'number' ? a - b : text(a).localeCompare(text(b), undefined, { numeric: true });
    return sort.direction === 'asc' ? result : -result;
  });
}

export function mapStats(matches = [], maps = []) {
  const groups = new Map();
  for (const match of matches) {
    const name = text(match.map) || 'Unreported map';
    if (!groups.has(name)) groups.set(name, { name, mode: text(match.mode) || maps.find(map => same(map.name, name) || same(map.id, name))?.mode || 'Unreported', matches: 0, scored: 0, scoreTotal: 0, marginTotal: 0, decided: 0, teamAWins: 0, teams: new Set() });
    const row = groups.get(name); row.matches += 1;
    matchTeams(match).forEach(team => row.teams.add(team));
    if (Number.isFinite(match.scoreA) && Number.isFinite(match.scoreB)) { row.scored += 1; row.scoreTotal += match.scoreA + match.scoreB; row.marginTotal += Math.abs(match.scoreA - match.scoreB); }
    const winner = winningTeam(match);
    if (winner) { row.decided += 1; if (same(winner, match.teamA)) row.teamAWins += 1; }
  }
  return [...groups.values()].map(row => ({ ...row, teams: row.teams.size, share: pct(row.matches, matches.length), averageScore: row.scored ? row.scoreTotal / row.scored : null, averageMargin: row.scored ? row.marginTotal / row.scored : null, sideAWinRate: pct(row.teamAWins, row.decided) }));
}

function addHero(entries, hero, team, source) {
  if (!hero) return;
  const heroName = typeof hero === 'object' ? text(hero.hero ?? hero.heroName ?? hero.name ?? hero.id) : text(hero);
  if (!heroName) return;
  entries.push({ name: heroName, team: text(hero?.team ?? team), source, type: hero?.type || (source === 'bans' ? 'ban' : 'pick') });
}

/** Supports explicit draft/pick records only; a roster is never treated as a hero pick. */
export function heroEntries(match, type = 'picks') {
  const entries = [];
  const direct = type === 'bans' ? match.bans : match.picks;
  const draft = match.draft;
  const consume = (value, team, source) => {
    if (Array.isArray(value)) value.filter(hero => type !== 'bans' || !hero?.type || hero.type === 'ban').forEach(hero => addHero(entries, hero, team, source));
    else if (value && typeof value === 'object') {
      for (const [side, heroes] of Object.entries(value)) {
        const resolved = side === 'teamA' || side === 'a' ? match.teamA : side === 'teamB' || side === 'b' ? match.teamB : side;
        if (Array.isArray(heroes)) heroes.filter(hero => type !== 'bans' || !hero?.type || hero.type === 'ban').forEach(hero => addHero(entries, hero, resolved, source));
      }
    }
  };
  consume(direct, '', type);
  if (!entries.length && draft) {
    if (Array.isArray(draft)) draft.filter(entry => type === 'bans' ? entry.type === 'ban' : entry.type === 'pick').forEach(entry => addHero(entries, entry.hero, entry.team, 'draft'));
    else {
      consume(draft[type], '', 'draft');
      for (const side of ['teamA', 'teamB']) consume(draft[side]?.[type], match[side], 'draft');
    }
  }
  if (type === 'picks' && !entries.length) {
    for (const player of match.players || []) {
      if (player.hero) addHero(entries, player.hero, player.team, 'scoreboard');
      else if (Array.isArray(player.heroes)) player.heroes.forEach(hero => addHero(entries, hero, player.team, 'scoreboard'));
    }
  }
  return [...new Map(entries.map(entry => [`${key(entry.name)}|${key(entry.team)}`, entry])).values()];
}

export function heroStats(matches = [], heroes = []) {
  const groups = new Map(); let draftMatches = 0; let banMatches = 0;
  const ensure = name => {
    if (!groups.has(key(name))) {
      const hero = heroes.find(item => same(item.name, name) || same(item.id, name));
      groups.set(key(name), { name: hero?.name || name, role: hero?.role || 'Unreported', image: hero?.image, picks: 0, bans: 0, wins: 0, decided: 0, matches: 0, totals: {}, reports: {} });
    }
    return groups.get(key(name));
  };
  for (const match of matches) {
    const picks = heroEntries(match); const bans = heroEntries(match, 'bans'); const seen = new Set();
    if (picks.length) draftMatches += 1;
    if (bans.length) banMatches += 1;
    for (const pick of picks) {
      const row = ensure(pick.name); row.picks += 1;
      if (!seen.has(key(pick.name))) { row.matches += 1; seen.add(key(pick.name)); }
      const winner = winningTeam(match);
      if (winner && pick.team) { row.decided += 1; if (same(winner, pick.team)) row.wins += 1; }
    }
    bans.forEach(ban => { ensure(ban.name).bans += 1; });
    for (const player of match.players || []) {
      if (!player.hero) continue;
      const row = ensure(text(player.hero));
      for (const stat of ['kills', 'deaths', 'assists', 'damage', 'healing', 'damageBlocked', 'finalHits', 'accuracy']) {
        const value = player[stat] ?? player.stats?.[stat];
        if (Number.isFinite(value)) { row.totals[stat] = (row.totals[stat] || 0) + value; row.reports[stat] = (row.reports[stat] || 0) + 1; }
      }
    }
  }
  return { draftMatches, banMatches, rows: [...groups.values()].map(row => ({ ...row, pickRate: pct(row.matches, draftMatches), banRate: pct(row.bans, banMatches), winRate: pct(row.wins, row.decided), ...Object.fromEntries(['kills', 'deaths', 'assists', 'damage', 'healing', 'damageBlocked', 'finalHits', 'accuracy'].map(stat => [stat, row.reports[stat] ? stat === 'accuracy' ? row.totals[stat] / row.reports[stat] : row.totals[stat] : null])) })) };
}

export function compositionStats(matches = [], heroes = [], options = {}) {
  const pairs = new Map(); const families = new Map(); const roleFamilies = new Map();
  for (const match of matches) {
    const entries = heroEntries(match);
    const sides = [...new Set(entries.map(entry => entry.team).filter(Boolean))];
    for (const team of sides) {
      if (options.team && !same(options.team, team)) continue;
      const names = [...new Set(entries.filter(entry => same(entry.team, team)).map(entry => entry.name))].sort();
      const winner = winningTeam(match); const decided = Boolean(winner); const win = same(team, winner);
      const add = (group, id, heroes) => {
        if (!group.has(id)) group.set(id, { name: id, heroes, matches: 0, wins: 0, decided: 0, matchIds: [], teams: new Set() });
        const row = group.get(id); row.matches += 1; row.decided += Number(decided); row.wins += Number(decided && win); row.matchIds.push(match.id); row.teams.add(team);
      };
      if (names.length) add(families, names.join(' / '), names);
      for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) add(pairs, `${names[i]} + ${names[j]}`, [names[i], names[j]]);
      const records = (match.players || []).filter(player => same(player.team, team));
      if (records.length === 6) {
        const roles = records.map(player => player.role || heroes.find(hero => same(hero.name, player.hero))?.role);
        if (roles.every(role => ['Vanguard', 'Duelist', 'Strategist'].includes(role))) {
          const counts = Object.fromEntries(['Vanguard', 'Duelist', 'Strategist'].map(role => [role, roles.filter(value => value === role).length]));
          const family = `${counts.Vanguard}V / ${counts.Duelist}D / ${counts.Strategist}S`;
          const familyLabel = counts.Strategist > 3 ? 'Support heavy' : counts.Strategist === 3 ? 'Triple support' : counts.Vanguard >= 3 ? 'Heavy frontline' : counts.Duelist >= 3 ? 'Damage heavy' : counts.Vanguard === 2 && counts.Duelist === 2 && counts.Strategist === 2 ? 'Balanced 2 / 2 / 2' : 'Mixed roles';
          add(roleFamilies, `${familyLabel} · ${family}`, []);
        }
      }
    }
  }
  const finish = groups => [...groups.values()].map(row => ({ ...row, teams: [...row.teams], winRate: pct(row.wins, row.decided) })).sort((a, b) => b.matches - a.matches);
  return { pairs: finish(pairs), families: finish(families), roleFamilies: finish(roleFamilies) };
}

export function teamStats(matches = [], teams = []) {
  const names = [...new Set([...teams.map(team => text(team.name)), ...matches.flatMap(matchTeams)])].filter(Boolean);
  return names.map(name => {
    const team = teams.find(item => same(item.name, name) || same(item.id, name)) || { name };
    const history = matches.filter(match => matchTeams(match).some(side => same(side, name)));
    const decided = history.filter(match => winningTeam(match)); const wins = decided.filter(match => same(winningTeam(match), name)).length;
    return { ...team, name, matches: history.length, wins, losses: decided.length - wins, winRate: pct(wins, decided.length), history };
  });
}

export function playerStats(matches = [], players = []) {
  // The normalizer resolves known directory aliases. Keep remaining exact names
  // distinct because the public feed does not provide a durable person ID.
  const groups = new Map(players.map(player => [text(player.name), { ...player, name: player.name, matches: 0, wins: 0, decided: 0, kills: 0, deaths: 0, assists: 0, damage: 0, healing: 0, damageBlocked: 0, finalHits: 0, accuracy: 0, reported: {}, heroes: new Set(), history: [] }]));
  for (const match of matches) {
    for (const player of match.players || []) {
      if (!player?.name) continue;
      if (!groups.has(text(player.name))) groups.set(text(player.name), { ...player, matches: 0, wins: 0, decided: 0, kills: 0, deaths: 0, assists: 0, damage: 0, healing: 0, damageBlocked: 0, finalHits: 0, accuracy: 0, reported: {}, heroes: new Set(), history: [] });
      const row = groups.get(text(player.name)); row.matches += 1; row.history.push(match);
      row.timedTotals ||= {}; row.timedSeconds ||= {};
      if ((!row.role || row.role === 'Unreported') && player.role) row.role = player.role;
      if (player.team && winningTeam(match)) { row.decided += 1; if (same(player.team, winningTeam(match))) row.wins += 1; }
      if (player.hero) row.heroes.add(text(player.hero));
      for (const stat of ['kills', 'deaths', 'assists', 'damage', 'healing', 'damageBlocked', 'finalHits', 'accuracy']) {
        const value = player[stat] ?? player.stats?.[stat];
        if (Number.isFinite(value)) { row[stat] = (row[stat] || 0) + value; row.reported[stat] = (row.reported[stat] || 0) + 1; }
        if (stat !== 'accuracy' && Number.isFinite(value) && Number.isFinite(match.duration) && match.duration > 0) {
          row.timedTotals[stat] = (row.timedTotals[stat] || 0) + value;
          row.timedSeconds[stat] = (row.timedSeconds[stat] || 0) + match.duration;
        }
      }
    }
  }
  return [...groups.values()].map(row => ({ ...row, heroes: [...row.heroes], winRate: pct(row.wins, row.decided), kda: row.reported.kills && row.reported.assists && row.reported.deaths && row.deaths ? (row.kills + row.assists) / row.deaths : null, ...Object.fromEntries(['kills', 'deaths', 'assists', 'damage', 'healing', 'damageBlocked', 'finalHits', 'accuracy'].map(stat => [stat, row.reported[stat] ? stat === 'accuracy' ? row[stat] / row.reported[stat] : row[stat] : null])), ...Object.fromEntries(['kills', 'deaths', 'assists', 'damage', 'healing', 'damageBlocked', 'finalHits'].map(stat => [`${stat}Per10`, row.timedSeconds?.[stat] ? row.timedTotals[stat] / row.timedSeconds[stat] * 600 : null])) }));
}
