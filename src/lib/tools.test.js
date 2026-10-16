import test from 'node:test';
import assert from 'node:assert/strict';
import { createHistoryState, decodeSnapshot, encodeSnapshot, getDragId, historyCommit, historyRedo, historyUndo, resizeBingo, safeRead, setDragId, snapshotFromSearch, validBingo, validDraft, validPlan, validTier } from './tools.js';

function draft() { return { title: 'Opening · 日本語', preset: 'tournament', blue: { timeline: Array(7).fill(null), comp: Array(6).fill(null), notes: '' }, red: { timeline: Array(7).fill(null), comp: Array(6).fill(null), notes: '' } }; }
function bingo() { return { title: 'Session', size: 7, free: true, cells: Array.from({ length: 49 }, (_, i) => `Moment ${i}`), marks: [0, 24, 48] }; }
function plan(objects = []) { return { title: 'Opening plan', mapId: 'tokyo', objects }; }

test('URL snapshots round-trip unicode draft content without executable parsing', () => {
  const input = draft(); input.blue.comp[0] = 'adam-warlock'; input.red.notes = '</script><script>throw new Error("not executed")</script>';
  const encoded = encodeSnapshot(input);
  assert.match(encoded, /^[\w-]+$/);
  assert.deepEqual(decodeSnapshot(encoded), input);
  assert.deepEqual(snapshotFromSearch(`?draft=${encoded}`, 'draft', validDraft), input);
  assert.equal(snapshotFromSearch(`?draft=${encodeSnapshot({ html: '<script>bad()</script>' })}`, 'draft', validDraft), null);
});

test('Malformed, oversized, and schema-incompatible snapshots are rejected', () => {
  for (const value of [null, '', '***not-base64***', 'a'.repeat(60001), btoa('not JSON'), btoa('{"title":')]) assert.equal(decodeSnapshot(value), null);
  assert.equal(snapshotFromSearch('?draft=%FF%FE%00', 'draft', validDraft), null);
  assert.equal(snapshotFromSearch(`?draft=${encodeSnapshot([])}`, 'draft', validDraft), null);
  assert.equal(snapshotFromSearch('', 'draft', validDraft), null);
});

test('Imported draft must preserve the two complete, typed team structures', () => {
  assert.equal(validDraft(draft()), true);
  for (const input of [null, [], {}, { ...draft(), preset: 'unknown' }, { ...draft(), red: { comp: [] } }, { ...draft(), blue: { ...draft().blue, timeline: Array(6).fill(null) } }, { ...draft(), blue: { ...draft().blue, comp: [{ id: 'object' }, ...Array(5).fill(null)] } }]) assert.equal(validDraft(input), false);
});

test('Draft matchup metadata survives shared URLs and older drafts remain compatible', () => {
  const input = { ...draft(), mapId: 'midtown', mode: 'Convoy', enemyTeamId: 'aconyx' };
  assert.deepEqual(snapshotFromSearch(`?draft=${encodeSnapshot(input)}`, 'draft', validDraft), input);
  assert.equal(validDraft(draft()), true);
  assert.equal(validDraft({ ...input, mapId: { unexpected: 'object' } }), false);
  assert.equal(validDraft({ ...input, enemyTeamId: null }), false);
  assert.equal(validDraft({ ...input, mode: ['Convoy'] }), false);
});

test('Planner rejects malformed drawing points and non-finite geometry before SVG rendering', () => {
  assert.equal(validPlan(plan([{ id: 'arrow-1', type: 'arrow', x: 10, y: 15, x2: 200, y2: 215, color: '#ff003c' }])), true);
  const stroke = { id: 'pen-1', type: 'pen', x: 5, y: 10, points: [{ x: 5, y: 10 }, { x: 15, y: 50 }] };
  assert.equal(validPlan(plan([stroke])), true);
  for (const input of [plan([{ ...stroke, points: null }]), plan([{ ...stroke, points: [null] }]), plan([{ ...stroke, points: [{ x: 1, y: '2' }] }]), plan([{ ...stroke, x: Infinity }]), plan([{ ...stroke, type: 'iframe' }]), plan([{ id: 'missing-endpoint', type: 'arrow', x: 1, y: 2 }]), plan([{ ...stroke, color: 'url(https://example.com)' }])]) assert.equal(validPlan(input), false);
});

