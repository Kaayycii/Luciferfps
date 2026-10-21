import {aggregateRecentPlayers,filterPlayerSeries} from '../lib/player-updates.js';
export {aggregateRecentPlayers} from '../lib/player-updates.js';
import React, { useMemo, useState } from 'react';
import { ArrowUpRight, Search, Users, Clock, Trophy, GitCompareArrows } from 'lucide-react';
import { PersonMedia, TeamMedia, HeroMedia } from './Media.jsx';
import '../pages/analytics.css';
import './recent-players.css';

const METRICS = [['kills', 'Kills'], ['deaths', 'Deaths'], ['assists', 'Assists'], ['finalHits', 'Final hits'], ['damage', 'Damage'], ['damageTaken', 'Damage taken'], ['healing', 'Healing']];
const list = value => Array.isArray(value) ? value : [];
const fold = value => String(value ?? '').normalize('NFKC').toLowerCase().trim();
const known = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const number = value => known(value) ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value) : '—';
const time = value => { const result = Date.parse(value || ''); return Number.isFinite(result) ? result : 0; };
const date = value => time(value) ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(value)) : 'Unreported';
const nameOf = value => typeof value === 'string' ? value : value?.name || '';
const sourceUrl = value => { try { const url = new URL(value); return url.protocol === 'https:' ? url.href : null; } catch { return null; } };
const seriesDate = series => series.scheduledAt || series.date;


function Metric({ player, metric }) {
  const count = player.reported[metric] || 0;
  return <span title={`${count} of ${player.seriesSeen} series report this statistic`}>{number(player.totals[metric])}{count > 0 && count < player.seriesSeen && <small>{count}/{player.seriesSeen} reported</small>}</span>;
}

