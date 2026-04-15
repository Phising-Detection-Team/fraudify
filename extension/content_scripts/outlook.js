/**
 * Sentra Extension — Outlook content script
 * Injected into:
 *   https://outlook.live.com/*
 *   https://outlook.office.com/*
 *   https://outlook.office365.com/*
 *
 * Selectors target Outlook Web (OWA) DOM structure.
 */

const OVERLAY_ID = 'sentra-phishing-overlay';

// Tracks which document currently hosts the overlay (top-level or an iframe's doc).
// Updated each time _getBodyContainer() succeeds.
let _readingPaneDoc = document;

// ---------------------------------------------------------------------------
// DOM extraction
// ---------------------------------------------------------------------------

/**
 * Find the subject element across multiple Outlook DOM variants.
 * @returns {Element|null}
 */
function _findSubjectEl() {
  return document.querySelector('[data-testid="subject"]')
      || document.querySelector('[id*="SubjectWell"]')
      || document.querySelector('[aria-label*="subject" i]')
      || document.querySelector('[id*="subject" i]');
}

/**
 * Find the subject element (logged wrapper used by extractEmailFromDOM).
 * @returns {Element|null}
 */
function _getSubjectEl() {
  return _findSubjectEl();
}

/**
 * Find the reading-pane body container across multiple Outlook UI variants.
 * All confirmed selectors are in the top-level document.
 * @returns {Element|null}
 */
function _getBodyContainer() {
  const SELECTORS = [
    '[aria-label*="message body" i]',  // confirmed: matches Outlook Live reading pane
    '[id*="MessageBody"]',              // confirmed: same element, id-based fallback
    '[data-testid="UniqueMessageBody"]',
    '[id*="UniqueMessageBody"]',
    '.ReadingPaneContents',
    '[class*="ReadingPane"] [role="document"]',
  ];

  for (const sel of SELECTORS) {
    const el = document.querySelector(sel);
    if (el) {
      _readingPaneDoc = document;
      return el;
    }
  }

  return null;
}

/**
 * Extract the subject and body of the currently open email from Outlook's DOM.
 * @returns {{ subject: string, body: string }}
 */
function extractEmailFromDOM() {
  const subjectEl = _getSubjectEl();
  const bodyEl    = _getBodyContainer();

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
    body:    (bodyEl?.innerText      || bodyEl?.textContent || '').trim(),
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

  const bgColor = isPhishing ? '#dc2626' : isSuspicious ? '#d97706' : '#16a34a';
  const pct     = Math.round((confidence || 0) * 100);

  const label = isPhishing
    ? '⚠ Sentra: Phishing Detected'
    : isSuspicious
      ? '⚠ Sentra: Suspicious Email'
      : '✓ Sentra: Email Looks Safe (Legitimate)';

  const div = document.createElement('div');
  div.id = OVERLAY_ID;
  div.style.cssText = `
    background:${bgColor};
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

/** Inject overlay above the email body. */
function injectOverlay(verdictData) {
  const existing = _readingPaneDoc.getElementById(OVERLAY_ID);
  if (existing) existing.remove();

  const container = _getBodyContainer();
  if (!container) return;

  const overlayElement = buildOverlayElement(verdictData);
  container.prepend(overlayElement);
}

/** Remove the Sentra overlay from the DOM if present. */
function removeOverlay() {
  for (const doc of [_readingPaneDoc, document]) {
    const el = doc.getElementById(OVERLAY_ID);
    if (el) el.remove();
  }
}

/** Inject a temporary "Analyzing…" placeholder while scanning. */
function injectScanning() {
  const existing = _readingPaneDoc.getElementById(OVERLAY_ID);
  if (existing) existing.remove();

  const container = _getBodyContainer();
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
 * Watch for Outlook email-open events.
 * Fires immediately if an email is already open, then re-fires on each subject change.
 * @param {() => void} onEmailOpen
 * @returns {MutationObserver}
 */
function watchForEmailOpen(onEmailOpen) {
  let lastSubject = '';

  function _checkSubject() {
    const subjectEl = _findSubjectEl();
    if (!subjectEl) return;
    const subject = subjectEl.textContent.trim();
    if (subject && subject !== lastSubject) {
      lastSubject = subject;
      onEmailOpen();
    }
  }

  const observer = new MutationObserver(_checkSubject);
  observer.observe(document.body, { childList: true, subtree: true });

  // Fire once immediately in case an email was already open when the script loaded.
  _checkSubject();

  return observer;
}

// ---------------------------------------------------------------------------
// Entry point
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
  // Always run the scanner from the top-level frame.
  // Child frames are explicitly skipped to avoid duplicate scans.
  if (window === window.top) {
    watchForEmailOpen(async () => {
      // Outlook renders body asynchronously after the subject appears.
      // Retry up to 8 times (every 500ms = 4s total).
      let subject = '', body = '', links = [];
      for (let attempt = 0; attempt < 8; attempt++) {
        ({ subject, body, links } = extractEmailFromDOM());
        if (body) break;
        await new Promise((r) => setTimeout(r, 500));
      }
      if (!body) return;

      injectScanning();
      _scanAndShow(subject, body, links);
    });
  }
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
      verdictData = data;
    } else if (data && data.job_id) {
      verdictData = await pollScanResult(apiUrl, token, data.job_id);
    }

    removeOverlay();
    if (verdictData && verdictData.verdict) {
      await _cacheScanResult(subject, verdictData.verdict, verdictData.confidence);
      injectOverlay(verdictData);
    } else {
      injectOverlay({ verdict: 'suspicious', confidence: 0, reasoning: 'Unable to determine verdict.' });
    }
  } catch (err) {
    _injectError('Sentra: Analysis unavailable');
  }
}

/** Inject a subtle error banner when scanning fails entirely. */
/* istanbul ignore next */
function _injectError(message) {
  const existing = _readingPaneDoc.getElementById(OVERLAY_ID);
  if (existing) existing.remove();

  const container = _getBodyContainer();
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