test('Tier and bingo imports enforce stable item and board shapes', () => {
  const tiers = { title: 'My rankings', rows: [{ id: 's', name: 'S', color: '#ff003c', items: ['heroes:hulk'] }], custom: [{ id: 'custom:1', name: 'My item' }] };
  assert.equal(validTier(tiers), true);
  assert.equal(validTier({ ...tiers, rows: [null] }), false);
  assert.equal(validTier({ ...tiers, custom: ['broken'] }), false);
  assert.equal(validTier({ ...tiers, rows: Array(21).fill(tiers.rows[0]) }), false);
  assert.equal(validBingo(bingo()), true);
  assert.equal(validBingo({ ...bingo(), cells: ['one'] }), false);
  assert.equal(validBingo({ ...bingo(), size: 8 }), false);
  assert.equal(validBingo({ ...bingo(), marks: [49] }), false);
});

test('History branch discards redo after a new edit and preserves older immutable snapshots', () => {
  const original = { slots: ['hulk', null] };
  let history = createHistoryState(original);
  history = historyCommit(history, current => ({ slots: [...current.slots, 'luna-snow'] }));
  const second = history.present;
  history = historyCommit(history, { slots: ['magneto'] });
  history = historyUndo(history);
  assert.deepEqual(history.present, second);
  assert.equal(history.future.length, 1);
  history = historyCommit(history, { slots: ['adam-warlock'] });
  assert.equal(history.future.length, 0);
  assert.strictEqual(historyRedo(history), history);
  history = historyUndo(history); assert.deepEqual(history.present, second);
  history = historyUndo(history); assert.deepEqual(history.present, original);
  assert.deepEqual(original.slots, ['hulk', null]);
});

test('History caps retained edits and no-op commits do not erase a redo branch', () => {
  let history = createHistoryState({ count: 0 });
  assert.strictEqual(historyUndo(history), history);
  for (let i = 1; i <= 100; i++) history = historyCommit(history, { count: i });
  assert.equal(history.past.length, 60);
  history = historyUndo(history);
  const same = historyCommit(history, { count: 99 });
  assert.strictEqual(same, history);
  assert.equal(historyRedo(same).present.count, 100);
});

test('Resizing bingo hides cells without discarding off-grid text, marks, or the center text', () => {
  const original = bingo();
  original.cells[24] = 'Original center stays under FREE'; original.cells[48] = 'Bottom right at 7 × 7';
  const small = resizeBingo(original, 3), restored = resizeBingo(small, 7);
  assert.equal(small.size, 3);
  assert.strictEqual(small.cells, original.cells);
  assert.strictEqual(small.marks, original.marks);
  assert.deepEqual(restored, original);
  assert.equal(restored.cells[24], 'Original center stays under FREE');
  assert.equal(restored.cells[48], 'Bottom right at 7 × 7');
  assert.throws(() => resizeBingo(original, 2), RangeError);
  assert.throws(() => resizeBingo(original, '5'), RangeError);
});

test('Drag payload carries only an item ID, prefers application data, and falls back to plain text', () => {
  const values = new Map(); const transfer = { setData: (type, value) => values.set(type, value), getData: type => values.get(type) || '' };
  setDragId({ dataTransfer: transfer }, 'hero:hulk');
  assert.equal(transfer.effectAllowed, 'move');
  assert.equal(getDragId({ dataTransfer: transfer }), 'hero:hulk');
  values.delete('application/x-lucifer-item');
  assert.equal(getDragId({ dataTransfer: transfer }), 'hero:hulk');
  values.clear(); assert.equal(getDragId({ dataTransfer: transfer }), '');
});

test('Local state fails closed when storage is malformed, schema is outdated, or access is unavailable', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const fallback = { clean: true };
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => '{broken JSON' } });
    assert.strictEqual(safeRead('test', fallback, validPlan), fallback);
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => JSON.stringify({ old: 'schema' }) } });
    assert.strictEqual(safeRead('test', fallback, validPlan), fallback);
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => { throw new Error('access blocked'); } });
    assert.strictEqual(safeRead('test', fallback, validPlan), fallback);
  } finally { if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor); else delete globalThis.localStorage; }
});
