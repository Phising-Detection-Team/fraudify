/**
 * Sentra Extension — Popup script
 * Reads state from chrome.storage and renders the appropriate view.
 */

const DASHBOARD_URL = 'http://localhost:3000/dashboard/user/settings';
const DASHBOARD_SCAN_URL = 'http://localhost:3000/dashboard/user/scan';

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------------------
// Time-ago formatter
// ---------------------------------------------------------------------------

function _timeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ---------------------------------------------------------------------------
// Verdict badge
// ---------------------------------------------------------------------------

function _verdictBadge(verdict) {
  if (verdict === 'phishing') return '\uD83D\uDD34'; // 🔴
  if (verdict === 'safe') return '\uD83D\uDFE2';     // 🟢
  return '\uD83D\uDFE1';                              // 🟡 suspicious / other
}

// ---------------------------------------------------------------------------
// Scan history renderer (exported for unit tests)
// ---------------------------------------------------------------------------

async function renderScanHistory() {
  const { sentra_scan_history: history = [] } = await chrome.storage.local.get('sentra_scan_history');

  const listEl = $('scan-history-list');
  const emptyEl = $('scan-history-empty');
  const linkEl = $('view-all-link');

  if (linkEl) {
    linkEl.href = DASHBOARD_SCAN_URL;
  }

  if (!history.length) {
    if (emptyEl) emptyEl.style.display = '';
    if (listEl) listEl.style.display = 'none';
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';
  if (listEl) listEl.style.display = '';

  listEl.innerHTML = history
    .map((entry) => {
      const badge = _verdictBadge(entry.verdict);
      const subject = (entry.subject || '').slice(0, 40);
      const time = _timeAgo(entry.timestamp);
      return (
        `<li class="scan-history-item">` +
        `<span class="verdict-badge">${badge}</span>` +
        `<span class="scan-subject">${subject}</span>` +
        `<span class="scan-time">${time}</span>` +
        `</li>`
      );
    })
    .join('');
}

// ---------------------------------------------------------------------------
// Main init
// ---------------------------------------------------------------------------

async function init() {
  const stored = await chrome.storage.local.get([
    'sentra_auth_token',
    'sentra_user_email',
    'sentra_instance_token',
  ]);

  const dot = $('statusDot');

  if (!stored.sentra_auth_token) {
    // Not logged in
    dot.className = 'status-dot disconnected';
    $('viewLogin').classList.remove('hidden');
    $('btnOpenDashboard').addEventListener('click', openDashboard);
    return;
  }

  // Logged in
  dot.className = 'status-dot connected';
  $('viewMain').classList.remove('hidden');
  $('userEmail').textContent = stored.sentra_user_email || 'Unknown';
  $('instanceToken').textContent = stored.sentra_instance_token
    ? stored.sentra_instance_token.slice(0, 12) + '…'
    : 'Not registered';

  $('btnLogout').addEventListener('click', logout);
  $('btnOpenDashboard2').addEventListener('click', openDashboard);

  await renderScanHistory();
}

async function logout() {
  await chrome.storage.local.remove(['sentra_auth_token', 'sentra_user_email', 'sentra_instance_token']);
  window.location.reload();
}

function openDashboard() {
  chrome.tabs.create({ url: DASHBOARD_URL });
}

document.addEventListener('DOMContentLoaded', init);

// CommonJS export for Jest
if (typeof module !== 'undefined') {
  module.exports = { renderScanHistory, _timeAgo, _verdictBadge };
}
