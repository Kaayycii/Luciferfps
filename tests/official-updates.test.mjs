import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildOfficialSnapshot, dateOnly, fetchOfficialIndex, officialUrl, parseOfficialIndex, REVIEWED_FACTS, SOURCES, syncOfficialUpdates } from '../scripts/sync-official-updates.mjs';

const home = SOURCES[0];
const patch = SOURCES[1];
const fixture = `<a href="/20261014/41525_1316588.html"><img alt="not a title"><p class="title">Marvel Rivals Version 20261015 Patch Notes</p><p class="date">2026/10/14</p><p class="desc">Publisher body text is not copied.</p></a>`;
const response = text => new Response(text, { headers: { 'content-type': 'text/html; charset=utf-8' } });

test('official URLs reject non-HTTPS, lookalike hosts, credentials, and nonstandard ports', () => {
  for (const value of ['http://www.marvelrivals.com/', 'https://www.marvelrivals.com.evil.example/', 'https://evil.example/', 'javascript:alert(1)', 'https://user@www.marvelrivals.com/', 'https://www.marvelrivals.com:444/']) assert.equal(officialUrl(value), null);
  assert.equal(officialUrl('//marvelrivals.com/gameupdate/?tracking=1#fragment'), 'https://www.marvelrivals.com/gameupdate/');
  assert.equal(officialUrl('/20260908/42828_1313342.html', SOURCES[4].url), 'https://www.marvelrivalsesports.com/20260908/42828_1313342.html');
});

test('real calendar days remain separate from the patch effective date', () => {
  assert.equal(dateOnly('20260229'), null);
  assert.equal(dateOnly('2026-02-30'), null);
  assert.equal(dateOnly('2024/02/29'), '2024-02-29');
  assert.equal(dateOnly('20261014'), '2026-10-14');
  const [record] = parseOfficialIndex(fixture, home);
  assert.equal(record.publishedAt, '2026-10-14');
  assert.equal(record.effectiveAt, '2026-10-15');
  assert.equal(record.category, 'patches');
  assert.equal(record.title, 'Marvel Rivals Version 20261015 Patch Notes');
  assert.equal(record.summary, undefined);
});

test('the bounded HTML parser ignores scripts and unsafe or invalid article links', () => {
  const html = fixture + `<a href="https://evil.example/20261016/41525_123.html"><h2>Untrusted mirror</h2></a>
    <a href="/20260230/41525_123.html"><h2>Impossible publication date</h2></a>
    <a href="javascript:alert(1)"><h2>Unsafe link</h2></a>
    <script>const fake = '<a href="/20261016/41525_123.html"><h2>Script fixture article</h2></a>';</script>
    <!-- <a href="/20261016/41525_124.html"><h2>Unpublished comment article</h2></a> -->
    <a href="/heroes/"><h2>Not an article</h2></a>`;
  const items = parseOfficialIndex(html, home);
  assert.equal(items.length, 1);
  assert.throws(() => parseOfficialIndex('x'.repeat(2_000_001), home), /parser limit/);
  assert.throws(() => parseOfficialIndex('<html>Unexpected or blocked document</html>', home), /no recognized article/);
  assert.equal(parseOfficialIndex(fixture.replace('Patch Notes</p>', 'Patch Notes<script>globalThis.compromised = true</script></p>'), home)[0].title, items[0].title);
  assert.equal(globalThis.compromised, undefined);
});

test('publisher article IDs deduplicate homepage and category variants without losing source attribution', async () => {
  const proper = fixture.replace('/20261014/41525_1316588.html', '/gameupdate/20261014/41548_1316588.html');
  const { snapshot } = await buildOfficialSnapshot({}, { sources: [home, patch], facts: [], now: '2026-10-16T10:00:00Z', fetchImpl: async url => response(url === home.url ? fixture : proper) });
  assert.equal(snapshot.articles.length, 1);
  assert.equal(snapshot.articles[0].url, 'https://www.marvelrivals.com/gameupdate/20261014/41548_1316588.html');
  assert.deepEqual(snapshot.articles[0].sourceIds, ['game-home', 'game-updates']);
});

