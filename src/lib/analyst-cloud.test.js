import test from 'node:test';
import assert from 'node:assert/strict';
import { analystCloudError, createCloudPayload, deleteAnalystBackup, getAnalystCloudClient, getAnalystCloudConfig, MAX_CLOUD_BACKUP_BYTES, readAnalystBackup, uploadAnalystBackup, validateCloudPayload } from './analyst-cloud.js';

const userId = '11111111-2222-4333-8444-555555555555';
const payload = () => ({ schema: 'lucifer-analyst', version: 1, reports: [{ id: 'report-1', title: 'Review' }] });
const row = (revision = 1) => ({ payload: payload(), updated_at: '2026-10-21T18:00:00.000Z', revision });
const env = extra => ({ VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_ANON_KEY: 'public-example', ...extra });

function fakeClient(result) {
  const calls = [];
  const query = Object.fromEntries(['select', 'eq', 'insert', 'update', 'delete'].map(name => [name, (...args) => { calls.push([name, ...args]); return query; }]));
  query.maybeSingle = async () => { calls.push(['maybeSingle']); return result; };
  return { calls, from: name => { calls.push(['from', name]); return query; } };
}

test('cloud requires a separate opt-in and complete safe public configuration', async () => {
  assert.equal(getAnalystCloudConfig(env()).enabled, false);
  assert.equal(getAnalystCloudConfig(env({ VITE_ANALYST_CLOUD_ENABLED: 'true' })).enabled, true);
  assert.equal(getAnalystCloudConfig(env({ VITE_ANALYST_CLOUD_ENABLED: 'false' })).enabled, false);
  assert.equal(getAnalystCloudConfig(env({ VITE_ANALYST_CLOUD_ENABLED: 'true', VITE_SUPABASE_ANON_KEY: '' })).enabled, false);
  assert.equal(getAnalystCloudConfig(env({ VITE_ANALYST_CLOUD_ENABLED: 'true', VITE_SUPABASE_URL: 'javascript:alert(1)' })).enabled, false);
  assert.equal(getAnalystCloudConfig(env({ VITE_ANALYST_CLOUD_ENABLED: 'true', VITE_SUPABASE_URL: 'http://remote.example' })).enabled, false);
  assert.equal(getAnalystCloudConfig(env({ VITE_ANALYST_CLOUD_ENABLED: 'true', VITE_SUPABASE_URL: 'http://127.0.0.1:54321' })).enabled, true);
  assert.equal(getAnalystCloudConfig(env({ VITE_ANALYST_CLOUD_ENABLED: 'true', VITE_SUPABASE_ANON_KEY: 'sb_secret_example' })).enabled, false);
  const privileged = `e30.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.signature`;
  assert.equal(getAnalystCloudConfig(env({ VITE_ANALYST_CLOUD_ENABLED: 'true', VITE_SUPABASE_ANON_KEY: privileged })).enabled, false);
  assert.equal(await getAnalystCloudClient(), null, 'disabled Node import does not initialize an auth client');
});

test('payload snapshots are bounded, versioned, and independent of later local edits', () => {
  const reports = [{ id: '1', notes: { text: 'before' } }];
  const snapshot = createCloudPayload(reports);
  reports[0].notes.text = 'after';
  assert.equal(snapshot.reports[0].notes.text, 'before');
  assert.deepEqual(createCloudPayload([]), { schema: 'lucifer-analyst', version: 1, reports: [] });
  for (const invalid of [null, [], {}, { ...payload(), schema: 'other' }, { ...payload(), version: '1' }, { ...payload(), reports: {} }, { ...payload(), reports: [null] }, { ...payload(), reports: [[]] }, { ...payload(), reports: new Array(501).fill({}) }]) assert.throws(() => validateCloudPayload(invalid));
  assert.throws(() => createCloudPayload([{ text: 'é'.repeat(MAX_CLOUD_BACKUP_BYTES / 2) }]), /5 MiB/, 'size is UTF-8 bytes, not string length');
  const cyclic = {}; cyclic.self = cyclic;
  assert.throws(() => createCloudPayload([cyclic]), /JSON/);
});

