import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=resolve(fileURLToPath(new URL('..',import.meta.url)));
const decode=s=>s.replace(/&(?:amp|lt|gt|quot|apos|#39|nbsp);/g,x=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&#39;':"'",'&nbsp;':' '}[x])).replace(/&#([0-9]+);/g,(_,n)=>String.fromCodePoint(Number(n)));
function parse(h){h=h.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'');const root={tag:'root',attrs:{},children:[]},stack=[root];for(const m of h.matchAll(/<!--[\s\S]*?-->|<[^>]+>|[^<]+/g)){const t=m[0];if(t.startsWith('<!--')||t.startsWith('<!'))continue;if(t.startsWith('</')){const tag=t.slice(2,-1).trim().toLowerCase();let i=stack.length-1;while(i>0&&stack[i].tag!==tag)i--;if(i>0)stack.length=i;continue;}if(t[0]==='<'){const tag=t.match(/^<([\w-]+)/)?.[1]?.toLowerCase();if(!tag)continue;const attrs={};for(const a of t.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))attrs[a[1]]=decode(a[2]??a[3]);const node={tag,attrs,children:[],parent:stack.at(-1)};node.parent.children.push(node);if(!/^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/.test(tag)&&!t.endsWith('/>'))stack.push(node);}else stack.at(-1).children.push(decode(t));}return root;}
const all=(n,p)=>{let result=[];if(typeof n==='string')return result;if(p(n))result.push(n);for(const child of n.children)result.push(...all(child,p));return result;};const text=n=>typeof n==='string'?n:n.children.map(text).join('');

