/**
 * Tests for extension/background/service-worker.js
 * Written BEFORE implementation (TDD RED phase).
 *
 * Strategy: require() the service-worker module after setting up chrome mocks
 * in setup.js. The module registers listeners on load; we capture those
 * listeners and invoke them directly to test behaviour.
 */

beforeEach(() => {
  chrome.storage.local._reset();
});

// Capture listeners as they are registered
let installedListener = null;
let alarmListener = null;
let messageListener = null;

// Helpers exposed by the module for direct testing
let _detectBrowser;
let _detectOS;
let _cacheScanResult;

beforeAll(() => {
  chrome.runtime.onInstalled.addListener.mockImplementation((fn) => { installedListener = fn; });
  chrome.alarms.onAlarm.addListener.mockImplementation((fn) => { alarmListener = fn; });
  chrome.runtime.onMessage.addListener.mockImplementation((fn) => { messageListener = fn; });

  // Load the module — listeners are registered as a side-effect
  const sw = require('../background/service-worker');
  _detectBrowser = sw._detectBrowser;
  _detectOS = sw._detectOS;
  _cacheScanResult = sw._cacheScanResult;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetch(status, body) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  });
}

// ---------------------------------------------------------------------------
// onInstalled — instance registration
// ---------------------------------------------------------------------------

describe('onInstalled', () => {
  it('registers an onInstalled listener', () => {
    expect(installedListener).toBeInstanceOf(Function);
  });

  it('calls registerInstance when auth token is present', async () => {
    await chrome.storage.local.set({ sentra_auth_token: 'jwt-abc', sentra_api_url: 'http://localhost:5000' });
    mockFetch(201, { success: true, data: { instance_token: 'tok123' } });

    await installedListener({ reason: 'install' });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/extension/register'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('does nothing when auth token is absent', async () => {
    mockFetch(201, { success: true });

    await installedListener({ reason: 'install' });

    expect(fetch).not.toHaveBeenCalled();
  });

  it('stores instance_token in chrome.storage after registration', async () => {
    await chrome.storage.local.set({ sentra_auth_token: 'jwt-abc' });
    mockFetch(201, { success: true, data: { instance_token: 'newtoken99' } });

    await installedListener({ reason: 'install' });

    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({ sentra_instance_token: 'newtoken99' })
    );
  });

  it('does not throw when registration fetch fails', async () => {
    await chrome.storage.local.set({ sentra_auth_token: 'jwt-abc' });
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    await expect(installedListener({ reason: 'install' })).resolves.not.toThrow();
  });

  it('does not store token when response has no instance_token', async () => {
    await chrome.storage.local.set({ sentra_auth_token: 'jwt-abc' });
    mockFetch(201, { success: true, data: {} }); // no instance_token field in data

    await installedListener({ reason: 'install' });

    expect(chrome.storage.local.set).not.toHaveBeenCalledWith(
      expect.objectContaining({ sentra_instance_token: expect.anything() })
    );
  });
});

// ---------------------------------------------------------------------------
// onAlarm — heartbeat
// ---------------------------------------------------------------------------

