import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const file = new URL('./worker-live.mjs', import.meta.url);
const source = fs.readFileSync(file, 'utf8').replace(
  'import { DurableObject } from "cloudflare:workers";',
  'class DurableObject {}'
);
const { default: worker } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

const limiter = { limit: async () => ({ success: true }) };
const env = { TEST_GATE_KEY: 'test-only-key', ENTRY_LIMIT: limiter, ACTION_LIMIT: limiter };
globalThis.fetch = async () => new Response('<html><head></head><body>GAME</body></html>');
const base = 'https://worker.example';
const response = await worker.fetch(new Request(`${base}/?create=1&name=Jerome+Griff`), env);
assert.equal(response.status, 200);
assert.equal(response.headers.get('x-frame-options'), 'DENY');
assert.match(response.headers.get('content-security-policy') || '', /frame-ancestors 'none'/);
const html = await response.text();
assert.match(html, /GHR_CLOUD_CREATE=/);
assert.match(html, /GHR_CLOUD_NAME=/);
assert.match(html, /GHR_CLOUD_INVITE=/);
assert.match(html, /new URLSearchParams\(location\.hash\.slice\(1\)\)/);
assert.match(html, /await joinByCode\(\)/);
assert.match(html, /if \(window\.GHR_CLOUD_CREATE\)[\s\S]*?await createCloudRoom\(\)/);
assert.match(html, /window\.GHR_CLOUD_NAME \|\| ""/);
assert.match(html, /history\.replaceState\(null,"",location\.pathname\+"\?cloud=1"\)/);

const prelude = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(prelude, 'injected bootstrap script exists');
const window = {};
const location = { hash: '#create=1&name=Jerome+Griff', search: '', pathname: '/' };
let replacedUrl = null;
vm.runInNewContext(prelude, {
  window,
  location,
  URLSearchParams,
  history: { replaceState: (_state, _title, url) => { replacedUrl = url; } },
  navigator: { serviceWorker: { register: () => Promise.resolve(null) } },
});
assert.equal(window.GHR_CLOUD_CREATE, true);
assert.equal(window.GHR_CLOUD_NAME, 'Jerome Griff');
assert.equal(window.GHR_CLOUD_INVITE, '');
assert.equal(replacedUrl, '/?cloud=1');

const joinWindow = {};
location.hash = '#room=AB23CD45';
vm.runInNewContext(prelude, {
  window: joinWindow,
  location,
  URLSearchParams,
  history: { replaceState: () => {} },
  navigator: { serviceWorker: { register: () => Promise.resolve(null) } },
});
assert.equal(joinWindow.GHR_CLOUD_CREATE, false);
assert.equal(joinWindow.GHR_CLOUD_INVITE, 'AB23CD45');

const legacyWindow = {};
location.hash = '';
location.search = '?room=AB23CD45';
vm.runInNewContext(prelude, {
  window: legacyWindow,
  location,
  URLSearchParams,
  history: { replaceState: () => {} },
  navigator: { serviceWorker: { register: () => Promise.resolve(null) } },
});
assert.equal(legacyWindow.GHR_CLOUD_INVITE, 'AB23CD45');

console.log('PASS: Worker entry preserves create/name/invite intent for adapter startup, then removes those values from the visible URL.');
