/* Explicit backup testing in a separate storage namespace. Loaded before game code. */
(function () {
  'use strict';
  const ACTIVE = '__horCareerPhoneTestActiveV1';
  const BASE = '__horCareerPhoneTestV1:';
  const FORMAT = 'GriffinHouseOfRooksCareerTestBackup';
  const rawLocal = window.localStorage;
  const rawSession = window.sessionStorage;
  const validId = id => typeof id === 'string' && /^[a-f0-9-]{36}$/.test(id);
  let active = null;

  function keys(storage, prefix) {
    const found = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && key.startsWith(prefix)) found.push(key);
    }
    return found;
  }
  function storageView(storage, prefix) {
    const methods = {
      getItem(key) { return storage.getItem(prefix + String(key)); },
      setItem(key, value) { storage.setItem(prefix + String(key), String(value)); },
      removeItem(key) { storage.removeItem(prefix + String(key)); },
      clear() { for (const key of keys(storage, prefix)) storage.removeItem(key); },
      key(index) { return keys(storage, prefix)[Number(index)]?.slice(prefix.length) ?? null; }
    };
    return new Proxy(Object.create(null), {
      get(_, key) {
        if (key === 'length') return keys(storage, prefix).length;
        if (key === Symbol.toStringTag) return 'Storage';
        if (Object.hasOwn(methods, key)) return methods[key];
        return typeof key === 'string' ? methods.getItem(key) ?? undefined : undefined;
      },
      set(_, key, value) { methods.setItem(key, value); return true; },
      deleteProperty(_, key) { methods.removeItem(key); return true; },
      ownKeys() { return keys(storage, prefix).map(k => k.slice(prefix.length)); },
      getOwnPropertyDescriptor(_, key) {
        const value = methods.getItem(key);
        return value === null ? undefined : { configurable: true, enumerable: true, writable: true, value };
      },
      has(_, key) { return key === 'length' || Object.hasOwn(methods, key) || methods.getItem(key) !== null; }
    });
  }
  function memoryStorage() {
    const data = new Map();
    return {
      get length() { return data.size; },
      key(index) { return [...data.keys()][Number(index)] ?? null; },
      getItem(key) { return data.get(String(key)) ?? null; },
      setItem(key, value) { data.set(String(key), String(value)); },
      removeItem(key) { data.delete(String(key)); }
    };
  }
  function exit() {
    rawSession.removeItem(ACTIVE);
    location.reload();
  }
  function failClosed() {
    // Do not let the normal game run against real storage after a failed test boot.
    document.open();
    document.write('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Career test could not open</title><body style="background:#171e19;color:white;padding:24px;font:18px system-ui"><h1>Career test could not open</h1><p>Your original saved career has not been replaced.</p><button id="returnFromFailedCareerTest">Return to my career</button></body>');
    document.close();
    document.getElementById('returnFromFailedCareerTest').onclick = exit;
  }
  try {
    const saved = rawSession.getItem(ACTIVE);
    if (saved) {
      // Quarantine immediately, before parsing any test metadata. Even if the
      // browser continues already-queued scripts after an error, they cannot
      // reach the original career through either storage global.
      let localView = storageView(memoryStorage(), '');
      let sessionView = storageView(memoryStorage(), '');
      Object.defineProperty(window, 'localStorage', { configurable: false, get: () => localView });
      Object.defineProperty(window, 'sessionStorage', { configurable: false, get: () => sessionView });
      active = JSON.parse(saved);
      if (!validId(active.id) || typeof active.label !== 'string') throw Error('Invalid test session');
      const prefix = BASE + active.id + ':';
      if (rawLocal.getItem(prefix + 'ready') !== '1') throw Error('Incomplete test session');
      localView = storageView(rawLocal, prefix + 'local:');
      sessionView = storageView(rawSession, prefix + 'session:');
      // Other real-career tabs must not feed storage events into this test profile.
      window.addEventListener('storage', event => event.stopImmediatePropagation(), true);
    }
  } catch (_) {
    failClosed();
    return;
  }

  function start(payload) {
    if (!payload || payload.format !== FORMAT || payload.version !== 1 ||
        typeof payload.label !== 'string' || !payload.label.trim() || payload.label.length > 80) {
      throw Error('Invalid test backup');
    }
    const backup = JSON.parse(JSON.stringify(payload.backup));
    // Use the same strict validator as a normal restore. Never bypass validation.
    window.HORProgression.protection.validateBackup(backup);
    const id = crypto.randomUUID();
    const prefix = BASE + id + ':';
    try {
      for (const [key, value] of Object.entries(backup.data)) {
        rawLocal.setItem(prefix + 'local:' + key, value);
      }
      rawLocal.setItem(prefix + 'local:horProgressModeV1', 'local');
      rawLocal.setItem(prefix + 'ready', '1');
      rawSession.setItem(ACTIVE, JSON.stringify({ id, label: payload.label.trim() }));
    } catch (error) {
      for (const key of keys(rawLocal, prefix)) rawLocal.removeItem(key);
      throw Error('Test copy could not be saved. Your original career was not changed. ' + error.message);
    }
    location.reload();
    return { ok: true, testProfile: true };
  }
  function wrapBackup(backup) {
    return { format: FORMAT, version: 1, label: active?.label || 'Career test', backup };
  }
  window.HORCareerPhoneTest = Object.freeze({
    format: FORMAT, active: !!active, label: active?.label || '', start, exit, wrapBackup
  });
  if (active) {
    document.addEventListener('DOMContentLoaded', () => {
      // Only the isolated test gets this control; ordinary table geometry is unchanged.
      const button = document.createElement('button');
      button.id = 'horReturnFromCareerTest';
      button.type = 'button';
      button.setAttribute('data-hor-career-export', '1');
      button.style = 'position:fixed;top:max(4px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:2147483647;max-width:94vw;padding:7px 12px;border:1px solid #e7c374;border-radius:8px;background:#503c14;color:#fff;font:600 12px system-ui;box-shadow:0 2px 10px #0008';
      button.textContent = active.label + ' · Return to my career';
      button.addEventListener('pointerdown', event => event.stopPropagation());
      button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); exit(); });
      document.body.appendChild(button);
    }, { once: true });
  }
})();
