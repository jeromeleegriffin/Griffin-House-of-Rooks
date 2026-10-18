/* One opt-in local founder profile. Existing peer/career IDs are never replaced. */
(() => {
  'use strict';
  const id = 'jerome_founder',
    regularKey = 'horFounderPreviousHumanV1',
    voiceKey = 'horFounderVoiceV1';
  const get = (key) => {
    try {
      return localStorage.getItem(key);
    } catch (_) {
      return null;
    }
  };
  const put = (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch (_) {}
  };
  const active = () => !!window.HORFounderDev?.enabled && get('griffinHousePlayerAvatar') === id;
  function syncName() {
    const on = active();
    for (const key of ['hor-player-name', 'welcome-player-name']) {
      const el = document.getElementById(key);
      if (!el) continue;
      el.readOnly = on;
      if (on) el.value = 'Jerome';
    }
    if (on) {
      myName = 'Jerome';
      put('horLandingIdentityV1', JSON.stringify({ name: 'Jerome' }));
    }
  }
  function select(next) {
    const was = active();
    if (next === id && !window.HORFounderDev?.enabled) return;
    if (next === id && !was) {
      put(
        regularKey,
        JSON.stringify({
          name: document.getElementById('hor-player-name')?.value || '',
          voice: loadPreferredVoice(),
        })
      );
      if (!get(voiceKey)) put(voiceKey, 'male');
    }
    savePreferredAvatar(next);
    if (was && next !== id) {
      let old;
      try {
        old = JSON.parse(get(regularKey) || 'null');
      } catch (_) {}
      if (old) {
        for (const key of ['hor-player-name', 'welcome-player-name']) {
          const el = document.getElementById(key);
          if (el) el.value = old.name;
        }
        myName = old.name || 'You';
        put('horLandingIdentityV1', JSON.stringify({ name: old.name }));
        savePreferredVoice(old.voice);
      }
    }
    syncName();
    window.HORLanding783?.refreshIdentity?.();
  }
  window.HORFounderProfile785 = { active, select, syncName };
  syncName();
})();
