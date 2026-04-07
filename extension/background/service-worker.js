/**
 * Sentra Extension — MV3 Service Worker (background script)
 *
 * Responsibilities:
 *   1. Register extension instance with backend on install
 *   2. Send heartbeat every 4 minutes to keep instance active
 *   3. Broker SCAN_EMAIL messages from content scripts to /api/scan
 *
 * Storage keys (chrome.storage.local):
 *   sentra_api_url       — backend base URL (default: http://localhost:5000)
 *   sentra_auth_token    — user's JWT access token (set by popup on login)
 *   sentra_instance_token — extension instance token (set after registration)
 */

// Load shared API helpers (importScripts for MV3 service worker;
// module.exports guard lets the same file be require()'d by Jest).
/* istanbul ignore next */
if (typeof importScripts !== 'undefined') {
  importScripts('../utils/api.js');
}
/* istanbul ignore next */
const _api = (typeof require !== 'undefined') ? require('../utils/api') : { scanEmail, registerInstance, sendHeartbeat, pollScanResult, DEFAULT_API_URL };

const HEARTBEAT_ALARM = 'heartbeat';
const HEARTBEAT_PERIOD_MINUTES = 4;

// ---------------------------------------------------------------------------
// Helper — read all Sentra keys from storage
// ---------------------------------------------------------------------------

async function _getStorage() {
  return chrome.storage.local.get([
    'sentra_api_url',
    'sentra_auth_token',
    'sentra_instance_token',
  ]);
}

function _apiUrl(stored) {
  return stored.sentra_api_url || _api.DEFAULT_API_URL;
}

// ---------------------------------------------------------------------------
// 1. onInstalled — register instance
// ---------------------------------------------------------------------------

chrome.runtime.onInstalled.addListener(async (details) => {
  const stored = await _getStorage();
  if (!stored.sentra_auth_token) return; // User not logged in yet; popup handles registration

  try {
    const browser = _detectBrowser();
    const os_name = _detectOS();
    const result = await _api.registerInstance(_apiUrl(stored), stored.sentra_auth_token, { browser, os_name });
    if (result && result.data && result.data.instance_token) {
      await chrome.storage.local.set({ sentra_instance_token: result.data.instance_token });
    }
  } catch (err) {
    // Registration failure is non-fatal; user can retry via popup
    console.warn('[Sentra] Instance registration failed:', err.message);
  }
});

// ---------------------------------------------------------------------------
// 2. onAlarm — heartbeat
// ---------------------------------------------------------------------------

chrome.alarms.create(HEARTBEAT_ALARM, { periodInMinutes: HEARTBEAT_PERIOD_MINUTES });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== HEARTBEAT_ALARM) return;

  const stored = await _getStorage();
  if (!stored.sentra_instance_token) return;

  try {
    await _api.sendHeartbeat(_apiUrl(stored), stored.sentra_instance_token);
  } catch (err) {
    console.warn('[Sentra] Heartbeat failed:', err.message);
  }
});

// ---------------------------------------------------------------------------
// 3. onMessage — SET_AUTH_TOKEN / CLEAR_AUTH_TOKEN / SCAN_EMAIL
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SET_AUTH_TOKEN') {
    _handleSetAuthToken(message);
    return false;
  }

  if (message.type === 'CLEAR_AUTH_TOKEN') {
    chrome.storage.local.remove(['sentra_auth_token', 'sentra_user_email']);
    return false;
  }

  if (message.type !== 'SCAN_EMAIL') return false;

  _handleScanRequest(message, sendResponse);
  return true; // keeps the message channel open for async response
});

async function _handleSetAuthToken(message) {
  const stored = await _getStorage();
  const tokenChanged = stored.sentra_auth_token !== message.token;

  await chrome.storage.local.set({
    sentra_auth_token: message.token,
    sentra_user_email: message.email,
  });

  // Auto-register instance when user first logs in or token rotates
  if (!stored.sentra_instance_token || tokenChanged) {
    try {
      const browser = _detectBrowser();
      const os_name = _detectOS();
      const result = await _api.registerInstance(
        _api.DEFAULT_API_URL,
        message.token,
        { browser, os_name }
      );
      if (result && result.data && result.data.instance_token) {
        await chrome.storage.local.set({ sentra_instance_token: result.data.instance_token });
      }
    } catch (err) {
      console.warn('[Sentra] Auto-registration failed:', err.message);
    }
  }
}

async function _handleScanRequest(message, sendResponse) {
  const stored = await _getStorage();

  if (!stored.sentra_auth_token) {
    sendResponse({ success: false, error: 'Please log in to Sentra to scan emails.' });
    return;
  }

  try {
    const result = await _api.scanEmail(
      _apiUrl(stored),
      stored.sentra_auth_token,
      message.subject || '',
      message.body || '',
      'gguf'
    );

    if (result && result.data && result.data.status === 'complete') {
      // Cache hit — verdict available immediately
      const verdictData = result.data;
      await _cacheScanResult(message.subject, verdictData.verdict, verdictData.confidence);
      sendResponse(verdictData);
    } else if (result && result.data && result.data.job_id) {
      // Cache miss — let the content script drive polling (service workers can be
      // suspended during setTimeout delays, breaking the async sendResponse channel)
      sendResponse({ success: true, job_id: result.data.job_id, status: 'queued' });
    } else {
      sendResponse({ success: false, error: 'Scan did not return a verdict.' });
    }
  } catch (err) {
    sendResponse({ success: false, error: `Scan failed: ${err.message}` });
  }
}

// ---------------------------------------------------------------------------
// Browser / OS detection helpers
// ---------------------------------------------------------------------------

function _detectBrowser() {
  if (typeof navigator === 'undefined') return 'Unknown';
  const ua = navigator.userAgent;
  if (ua.includes('Edg/')) return `Edge ${ua.match(/Edg\/([\d.]+)/)?.[1] || ''}`.trim();
  if (ua.includes('Chrome/')) return `Chrome ${ua.match(/Chrome\/([\d.]+)/)?.[1] || ''}`.trim();
  return 'Unknown';
}

function _detectOS() {
  if (typeof navigator === 'undefined') return 'Unknown';
  const ua = navigator.userAgent;
  if (ua.includes('Windows NT 10.0')) return 'Windows 11/10';
  if (ua.includes('Windows')) return 'Windows';
  if (ua.includes('Mac OS X')) return 'macOS';
  if (ua.includes('Linux')) return 'Linux';
  return 'Unknown';
}

// ---------------------------------------------------------------------------
// Scan history cache helper
// ---------------------------------------------------------------------------

async function _cacheScanResult(subject, verdict, confidence) {
  const { sentra_scan_history: existing = [] } = await chrome.storage.local.get('sentra_scan_history');
  const entry = {
    subject: (subject || '').slice(0, 60) || '(no subject)',
    verdict,
    confidence,
    timestamp: Date.now(),
  };
  const updated = [entry, ...existing].slice(0, 5);
  await chrome.storage.local.set({ sentra_scan_history: updated });
}

// CommonJS export for Jest
if (typeof module !== 'undefined') {
  module.exports = { _handleScanRequest, _handleSetAuthToken, _detectBrowser, _detectOS, _cacheScanResult };
}
