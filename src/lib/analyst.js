const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
const MAX_REPORTS = 500;
const TYPES = ['scouting', 'review', 'map-prep', 'patch'];
const OUTCOMES = ['win', 'loss', 'draw', 'unknown'];
const FIRSTS = ['for', 'against', 'unknown'];
const CONFIDENCES = ['observed', 'hypothesis', 'uncertain'];
const OBJECT_TYPES = ['hero', 'text', 'pen', 'arrow', 'line', 'highlight', 'zone'];

export const REPORT_TYPES = Object.freeze([
  { value: 'scouting', label: 'Opponent scouting', description: 'Record sourced opponent tendencies and preparation priorities.' },
  { value: 'review', label: 'Post-match review', description: 'Review logged fights, evidence, and follow-up actions.' },
  { value: 'map-prep', label: 'Map preparation', description: 'Connect map notes, win conditions, and tactical boards.' },
  { value: 'patch', label: 'Patch impact', description: 'Track patch evidence, tournament rules, and recommendations.' },
]);

export function newId() {
  return globalThis.crypto?.randomUUID?.() || `analyst-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function createReport(type = 'scouting') {
  if (!TYPES.includes(type)) throw new TypeError('Choose a supported report type.');
  const now = new Date().toISOString();
  const titles = { scouting: 'Opponent scouting', review: 'Post-match review', 'map-prep': 'Map preparation', patch: 'Patch impact' };
  return {
    id: newId(), title: titles[type], type, createdAt: now, updatedAt: now,
    team: '', opponent: '', event: '', date: '', patch: '', tournamentPatch: '', mapId: '', layoutId: '', side: 'both',
    sourceUrl: '', summary: '', mapNotes: '', winCondition: '', risks: '', patchNotes: '', recommendation: '',
    findings: [], fights: [], actions: [], decisions: [], boards: [],
  };
}

function record(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new TypeError(`${label} must be an object.`);
  return value;
}
function string(value, label, limit = 1000, fallback = '') {
  if (value === undefined) return fallback;
  if (typeof value !== 'string') throw new TypeError(`${label} must be text.`);
  if (value.length > limit) throw new RangeError(`${label} exceeds ${limit} characters.`);
  // Retain whitespace and literal markup as data. Consumers must render text, never HTML.
  return value.replace(/\u0000/g, '');
}
function choice(value, choices, label, fallback) {
  if (value === undefined) return fallback;
  if (!choices.includes(value)) throw new TypeError(`${label} has an unsupported value.`);
  return value;
}
function collection(value, label, limit, map) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new TypeError(`${label} must be a list.`);
  if (value.length > limit) throw new RangeError(`${label} exceeds ${limit} entries.`);
  return value.map((entry, index) => map(record(entry, `${label} entry ${index + 1}`)));
}
function identifier(value, seen) {
  let id = string(value, 'ID', 160);
  if (!id.trim() || seen.has(id)) id = newId();
  while (seen.has(id)) id = newId();
  seen.add(id);
  return id;
}
function isoDate(value, label, fallback) {
  const input = string(value, label, 40, fallback);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(input) || !Number.isFinite(Date.parse(input))) throw new TypeError(`${label} must be a UTC ISO date.`);
  if (new Date(input).toISOString().slice(0, 19) !== input.slice(0, 19)) throw new TypeError(`${label} must be a valid UTC date.`);
  return input;
}
function calendarDate(value, label) {
  const input = string(value, label, 10);
  if (input && (!/^\d{4}-\d{2}-\d{2}$/.test(input) || new Date(`${input}T00:00:00Z`).toISOString().slice(0, 10) !== input)) throw new TypeError(`${label} must be a valid YYYY-MM-DD date.`);
  return input;
}
function httpsUrl(value, label = 'Source URL') {
  const input = string(value, label, 4000).trim();
  if (!input) return '';
  try {
    const parsed = new URL(input);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return '';
    return parsed.href;
  } catch { return ''; }
}
function count(value, label) {
  if (value === undefined || value === null || value === '') return null;
  if (!Number.isSafeInteger(value) || value < 0 || value > 1000) throw new TypeError(`${label} must be an integer from 0 to 1000 or unknown.`);
  return value;
}
function finite(value, label) {
  if (!Number.isFinite(value) || Math.abs(value) > 10_000_000) throw new TypeError(`${label} must be a finite coordinate.`);
  return value;
}
function normalizePlan(value) {
  const p = record(value, 'Board plan');
  const result = { title: string(p.title, 'Plan title', 1000), mapId: string(p.mapId, 'Plan map', 200), objects: [] };
  if (typeof p.title !== 'string' || typeof p.mapId !== 'string' || !Array.isArray(p.objects)) throw new TypeError('Board plan requires a title, map, and objects.');
  if (p.layoutId !== undefined) result.layoutId = string(p.layoutId, 'Plan layout', 200);
  if (p.referenceMode !== undefined) result.referenceMode = choice(p.referenceMode, ['floorplan', 'art'], 'Plan reference mode');
  if (p.referenceName !== undefined) result.referenceName = string(p.referenceName, 'Reference name', 120);
  if (p.referenceImage !== undefined) {
    const image = string(p.referenceImage, 'Reference image', 2_000_000);
    if (!/^data:image\/(?:jpeg|png|webp);base64,[a-zA-Z0-9+/=]+$/.test(image)) throw new TypeError('Board reference must be a bounded PNG, JPEG, or WebP data image.');
    result.referenceImage = image;
  }
  const objectIds = new Set();
  result.objects = collection(p.objects, 'Board objects', 2000, object => {
    const type = choice(object.type, OBJECT_TYPES, 'Board object type');
    if (!type) throw new TypeError('Board object requires a supported type.');
    const clean = { id: identifier(object.id, objectIds), type, x: finite(object.x, 'Object x'), y: finite(object.y, 'Object y') };
    for (const key of ['heroId', 'abilityId']) if (object[key] !== undefined) clean[key] = string(object[key], `Object ${key}`, 200);
    for (const key of ['text', 'label']) if (object[key] !== undefined) clean[key] = string(object[key], `Object ${key}`, 10_000);
    if (object.color !== undefined) {
      if (typeof object.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(object.color)) throw new TypeError('Object color must be a six-digit hex color.');
      clean.color = object.color;
    }
    if (object.dashed !== undefined) {
      if (typeof object.dashed !== 'boolean') throw new TypeError('Dashed must be true or false.');
      clean.dashed = object.dashed;
    }
    // Preserve the optional numeric settings used by the existing Tools planner.
    for (const key of ['width', 'size', 'fontSize', 'opacity', 'rotation']) if (object[key] !== undefined) clean[key] = finite(object[key], `Object ${key}`);
    for (const key of ['x2', 'y2']) if (object[key] !== undefined || ['arrow', 'line', 'zone'].includes(type)) clean[key] = finite(object[key], `Object ${key}`);
    if (object.points !== undefined || ['pen', 'highlight'].includes(type)) clean.points = collection(object.points, 'Stroke points', 20_000, point => ({ x: finite(point.x, 'Point x'), y: finite(point.y, 'Point y') }));
    if (['pen', 'highlight'].includes(type) && !Array.isArray(object.points)) throw new TypeError('A stroke requires drawing points.');
    return clean;
  });
  return result;
}

function normalize(input, seen) {
  const source = record(input, 'Report');
  const type = choice(source.type, TYPES, 'Report type', 'scouting');
  const defaults = createReport(type);
  const result = { id: identifier(source.id, seen), title: string(source.title, 'Title', 300, defaults.title), type,
    createdAt: isoDate(source.createdAt, 'Created date', defaults.createdAt), updatedAt: isoDate(source.updatedAt, 'Updated date', defaults.updatedAt) };
  for (const key of ['team', 'opponent', 'event', 'patch', 'tournamentPatch', 'mapId', 'layoutId']) result[key] = string(source[key], key, 300);
  result.date = calendarDate(source.date, 'Match date');
  result.side = choice(source.side, ['both', 'attack', 'defense', 'neutral', 'blue', 'red'], 'Side', 'both');
  result.sourceUrl = httpsUrl(source.sourceUrl);
  for (const key of ['summary', 'mapNotes', 'winCondition', 'risks', 'patchNotes', 'recommendation']) result[key] = string(source[key], key, 30_000);
  result.findings = collection(source.findings, 'Findings', 300, finding => ({
    id: identifier(finding.id, seen), claim: string(finding.claim, 'Finding claim', 5000), evidence: string(finding.evidence, 'Finding evidence', 15_000),
    sourceUrl: httpsUrl(finding.sourceUrl), timestamp: string(finding.timestamp, 'Finding timestamp', 40), confidence: choice(finding.confidence, CONFIDENCES, 'Finding confidence', 'uncertain'),
  }));
  for (const finding of result.findings) if (finding.timestamp && timestampSeconds(finding.timestamp) === null) throw new TypeError('Finding timestamps must use mm:ss or hh:mm:ss.');
  result.fights = collection(source.fights, 'Fights', 2000, fight => {
    const time = string(fight.time, 'Fight time', 40);
    if (time && timestampSeconds(time) === null) throw new TypeError('Fight times must use mm:ss or hh:mm:ss.');
    return { id: identifier(fight.id, seen), time, outcome: choice(fight.outcome, OUTCOMES, 'Fight outcome', 'unknown'),
      firstElimination: choice(fight.firstElimination, FIRSTS, 'First elimination', 'unknown'), ultsFor: count(fight.ultsFor, 'Our ultimates'), ultsAgainst: count(fight.ultsAgainst, 'Opponent ultimates'),
      compositionFor: string(fight.compositionFor, 'Our composition', 2000), compositionAgainst: string(fight.compositionAgainst, 'Opponent composition', 2000), notes: string(fight.notes, 'Fight notes', 15_000), sourceUrl: httpsUrl(fight.sourceUrl) };
  });
  result.actions = collection(source.actions, 'Actions', 300, action => ({ id: identifier(action.id, seen), title: string(action.title, 'Action title', 2000), owner: string(action.owner, 'Action owner', 300), due: calendarDate(action.due, 'Action due date'), status: choice(action.status, ['todo', 'done'], 'Action status', 'todo'), reason: string(action.reason, 'Action reason', 10_000) }));
  result.decisions = collection(source.decisions, 'Draft decisions', 300, decision => ({ id: identifier(decision.id, seen), kind: choice(decision.kind, ['pick', 'ban'], 'Draft decision', 'pick'), team: string(decision.team, 'Draft team', 300), hero: string(decision.hero, 'Draft hero', 300), note: string(decision.note, 'Draft note', 10_000) }));
  result.boards = collection(source.boards, 'Boards', 20, board => ({ id: identifier(board.id, seen), title: string(board.title, 'Board title', 1000), mapId: string(board.mapId, 'Board map', 300), layoutId: string(board.layoutId, 'Board layout', 300), plan: normalizePlan(board.plan), attachedAt: isoDate(board.attachedAt, 'Board attachment date', defaults.createdAt) }));
  return result;
}

export function normalizeReport(input) { return normalize(input, new Set()); }

export function parseWorkspaceImport(text) {
  if (typeof text !== 'string') throw new TypeError('Import must be JSON text.');
  if (new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) throw new RangeError('Import exceeds the 5 MB limit.');
  let envelope;
  try { envelope = JSON.parse(text); } catch { throw new TypeError('Import must contain valid JSON.'); }
  record(envelope, 'Import');
  if (envelope.schema !== 'lucifer-analyst' || envelope.version !== 1) throw new TypeError('Import requires lucifer-analyst schema version 1.');
  const hasReports = Object.hasOwn(envelope, 'reports'), hasReport = Object.hasOwn(envelope, 'report');
  if (hasReports === hasReport) throw new TypeError('Import must contain reports or one report.');
  const reports = hasReports ? envelope.reports : [envelope.report];
  if (!Array.isArray(reports) || reports.length > MAX_REPORTS) throw new RangeError('Import supports up to 500 reports.');
  const seen = new Set();
  return reports.map(report => normalize(report, seen));
}

export function serializeWorkspace(reports) {
  if (!Array.isArray(reports) || reports.length > MAX_REPORTS) throw new RangeError('Workspace supports up to 500 reports.');
  const seen = new Set();
  const text = JSON.stringify({ schema: 'lucifer-analyst', version: 1, reports: reports.map(report => normalize(report, seen)) }, null, 2);
  if (new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) throw new RangeError('Export exceeds the 5 MB import limit.');
  return text;
}

/** A rate is a fraction in [0, 1]. Ultimate totals use only complete pairs. */
export function summarizeFights(fights) {
  const items = Array.isArray(fights) ? fights.filter(fight => fight && typeof fight === 'object') : [];
  const wins = items.filter(fight => fight.outcome === 'win').length;
  const losses = items.filter(fight => fight.outcome === 'loss').length;
  const draws = items.filter(fight => fight.outcome === 'draw').length;
  const firstKnown = items.filter(fight => ['for', 'against'].includes(fight.firstElimination)).length;
  const firstFor = items.filter(fight => fight.firstElimination === 'for').length;
  const ultPairs = items.filter(fight => Number.isSafeInteger(fight.ultsFor) && fight.ultsFor >= 0 && Number.isSafeInteger(fight.ultsAgainst) && fight.ultsAgainst >= 0);
  return { logged: items.length, decided: wins + losses, wins, losses, draws, winRate: wins + losses ? wins / (wins + losses) : null,
    firstKnown, firstFor, firstForRate: firstKnown ? firstFor / firstKnown : null, ultKnown: ultPairs.length,
    ultsFor: ultPairs.length ? ultPairs.reduce((sum, fight) => sum + fight.ultsFor, 0) : null,
    ultsAgainst: ultPairs.length ? ultPairs.reduce((sum, fight) => sum + fight.ultsAgainst, 0) : null };
}

export function timestampSeconds(value) {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value >= 0 ? value : null;
  if (typeof value !== 'string') return null;
  const input = value.trim();
  const match = /^(?:(\d{1,6}):)?(\d{1,6}):(\d{2})$/.exec(input);
  if (!match || Number(match[3]) > 59 || (match[1] !== undefined && (match[2].length !== 2 || Number(match[2]) > 59))) return null;
  const result = Number(match[1] || 0) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  return Number.isSafeInteger(result) ? result : null;
}

export function buildVideoUrl(url, time) {
  if (typeof url !== 'string' || url.length > 4000) return null;
  const safe = httpsUrl(url);
  if (!safe) return null;
  const parsed = new URL(safe);
  const youtube = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(parsed.hostname) && parsed.pathname === '/watch';
  const short = parsed.hostname === 'youtu.be' && /^\/[^/]+\/?$/.test(parsed.pathname);
  if (youtube || short) {
    if (time === undefined || time === null || time === '') return parsed.href;
    const seconds = timestampSeconds(time);
    if (seconds === null) return null;
    parsed.searchParams.set('t', String(seconds));
    parsed.hash = '';
  }
  return parsed.href;
}

function markdown(value) { return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'); }
function cell(value) { return markdown(value).replaceAll('|', '\\|').replace(/\r?\n/g, '<br>'); }
function field(label, value) { return `**${label}:** ${markdown(value || 'Not recorded')}`; }
function section(title, value) { return `## ${title}\n\n${markdown(value || 'Not recorded')}`; }

export function reportMarkdown(input) {
  const report = normalizeReport(input);
  const stats = summarizeFights(report.fights);
  const metadata = [['Report ID', report.id], ['Report type', REPORT_TYPES.find(type => type.value === report.type).label], ['Team', report.team], ['Opponent', report.opponent], ['Event', report.event], ['Match date', report.date], ['Patch', report.patch], ['Tournament patch', report.tournamentPatch], ['Map', report.mapId], ['Layout', report.layoutId], ['Side', report.side], ['Source', report.sourceUrl], ['Created', report.createdAt], ['Updated', report.updatedAt]].map(([label, value]) => field(label, value)).join('  \n');
  const findings = report.findings.length ? report.findings.map((finding, index) => `### ${index + 1}. ${markdown(finding.claim || 'Untitled finding')}\n\n${field('Confidence', finding.confidence)}  \n${field('Timestamp', finding.timestamp)}  \n${field('Source', finding.sourceUrl)}\n\n${markdown(finding.evidence || 'Evidence not recorded')}`).join('\n\n') : 'No findings recorded.';
  const fights = ['| Time | Outcome | First elimination | Our ults | Opponent ults | Our composition | Opponent composition | Notes | Source |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- |', ...report.fights.map(fight => `| ${[fight.time || 'Unknown', fight.outcome, fight.firstElimination, fight.ultsFor ?? 'Unknown', fight.ultsAgainst ?? 'Unknown', fight.compositionFor, fight.compositionAgainst, fight.notes, fight.sourceUrl].map(cell).join(' | ')} |`)].join('\n');
  const metrics = `Logged fights: ${stats.logged}. Wins: ${stats.wins}; losses: ${stats.losses}; draws: ${stats.draws}. Win rate: ${stats.winRate === null ? 'Unknown' : `${(stats.winRate * 100).toFixed(1)}%`} (${stats.decided} wins/losses). First elimination for us: ${stats.firstFor}/${stats.firstKnown} known. Ultimate usage: ${stats.ultKnown ? `${stats.ultsFor} for / ${stats.ultsAgainst} against across ${stats.ultKnown} fully recorded fights` : 'Unknown'}.\n\nThese figures describe only the observations logged in this report. They are not global match, team, or hero statistics. Draws and unknown outcomes are excluded from win rate; incomplete ultimate pairs are excluded from usage totals.`;
  const decisions = report.decisions.length ? report.decisions.map((decision, index) => `${index + 1}. **${markdown(decision.kind)} — ${markdown(decision.hero || 'Hero not recorded')}** (${markdown(decision.team || 'Team not recorded')})\n\n   ${markdown(decision.note || 'No note recorded').replace(/\n/g, '\n   ')}`).join('\n\n') : 'No draft decisions recorded.';
  const boards = report.boards.length ? report.boards.map(board => `### ${markdown(board.title || board.plan.title || 'Untitled board')}\n\n${field('Map', board.mapId || board.plan.mapId)}  \n${field('Layout', board.layoutId || board.plan.layoutId)}  \n${field('Attached', board.attachedAt)}  \n${field('Plan title', board.plan.title)}  \n${field('Plan objects', String(board.plan.objects.length))}\n\nThe attached drawing is preserved in the JSON workspace export.`).join('\n\n') : 'No tactical boards attached.';
  const actions = report.actions.length ? report.actions.map(action => `- [${action.status === 'done' ? 'x' : ' '}] ${markdown(action.title || 'Untitled action')} — Owner: ${markdown(action.owner || 'Unassigned')}; due: ${markdown(action.due || 'Not set')}\n  Reason: ${markdown(action.reason || 'Not recorded').replace(/\n/g, '\n  ')}`).join('\n\n') : 'No actions recorded.';
  return [`# ${markdown(report.title)}`, metadata, section('Summary', report.summary), section('Map notes', report.mapNotes), section('Win condition', report.winCondition), section('Risks', report.risks), section('Patch notes', report.patchNotes), section('Recommendation', report.recommendation), `## Findings\n\n${findings}`, `## Fight log\n\n${metrics}\n\n${fights}`, `## Draft decisions\n\n${decisions}`, `## Tactical boards\n\n${boards}`, `## Actions\n\n${actions}`].join('\n\n') + '\n';
}

function csvCell(value) {
  let output = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(output) || /^\s+[=+\-@]/.test(output)) output = `'${output}`;
  return /[",\r\n]/.test(output) ? `"${output.replaceAll('"', '""')}"` : output;
}
export function fightsCsv(input) {
  const report = normalizeReport(input);
  const rows = [['Report', 'Team', 'Opponent', 'Event', 'Date', 'Map', 'Time', 'Outcome', 'First elimination', 'Our ultimates', 'Opponent ultimates', 'Our composition', 'Opponent composition', 'Notes', 'Source']];
  for (const fight of report.fights) rows.push([report.title, report.team, report.opponent, report.event, report.date, report.mapId, fight.time, fight.outcome, fight.firstElimination, fight.ultsFor ?? '', fight.ultsAgainst ?? '', fight.compositionFor, fight.compositionAgainst, fight.notes, fight.sourceUrl || report.sourceUrl]);
  return rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}


