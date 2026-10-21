import test from 'node:test';
import assert from 'node:assert/strict';
import { REPORT_TYPES, buildVideoUrl, createReport, fightsCsv, newId, normalizeReport, parseWorkspaceImport, reportMarkdown, serializeWorkspace, summarizeFights, timestampSeconds } from './analyst.js';
import { validPlan } from './tools.js';

const envelope = reports => JSON.stringify({ schema: 'lucifer-analyst', version: 1, reports });
const fight = (values = {}) => ({ id: newId(), time: '01:23', outcome: 'unknown', firstElimination: 'unknown', ultsFor: null, ultsAgainst: null, compositionFor: '', compositionAgainst: '', notes: '', sourceUrl: '', ...values });
const board = () => ({ id: newId(), title: 'Opening board', mapId: 'midtown', layoutId: 'stage-a', attachedAt: '2026-10-21T12:00:00.000Z', plan: { title: 'Opening route', mapId: 'midtown', layoutId: 'stage-a', referenceMode: 'floorplan', objects: [{ id: 'route-1', type: 'arrow', x: 10, y: 20, x2: 500, y2: 600, color: '#00aaFF', width: 5, dashed: true }] } });

test('new reports are empty typed workspaces with unique identities', () => {
  assert.deepEqual(REPORT_TYPES.map(type => type.value), ['scouting', 'review', 'map-prep', 'patch']);
  const report = createReport();
  assert.equal(report.type, 'scouting');
  for (const field of ['team', 'opponent', 'event', 'date', 'patch', 'tournamentPatch', 'mapId', 'layoutId', 'sourceUrl', 'summary', 'mapNotes', 'winCondition', 'risks', 'patchNotes', 'recommendation']) assert.equal(report[field], '');
  for (const field of ['findings', 'fights', 'actions', 'decisions', 'boards']) assert.deepEqual(report[field], []);
  assert.equal(report.side, 'both');
  assert.notEqual(report.id, createReport().id);
  assert.equal(new Date(report.createdAt).toISOString(), report.createdAt);
  assert.throws(() => createReport('invented'), /supported/);
});

test('normalization allowlists fields and nested data without interpreting literal markup', () => {
  const input = { ...createReport(), summary: '<script>alert(1)</script>\n日本語', sourceUrl: 'javascript:alert(1)', unknown: 'drop', findings: [{ id: 'evidence', claim: 'Test only', evidence: 'Observed at source', confidence: 'observed', sourceUrl: 'https://example.com/vod', timestamp: '1:02', html: '<img>' }] };
  const output = normalizeReport(input);
  assert.equal(output.summary, input.summary);
  assert.equal(output.sourceUrl, '');
  assert.equal(output.unknown, undefined);
  assert.equal(output.findings[0].html, undefined);
  assert.equal(output.findings[0].sourceUrl, 'https://example.com/vod');
  assert.equal(output.findings[0].timestamp, '1:02');
  assert.equal(input.unknown, 'drop');
  const pollution = parseWorkspaceImport('{"schema":"lucifer-analyst","version":1,"reports":[{"__proto__":{"polluted":true}}]}');
  assert.equal({}.polluted, undefined);
  assert.equal(Object.hasOwn(pollution[0], '__proto__'), false);
});

test('invalid imported types and excessive entry sizes fail atomically', () => {
  for (const input of [null, [], 'report', { type: 'custom' }, { summary: {} }, { title: 'x'.repeat(301) }, { side: 'guessed' }, { fights: {} }, { fights: [null] }, { fights: [fight({ outcome: 'won' })] }, { fights: [fight({ ultsFor: '3' })] }, { fights: [fight({ ultsFor: -1 })] }, { fights: [fight({ ultsAgainst: Infinity })] }, { fights: [fight({ time: '2:99' })] }, { actions: [{ due: '2026-02-30' }] }, { findings: [{ confidence: 'certain' }] }, { decisions: [{ kind: 'maybe' }] }, { findings: Array.from({ length: 301 }, () => ({})) }]) assert.throws(() => normalizeReport(input));
  assert.throws(() => parseWorkspaceImport(envelope([createReport(), { fights: [{}], summary: 1 }])));
});

