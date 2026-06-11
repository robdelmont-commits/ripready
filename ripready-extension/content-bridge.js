// content-bridge.js
// Runs in ISOLATED world
// Listens for RIPREADY_TOKEN_INTERCEPTED from injected.js (MAIN world)
// Forwards the token to background.js via chrome.runtime.sendMessage

window.addEventListener('message', function(event) {
  // Only accept messages from the same page
  if (event.source !== window) return;
  if (!event.data || event.data.type !== 'RIPREADY_TOKEN_INTERCEPTED') return;

  const { token, server, timestamp } = event.data;

  if (!token) return;

  // Forward to background service worker
  chrome.runtime.sendMessage({
    type: 'RIPREADY_TOKEN',
    token: token,
    server: server,
    timestamp: timestamp
  }, function(response) {
    if (chrome.runtime.lastError) {
      console.warn('[RipReady] Could not forward token:', chrome.runtime.lastError.message);
    }
  });
});
