/**
 * Sentra Extension — API client
 * Shared by the service worker and popup.
 * Pure functions with no side-effects; easy to unit-test.
 */

const DEFAULT_API_URL = 'http://localhost:5000';

/**
 * Scan an email for phishing via the Sentra backend.
 *
 * @param {string} apiUrl     - Backend base URL
 * @param {string} authToken  - User's JWT access token
 * @param {string} subject    - Email subject (may be empty)
 * @param {string} body       - Email body text (required)
 * @param {Array<string>} links - Array of extracted href links
 * @returns {Promise<object>} - { success, verdict, confidence, scam_score, reasoning, id }
 */
async function scanEmail(apiUrl, authToken, subject, body, links = [], inferenceMode = 'gguf') {
  const res = await fetch(`${apiUrl}/api/scan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'X-Inference-Mode': inferenceMode,
    },
    body: JSON.stringify({ subject, body, links }),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

/**
 * Register this extension instance with the backend.
 * Called once on install (when the user is logged in).
 *
 * @param {string} apiUrl        - Backend base URL
 * @param {string} authToken     - User's JWT access token
 * @param {object} browserInfo   - { browser, os_name }
 * @returns {Promise<object>}    - { success, instance_token, ... }
 */
async function registerInstance(apiUrl, authToken, browserInfo) {
  const res = await fetch(`${apiUrl}/api/extension/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify(browserInfo),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

/**
 * Send a heartbeat to keep this instance marked as active.
 * Intentionally unauthenticated — uses instance_token only.
 *
 * @param {string} apiUrl         - Backend base URL
 * @param {string} instanceToken  - Extension instance token
 * @returns {Promise<object>}     - { success }
 */
async function sendHeartbeat(apiUrl, instanceToken) {
  const res = await fetch(`${apiUrl}/api/extension/heartbeat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instance_token: instanceToken }),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

/**
 * Poll GET /api/scan/status/<jobId> until the result is complete.
 *
 * @param {string} apiUrl       - Backend base URL
 * @param {string} authToken    - User's JWT access token
 * @param {string} jobId        - Celery task ID from POST /api/scan
 * @param {number} maxAttempts  - Max poll attempts before timeout (default 40 = 60s)
 * @param {number} intervalMs   - Milliseconds between polls (default 1500)
 * @returns {Promise<object>}   - { verdict, confidence, scam_score, reasoning, status }
 */
async function pollScanResult(apiUrl, authToken, jobId, maxAttempts = 40, intervalMs = 1500) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, intervalMs));
    const res = await fetch(`${apiUrl}/api/scan/status/${encodeURIComponent(jobId)}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const json = await res.json();
    const data = json.data || {};
    if (data.status === 'complete') return data;
    if (data.status === 'failed') throw new Error(data.error || 'Scan failed');
    // status === 'pending' — keep polling
  }
  throw new Error('Scan timed out');
}

/**
 * Fetch system capability info (e.g. GPU availability) from the backend.
 *
 * @param {string} apiUrl    - Backend base URL
 * @param {string} authToken - User's JWT access token
 * @returns {Promise<object>} - { cuda_available, gpu_name }
 */
async function getSystemInfo(apiUrl, authToken) {
  const res = await fetch(`${apiUrl}/api/system/info`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

// CommonJS export for Jest; in the extension itself the functions are globals.
/* istanbul ignore next */
if (typeof module !== 'undefined') {
  module.exports = { scanEmail, registerInstance, sendHeartbeat, pollScanResult, getSystemInfo, DEFAULT_API_URL };
}
