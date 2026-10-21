import {competitiveMapRecords} from './competitive-maps.js';
const key=value=>String(value||'').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g,'');
export function analystPublicSample(data,subject,filters={}) {
  const directory=(data.teams||[]).find(team=>[team.name,team.id,team.shortName,...(team.aliases||[])].some(name=>key(name)===key(subject)));
  const names=new Set([subject,directory?.name,directory?.id,directory?.shortName,...(directory?.aliases||[])].filter(Boolean).map(key));
  const matches=subject?(data.competitiveResults?.series||[]).filter(row=>row.status==='completed'&&[row.teamA,row.teamB,row.teamAId,row.teamBId].some(value=>names.has(key(value)))&&(!filters.from||row.date>=filters.from)&&(!filters.to||row.date<=filters.to)&&(!filters.event||row.event===filters.event)).sort((a,b)=>String(b.scheduledAt||b.date).localeCompare(String(a.scheduledAt||a.date))):[];
  const decided=matches.filter(row=>[row.teamA,row.teamB].some(team=>key(team)===key(row.winner)));
  const wins=decided.filter(row=>names.has(key(row.winner))).length;
  const maps=competitiveMapRecords(matches,data.maps||[]),groups=new Map();
  for(const record of maps){const name=record.map;const group=groups.get(name)||{name,played:0,wins:0,losses:0};group.played++;if(names.has(key(record.winner)))group.wins++;else group.losses++;groups.set(name,group);}
  const expected=matches.reduce((sum,row)=>sum+(Number.isInteger(row.scoreA)&&Number.isInteger(row.scoreB)&&row.scoreA>=0&&row.scoreB>=0?row.scoreA+row.scoreB:0),0);
  return {matches,decided:decided.length,wins,losses:decided.length-wins,winRate:decided.length?wins/decided.length:null,maps:[...groups.values()].sort((a,b)=>b.played-a.played||a.name.localeCompare(b.name)),publishedMaps:maps.length,missingMaps:Math.max(0,expected-maps.length),latest:matches[0]?.date||null,updatedAt:data.competitiveResults?.updatedAt||null};
}