test('read scopes by owner, accepts no backup and rejects invalid returned payloads', async () => {
  const client = fakeClient({ data: row(), error: null });
  assert.equal((await readAnalystBackup(client, userId)).revision, 1);
  assert.ok(client.calls.some(call => call[0] === 'eq' && call[1] === 'user_id' && call[2] === userId));
  assert.equal(await readAnalystBackup(fakeClient({ data: null }), userId), null);
  await assert.rejects(readAnalystBackup(fakeClient({ data: { ...row(), payload: {} } }), userId), /supported/);
  await assert.rejects(readAnalystBackup(fakeClient({ data: { ...row(), revision: '1' } }), userId), /metadata/);
  const blocked = fakeClient({ data: row() });
  await assert.rejects(readAnalystBackup(blocked, 'not-a-user'));
  assert.equal(blocked.calls.length, 0);
});

test('first upload inserts instead of unconditional upsert; an initial race is reported', async () => {
  const client = fakeClient({ data: row(), error: null });
  await uploadAnalystBackup(client, userId, payload());
  const insert = client.calls.find(call => call[0] === 'insert');
  assert.deepEqual(insert[1], { user_id: userId, payload: payload() });
  assert.equal(client.calls.some(call => call[0] === 'update'), false);
  const collision = { code: '23505', message: 'duplicate' };
  await assert.rejects(uploadAnalystBackup(fakeClient({ error: collision }), userId, payload()), failure => failure === collision);
  assert.match(analystCloudError(collision), /another device/);
});

test('replacing and deleting a backup require both the owner and reviewed revision', async () => {
  const client = fakeClient({ data: row(8), error: null });
  await uploadAnalystBackup(client, userId, payload(), 7, row().updated_at);
  assert.deepEqual(client.calls.find(call => call[0] === 'update')[1], { payload: payload() });
  assert.ok(client.calls.some(call => call[0] === 'eq' && call[1] === 'user_id' && call[2] === userId));
  assert.ok(client.calls.some(call => call[0] === 'eq' && call[1] === 'revision' && call[2] === 7));
  assert.ok(client.calls.some(call => call[0] === 'eq' && call[1] === 'updated_at' && call[2] === row().updated_at));
  await assert.rejects(uploadAnalystBackup(fakeClient({ data: null }), userId, payload(), 7, row().updated_at), { code: 'ANALYST_CONFLICT' });
  await assert.rejects(uploadAnalystBackup(fakeClient({ data: null }), userId, payload(), 7), { code: 'ANALYST_CONFLICT' });
  const deletion = fakeClient({ data: { user_id: userId } });
  await deleteAnalystBackup(deletion, userId, 8, row().updated_at);
  assert.ok(deletion.calls.some(call => call[0] === 'delete'));
  assert.ok(deletion.calls.some(call => call[0] === 'eq' && call[1] === 'revision' && call[2] === 8));
  assert.ok(deletion.calls.some(call => call[0] === 'eq' && call[1] === 'updated_at' && call[2] === row().updated_at));
  await assert.rejects(deleteAnalystBackup(fakeClient({ data: null }), userId, 8, row().updated_at), { code: 'ANALYST_CONFLICT' });
  await assert.rejects(deleteAnalystBackup(fakeClient({ data: null }), userId, 8), { code: 'ANALYST_CONFLICT' });
  await assert.rejects(deleteAnalystBackup(fakeClient({ data: null }), userId, null), { code: 'ANALYST_CONFLICT' });
});

test('cloud failures propagate for the UI to catch, while messages do not echo server contents', async () => {
  const failure = { code: 'PGRST205', message: 'private server details' };
  await assert.rejects(readAnalystBackup(fakeClient({ error: failure }), userId), error => error === failure);
  assert.match(analystCloudError(failure), /owner configuration/);
  assert.doesNotMatch(analystCloudError({ message: 'private server details' }), /private server details/);
  assert.match(analystCloudError({ status: 429 }), /Too many/);
});
