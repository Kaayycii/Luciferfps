const list=value=>Array.isArray(value)?value:[];
const fold=value=>String(value??'').normalize('NFKC').toLowerCase().trim();
const known=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
const time=value=>{const t=Date.parse(value||'');return Number.isFinite(t)?t:0;};
const nameOf=value=>typeof value==='string'?value:value?.name||'';
const seriesDate=s=>s.scheduledAt||s.date;
const METRICS=[['kills'],['deaths'],['assists'],['finalHits'],['damage'],['damageTaken'],['healing']];
export function aggregateRecentPlayers(series = []) {
  const players = new Map();
  const seenSeries = new Set();
  for (const match of list(series).slice().sort((a, b) => time(seriesDate(a)) - time(seriesDate(b)))) {
    const matchKey = match.id || `${seriesDate(match)}|${nameOf(match.teamA)}|${nameOf(match.teamB)}`;
    if (seenSeries.has(matchKey)) continue;
    seenSeries.add(matchKey);
    const seenPlayers = new Set();
    for (const record of list(match.players)) {
      const name = record.name || record.sourceName;
      if (!name) continue;
      const id = record.sourcePlayerId ? String(record.sourcePlayerId) : fold(name);
      if (seenPlayers.has(id)) continue;
      seenPlayers.add(id);
      let player = players.get(id);
      if (!player) {
        player = { id, name, sourceName: record.sourceName, seriesSeen: 0, history: [], heroes: new Set(), reported: {}, totals: {} };
        players.set(id, player);
      }
      player.seriesSeen += 1;
      player.name = name;
      player.sourceName = record.sourceName || name;
      player.latestTeam = nameOf(record.team);
      player.teamId = record.teamId;
      player.role = record.role || 'Unreported';
      player.latestAt = seriesDate(match);
      player.history.unshift({ ...record, series: match });
      for (const hero of list(record.heroes)) if (nameOf(hero)) player.heroes.add(nameOf(hero));
      for (const [key] of METRICS) if (known(record[key])) {
        player.totals[key] = (player.totals[key] ?? 0) + record[key];
        player.reported[key] = (player.reported[key] ?? 0) + 1;
      }
    }
  }
  return [...players.values()].map(player => ({ ...player, heroes: [...player.heroes] }));
}

export function filterPlayerSeries(series=[],filters={}){
 const all=value=>!value||['all','all teams','all regions','all maps','all seasons','all historical seasons'].includes(fold(value));
 if(!all(filters.map)||!all(filters.season)||!all(filters.mode))return [];
 const latest=Math.max(0,...series.map(row=>time(row.date)));const days=filters.window==='all'?0:Number(filters.window)||0;const cutoff=days?latest-Math.max(0,days-1)*86400000:0;
 return series.filter(row=>(all(filters.team)||[row.teamA,row.teamB,row.teamAId,row.teamBId,...row.players.map(p=>p.team)].some(team=>fold(team)===fold(filters.team)))&&(all(filters.region)||fold(row.region)===fold(filters.region))&&(!cutoff||time(row.date)>=cutoff)&&(!filters.days?.length||filters.days.includes(row.date))&&(!filters.search||fold([row.teamA,row.teamB,row.event,...row.players.flatMap(p=>[p.name,p.sourceName,...(p.heroes||[])])].join(' ')).includes(fold(filters.search))));
}
