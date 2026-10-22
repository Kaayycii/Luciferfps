import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const vercel = JSON.parse(await read('vercel.json'));
const netlify = await read('netlify.toml');
const vercelRules = vercel.headers.filter(rule => rule.source === '/(.*)');
assert.equal(vercelRules.length, 1, 'One global Vercel header rule must cover every SPA route and asset.');
const vercelHeaders = Object.fromEntries(vercelRules[0].headers.map(({ key, value }) => [key.toLowerCase(), value]));
const netlifyRules = [...netlify.matchAll(/\[\[headers\]\]([\s\S]*?)(?=\n\[\[|$)/g)];
const globalNetlify = netlifyRules.filter(([, rule]) => /\bfor\s*=\s*"\/\*"/.test(rule));
assert.equal(globalNetlify.length, 1, 'One global Netlify header rule must cover every SPA route and asset.');
const netlifyHeaders = Object.fromEntries([...globalNetlify[0][1].matchAll(/^\s+([\w-]+)\s*=\s*"([^"\n]*)"\s*$/gm)].map(([, key, value]) => [key.toLowerCase(), value]));

function parsePolicy(policy) {
  assert.equal(typeof policy, 'string', 'Production responses must carry an enforced CSP.');
  const entries = policy.split(';').map(part => part.trim()).filter(Boolean).map(part => part.split(/\s+/));
  assert.equal(new Set(entries.map(([key]) => key)).size, entries.length, 'Repeated CSP directives can silently override intended restrictions.');
  return new Map(entries.map(([key, ...values]) => [key, values]));
}

test('Vercel and Netlify enforce the same security policy across all routes', () => {
  for (const key of ['content-security-policy', 'x-frame-options', 'x-content-type-options', 'referrer-policy', 'permissions-policy']) {
    assert.ok(vercelHeaders[key], `${key} must be configured on Vercel`);
    assert.equal(netlifyHeaders[key], vercelHeaders[key], `${key} must not diverge across hosts`);
  }
  assert.equal(vercelHeaders['x-frame-options'], 'DENY');
  assert.equal(vercelHeaders['x-content-type-options'], 'nosniff');
});

test('production CSP blocks injected scripts, framing, plugins and base-URL changes', () => {
  for (const headers of [vercelHeaders, netlifyHeaders]) {
    const policy = parsePolicy(headers['content-security-policy']);
    assert.deepEqual(policy.get('default-src'), ["'self'"]);
    assert.deepEqual(policy.get('script-src'), ["'self'"], 'No inline/eval/data/third-party script execution is allowed.');
    for (const directive of ['frame-ancestors', 'frame-src', 'object-src', 'base-uri', 'worker-src']) {
      assert.deepEqual(policy.get(directive), ["'none'"], `${directive} must be denied`);
    }
    assert.deepEqual(policy.get('form-action'), ["'self'"]);
    assert.ok(policy.has('upgrade-insecure-requests'));
  }
});

test('CSP preserves tactical image exports, local fonts, dynamic styles and secure optional cloud connections', () => {
  const policy = parsePolicy(vercelHeaders['content-security-policy']);
  for (const source of ["'self'", 'https:', 'data:', 'blob:']) assert.ok(policy.get('img-src').includes(source), `Image source ${source} is needed for media or exports.`);
  for (const source of ["'self'", 'data:']) assert.ok(policy.get('font-src').includes(source), `Font source ${source} is needed for local and exported typography.`);
  assert.ok(policy.get('style-src').includes("'unsafe-inline'"), 'Dynamic canvas positioning, tier colors and export clones use inline styles.');
  for (const source of ["'self'", 'https:', 'wss:']) assert.ok(policy.get('connect-src').includes(source), `Connection source ${source} supports media embedding or optional cloud.`);
  assert.ok(!policy.get('connect-src').includes('http:'));
  assert.ok(!policy.get('connect-src').includes('ws:'));
});