test('workspace import supports both versioned envelopes and regenerates duplicate identities', () => {
  const report = createReport('review');
  report.fights = [fight({ id: 'duplicate' }), fight({ id: 'duplicate' })];
  const imported = parseWorkspaceImport(envelope([report, report]));
  const ids = imported.flatMap(item => [item.id, ...item.fights.map(entry => entry.id)]);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(imported[0].id, report.id);
  assert.equal(imported[0].fights[0].id, 'duplicate');
  assert.equal(imported[1].type, 'review');
  assert.equal(parseWorkspaceImport(JSON.stringify({ schema: 'lucifer-analyst', version: 1, report })).length, 1);
  const serialized = serializeWorkspace([normalizeReport(report)]);
  assert.deepEqual(parseWorkspaceImport(serialized), JSON.parse(serialized).reports);
});

test('imports reject invalid schema, ambiguous envelopes, malformed JSON, report count and UTF-8 byte limits', () => {
  for (const value of ['', '[]', '{}', '{bad', JSON.stringify({ schema: 'other', version: 1, reports: [] }), JSON.stringify({ schema: 'lucifer-analyst', version: 2, reports: [] }), JSON.stringify({ schema: 'lucifer-analyst', version: 1, reports: [], report: {} }), JSON.stringify({ schema: 'lucifer-analyst', version: 1, reports: {} }), envelope(Array.from({ length: 501 }, () => ({})))]) assert.throws(() => parseWorkspaceImport(value));
  assert.deepEqual(parseWorkspaceImport(envelope([])), []);
  const emptyEnvelope = envelope([]);
  assert.deepEqual(parseWorkspaceImport(emptyEnvelope + ' '.repeat(5 * 1024 * 1024 - emptyEnvelope.length)), []);
  assert.equal(parseWorkspaceImport(envelope(Array.from({ length: 500 }, () => ({})))).length, 500);
  assert.throws(() => parseWorkspaceImport(' '.repeat(5 * 1024 * 1024 + 1)), /5 MB/);
  // A smaller character count can still exceed the byte limit.
  assert.throws(() => parseWorkspaceImport('日'.repeat(Math.ceil(5 * 1024 * 1024 / 3))), /5 MB/);
  assert.throws(() => parseWorkspaceImport({}), /JSON text/);
  assert.throws(() => serializeWorkspace({}), /500 reports/);
  const largeReport = { ...createReport(), summary: 'x'.repeat(30_000), mapNotes: 'x'.repeat(30_000) };
  assert.throws(() => serializeWorkspace(Array.from({ length: 100 }, () => largeReport)), /5 MB/);
});

test('board snapshots retain functional Tools data while stripping unknown and unsafe fields', () => {
  const input = board();
  input.plan.referenceImage = 'data:image/png;base64,AA==';
  input.plan.referenceName = 'Personal map.png';
  input.plan.objects.push({ id: 'ability', type: 'hero', x: 100, y: 200, heroId: 'hulk', abilityId: 'ability-1', label: 'Ability', onclick: 'bad()' });
  const report = normalizeReport({ ...createReport('map-prep'), boards: [input] });
  assert.equal(validPlan(report.boards[0].plan), true);
  assert.equal(report.boards[0].plan.objects[1].abilityId, 'ability-1');
  assert.equal(report.boards[0].plan.objects[1].onclick, undefined);
  assert.equal(report.boards[0].plan.referenceName, 'Personal map.png');
  assert.equal(report.boards[0].plan.objects[0].dashed, true);
  for (const plan of [{ title: 'Bad', mapId: 'a', objects: [{ id: 'bad', type: 'arrow', x: 0, y: 0 }] }, { ...input.plan, referenceImage: 'data:image/svg+xml;base64,AA==' }, { ...input.plan, objects: [{ id: 'bad', type: 'pen', x: 0, y: 0, points: [{ x: 1, y: NaN }] }] }, { ...input.plan, objects: [{ id: 'bad', type: 'iframe', x: 0, y: 0 }] }, { ...input.plan, objects: [{ id: 'bad', type: 'text', x: 0, y: 0, color: 'url(javascript:bad)' }] }]) assert.throws(() => normalizeReport({ boards: [{ ...input, plan }] }));
});