export default function RecentPlayers({ data = {}, filters = {} }) {
  const updates = data.playerUpdates || {};
  const series = useMemo(()=>filterPlayerSeries(list(updates.series),filters),[updates.series,filters]);
  const players = useMemo(() => aggregateRecentPlayers(series), [series]);
  const [query, setQuery] = useState('');
  const [team, setTeam] = useState('all');
  const [role, setRole] = useState('all');
  const [sort, setSort] = useState('kills');
  const [selected, setSelected] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const teams = [...new Set(players.map(player => player.latestTeam).filter(Boolean))].sort();
  const roles = [...new Set(players.map(player => player.role))].sort();
  const allTeams = new Set(series.flatMap(match => list(match.players).map(player => nameOf(player.team))).filter(Boolean));
  const filtered = players.filter(player => (team === 'all' || player.latestTeam === team) && (role === 'all' || player.role === role) && fold([player.name, player.sourceName, player.latestTeam, player.role, ...player.heroes].join(' ')).includes(fold(query))).sort((a, b) => {
    const left = sort === 'seriesSeen' ? a.seriesSeen : a.totals[sort];
    const right = sort === 'seriesSeen' ? b.seriesSeen : b.totals[sort];
    if (!known(left)) return known(right) ? 1 : a.name.localeCompare(b.name);
    if (!known(right)) return -1;
    return right - left || a.name.localeCompare(b.name);
  });
  const comparison = selected.map(id => players.find(player => player.id === id)).filter(Boolean);
  const findPerson = player => list(data.players).find(person => [person.name, person.sourceName, ...list(person.aliases)].some(name => [player.name, player.sourceName].some(candidate => fold(name) === fold(candidate)))) || { name: player.name };
  const findTeam = player => list(data.teams).find(item => (player.teamId && item.id === player.teamId) || [item.name, item.shortName, ...list(item.aliases)].some(name => fold(name) === fold(player.latestTeam))) || { name: player.latestTeam || 'Unreported' };
  const identity = player => <><PersonMedia person={findPerson(player)} className="recent-player-portrait" /><span><b>{player.name}</b><small>{player.role}</small></span></>;
  const teamIdentity = player => <span className="ana-inline-team"><TeamMedia team={findTeam(player)} /><span>{player.latestTeam || 'Unreported'}</span></span>;
  const latestAt = updates.latestMatchAt || series.slice().sort((a, b) => time(seriesDate(b)) - time(seriesDate(a)))[0]?.scheduledAt || series.slice().sort((a, b) => time(seriesDate(b)) - time(seriesDate(a)))[0]?.date;
  const toggle = id => setSelected(previous => previous.includes(id) ? previous.filter(item => item !== id) : previous.length < 4 ? [...previous, id] : previous);

  return <div className="ana-page recent-players">
    <header className="ana-intro"><div><span className="ana-eyebrow"><Trophy size={13} /> RECENT COMPETITIVE SCOREBOARDS</span><h1>Players in <span>focus.</span></h1><p>Published individual performance from recent tournament series. Explore the recorded sample, compare players and open the evidence behind each total.</p></div></header>
    <div className="ana-stats">
      {[['PUBLISHED SERIES', series.length, `${allTeams.size} teams in this sample`, Trophy], ['UNIQUE PLAYERS', players.length, 'Select 2–4 players to compare', Users], ['LATEST MATCH', date(latestAt), 'Match dates shown in UTC', Clock], ['SOURCES CHECKED', date(updates.checkedAt), 'Latest source review', ArrowUpRight]].map(([label, value, detail, Icon]) => <div className="ana-stat" key={label}><span className="ana-stat-label">{label}<Icon size={15} /></span><strong>{value}</strong><small>{detail}</small></div>)}
    </div>
    <p className="recent-players-coverage">Coverage: {series.length} published series · {allTeams.size} teams · {players.length} players. Totals cover this sample only. Team and role reflect the latest observed scoreboard. Hero lists include observed switches; totals are not attributed to a single hero.</p>
    {comparison.length > 0 && <section className="panel recent-players-comparison" aria-label="Selected player comparison"><div className="recent-players-section-heading"><h2><GitCompareArrows size={17} />Compare players <small>{comparison.length}/4</small></h2><button className="btn" onClick={() => setSelected([])}>Clear selection</button></div>{comparison.length < 2 ? <p className="ana-note">Select one more player to compare recorded series totals.</p> : <><div className="recent-players-compare-grid">{comparison.map(player => <article key={player.id}><div className="recent-players-identity">{identity(player)}</div>{teamIdentity(player)}<dl><div><dt>Series observed</dt><dd>{player.seriesSeen}</dd></div>{METRICS.map(([key, label]) => <div key={key}><dt>{label}</dt><dd><Metric player={player} metric={key} /></dd></div>)}</dl></article>)}</div><p className="ana-note">Players may have different sample sizes, opponents and roles. Compare totals alongside series counts. Missing statistics remain unreported.</p></>}</section>}
    <section className="panel ana-panel">
      <div className="ana-panel-heading"><div><span className="ana-eyebrow">INDIVIDUAL SERIES TOTALS</span><h2>Recent player directory</h2></div><span className="ana-note">{filtered.length} players</span></div>
      <div className="ana-controls recent-players-controls"><label className="ana-search"><Search size={14} /><input className="field" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search player, team or observed hero…" aria-label="Search recent players" /></label><select className="field" aria-label="Filter by latest observed team" value={team} onChange={event => setTeam(event.target.value)}><option value="all">All observed teams</option>{teams.map(name => <option key={name}>{name}</option>)}</select><select className="field" aria-label="Filter by observed role" value={role} onChange={event => setRole(event.target.value)}><option value="all">All observed roles</option>{roles.map(name => <option key={name}>{name}</option>)}</select><select className="field" aria-label="Sort recent players" value={sort} onChange={event => setSort(event.target.value)}>{[...METRICS, ['seriesSeen', 'Series observed']].map(([key, label]) => <option key={key} value={key}>{label} · highest first</option>)}</select></div>
      <div className="ana-table-wrap"><table className="ana-table recent-players-table"><thead><tr><th>COMPARE</th><th>PLAYER</th><th>LATEST OBSERVED TEAM</th><th className="ana-numeric">SERIES</th>{METRICS.map(([key, label]) => <th className="ana-numeric" key={key}>{label.toUpperCase()}</th>)}<th>DETAILS</th></tr></thead><tbody>{filtered.map(player => <React.Fragment key={player.id}><tr><td><input type="checkbox" aria-label={`Compare ${player.name}`} checked={selected.includes(player.id)} disabled={selected.length >= 4 && !selected.includes(player.id)} onChange={() => toggle(player.id)} /></td><td><button className="recent-players-identity recent-players-profile-button" onClick={() => setExpanded(expanded === player.id ? null : player.id)} aria-expanded={expanded === player.id}>{identity(player)}</button></td><td>{teamIdentity(player)}<small>Observed {date(player.latestAt)}</small></td><td className="ana-numeric">{player.seriesSeen}</td>{METRICS.map(([key]) => <td className="ana-numeric" key={key}><Metric player={player} metric={key} /></td>)}<td><button className="ana-row-action" onClick={() => setExpanded(expanded === player.id ? null : player.id)} aria-expanded={expanded === player.id}>{expanded === player.id ? 'Close' : 'View sources'}<ArrowUpRight size={12} /></button></td></tr>{expanded === player.id && <tr className="recent-players-expanded"><td colSpan={12}><div className="recent-players-profile"><div className="recent-players-section-heading"><h3>{player.name} · published evidence</h3><button className="btn" onClick={() => setExpanded(null)}>Close profile</button></div><p className="ana-note">Observed heroes across this sample, including switches. No hero-specific totals are inferred.</p><div className="recent-players-heroes">{player.heroes.length ? player.heroes.map(name => { const hero = list(data.heroes).find(item => fold(item.name) === fold(name)); return <span key={name}>{hero && <HeroMedia hero={hero} />}<span>{name}</span></span>; }) : <span className="ana-note">Hero observations unreported.</span>}</div><div className="recent-players-history">{player.history.map((record, index) => { const match = record.series; const url = sourceUrl(match.sourceUrl); return <article key={`${match.id || index}-${index}`}><div><b>{nameOf(match.teamA)} {known(match.scoreA) ? match.scoreA : '—'}–{known(match.scoreB) ? match.scoreB : '—'} {nameOf(match.teamB)}</b><small>{date(seriesDate(match))} · {match.event || 'Event unreported'} · {match.region || 'Region unreported'}</small><small>{known(match.mapCount) ? `${match.mapCount} maps in series · ` : ''}Combined series totals · observed team: {nameOf(record.team) || 'Unreported'}</small></div><dl>{METRICS.map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{number(record[key])}</dd></div>)}</dl>{url ? <a href={url} target="_blank" rel="noopener noreferrer">Open published scoreboard<ArrowUpRight size={12} /></a> : <span className="ana-note">Source link unavailable.</span>}</article>; })}</div></div></td></tr>}</React.Fragment>)}</tbody></table></div>
      {!filtered.length && <div className="ana-empty"><span><Users size={24} /></span><h3>{players.length ? 'No players match these filters' : 'Recent individual scoreboards are not available yet'}</h3><p>{players.length ? 'Try another player, team, role or hero search.' : 'Published player statistics will appear here when sourced scoreboards are available. Clear any map, mode or historical-season filters, or switch to the historical map archive. Tournament results alone do not supply individual performance.'}</p></div>}
      <p className="ana-provenance">Series totals are summed only where a statistic was published. A dash means unreported; a published zero remains zero. Partial reporting is shown beside each affected total. Series counts are not map appearance counts. Damage blocked, accuracy and per-10-minute rates are not supplied by these combined scoreboards. Map, mode and historical-season filters require the map archive.</p>
    </section>
  </div>;
}
