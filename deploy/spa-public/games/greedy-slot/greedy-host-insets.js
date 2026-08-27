(function applyGreedyHostInsets() {
  var root = document.documentElement;
  var hostPadded = false;

  function setInsets(top, bottom, left, right, padded) {
    if (typeof padded === 'boolean') hostPadded = padded;
    var minTop = hostPadded ? 8 : 12;
    if (typeof top === 'number' && top >= 0) {
      root.style.setProperty('--greedy-safe-top', Math.max(minTop, top) + 'px');
    }
    if (typeof bottom === 'number' && bottom >= 0) {
      root.style.setProperty('--greedy-safe-bottom', Math.max(hostPadded ? 8 : 12, bottom) + 'px');
    }
    if (typeof left === 'number' && left >= 0) {
      root.style.setProperty('--greedy-safe-left', Math.max(8, left) + 'px');
    }
    if (typeof right === 'number' && right >= 0) {
      root.style.setProperty('--greedy-safe-right', Math.max(8, right) + 'px');
    }
  }

  window.addEventListener('message', function (event) {
    var data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.source !== 'uniapplab-greedy-host' || data.type !== 'host-insets') return;
    setInsets(data.top, data.bottom, data.left, data.right, data.hostPadded === true);
  });

  function requestHostInsets() {
    if (window.self === window.top) return;
    try {
      window.parent.postMessage({ source: 'uniapplab-greedy', type: 'request-host-insets' }, '*');
    } catch (e) {
      /* standalone */
    }
  }

  requestHostInsets();
  var attempts = 0;
  var timer = window.setInterval(function () {
    attempts += 1;
    requestHostInsets();
    if (attempts >= 15) window.clearInterval(timer);
  }, 400);
})();