const key=value=>String(value||'').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g,'');
export function parsePlayerScoreboard(html, {id, sourceUrl, catalog, seriesIndex}) {
 if(typeof html!=='string'||html.length>4000000) throw Error('Scoreboard exceeds the supported size');
 const root=parse(html),content=text(root);
 if(!content.includes('FINAL')||!content.includes('Combined stats')) throw Error('Completed combined-series scoreboard is unavailable');
 const title=all(root,n=>n.tag==='title').map(text)[0]||'';
 const sides=title.replace(/\s*\| MRVL$/,'').split(' vs ');if(sides.length!==2)throw Error('Match title contract changed');
 const findTeam=name=>{const wanted=key(name);return wanted?catalog.teams.find(team=>[team.id,team.name,team.shortName,...(team.aliases||[])].some(alias=>alias&&key(alias)===wanted)):undefined;};
 const ta=findTeam(sides[0]),tb=findTeam(sides[1]);if(!ta||!tb||ta.id===tb.id)throw Error('Unknown team identity');
 const header=all(root,n=>n.attrs['data-sentry-component']==='MatchDetailPage')[0];
 const scoreNodes=all(header,n=>n.tag==='div'&&n.attrs.class==='text-lg font-bold leading-none tabular-nums');
 const score=text(scoreNodes[0]||'').match(/([0-9]+)\s*-\s*([0-9]+)/);if(!score)throw Error('Missing final series score');
 const scoreA=Number(score[1]),scoreB=Number(score[2]);if(scoreA===scoreB||scoreA>4||scoreB>4)throw Error('Unsupported or undecided score');
 const candidates=seriesIndex.filter(match=>match.status==='completed'&&[match.teamAId,match.teamBId].some(value=>key(value)===key(ta.id))&&[match.teamAId,match.teamBId].some(value=>key(value)===key(tb.id)));
 const monthNames=['January','February','March','April','May','June','July','August','September','October','November','December'];
 const dates=all(header,n=>n.tag==='p').map(text);const calendar=dates.find(value=>new RegExp('(?:'+monthNames.join('|')+') [0-9]{1,2}').test(value));
 const dateMatch=calendar?.match(new RegExp('('+monthNames.join('|')+') ([0-9]{1,2})'));if(!dateMatch)throw Error('Missing displayed match date');
 const eventText=all(header,n=>n.tag==='a'&&n.attrs.href?.startsWith('/events/')).map(text).find(value=>value.includes('2026'))||'';
 if(!eventText.includes('2026')||!/Stage 2/.test(eventText))throw Error('Unapproved event scope');
 const date='2026-'+String(monthNames.indexOf(dateMatch[1])+1).padStart(2,'0')+'-'+dateMatch[2].padStart(2,'0');
 const result=candidates.find(match=>match.date===date);if(!result)throw Error('Match is not corroborated in the verified results index');
 const forward=key(result.teamAId)===key(ta.id);if((forward?result.scoreA:result.scoreB)!==scoreA||(forward?result.scoreB:result.scoreA)!==scoreB)throw Error('Series score conflicts with verified results');
 const rows=all(root,n=>n.tag==='div'&&n.attrs.class?.startsWith('grid items-center gap-x-1 border'));
 const players=rows.map(row=>{
   const link=all(row,n=>n.tag==='a'&&n.attrs.href?.startsWith('/players/'))[0];if(!link)throw Error('Missing player identity');
   let owner=row.parent,team;while(owner){const links=all(owner,n=>n.tag==='a'&&n.attrs.href?.startsWith('/teams/'));const labels=[...new Set(links.map(text).map(value=>value.trim()).filter(Boolean))];if(labels.length===1){team=findTeam(labels[0]);if(team)break;}owner=owner.parent;}
   if(!team||![ta.id,tb.id].includes(team.id))throw Error('Unresolved scoreboard team');
   const values=all(row,n=>n.tag==='span'&&n.attrs.class==='whitespace-nowrap font-semibold tabular-nums').map(n=>{const value=text(n).trim();return /^[0-9]+(?:,[0-9]{3})*$/.test(value)?Number(value.replaceAll(',','')):NaN;});
   if(values.length!==7||values.some(value=>!Number.isSafeInteger(value)||value<0))throw Error('Player metric contract changed');
   const sourceName=text(link).trim(),known=catalog.players.filter(player=>[player.name,...(player.aliases||[])].some(alias=>String(alias).toLowerCase()===sourceName.toLowerCase()));
   const role=all(row,n=>n.tag==='img'&&['vanguard','duelist','strategist'].includes(n.attrs.alt)).map(n=>n.attrs.alt)[0];
   const heroes=[...new Set(all(row,n=>n.tag==='button'&&n.attrs.title).map(n=>n.attrs.title))];
   const[kills,deaths,assists,finalHits,damage,damageTaken,healing]=values;
   return {name:known.length===1?known[0].name:sourceName,sourceName,sourcePlayerId:link.attrs.href.split('/').at(-1),directoryId:known.length===1?known[0].id:null,team:team.name,teamId:team.id,role:role?role[0].toUpperCase()+role.slice(1):'Unreported',heroes,kills,deaths,assists,finalHits,damage,damageTaken,healing};
 });
 if(players.length<12||players.length>16||new Set(players.map(p=>p.sourcePlayerId)).size!==players.length)throw Error('Incomplete or duplicate player scoreboard');
 for(const team of[ta,tb])if(players.filter(player=>player.teamId===team.id).length<6)throw Error('Incomplete team scoreboard');
 return {id,date,scheduledAt:result.scheduledAt,event:result.event,region:result.region,teamA:ta.name,teamB:tb.name,scoreA,scoreB,winner:scoreA>scoreB?ta.name:tb.name,mapCount:scoreA+scoreB,sourceUrl,recordType:'combined-series-scoreboard',players};
}
export async function fetchPlayerPage(url,fetchImpl=fetch){const u=new URL(url);if(u.origin!=='https://www.mrvl.net'||!/^\/(?:matches|events)\/[a-z0-9]{20,40}$/.test(u.pathname))throw Error('Unapproved player source');const r=await fetchImpl(u,{signal:AbortSignal.timeout(15000),redirect:'error',headers:{accept:'text/html'}});if(!r.ok)throw Error('HTTP '+r.status);if(!String(r.headers.get('content-type')).includes('text/html'))throw Error('Unexpected source type');if(Number(r.headers.get('content-length'))>4000000)throw Error('Source too large');const html=await r.text();if(html.length>4000000)throw Error('Source too large');return html;}
const EVENTS=['jd7acf0rwgyjn13bhst3rq8mr58ekfpj','jd74f7y9gzpvx507ey3njkaqzn8ek3j7','jd73qnaxmjwet7kcz7m4b8waeh8eg86s','jd79jzjjphhgpfa7yakxe3d4598e2v0f','jd71p60z0nf0fzrwarmqmxsfjd8e471b','jd79pcthc0pjgj9pm52z9wvzfx8epeks'];
const SEEDS=['js79pdyscdxgjz414n9jjae7jh8gkwp3','js7c1k16k67nkxn9bfkms9wmsh8gh91d','js7dv3bgd9cyt3zjygmhdfxn498gf453','js7d3e97gbkfsnm3fycnean4p58gd5sy','js7cn9fsy3jw9baevt91zafxv58gghws','js72daynta40h954jxmytrgfq18gf8kf','js75751jr4hjs4ahpt6vx1h4gx8geycn','js7abm3rmj1d39nynfefh1cwx58gc37k'];
export async function syncPlayers({output=resolve(ROOT,'data/player-updates.json'),now=new Date().toISOString(),fetchImpl=fetch,skipKnown=false}={}){
 const catalog=JSON.parse(await readFile(resolve(ROOT,'data/siteData.json'),'utf8')),seriesIndex=JSON.parse(await readFile(resolve(ROOT,'data/competitive-results.json'),'utf8')).series;
 let previous;try{previous=JSON.parse(await readFile(output,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;previous={series:[]};}
 const records=new Map(previous.series.map(row=>[row.id,row])),ids=new Set([...SEEDS,...records.keys()]),failures=[];
 for(const id of EVENTS){try{const html=await fetchPlayerPage('https://www.mrvl.net/events/'+id,fetchImpl);for(const match of html.matchAll(/matches\/([a-z0-9]{20,40})/g))ids.add(match[1]);for(const match of html.matchAll(/["'](js7[a-z0-9]{25,36})["']/g))ids.add(match[1]);}catch(error){failures.push({id,error:error.message});}}
 // Discoveries take priority so a growing archive cannot starve new scoreboards.
 const discovered=[...ids];const targets=[...discovered.filter(id=>!records.has(id)),...(!skipKnown?discovered.filter(id=>records.has(id)):[])].slice(0,120);let successful=0;
 for(let offset=0;offset<targets.length;offset+=3)await Promise.all(targets.slice(offset,offset+3).map(async id=>{try{const sourceUrl='https://www.mrvl.net/matches/'+id+'?game=null',html=await fetchPlayerPage(sourceUrl,fetchImpl);const record=parsePlayerScoreboard(html,{id,sourceUrl,catalog,seriesIndex});records.set(id,record);successful++;}catch(error){failures.push({id,error:error.message});}}));
 const series=[...records.values()].sort((a,b)=>b.scheduledAt.localeCompare(a.scheduledAt));if(!series.length){console.error(JSON.stringify(failures));throw Error('No validated player scoreboards; existing data was preserved');}
 const changed=JSON.stringify(series)!==JSON.stringify(previous.series);if(!changed){console.log('Player scoreboards checked; unchanged. '+successful+' sources validated, '+failures.length+' unavailable.');return{changed:false,failures,successful};}
 const data={schemaVersion:1,checkedAt:now,latestMatchAt:series[0].scheduledAt,scope:'Independently published combined-series player scoreboards; partial event coverage',source:'https://www.mrvl.net/',limitations:['Series totals are not individual map statistics or hero-time measurements.','Source-listed lineups do not establish current contracts or transfers.','Damage taken is not damage blocked.','Unavailable or conflicting source pages preserve the last validated scoreboard.'],series};await writeFile(output,JSON.stringify(data,null,2)+'\n');console.log('Player scoreboards saved: '+series.length+' series, '+new Set(series.flatMap(row=>row.players.map(p=>p.sourcePlayerId))).size+' players; latest '+series[0].date+'. '+failures.length+' unavailable.');console.log(JSON.stringify({failures}));return{changed:true,successful,failures,data};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await syncPlayers();
