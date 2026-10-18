const key = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

/** Published map results only: never infer a map from a series score or lineup. */
export function competitiveMapRecords(series = [], maps = []) {
  return series.filter(match => match.status === 'completed').flatMap(match => (match.maps || []).flatMap((map, index) => {
    if (!map.name || !map.winner || ![match.teamA, match.teamB].some(team => key(team) === key(map.winner))) return [];
    const catalog = maps.find(item => key(item.id) === key(map.mapId) || key(item.name) === key(map.name));
    return [{id:`${match.id}-map-${index+1}`,seriesId:match.id,date:match.date,scheduledAt:match.scheduledAt,teamA:match.teamA,teamB:match.teamB,teamAId:match.teamAId,teamBId:match.teamBId,winner:map.winner,scoreA:map.scoreA ?? null,scoreB:map.scoreB ?? null,scoreOrder:'team-order',map:catalog?.name || map.name,mapId:catalog?.id || map.mapId,mode:catalog?.mode || 'Unreported',region:match.region,event:match.event,source:match.sourceUrl,sourceUrl:match.sourceUrl,recordType:'published-map-result'}];
  }));
}
