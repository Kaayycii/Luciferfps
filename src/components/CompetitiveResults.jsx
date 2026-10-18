import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, CalendarDays, CheckCircle2, ChevronDown, Swords, Trophy } from 'lucide-react';
import { MapMedia, TeamMedia } from './Media.jsx';
import { competitiveMapRecords, competitiveTeamStats, filterCompetitiveSeries } from '../lib/competitive-results.js';
import './competitive-results.css';

const same = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase();
const date = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric', timeZone:'UTC' }) : 'Date to be confirmed';
const time = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', timeZone:'UTC' }) + ' UTC' : 'Time to be confirmed';
const teamRecord = (teams, name) => teams.find(team => [team.name, team.id, team.shortName, ...(team.aliases || [])].some(alias => same(alias, name))) || { name };

export function SeriesRow({ series, teams = [] }) {
  const completed = series.status === 'completed';
  const statusLabel = completed ? 'FINAL' : series.status === 'awaiting-result' ? 'AWAITING RESULT' : 'SCHEDULED';
  return <article className={`series-row ${completed ? 'is-completed' : 'is-scheduled'}`}>
    <div className="series-date"><span className={`series-status ${completed?'finished':'scheduled'}`}>{completed ? <CheckCircle2 size={11}/> : <CalendarDays size={11}/>} {statusLabel}</span><time dateTime={series.scheduledAt || series.date}>{date(series.scheduledAt || series.date)}{!completed&&<small>{time(series.scheduledAt)}</small>}</time><small>{series.region} · {series.stage || series.event}</small></div>
    <div className="series-matchup"><span className={same(series.winner,series.teamA)?'is-winner':''}><TeamMedia team={teamRecord(teams,series.teamA)}/><b>{series.teamA}</b></span><strong className="series-score">{completed ? <>{series.scoreA ?? '—'}<i>:</i>{series.scoreB ?? '—'}</> : <i>VS</i>}</strong><span className={same(series.winner,series.teamB)?'is-winner':''}><TeamMedia team={teamRecord(teams,series.teamB)}/><b>{series.teamB}</b></span></div>
    <div className="series-context"><small>{series.event || 'Marvel Rivals competition'}{series.bestOf ? ` · BO${series.bestOf}` : ''}</small>{series.sourceUrl&&<a href={series.sourceUrl} target="_blank" rel="noreferrer">{completed?'Verify result':'Source schedule'} <ArrowUpRight size={12}/></a>}</div>
    {series.maps?.length>0&&<details className="series-map-detail"><summary>Map results <span>{series.maps.length} reported</span><ChevronDown size={12}/></summary><div>{series.maps.map((map,index)=><span key={`${map.name}-${index}`}><b>{map.name || `Map ${index+1}`}</b><span>{map.scoreA ?? '—'} : {map.scoreB ?? '—'}</span>{map.winner&&<small>{map.winner} won</small>}</span>)}</div></details>}
  </article>;
}

