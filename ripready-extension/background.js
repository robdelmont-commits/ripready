// background.js
// Service worker — receives token from content-bridge.js
// Finds the ripready.app tab and delivers the token via chrome.tabs.sendMessage

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  if (message.type !== 'RIPREADY_TOKEN') return;

  const { token, server, timestamp } = message;

  // Find open ripready.app tab
  chrome.tabs.query({ url: 'https://ripready.app/*' }, function(tabs) {
    if (!tabs || tabs.length === 0) {
      // No RipReady tab open — store token in case tab opens shortly
      chrome.storage.local.set({
        ripready_pending_token: token,
        ripready_pending_server: server,
        ripready_pending_timestamp: timestamp
      });
      console.warn('[RipReady] No RipReady tab found. Token stored for pickup.');
      sendResponse({ status: 'stored' });
      return;
    }

    // Deliver to the first ripready.app tab found
    const tab = tabs[0];
    chrome.tabs.sendMessage(tab.id, {
      type: 'RIPREADY_TOKEN_DELIVER',
      token: token,
      server: server,
      timestamp: timestamp
    }, function(response) {
      if (chrome.runtime.lastError) {
        // RipReady tab exists but content script not ready yet — store it
        chrome.storage.local.set({
          ripready_pending_token: token,
          ripready_pending_server: server,
          ripready_pending_timestamp: timestamp
        });
        console.warn('[RipReady] Tab found but not ready. Token stored.');
      }
    });

    sendResponse({ status: 'delivered' });
  });

  return true; // Keep message channel open for async response
});
