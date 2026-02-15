const { test } = require('node:test');
const assert = require('node:assert');

// Mock chrome before requiring the file
global.chrome = {
  runtime: {
    onStartup: { addListener: () => {} }
  },
  action: {
    onClicked: { addListener: () => {} }
  },
  storage: {
    local: {
        get: () => {}
    }
  },
  tabs: {
    query: () => {},
    update: () => {},
    create: () => {},
    discard: () => {}
  }
};

const { isSpecialTab } = require('./eventPage.js');

test('isSpecialTab edge cases', async (t) => {
  await t.test('returns true for chrome:// URLs', () => {
    assert.strictEqual(isSpecialTab({url: 'chrome://settings'}), true);
    assert.strictEqual(isSpecialTab({url: 'chrome://extensions'}), true);
  });

  await t.test('returns true for chrome-extension:// URLs', () => {
    assert.strictEqual(isSpecialTab({url: 'chrome-extension://abcdefg/options.html'}), true);
  });

  await t.test('returns true for chrome-devtools:// URLs', () => {
    assert.strictEqual(isSpecialTab({url: 'chrome-devtools://devtools/bundled/inspector.html'}), true);
  });

  await t.test('returns true for file:// URLs', () => {
    assert.strictEqual(isSpecialTab({url: 'file:///home/user/document.pdf'}), true);
  });

  await t.test('returns true for legitimate chrome webstore URLs', () => {
    assert.strictEqual(isSpecialTab({url: 'https://chrome.google.com/webstore/category/extensions'}), true);
    assert.strictEqual(isSpecialTab({url: 'https://chrome.google.com/webstore'}), true);
    assert.strictEqual(isSpecialTab({url: 'https://chromewebstore.google.com/'}), true);
  });

  await t.test('returns false for fake chrome webstore URLs', () => {
    assert.strictEqual(isSpecialTab({url: 'https://example.com/chrome.google.com/webstore'}), false);
    assert.strictEqual(isSpecialTab({url: 'https://example.com/?q=chrome.google.com/webstore'}), false);
    assert.strictEqual(isSpecialTab({url: 'http://chrome.google.com.malicious.com/webstore'}), false);
  });

  await t.test('returns false for regular URLs', () => {
    assert.strictEqual(isSpecialTab({url: 'https://www.google.com'}), false);
    assert.strictEqual(isSpecialTab({url: 'https://github.com/hrj/sloth'}), false);
  });

  await t.test('returns false for URLs containing special prefixes but not at the start', () => {
    assert.strictEqual(isSpecialTab({url: 'https://example.com/?url=chrome://settings'}), false);
    assert.strictEqual(isSpecialTab({url: 'https://example.com/file://root'}), false);
  });

  await t.test('handles null or undefined tab', () => {
    assert.strictEqual(isSpecialTab(null), false);
    assert.strictEqual(isSpecialTab(undefined), false);
  });

  await t.test('handles missing or empty URL', () => {
    assert.strictEqual(isSpecialTab({}), false);
    assert.strictEqual(isSpecialTab({url: ''}), false);
    assert.strictEqual(isSpecialTab({url: null}), false);
  });
});
