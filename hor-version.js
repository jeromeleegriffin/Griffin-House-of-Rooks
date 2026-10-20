// Griffin House of Rooks runtime identity for diagnostics and offline verification.
window.HOR_LIVE_VERSION = '846-premium-owner-repair-20261020-r7-cumulative';
window.HOR_BUILD = '846-premium-owner-repair-20261020-r7-cumulative';
window.GHR_BUILD = 'Premium UI real fullscreen and separate fit 20261020 R7';
window.HORRuntimeTruth = async function () {
  const controller = navigator.serviceWorker && navigator.serviceWorker.controller;
  const worker = controller
    ? await new Promise((resolve) => {
        const channel = new MessageChannel();
        const timer = setTimeout(() => resolve(null), 2000);
        channel.port1.onmessage = (e) => {
          clearTimeout(timer);
          channel.port1.close();
          resolve(e.data);
        };
        controller.postMessage({ type: 'HOR_BUILD_QUERY' }, [channel.port2]);
      })
    : null;
  return {
    page: window.HOR_PAGE_BUILD,
    script: window.HOR_SCRIPT_BUILD,
    marker: window.HOR_BUILD,
    worker,
    controller: controller && controller.scriptURL,
    coherent:
      window.HOR_PAGE_BUILD === '846-premium-owner-repair-20261020-r7-cumulative' &&
      window.HOR_SCRIPT_BUILD === '846-premium-owner-repair-20261020-r7-cumulative' &&
      window.HOR_BUILD === '846-premium-owner-repair-20261020-r7-cumulative' &&
      !!worker &&
      worker.build === '846-premium-owner-repair-20261020-r7-cumulative' &&
      worker.cache === 'house-of-rooks-846-premium-owner-repair-20261020-r7-cumulative',
  };
};
