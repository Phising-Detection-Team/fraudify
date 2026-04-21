/**
 * Sentra Extension — Auth Bridge (content script for localhost:3000)
 *
 * Reads the backend JWT embedded by the Next.js layout into a
 * <script id="sentra-ext-data" type="application/json"> element,
 * then syncs it to extension storage via the service worker.
 *
 * - Authenticated pages:  sends SET_AUTH_TOKEN  → popup shows logged-in view
 * - Login / logged-out:   sends CLEAR_AUTH_TOKEN → popup shows login prompt
 */
(function sentraBridge() {
  const el = document.getElementById('sentra-ext-data');

  if (!el || !el.textContent) {
    // No element → user is not authenticated; clear any stale token
    chrome.runtime.sendMessage({ type: 'CLEAR_AUTH_TOKEN' });
    return;
  }

  let data;
  try {
    data = JSON.parse(el.textContent);
  } catch (_) {
    return; // malformed JSON — leave storage untouched
  }

  if (data && data.token) {
    chrome.runtime.sendMessage({
      type: 'SET_AUTH_TOKEN',
      token: data.token,
      email: data.email || '',
      locale: data.locale || 'en',
    });
  } else {
    chrome.runtime.sendMessage({ type: 'CLEAR_AUTH_TOKEN' });
  }
})();
