/**
 * Tests for extension/content_scripts/gmail.js
 * Written BEFORE implementation (TDD RED phase).
 * Uses jsdom (configured as testEnvironment in package.json).
 */

const {
  extractEmailFromDOM,
  buildOverlayElement,
  injectOverlay,
  removeOverlay,
  getOverlayId,
} = require('../content_scripts/gmail');

// ---------------------------------------------------------------------------
// extractEmailFromDOM
// ---------------------------------------------------------------------------

describe('extractEmailFromDOM', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('extracts subject from h2.hP', () => {
    document.body.innerHTML = `
      <h2 class="hP">Your account has been compromised</h2>
      <div class="a3s aiL">Please verify your credentials immediately.</div>
    `;

    const { subject } = extractEmailFromDOM();
    expect(subject).toBe('Your account has been compromised');
  });

  it('extracts body from .a3s.aiL', () => {
    document.body.innerHTML = `
      <h2 class="hP">Normal subject</h2>
      <div class="a3s aiL">Email body content here.</div>
    `;

    const { body } = extractEmailFromDOM();
    expect(body).toBe('Email body content here.');
  });

  it('returns empty strings when elements are not found', () => {
    document.body.innerHTML = '<div>Some other content</div>';

    const { subject, body } = extractEmailFromDOM();
    expect(subject).toBe('');
    expect(body).toBe('');
  });

  it('trims whitespace from extracted text', () => {
    document.body.innerHTML = `
      <h2 class="hP">   Spaced Subject   </h2>
      <div class="a3s aiL">   Spaced body   </div>
    `;

    const { subject, body } = extractEmailFromDOM();
    expect(subject).toBe('Spaced Subject');
    expect(body).toBe('Spaced body');
  });

  it('returns empty body when body element is present but empty', () => {
    document.body.innerHTML = `
      <h2 class="hP">Subject</h2>
      <div class="a3s aiL"></div>
    `;

    const { body } = extractEmailFromDOM();
    expect(body).toBe('');
  });
});

// ---------------------------------------------------------------------------
// buildOverlayElement
// ---------------------------------------------------------------------------

describe('buildOverlayElement', () => {
  it('returns an HTMLElement', () => {
    const el = buildOverlayElement({ verdict: 'phishing', confidence: 0.95 });
    expect(el instanceof HTMLElement).toBe(true);
    expect(el.tagName).toBe('DIV');
  });

  it('includes verdict text for phishing', () => {
    const el = buildOverlayElement({ verdict: 'phishing', confidence: 0.95 });
    expect(el.textContent.toLowerCase()).toContain('phishing');
  });

  it('includes verdict text for legitimate', () => {
    const el = buildOverlayElement({ verdict: 'legitimate', confidence: 0.98 });
    expect(el.textContent.toLowerCase()).toContain('safe');
  });

  it('includes confidence percentage', () => {
    const el = buildOverlayElement({ verdict: 'phishing', confidence: 0.92 });
    expect(el.textContent).toContain('92');
  });

  it('includes reasoning when provided', () => {
    const el = buildOverlayElement({
      verdict: 'phishing',
      confidence: 0.9,
      reasoning: 'Suspicious link detected',
    });
    expect(el.textContent).toContain('Suspicious link detected');
  });

  it('uses sentra-overlay id so it can be found and removed', () => {
    const el = buildOverlayElement({ verdict: 'phishing', confidence: 0.9 });
    expect(el.id).toBe(getOverlayId());
  });
});

// ---------------------------------------------------------------------------
// injectOverlay / removeOverlay
// ---------------------------------------------------------------------------

describe('injectOverlay / removeOverlay', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div class="a3s"><p>Email body</p></div>';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('injects overlay element into the DOM', () => {
    injectOverlay({ verdict: 'phishing', confidence: 0.93 });
    expect(document.getElementById(getOverlayId())).not.toBeNull();
  });

  it('overlay contains verdict text', () => {
    injectOverlay({ verdict: 'phishing', confidence: 0.93 });
    const el = document.getElementById(getOverlayId());
    expect(el.textContent.toLowerCase()).toContain('phishing');
  });

  it('replaces existing overlay on second inject', () => {
    injectOverlay({ verdict: 'phishing', confidence: 0.9 });
    injectOverlay({ verdict: 'legitimate', confidence: 0.98 });
    const overlays = document.querySelectorAll(`#${getOverlayId()}`);
    expect(overlays.length).toBe(1);
  });

  it('removeOverlay removes the overlay element', () => {
    injectOverlay({ verdict: 'phishing', confidence: 0.9 });
    removeOverlay();
    expect(document.getElementById(getOverlayId())).toBeNull();
  });

  it('removeOverlay does nothing when no overlay present', () => {
    expect(() => removeOverlay()).not.toThrow();
  });

  it('does not inject when no container element found', () => {
    document.body.innerHTML = '<div>No email container</div>';
    injectOverlay({ verdict: 'phishing', confidence: 0.9 });
    expect(document.getElementById(getOverlayId())).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getOverlayId
// ---------------------------------------------------------------------------

describe('getOverlayId', () => {
  it('returns a stable non-empty string', () => {
    expect(getOverlayId()).toBe(getOverlayId());
    expect(getOverlayId().length).toBeGreaterThan(0);
  });
});
