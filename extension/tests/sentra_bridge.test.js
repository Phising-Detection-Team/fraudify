/**
 * Tests for extension/content_scripts/sentra_bridge.js
 *
 * The bridge is an IIFE that runs immediately on require(). Each test sets up
 * the DOM, loads the module fresh via jest.resetModules() + require(), and then
 * inspects what was sent to chrome.runtime.sendMessage.
 */

beforeEach(() => {
  jest.resetModules();
  document.body.innerHTML = '';
  chrome.runtime.sendMessage.mockClear();
});

function loadBridge() {
  require('../content_scripts/sentra_bridge');
}

function setExtData(content) {
  const el = document.createElement('script');
  el.id = 'sentra-ext-data';
  el.type = 'application/json';
  el.textContent = content;
  document.body.appendChild(el);
}

// ---------------------------------------------------------------------------
// Authenticated state
// ---------------------------------------------------------------------------

describe('when sentra-ext-data element is present with a valid token', () => {
  it('sends SET_AUTH_TOKEN with token and email', () => {
    setExtData(JSON.stringify({ token: 'jwt-abc', email: 'user@example.com' }));
    loadBridge();
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'SET_AUTH_TOKEN',
      token: 'jwt-abc',
      email: 'user@example.com',
      locale: 'en',
    });
  });

  it('sends SET_AUTH_TOKEN with empty email when email is missing', () => {
    setExtData(JSON.stringify({ token: 'jwt-abc' }));
    loadBridge();
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SET_AUTH_TOKEN', token: 'jwt-abc', email: '' })
    );
  });
});

// ---------------------------------------------------------------------------
// Unauthenticated / logout state
// ---------------------------------------------------------------------------

describe('when sentra-ext-data element is absent', () => {
  it('sends CLEAR_AUTH_TOKEN', () => {
    loadBridge();
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'CLEAR_AUTH_TOKEN' });
  });
});

describe('when sentra-ext-data element has no token field', () => {
  it('sends CLEAR_AUTH_TOKEN', () => {
    setExtData(JSON.stringify({ email: 'user@example.com' }));
    loadBridge();
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'CLEAR_AUTH_TOKEN' });
  });
});

describe('when sentra-ext-data element has malformed JSON', () => {
  it('does not send any message', () => {
    setExtData('not-valid-json{{{');
    loadBridge();
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
  });
});

describe('when sentra-ext-data element is empty', () => {
  it('sends CLEAR_AUTH_TOKEN', () => {
    setExtData('');
    loadBridge();
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'CLEAR_AUTH_TOKEN' });
  });
});