test('one failed source keeps its last good articles while another source advances', async () => {
  const sources = [home, SOURCES[4]];
  const esports = `<a href="/20260908/42828_1313342.html"><div class="title">Marvel Rivals Ignite 2026 Stage 2: The Road Ahead</div><div class="time">2026-09-08</div></a>`;
  const first = await buildOfficialSnapshot({}, { sources, facts: [], now: '2026-10-16T10:00:00Z', fetchImpl: async url => response(url === home.url ? fixture : esports) });
  const nextFixture = fixture.replaceAll('20261014', '20261016').replaceAll('1316588', '1316802').replace('20261015 Patch Notes', '20261017 Patch Notes').replace('2026/10/14', '2026/10/16');
  const next = await buildOfficialSnapshot(first.snapshot, { sources, facts: [], now: '2026-10-16T22:00:00Z', fetchImpl: async url => url === home.url ? response(nextFixture) : new Response('', { status: 503 }) });
  assert.equal(next.snapshot.articles.length, 3);
  assert.equal(next.snapshot.sources[1].status, 'error');
  assert.equal(next.snapshot.sources[1].articleCount, 1);
  assert.ok(next.snapshot.articles.some(item => item.id === 'ignite-1313342'));
  assert.ok(next.snapshot.articles.some(item => item.id === 'game-1316802'));
  const repeated = await buildOfficialSnapshot(next.snapshot, { sources, facts: [], now: '2026-10-17T10:00:00Z', fetchImpl: async url => url === home.url ? response(nextFixture) : new Response('', { status: 503 }) });
  assert.equal(repeated.changed, false);
  assert.equal(repeated.snapshot.updatedAt, next.snapshot.updatedAt);
});

test('unchanged successful sync leaves the exact file and timestamps alone', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lucifer-official-'));
  const output = join(directory, 'updates.json');
  try {
    const options = { output, sources: [home], facts: [], fetchImpl: async () => response(fixture) };
    assert.equal((await syncOfficialUpdates({ ...options, now: '2026-10-16T10:00:00Z' })).changed, true);
    const first = await readFile(output, 'utf8');
    assert.equal((await syncOfficialUpdates({ ...options, now: '2026-10-16T22:00:00Z' })).changed, false);
    assert.equal(await readFile(output, 'utf8'), first);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('a failed source latest good article survives the bounded historical window', async () => {
  const source = SOURCES[4];
  const oldId = 'ignite-1313342';
  const old = { id: oldId, title: 'Stage 2 official guide', url: 'https://www.marvelrivalsesports.com/20260908/42828_1313342.html', category: 'esports', publishedAt: '2026-09-08', sourceIds: [source.id] };
  const history = Array.from({ length: 240 }, (_, i) => ({ id: `game-${i}`, title: `Newer article ${i}`, url: `https://www.marvelrivals.com/20261016/41525_${i}.html`, category: 'announcements', publishedAt: '2026-10-16', sourceIds: [home.id] }));
  const result = await buildOfficialSnapshot({ schemaVersion: 1, sources: [{ ...source, articleCount: 1, articleIds: [oldId], status: 'ok' }], articles: [...history, old], facts: [] }, { sources: [source], facts: [], fetchImpl: async () => new Response('', { status: 403 }) });
  assert.equal(result.snapshot.articles.length, 240);
  assert.ok(result.snapshot.articles.some(item => item.id === oldId));
});

test('bounded fetch rejects oversize, wrong type, redirects and unapproved destinations', async () => {
  let seen;
  await fetchOfficialIndex(home.url, { fetchImpl: async (url, options) => { seen = { url, options }; return response(fixture); } });
  assert.equal(seen.options.redirect, 'error');
  assert.equal(seen.options.credentials, 'omit');
  await assert.rejects(fetchOfficialIndex('https://evil.example/', { fetchImpl: async () => assert.fail('untrusted URL reached fetch') }), /not permitted/);
  await assert.rejects(fetchOfficialIndex(home.url, { maxBytes: 5, fetchImpl: async () => response(fixture) }), /download limit/);
  await assert.rejects(fetchOfficialIndex(home.url, { fetchImpl: async () => new Response('{}', { headers: { 'content-type': 'application/json' } }) }), /did not return HTML/);
});

test('reviewed facts have primary sources, real publication/effective dates, and no permanent ongoing label', () => {
  for (const fact of REVIEWED_FACTS) {
    const source = new URL(fact.sourceUrl);
    assert.equal(source.protocol, 'https:');
    assert.equal(source.username + source.password, '');
    assert.ok(officialUrl(fact.sourceUrl) || fact.sourceUrl === 'https://dreamhack.com/stockholm/updates/2026/10/06/marvel-rivals-ignite-grand-finals-are-coming-to-dreamhack-stockholm/');
    assert.equal(dateOnly(fact.publishedAt), fact.publishedAt);
    assert.ok(Number.isFinite(Date.parse(fact.effectiveAt)));
    assert.equal(dateOnly(fact.reviewedAt), fact.reviewedAt);
    assert.equal(fact.status, undefined);
    if (fact.event) {
      assert.equal(dateOnly(fact.event.startAt), fact.event.startAt);
      assert.equal(dateOnly(fact.event.endAt), fact.event.endAt);
      assert.ok(fact.event.startAt < fact.event.endAt);
      if (fact.id.startsWith('stage-2-')) assert.equal(fact.event.gameVersion, 'Season 10');
      assert.equal(fact.event.status, undefined);
    }
  }
  const conflict = REVIEWED_FACTS.find(item => item.id === 'gorr-living-abyss-source-conflict').conflict;
  assert.equal(conflict.status, 'unresolved');
  assert.deepEqual(conflict.alternatives.map(item => item.value), ['12 seconds', '13 seconds']);
});
