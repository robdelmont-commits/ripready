// inject-loader.js
// Runs in ISOLATED world (content script context)
// Its only job: inject injected.js into the MAIN world so it can patch WebSocket

(function() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('injected.js');
  script.onload = function() { this.remove(); };
  (document.head || document.documentElement).appendChild(script);
})();
