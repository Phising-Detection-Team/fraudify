/**
 * Sentra Extension — Gmail content script
 * Injected into https://mail.google.com/*
 *
 * Responsibilities:
 *   - Watch the Gmail DOM for email-open events (MutationObserver)
 *   - Extract subject + body from the reading pane
 *   - Send to service worker for scanning
 *   - Inject a verdict overlay badge into the email header
 */

const OVERLAY_ID = 'sentra-phishing-overlay';

// ---------------------------------------------------------------------------
// DOM extraction
// ---------------------------------------------------------------------------

/**
 * Extract the subject and body of the currently open email from Gmail's DOM.
 *
 * Selectors used:
 *   Subject : h2.hP          — the email subject heading
 *   Body    : .a3s.aiL        — the sanitised email body container
 *
 * @returns {{ subject: string, body: string }}
 */
function extractEmailFromDOM() {
  const subjectEl = document.querySelector('h2.hP');
  const bodyEl = document.querySelector('.a3s.aiL');

  const links = [];
  if (bodyEl) {
    const anchorTags = bodyEl.querySelectorAll('a[href]');
    for (const a of anchorTags) {
      const href = a.getAttribute('href');
      if (href && !href.startsWith('mailto:') && !href.startsWith('javascript:')) {
        links.push(href);
      }
    }
  }

  return {
    subject: (subjectEl?.textContent || '').trim(),
    body:    (bodyEl?.innerText   || bodyEl?.textContent || '').trim(),
    links:   Array.from(new Set(links)), // filter out duplicates
  };
}

// ---------------------------------------------------------------------------
// Overlay
// ---------------------------------------------------------------------------

/** Returns the stable DOM id used for the overlay element. */
function getOverlayId() {
  return OVERLAY_ID;
}

/**
 * Build the HTML string for the verdict overlay banner.
 *
 * @param {{ verdict: string, confidence: number, reasoning?: string }} data
 * @returns {string}
 */
function buildOverlayElement({ verdict, confidence, reasoning }) {
  const isPhishing   = verdict === 'phishing' || verdict === 'likely_phishing';
  const isSuspicious = verdict === 'suspicious';

  const bgColor   = isPhishing ? '#dc2626' : isSuspicious ? '#d97706' : '#16a34a';
  const textColor = '#ffffff';
  const pct       = Math.round((confidence || 0) * 100);

  const label = isPhishing
    ? '⚠ Sentra: Phishing Detected'
    : isSuspicious
      ? '⚠ Sentra: Suspicious Email'
      : '✓ Sentra: Email Looks Safe';

  const div = document.createElement('div');
  div.id = OVERLAY_ID;
  div.style.cssText = `
    background:${bgColor};
    color:${textColor};
    padding:8px 14px;
    border-radius:6px;
    font-family:sans-serif;
    font-size:13px;
    font-weight:600;
    margin-bottom:8px;
    display:flex;
    flex-direction:column;
    gap:2px;
    box-shadow:0 2px 8px rgba(0,0,0,0.2);
  `;

  const span = document.createElement('span');
  span.textContent = `${label} — ${pct}% confidence`;
  div.appendChild(span);

  if (reasoning) {
    const reasonDiv = document.createElement('div');
    reasonDiv.style.cssText = 'font-size:12px;margin-top:6px;opacity:0.9;';
    reasonDiv.textContent = reasoning;
    div.appendChild(reasonDiv);
  }

  return div;
}

/** Inject overlay above the email body; removes any previous overlay first. */
function injectOverlay(verdictData) {
  const existing = document.getElementById(OVERLAY_ID);
  if (existing) existing.remove();

  const container = document.querySelector('.a3s') || document.querySelector('.gs');
  if (!container) return;

  const overlayElement = buildOverlayElement(verdictData);
  container.prepend(overlayElement);
}

/** Remove the Sentra overlay from the DOM if present. */
function removeOverlay() {
  const el = document.getElementById(OVERLAY_ID);
  if (el) el.remove();
}

