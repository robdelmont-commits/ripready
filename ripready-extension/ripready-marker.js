// ripready-marker.js
// Runs in ISOLATED world on ripready.app pages only.
// Its only job: tell the page the extension is installed and active.
// Does NOT touch tokens, WebSocket, camera, or any streaming logic.

(function () {
  document.documentElement.setAttribute('data-ripready-installed', 'true');
  document.documentElement.setAttribute('data-ripready-version', chrome.runtime.getManifest().version);

  // Also fire a custom event in case the page is already loaded and listening
  // rather than checking the attribute on a timer.
  window.dispatchEvent(new CustomEvent('ripready:extension-ready', {
    detail: { version: chrome.runtime.getManifest().version }
  }));

  console.log('[RipReady] Extension marker set on ripready.app');
})();
