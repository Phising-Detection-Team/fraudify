/**
 * Sentra Extension — Popup script
 * Reads state from chrome.storage and renders the appropriate view.
 */

const DASHBOARD_URL = 'http://localhost:3000/dashboard/user/settings';
const DASHBOARD_SCAN_URL = 'http://localhost:3000/dashboard/user/scan';

const $ = (id) => document.getElementById(id);
const DEFAULT_API_URL = 'http://localhost:5000';

const I18N = {
  en: {
    statusTitle: 'Connection status',
    loginHint: 'Log in to Sentra to enable email scanning.',
    openSentraDashboard: 'Open Sentra Dashboard',
    labelLoggedInAs: 'Logged in as',
    labelInstance: 'Instance',
    mainHint: 'Sentra automatically scans emails when you open them in Gmail or Outlook.',
    recentScans: 'Recent Scans',
    refresh: 'Refresh',
    noScansYet: 'No scans yet',
    viewAllInDashboard: 'View all in dashboard →',
    logOut: 'Log Out',
    openDashboard: 'Open Dashboard',
    unknownUser: 'Unknown',
    notRegistered: 'Not registered',
    justNow: 'just now',
    minAgo: 'm ago',
    hourAgo: 'h ago',
    dayAgo: 'd ago',
  },
  vi: {
    statusTitle: 'Trạng thái kết nối',
    loginHint: 'Đăng nhập Sentra để bật quét email.',
    openSentraDashboard: 'Mở Sentra Dashboard',
    labelLoggedInAs: 'Đăng nhập với',
    labelInstance: 'Instance',
    mainHint: 'Sentra tự động quét email khi bạn mở trong Gmail hoặc Outlook.',
    recentScans: 'Lượt quét gần đây',
    refresh: 'Làm mới',
    noScansYet: 'Chưa có lượt quét',
    viewAllInDashboard: 'Xem tất cả trong dashboard →',
    logOut: 'Đăng xuất',
    openDashboard: 'Mở Dashboard',
    unknownUser: 'Không rõ',
    notRegistered: 'Chưa đăng ký',
    justNow: 'vừa xong',
    minAgo: 'phút trước',
    hourAgo: 'giờ trước',
    dayAgo: 'ngày trước',
  },
};

function _t(locale) {
  return I18N[locale] || I18N.en;
}

// ---------------------------------------------------------------------------
// Time-ago formatter
// ---------------------------------------------------------------------------

function _timeAgo(timestamp, locale = 'en') {
  const dict = _t(locale);
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return dict.justNow;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return locale === 'vi' ? `${minutes} ${dict.minAgo}` : `${minutes}${dict.minAgo}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return locale === 'vi' ? `${hours} ${dict.hourAgo}` : `${hours}${dict.hourAgo}`;
  const days = Math.floor(hours / 24);
  return locale === 'vi' ? `${days} ${dict.dayAgo}` : `${days}${dict.dayAgo}`;
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

function applyLocale(locale) {
  const dict = _t(locale);
  document.documentElement.lang = locale;

  const statusDot = $('statusDot');
  if (statusDot) statusDot.title = dict.statusTitle;
  if ($('loginHint')) $('loginHint').textContent = dict.loginHint;
  if ($('btnOpenDashboard')) $('btnOpenDashboard').textContent = dict.openSentraDashboard;
  if ($('labelLoggedInAs')) $('labelLoggedInAs').textContent = dict.labelLoggedInAs;
  if ($('labelInstance')) $('labelInstance').textContent = dict.labelInstance;
  if ($('mainHint')) $('mainHint').textContent = dict.mainHint;
  if ($('sectionRecentScans')) $('sectionRecentScans').textContent = dict.recentScans;

  const refreshBtn = $('btnRefreshHistory');
  if (refreshBtn) refreshBtn.title = dict.refresh;
  if ($('scan-history-empty')) $('scan-history-empty').textContent = dict.noScansYet;
  if ($('view-all-link')) $('view-all-link').textContent = dict.viewAllInDashboard;
  if ($('btnLogout')) $('btnLogout').textContent = dict.logOut;
  if ($('btnOpenDashboard2')) $('btnOpenDashboard2').textContent = dict.openDashboard;
}

async function _resolveLocale(stored) {
  if (!stored.sentra_auth_token) return stored.sentra_locale || 'en';
  try {
    const apiUrl = stored.sentra_api_url || DEFAULT_API_URL;
    const response = await fetch(`${apiUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${stored.sentra_auth_token}` },
    });
    if (response.ok) {
      const payload = await response.json();
      const serverLocale = payload?.data?.preferred_language === 'vi' ? 'vi' : 'en';
      await chrome.storage.local.set({ sentra_locale: serverLocale });
      return serverLocale;
    }
  } catch (_) {
    // Non-fatal; fallback to cached locale
  }
  return stored.sentra_locale || 'en';
}

async function renderScanHistory(locale = 'en') {
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
      const time = _timeAgo(entry.timestamp, locale);
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
    'sentra_api_url',
    'sentra_locale',
  ]);
  const locale = await _resolveLocale(stored);
  const dict = _t(locale);
  applyLocale(locale);

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
  $('userEmail').textContent = stored.sentra_user_email || dict.unknownUser;
  $('instanceToken').textContent = stored.sentra_instance_token
    ? stored.sentra_instance_token.slice(0, 12) + '…'
    : dict.notRegistered;

  $('btnLogout').addEventListener('click', logout);
  $('btnOpenDashboard2').addEventListener('click', openDashboard);
  $('btnRefreshHistory').addEventListener('click', () => renderScanHistory(locale));

  // Auto-refresh the list whenever the content script writes a new scan result
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.sentra_scan_history) renderScanHistory(locale);
  });

  await renderScanHistory(locale);
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
