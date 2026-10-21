/* Portable cumulative release: online rooms run on Cloudflare, never this phone. */
(() => {
  const online = 'https://griffin-house-of-rooks-online.jeromeleegriffin.workers.dev/';
  const field = document.getElementById('hor-room-code');
  if (field) field.maxLength = 8;
  window.addEventListener(
    'click',
    (event) => {
      if (window.HOR_CLOUD_TEST_ACTIVE) return;
      const button = event.target.closest?.(
        '#friendsToggleBtn,#createBtn,#joinConfirmBtn,#rejoinBtn,#reconnectBtn'
      );
      if (!button) return;
      event.stopImmediatePropagation();
      const url = new URL(online);
      const code = (field?.value || '').trim().toUpperCase();
      const intent = new URLSearchParams();
      if (button.id === 'joinConfirmBtn' && !/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/.test(code)) {
        event.preventDefault();
        const feedback = document.getElementById('joinFeedback841');
        if (feedback) {
          feedback.hidden = false;
          feedback.textContent = 'Enter the 8-character room code.';
        }
        return;
      }
      if (button.id === 'joinConfirmBtn' && /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/.test(code)) {
        url.searchParams.set('room', code); // Current deployed Worker invite compatibility.
        intent.set('room', code);
        const name = (document.getElementById('hor-player-name')?.value || '').trim().slice(0, 12);
        if (name) intent.set('name', name);
      } else if (button.id === 'friendsToggleBtn' || button.id === 'createBtn') {
        const name = (document.getElementById('hor-player-name')?.value || '').trim().slice(0, 12);
        intent.set('create', '1');
        if (name) intent.set('name', name);
      }
      if (intent.size) url.hash = intent.toString();
      // Keep the browser's native submit action and its trusted user activation.
      // A form-associated button survives the existing lobby DOM rearrangement.
      if (button.form?.id === 'hor-online-navigation') {
        const legacyRoom = document.getElementById('hor-online-room');
        if (legacyRoom) {
          legacyRoom.disabled = button.id !== 'joinConfirmBtn';
          legacyRoom.value = legacyRoom.disabled ? '' : code;
        }
        button.form.action = url.href;
        return;
      }
      event.preventDefault();
      // Leave preview iframes: the Worker correctly denies being framed.
      // In a standalone PWA this stays in the same app window; in a preview it
      // navigates the top-level browser instead of replacing the embedded game.
      try {
        const topWindow = window.top || window;
        topWindow.location.href = url.href;
      } catch (_) {
        try {
          window.open(url.href, '_blank', 'noopener');
        } catch (openError) {
          const status = document.getElementById('lobbyStatus');
          if (status)
            status.textContent =
              'This preview blocks online rooms. Open the game in a browser tab to play with friends.';
        }
      }
    },
    true
  );
})();