test('fight metrics use known denominators and never turn missing data into zero usage', () => {
  assert.deepEqual(summarizeFights([]), { logged: 0, decided: 0, wins: 0, losses: 0, draws: 0, winRate: null, firstKnown: 0, firstFor: 0, firstForRate: null, ultKnown: 0, ultsFor: null, ultsAgainst: null });
  const summary = summarizeFights([
    fight({ outcome: 'win', firstElimination: 'for', ultsFor: 0, ultsAgainst: 2 }),
    fight({ outcome: 'loss', firstElimination: 'against', ultsFor: 3, ultsAgainst: 1 }),
    fight({ outcome: 'draw', ultsFor: 9, ultsAgainst: null }),
    fight(),
  ]);
  assert.deepEqual(summary, { logged: 4, decided: 2, wins: 1, losses: 1, draws: 1, winRate: .5, firstKnown: 2, firstFor: 1, firstForRate: .5, ultKnown: 2, ultsFor: 3, ultsAgainst: 3 });
  assert.equal(summarizeFights([fight({ outcome: 'draw' })]).winRate, null);
  assert.equal(summarizeFights([fight({ ultsFor: 0, ultsAgainst: 0 })]).ultsFor, 0);
});

test('timestamps accept mm:ss or hh:mm:ss and reject malformed seconds and minute rollover', () => {
  for (const [input, expected] of [['00:00', 0], ['1:02', 62], ['123:59', 7439], ['1:02:03', 3723], ['00:59:59', 3599], [0, 0], [123, 123]]) assert.equal(timestampSeconds(input), expected);
  for (const input of ['', null, undefined, '1:60', '1:2', '1:60:00', '1:2:03', '1:00:60', '-1:30', '5', '1.5:00', '1:00 trailing', NaN, Infinity, -1, 1.5]) assert.equal(timestampSeconds(input), null);
});

test('video links allow HTTPS without credentials and add offsets only to genuine YouTube watch links', () => {
  assert.equal(buildVideoUrl('https://www.youtube.com/watch?v=abc&t=5#clip', '1:02:03'), 'https://www.youtube.com/watch?v=abc&t=3723');
  assert.equal(buildVideoUrl('https://youtu.be/abc?si=hello', 0), 'https://youtu.be/abc?si=hello&t=0');
  assert.equal(buildVideoUrl('https://example.com/vod?x=1#clip', '1:30'), 'https://example.com/vod?x=1#clip');
  assert.equal(buildVideoUrl('https://youtube.com.evil.test/watch?v=abc', '1:30'), 'https://youtube.com.evil.test/watch?v=abc');
  assert.equal(buildVideoUrl('https://www.youtube.com/watch?v=abc', ''), 'https://www.youtube.com/watch?v=abc');
  for (const input of ['javascript:alert(1)', 'data:text/html,bad', 'http://youtube.com/watch?v=abc', 'https://user:password@youtube.com/watch?v=abc', '//youtube.com/watch?v=abc', 'not a URL']) assert.equal(buildVideoUrl(input, '1:30'), null);
  assert.equal(buildVideoUrl('https://youtu.be/abc', '1:99'), null);
});

