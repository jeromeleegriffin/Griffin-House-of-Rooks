import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const base = 'https://griffin-house-of-rooks-online.jeromeleegriffin.workers.dev';
const entrySource = fs.readFileSync(new URL('../../cloudflare-entry.js', import.meta.url), 'utf8');
const fields = {
  'hor-room-code': { value: 'ab23cd45', maxLength: 0 },
  'hor-player-name': { value: 'Jerome Griffin' },
  'hor-online-room': { value: '', disabled: true },
};
function makeHarness(framed = false, nativeSubmit = false) {
  let selfRoute = null;
  let topRoute = null;
  const handlers = {};
  const form = nativeSubmit ? { id: 'hor-online-navigation', action: '' } : null;
  let prevented = false;
  const location = {};
  Object.defineProperty(location, 'href', { set: (url) => { selfRoute = url; } });
  const window = {
    location,
    addEventListener: (type, listener) => { handlers[type] = listener; },
  };
  window.self = window;
  if (framed) {
    const topLocation = {};
    Object.defineProperty(topLocation, 'href', { set: (url) => { topRoute = url; } });
    window.top = { location: topLocation };
  } else window.top = window;
  const document = { getElementById: (id) => fields[id] || null };
  vm.runInNewContext(entrySource, { window, document, URL, URLSearchParams });
  return {
    click(id) {
      handlers.click({
        target: { closest: () => ({ id, form }) },
        preventDefault() { prevented = true; },
        stopImmediatePropagation() {},
      });
    },
    routes: () => ({ selfRoute, topRoute }),
    native: () => ({ action: form?.action, prevented }),
  };
}

const direct = makeHarness();
direct.click('friendsToggleBtn');
assert.deepEqual(direct.routes(), { selfRoute: `${base}/#create=1&name=Jerome+Griff`, topRoute: null });
direct.click('createBtn');
assert.deepEqual(direct.routes(), { selfRoute: `${base}/#create=1&name=Jerome+Griff`, topRoute: null });
direct.click('joinConfirmBtn');
assert.deepEqual(direct.routes(), { selfRoute: `${base}/?room=AB23CD45#room=AB23CD45&name=Jerome+Griff`, topRoute: null });
direct.click('reconnectBtn');
assert.deepEqual(direct.routes(), { selfRoute: `${base}/`, topRoute: null });

const preview = makeHarness(true);
preview.click('friendsToggleBtn');
assert.deepEqual(preview.routes(), { selfRoute: null, topRoute: `${base}/#create=1&name=Jerome+Griff` });

const native = makeHarness(true, true);
native.click('friendsToggleBtn');
assert.deepEqual(native.routes(), { selfRoute: null, topRoute: null });
assert.deepEqual(native.native(), { action: `${base}/#create=1&name=Jerome+Griff`, prevented: false });
assert.equal(fields['hor-online-room'].disabled, true);
native.click('joinConfirmBtn');
assert.equal(fields['hor-online-room'].disabled, false);
assert.equal(fields['hor-online-room'].value, 'AB23CD45');
const html = fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
assert.match(html, /id="friendsToggleBtn"\s+type="submit"\s+form="hor-online-navigation"/);
assert.match(html, /id="hor-online-navigation"[^>]*target="_top"/);

const adapter = fs.readFileSync(new URL('./adapter-live.js', import.meta.url), 'utf8');
assert.match(adapter, /if \(window\.GHR_CLOUD_CREATE\)[\s\S]*?await createCloudRoom\(\)/);
assert.match(adapter, /GHR_CLOUD_INVITE/);

const workerSource = fs.readFileSync(new URL('./worker-live.mjs', import.meta.url), 'utf8');
assert.match(workerSource, /GHR_CLOUD_CREATE=/);
assert.match(workerSource, /GHR_CLOUD_NAME=/);
assert.match(workerSource, /GHR_CLOUD_INVITE=/);
const game = fs.readFileSync(new URL('../../game060.js', import.meta.url), 'utf8');
const build = game.match(/const APP_VERSION = '([^']+)'/)[1];
assert.ok(adapter.includes(JSON.stringify(build)), 'adapter accepts the cumulative app build');
const refs = [...new Set(workerSource.match(/raw\.githubusercontent\.com\/jeromeleegriffin\/Test\/[0-9a-f]+/g))];
assert.deepEqual(refs, ['raw.githubusercontent.com/jeromeleegriffin/Test/90078a710948c7643caafb18986e34dc71ce7cee']);

console.log('PASS: native submit keeps default navigation, targets the top window, carries create/join intent, and matches the cumulative Worker baseline.');