export function CompetitiveResults({ data, compact = false, filters = {} }) {
  const snapshot = data.competitiveResults || {};
  const [tab,setTab]=useState('completed'),[region,setRegion]=useState('all'),[query,setQuery]=useState(''),[limit,setLimit]=useState(20);
  const series = snapshot.series || [];
  const filtered = useMemo(() => {
    const selected=filterCompetitiveSeries(series,{...filters,season:'',region:region==='all'?filters.region:region});
    const searched=query?filterCompetitiveSeries(selected,{search:query}):selected;
    return !filters.mode?searched:searched.filter(item=>competitiveMapRecords([item],data.maps||[]).some(map=>same(map.mode,filters.mode)));
  },[series,filters,region,query,data.maps]);
  const completed = filtered.filter(item=>item.status==='completed').sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  const upcoming = filtered.filter(item=>item.status!=='completed').sort((a,b)=>String(a.scheduledAt||a.date).localeCompare(String(b.scheduledAt||b.date)));
  const visible = (compact?completed:tab==='completed'?completed:upcoming).slice(0,compact?4:limit);
  if(!series.length)return null;
  const regions=[...new Set(series.map(item=>item.region).filter(Boolean))].sort();
  return <section className={`competitive-results panel ${compact?'series-compact':''}`} aria-label="Current tournament series results">
    <div className="series-heading"><div><span className="eyebrow"><Swords size={13}/> TOURNAMENT RESULTS & FIXTURES</span><h2>{compact?'The latest results.':'The current competition.'}</h2><p>Verified series scores, with a source for every result.</p></div>{compact?<Link to="/matches" className="text-link">Full match log <ArrowUpRight size={14}/></Link>:<span className="badge cyan">Reviewed {date(snapshot.updatedAt)}</span>}</div>
    {!compact&&<><div className="series-summary"><span><b>{completed.length}</b> completed series</span><span><b>{upcoming.length}</b> fixtures / pending results</span><span>Results through <b>{date(snapshot.latestResultAt || completed[0]?.date)}</b></span></div><div className="series-controls"><div className="segmented"><button className={tab==='completed'?'active':''} aria-pressed={tab==='completed'} onClick={()=>{setTab('completed');setLimit(20);}}>Results</button><button className={tab==='scheduled'?'active':''} aria-pressed={tab==='scheduled'} onClick={()=>{setTab('scheduled');setLimit(20);}}>Fixtures & pending ({upcoming.length})</button></div><input className="field" type="search" aria-label="Search current tournament series" placeholder="Search teams or events…" value={query} onChange={event=>{setQuery(event.target.value);setLimit(20);}}/><select className="field" aria-label="Tournament region" value={region} onChange={event=>{setRegion(event.target.value);setLimit(20);}}><option value="all">All regions</option>{regions.map(name=><option key={name}>{name}</option>)}</select></div></>}
    <p className="series-coverage">Date, team, region, map and mode filters apply to current series. Map and mode require a published map breakdown; season applies only to the historical archive below.</p><div className="series-list">{visible.map(item=><SeriesRow key={item.id} series={item} teams={data.teams}/>)}{!visible.length&&<p className="empty">{tab==='scheduled'?'No confirmed fixtures are published in this selection. Future opponents or start times remain unconfirmed until announced.':'No verified series match this selection.'}</p>}</div>
    {!compact&&(tab==='completed'?completed:upcoming).length>limit&&<button className="btn series-load" onClick={()=>setLimit(value=>value+30)}>Show 30 more series</button>}
    <p className="series-coverage">{snapshot.coverage?.note || snapshot.coverage?.summary || snapshot.coverage?.scope || 'Series results and fixtures are collected independently of the historical map and player scoreboard archive. Coverage is limited to the cited competitions; unreported results are never inferred.'} {!compact&&'Map and player statistics below retain their own published sample dates.'}</p>
    {snapshot.coverage?.attribution&&<p className="series-coverage">{snapshot.coverage.attribution} {snapshot.coverage.licenseUrl&&<a href={snapshot.coverage.licenseUrl} target="_blank" rel="noreferrer">License <ArrowUpRight size={10}/></a>}</p>}
  </section>;
}

export function TeamSeriesResults({ data, name }) {
  const all=competitiveTeamStats(data.competitiveResults?.series||[],data.teams||[]);
  const team=all.find(item=>same(item.name,name)||item.aliases?.some(alias=>same(alias,name)));
  if(!team)return null;
  const played=team.played ?? team.matches ?? team.history?.filter(item=>item.status==='completed').length ?? 0;
  const history=(team.history||[]).filter(item=>item.status==='completed').sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  const mapResults=competitiveMapRecords(history,data.maps||[]);
  const maps=[...new Set(mapResults.map(item=>item.map))].map(name=>{const records=mapResults.filter(item=>item.map===name),wins=records.filter(item=>same(item.winner,team.name)).length;return {name,played:records.length,wins,losses:records.length-wins,winRate:wins/records.length*100,map:(data.maps||[]).find(item=>item.name===name)||{name}};}).sort((a,b)=>b.played-a.played);
  return <section className="team-series-results"><div className="series-heading"><div><span className="eyebrow"><Trophy size={12}/> CURRENT TOURNAMENT SERIES</span><h3>Results that define the run.</h3></div><small>Series sample · {date(data.competitiveResults?.latestResultAt)}</small></div><div className="team-series-metrics"><span><b>{played}</b>Series played</span><span><b>{team.wins}–{team.losses}</b>Series record</span><span><b>{team.winRate==null?'—':`${team.winRate.toFixed(1)}%`}</b>Series win rate</span></div><div className="series-list">{history.slice(0,8).map(series=><SeriesRow key={series.id} series={series} teams={data.teams}/>)}</div>{maps.length>0&&<div className="team-current-maps"><h3>Current tournament map record</h3><p className="series-coverage">{mapResults.length} individually published map results. Series with no reported map breakdown remain outside this map sample.</p><div className="team-map-record-head"><span>MAP</span><span>PLAYED</span><span>W–L</span><span>WIN RATE</span></div>{maps.map(map=><Link key={map.name} to={`/map-plans?map=${encodeURIComponent(map.map.id||map.name)}`} className="team-map-record-row"><span><MapMedia map={map.map}/><b>{map.name}</b></span><span>{map.played}</span><span>{map.wins}–{map.losses}</span><span>{map.winRate.toFixed(1)}%</span></Link>)}</div>}<p className="series-coverage">Calculated from the current verified series archive. A series win differs from a map win. Roster and individual player statistics require separately published evidence.</p></section>;
}