test('Markdown preserves report evidence, metadata and follow-up without fabricated claims', () => {
  const report = createReport('patch');
  Object.assign(report, { title: 'Patch review 日本語', team: 'Our team', opponent: 'Their team', event: 'Scrim', date: '2026-10-21', patch: 'Live 1', tournamentPatch: 'Event 0', mapId: 'midtown', layoutId: 'a', side: 'attack', sourceUrl: 'https://example.com/patch', summary: 'Summary\nSecond line', mapNotes: 'Use the high ground', winCondition: 'Test our route', risks: 'Unverified rotation', patchNotes: 'Literal <script>not executable</script>', recommendation: 'Practice first' });
  report.findings = [{ id: 'f', claim: 'One recorded observation', evidence: 'Exact evidence\nWith context', sourceUrl: 'https://example.com/vod', timestamp: '01:23', confidence: 'hypothesis' }];
  report.fights = [fight({ notes: 'Reason, with | pipe\nand newline', sourceUrl: 'https://example.com/fight' })];
  report.decisions = [{ id: 'd', kind: 'ban', team: 'Our team', hero: 'Hulk', note: 'Test ban reason' }];
  report.actions = [{ id: 'a', title: 'Watch VOD', owner: 'Coach', due: '2026-10-22', status: 'todo', reason: 'Verify hypothesis' }];
  report.boards = [board()];
  const md = reportMarkdown(report);
  for (const text of ['Patch review 日本語', 'Our team', 'Their team', 'Scrim', '2026-10-21', 'Live 1', 'Event 0', 'midtown', 'Summary\nSecond line', 'Use the high ground', 'Test our route', 'Unverified rotation', 'Practice first', 'One recorded observation', 'Exact evidence\nWith context', 'hypothesis', '01:23', 'https://example.com/vod', 'Hulk', 'Test ban reason', 'Watch VOD', 'Coach', '2026-10-22', 'Verify hypothesis', 'Opening board', 'Opening route', 'https://example.com/fight']) assert.ok(md.includes(text), `Missing ${text}`);
  assert.ok(md.includes('&lt;script&gt;not executable&lt;/script&gt;'));
  assert.ok(md.includes('Reason, with \\| pipe<br>and newline'));
  assert.ok(md.includes('Win rate: Unknown'));
  assert.ok(md.includes('not global match, team, or hero statistics'));
  assert.ok(!md.includes('NaN'));
});

test('CSV escapes commas, quotes and newlines and prevents spreadsheet formula injection', () => {
  const report = createReport();
  report.title = '=HYPERLINK("https://evil.test")';
  report.team = '+cmd'; report.opponent = '-cmd'; report.event = '@SUM(A1)';
  report.fights = [fight({ compositionFor: '\t=cmd', compositionAgainst: '\r=cmd', notes: 'A "quoted", multiline\nnote' }), fight({ notes: '  =SUM(1,2)' })];
  const csv = fightsCsv(report);
  assert.ok(csv.includes('"\'=HYPERLINK(""https://evil.test"")"'));
  assert.ok(csv.includes("'+cmd,'-cmd,'@SUM(A1)"));
  assert.ok(csv.includes("'\t=cmd"));
  assert.ok(csv.includes('"\'\r=cmd"'));
  assert.ok(csv.includes('"A ""quoted"", multiline\nnote"'));
  assert.ok(csv.includes('"\'  =SUM(1,2)"'));
  assert.ok(csv.includes(',unknown,unknown,,,') || csv.includes(',unknown,unknown,,,'));
  assert.equal(report.fights[0].notes, 'A "quoted", multiline\nnote');
});


test('CSV retains the report source when individual fights inherit primary footage', () => { const report=createReport('review'); report.sourceUrl='https://www.youtube.com/watch?v=example'; report.fights=[{id:'f1',time:'01:00',outcome:'unknown',firstElimination:'unknown',ultsFor:null,ultsAgainst:null,compositionFor:'',compositionAgainst:'',notes:'',sourceUrl:''}]; assert.ok(fightsCsv(report).includes(report.sourceUrl)); });
