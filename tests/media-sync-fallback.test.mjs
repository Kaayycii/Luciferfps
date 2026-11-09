import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

async function runFixture(mode, withManifest = true) {
  const root = await mkdtemp(join(tmpdir(), 'lucifer-media-test-'));
  try {
    await mkdir(join(root, 'scripts'));
    await mkdir(join(root, 'data'));
    await mkdir(join(root, 'public', 'media'), { recursive: true });
    await copyFile(resolve('scripts/image-assets.mjs'), join(root, 'scripts', 'image-assets.mjs'));
    await writeFile(join(root, 'data', 'siteData.json'), '{}');
    const manifest = '{"assets":{"old":"/media/old.png"},"entities":{"heroes":{},"maps":{}},"files":{"/media/old.png":{}}}\n';
    if (withManifest) await writeFile(join(root, 'data', 'asset-manifest.json'), manifest);
    await writeFile(join(root, 'public', 'media', 'old.png'), 'existing image sentinel');
    const mock = mode === 'network'
      ? "globalThis.fetch = async () => { throw new Error('network unavailable'); };"
      : "globalThis.fetch = async () => new Response('<html>incomplete</html>', { status: 200 });";
    await writeFile(join(root, 'mock.mjs'), mock);
    const run = spawnSync(process.execPath, ['--import', pathToFileURL(join(root, 'mock.mjs')).href, join(root, 'scripts', 'image-assets.mjs')], { encoding: 'utf8' });
    if (withManifest) assert.equal(await readFile(join(root, 'data', 'asset-manifest.json'), 'utf8'), manifest);
    assert.equal(await readFile(join(root, 'public', 'media', 'old.png'), 'utf8'), 'existing image sentinel');
    return run;
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('incomplete catalog retains existing manifest and images without blocking other updates', async () => {
  const run = await runFixture('incomplete');
  assert.equal(run.status, 0);
  assert.match(run.stderr, /catalog unexpectedly incomplete; retaining the last-good/);
});

test('catalog network failure retains existing manifest and images', async () => {
  const run = await runFixture('network');
  assert.equal(run.status, 0);
  assert.match(run.stderr, /network unavailable; retaining the last-good/);
});

test('an incomplete catalog still fails when no last-good manifest exists', async () => {
  const run = await runFixture('incomplete', false);
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /catalog unexpectedly incomplete/);
});
