// popup.js

const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const openBtn = document.getElementById('openBtn');

// Check if there's a pending token stored
chrome.storage.local.get(['ripready_pending_token', 'ripready_pending_timestamp'], function(result) {
  if (result.ripready_pending_token) {
    const age = Date.now() - (result.ripready_pending_timestamp || 0);
    const ageMinutes = Math.floor(age / 60000);

    if (age < 5 * 60 * 1000) {
      // Token is less than 5 minutes old — still valid
      statusDot.classList.add('waiting');
      statusText.innerHTML = '<strong>Token ready</strong> — open RipReady to stream';
    } else {
      statusText.textContent = 'Token expired — reconnect on Whatnot';
    }
  }
});

openBtn.addEventListener('click', function() {
  chrome.tabs.create({ url: 'https://ripready.app/studio' });
  window.close();
});