/** Inject a temporary "Analyzing…" placeholder while scanning. */
function injectScanning() {
  const existing = document.getElementById(OVERLAY_ID);
  if (existing) existing.remove();

  const container = document.querySelector('.a3s') || document.querySelector('.gs');
  if (!container) return;

  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div id="${OVERLAY_ID}" style="
      background:#4b5563;
      color:#ffffff;
      padding:8px 14px;
      border-radius:6px;
      font-family:sans-serif;
      font-size:13px;
      font-weight:600;
      margin-bottom:8px;
      display:flex;
      flex-direction:column;
      gap:2px;
      box-shadow:0 2px 8px rgba(0,0,0,0.2);
    ">
      <span>⟳ Sentra: Analyzing…</span>
    </div>
  `.trim();
  container.prepend(wrapper.firstChild);
}

// ---------------------------------------------------------------------------
// Email-open observer
// ---------------------------------------------------------------------------

/**
 * Watch for Gmail email-open events using a MutationObserver.
 * Calls `onEmailOpen()` whenever a new email is displayed.
 *
 * @param {() => void} onEmailOpen
 * @returns {MutationObserver}
 */
function watchForEmailOpen(onEmailOpen) {
  let lastSubject = '';

  const observer = new MutationObserver(() => {
    const subjectEl = document.querySelector('h2.hP');
    if (!subjectEl) return;

    const subject = subjectEl.textContent.trim();
    if (subject && subject !== lastSubject) {
      lastSubject = subject;
      onEmailOpen();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
  return observer;
}

// ---------------------------------------------------------------------------
// Content-script entry point (runs in Gmail tab)
// ---------------------------------------------------------------------------

function _escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* istanbul ignore next */
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
  // We are running inside an actual extension — start the observer
  watchForEmailOpen(() => {
    const { subject, body, links } = extractEmailFromDOM();
    if (!body) return;

    injectScanning();
    _scanAndShow(subject, body, links);
  });
}

/* istanbul ignore next */
async function _cacheScanResult(subject, verdict, confidence) {
  const { sentra_scan_history: existing = [] } = await chrome.storage.local.get('sentra_scan_history');
  const entry = {
    subject: (subject || '').slice(0, 60) || '(no subject)',
    verdict,
    confidence,
    timestamp: Date.now(),
  };
  await chrome.storage.local.set({ sentra_scan_history: [entry, ...existing].slice(0, 5) });
}

/* istanbul ignore next */
async function _scanAndShow(subject, body, links) {
  try {
    const stored = await chrome.storage.local.get(['sentra_api_url', 'sentra_auth_token', 'sentra_inference_mode']);
    const apiUrl = stored.sentra_api_url || DEFAULT_API_URL;
    const token = stored.sentra_auth_token;
    if (!token) { removeOverlay(); return; }

    const result = await scanEmail(apiUrl, token, subject, body, links, stored.sentra_inference_mode || 'gguf');
    const data = result && result.data;

    let verdictData = null;
    if (data && data.status === 'complete') {
      // Synchronous result (primary path) or cache hit — verdict available immediately
      verdictData = data;
    } else if (data && data.job_id) {
      // Legacy async path: poll until complete (kept for backward compat)
      verdictData = await pollScanResult(apiUrl, token, data.job_id);
    }

    removeOverlay();
    if (verdictData && verdictData.verdict) {
      await _cacheScanResult(subject, verdictData.verdict, verdictData.confidence);
      injectOverlay(verdictData);
    } else {
      // Scan ran but returned no verdict — show neutral state
      injectOverlay({ verdict: 'suspicious', confidence: 0, reasoning: 'Unable to determine verdict.' });
    }
  } catch (_) {
    // Network error or scan timeout — show a non-blocking error state
    _injectError('Sentra: Analysis unavailable');
  }
}

/** Inject a subtle error banner when scanning fails entirely. */
/* istanbul ignore next */
function _injectError(message) {
  const existing = document.getElementById(OVERLAY_ID);
  if (existing) existing.remove();

  const container = document.querySelector('.a3s') || document.querySelector('.gs');
  if (!container) return;

  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div id="${OVERLAY_ID}" style="
      background:#374151;
      color:#9ca3af;
      padding:6px 14px;
      border-radius:6px;
      font-family:sans-serif;
      font-size:12px;
      margin-bottom:8px;
      box-shadow:0 2px 8px rgba(0,0,0,0.15);
    ">
      ${_escapeHtml(message)}
    </div>
  `.trim();
  container.prepend(wrapper.firstChild);
}

// CommonJS export for Jest
if (typeof module !== 'undefined') {
  module.exports = { extractEmailFromDOM, buildOverlayElement, injectOverlay, injectScanning, removeOverlay, getOverlayId, watchForEmailOpen };
}
