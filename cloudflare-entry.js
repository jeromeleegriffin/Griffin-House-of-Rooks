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
      event.preventDefault();
      event.stopImmediatePropagation();
      const url = new URL(online);
      const code = (field?.value || '').trim().toUpperCase();
      if (button.id === 'joinConfirmBtn' && /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/.test(code))
        url.searchParams.set('room', code);
      const link = document.createElement('a');
      link.href = url.href;
      link.target = '_blank';
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();
    },
    true
  );
})();