describe('onAlarm (heartbeat)', () => {
  it('registers an onAlarm listener', () => {
    expect(alarmListener).toBeInstanceOf(Function);
  });

  it('sends heartbeat when instance_token is present', async () => {
    await chrome.storage.local.set({ sentra_instance_token: 'tok123', sentra_api_url: 'http://localhost:5000' });
    mockFetch(200, { success: true });

    await alarmListener({ name: 'heartbeat' });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/extension/heartbeat'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('does nothing when instance_token is absent', async () => {
    mockFetch(200, { success: true });

    await alarmListener({ name: 'heartbeat' });

    expect(fetch).not.toHaveBeenCalled();
  });

  it('ignores non-heartbeat alarms', async () => {
    await chrome.storage.local.set({ sentra_instance_token: 'tok123' });
    mockFetch(200, { success: true });

    await alarmListener({ name: 'some-other-alarm' });

    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not throw when heartbeat fetch fails', async () => {
    await chrome.storage.local.set({ sentra_instance_token: 'tok123' });
    global.fetch = jest.fn().mockRejectedValue(new Error('Network down'));

    await expect(alarmListener({ name: 'heartbeat' })).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// onMessage — SET_AUTH_TOKEN
// ---------------------------------------------------------------------------

describe('onMessage (SET_AUTH_TOKEN)', () => {
  it('stores auth token and email in chrome.storage', async () => {
    messageListener({ type: 'SET_AUTH_TOKEN', token: 'jwt-xyz', email: 'user@example.com' }, {}, jest.fn());
    await new Promise((r) => setTimeout(r, 0));
    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({ sentra_auth_token: 'jwt-xyz', sentra_user_email: 'user@example.com' })
    );
  });

  it('auto-registers instance when no instance_token exists', async () => {
    mockFetch(201, { success: true, data: { instance_token: 'inst-abc' } });
    messageListener({ type: 'SET_AUTH_TOKEN', token: 'jwt-new', email: 'user@example.com' }, {}, jest.fn());
    await new Promise((r) => setTimeout(r, 0));
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/extension/register'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('skips registration when token is unchanged and instance already exists', async () => {
    await chrome.storage.local.set({ sentra_auth_token: 'jwt-same', sentra_instance_token: 'inst-existing' });
    mockFetch(201, { success: true });
    messageListener({ type: 'SET_AUTH_TOKEN', token: 'jwt-same', email: 'user@example.com' }, {}, jest.fn());
    await new Promise((r) => setTimeout(r, 0));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not throw when registration fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
    messageListener({ type: 'SET_AUTH_TOKEN', token: 'jwt-xyz', email: 'a@b.com' }, {}, jest.fn());
    await expect(new Promise((r) => setTimeout(r, 10))).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// onMessage — CLEAR_AUTH_TOKEN
// ---------------------------------------------------------------------------

describe('onMessage (CLEAR_AUTH_TOKEN)', () => {
  it('removes auth token and email from chrome.storage', async () => {
    await chrome.storage.local.set({ sentra_auth_token: 'jwt-abc', sentra_user_email: 'u@e.com' });
    messageListener({ type: 'CLEAR_AUTH_TOKEN' }, {}, jest.fn());
    await new Promise((r) => setTimeout(r, 0));
    expect(chrome.storage.local.remove).toHaveBeenCalledWith(
      expect.arrayContaining(['sentra_auth_token', 'sentra_user_email'])
    );
  });
});

// ---------------------------------------------------------------------------
// onMessage — SCAN_EMAIL
// ---------------------------------------------------------------------------

describe('onMessage (SCAN_EMAIL)', () => {
  it('registers an onMessage listener', () => {
    expect(messageListener).toBeInstanceOf(Function);
  });

  it('sends verdict back via sendResponse for a cache-hit (200, status complete)', async () => {
    await chrome.storage.local.set({
      sentra_auth_token: 'jwt-abc',
      sentra_api_url: 'http://localhost:5000',
    });
    // Cache hit: POST /api/scan returns 200 with data.status === 'complete'
    mockFetch(200, {
      success: true,
      data: { verdict: 'phishing', confidence: 0.92, status: 'complete' },
    });

    const sendResponse = jest.fn();
    messageListener({ type: 'SCAN_EMAIL', subject: 'Win a prize', body: 'Click here' }, {}, sendResponse);

    await new Promise((r) => setTimeout(r, 0));

    expect(sendResponse).toHaveBeenCalledWith(
      expect.objectContaining({ verdict: 'phishing', confidence: 0.92 })
    );
  });

  it('returns job_id immediately when API returns 202 cache miss (content script polls)', async () => {
    await chrome.storage.local.set({
      sentra_auth_token: 'jwt-abc',
      sentra_api_url: 'http://localhost:5000',
    });

    // POST /api/scan returns 202 with job_id (cache miss)
    mockFetch(202, { success: true, data: { job_id: 'job-xyz', status: 'queued' } });

    const sendResponse = jest.fn();
    messageListener({ type: 'SCAN_EMAIL', subject: 'Hello', body: 'Normal email' }, {}, sendResponse);

    await new Promise((r) => setTimeout(r, 0));

    // Service worker returns job_id immediately — content script drives polling
    expect(sendResponse).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, job_id: 'job-xyz', status: 'queued' })
    );
  });

  it('sends error response when scanning fails', async () => {
    await chrome.storage.local.set({ sentra_auth_token: 'jwt-abc' });
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    const sendResponse = jest.fn();
    messageListener({ type: 'SCAN_EMAIL', subject: '', body: 'test' }, {}, sendResponse);

    await new Promise((r) => setTimeout(r, 0));

    expect(sendResponse).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
  });

  it('sends not-logged-in error when auth token is missing', async () => {
    const sendResponse = jest.fn();
    messageListener({ type: 'SCAN_EMAIL', subject: '', body: 'test' }, {}, sendResponse);

    await new Promise((r) => setTimeout(r, 0));

    expect(sendResponse).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: expect.stringMatching(/log in|token/i) })
    );
  });

  it('ignores messages with unknown type', () => {
    const sendResponse = jest.fn();
    const result = messageListener({ type: 'UNKNOWN_MSG' }, {}, sendResponse);

    expect(result).toBe(false);
    expect(sendResponse).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// _detectBrowser / _detectOS helpers
// ---------------------------------------------------------------------------

describe('_detectBrowser', () => {
  let originalUA;

  beforeEach(() => {
    originalUA = navigator.userAgent;
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', { value: originalUA, configurable: true });
  });

  function setUA(ua) {
    Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
  }

  it('detects Edge browser', () => {
    setUA('Mozilla/5.0 ... Edg/110.0.1587.63');
    expect(_detectBrowser()).toContain('Edge');
  });

  it('detects Chrome browser', () => {
    setUA('Mozilla/5.0 ... Chrome/110.0.0.0 Safari/537.36');
    expect(_detectBrowser()).toContain('Chrome');
  });

  it('returns Unknown for unrecognised user agent', () => {
    setUA('UnknownBrowser/1.0');
    expect(_detectBrowser()).toBe('Unknown');
  });
});

describe('_detectOS', () => {
  let originalUA;

  beforeEach(() => {
    originalUA = navigator.userAgent;
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', { value: originalUA, configurable: true });
  });

  function setUA(ua) {
    Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
  }

  it('detects Windows 10/11', () => {
    setUA('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    expect(_detectOS()).toBe('Windows 11/10');
  });

  it('detects generic Windows', () => {
    setUA('Mozilla/5.0 (Windows NT 6.1)');
    expect(_detectOS()).toBe('Windows');
  });

  it('detects macOS', () => {
    setUA('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)');
    expect(_detectOS()).toBe('macOS');
  });

  it('detects Linux', () => {
    setUA('Mozilla/5.0 (X11; Linux x86_64)');
    expect(_detectOS()).toBe('Linux');
  });

  it('returns Unknown for unrecognised OS', () => {
    setUA('SomeOtherOS/1.0');
    expect(_detectOS()).toBe('Unknown');
  });
});

// ---------------------------------------------------------------------------
// _cacheScanResult
// ---------------------------------------------------------------------------

describe('_cacheScanResult', () => {
  beforeEach(() => {
    chrome.storage.local._reset();
  });

  it('stores a scan entry in sentra_scan_history', async () => {
    await _cacheScanResult('Important email subject', 'phishing', 0.95);

    const stored = await chrome.storage.local.get('sentra_scan_history');
    expect(stored.sentra_scan_history).toHaveLength(1);
  });

  it('stored entry has subject, verdict, confidence and timestamp fields', async () => {
    const before = Date.now();
    await _cacheScanResult('Test subject', 'safe', 0.80);
    const after = Date.now();

    const stored = await chrome.storage.local.get('sentra_scan_history');
    const entry = stored.sentra_scan_history[0];

    expect(entry).toMatchObject({
      subject: 'Test subject',
      verdict: 'safe',
      confidence: 0.80,
    });
    expect(entry.timestamp).toBeGreaterThanOrEqual(before);
    expect(entry.timestamp).toBeLessThanOrEqual(after);
  });

  it('keeps only the last 5 entries when more than 5 are added', async () => {
    for (let i = 0; i < 7; i++) {
      await _cacheScanResult(`Email ${i}`, 'safe', 0.5);
    }

    const stored = await chrome.storage.local.get('sentra_scan_history');
    expect(stored.sentra_scan_history).toHaveLength(5);
  });

  it('prepends new entries so the most recent appears first', async () => {
    await _cacheScanResult('First email', 'safe', 0.7);
    await _cacheScanResult('Second email', 'phishing', 0.9);

    const stored = await chrome.storage.local.get('sentra_scan_history');
    expect(stored.sentra_scan_history[0].subject).toBe('Second email');
    expect(stored.sentra_scan_history[1].subject).toBe('First email');
  });
});
