const { test } = require('node:test');
const assert = require('node:assert');

// Mock chrome before requiring the file
const createdTabs = [];
const discardedTabs = [];
const markerExecutions = [];
let queryTabs = [
  { id: 1, windowId: 1, url: 'https://example.com', index: 0, active: false, discarded: false },
  { id: 2, windowId: 1, url: 'chrome://newtab/', index: 1, active: true, discarded: false },
  { id: 3, windowId: 2, url: 'https://example.org', index: 0, active: true, discarded: false }
];
let markerPermissionGranted = false;
let discardErrorMessage = null;

global.fetch = async () => ({
  ok: true,
  blob: async () => new Blob(['test favicon'], {type: 'image/png'})
});

global.chrome = {
  runtime: {
    onStartup: { addListener: () => {} },
    lastError: null
  },
  action: {
    onClicked: { addListener: () => {} }
  },
  storage: {
    local: {
        get: () => {}
    }
  },
  permissions: {
    contains: (permissions, callback) => callback(markerPermissionGranted)
  },
  scripting: {
    executeScript: (details, callback) => {
      markerExecutions.push(details);
      callback();
    }
  },
  tabs: {
    query: (queryInfo, callback) => {
      callback(queryTabs);
    },
    update: (tabId, updateProperties, callback) => {
      if (callback) {
        callback();
      }
    },
    create: (createProperties) => {
      createdTabs.push(createProperties);
    },
    discard: (tabId, callback) => {
      discardedTabs.push(tabId);
      if (discardErrorMessage) {
        chrome.runtime.lastError = {message: discardErrorMessage};
        callback();
        chrome.runtime.lastError = null;
        return;
      }
      if (callback) {
        callback({id: tabId});
      }
    }
  }
};

const {
  isSpecialTab,
  isNewTab,
  discardAllTabs,
  isDiscarded
} = require('./eventPage.js');

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

test('discardAllTabs creates new tab only for windows without a new tab', async () => {
  createdTabs.length = 0;
  markerPermissionGranted = false;
  await discardAllTabs(true, true);

  // Window 1 has a new tab (id 2).
  // Window 2 does not have a new tab.
  // So it should create a new tab in window 2.
  assert.strictEqual(createdTabs.length, 1);
  assert.strictEqual(createdTabs[0].windowId, 2);
});

test('discardAllTabs discards normally without marker permission', async () => {
  markerPermissionGranted = false;
  markerExecutions.length = 0;
  discardedTabs.length = 0;
  queryTabs = [
    { id: 10, windowId: 1, url: 'https://example.com', status: 'complete', active: false, discarded: false }
  ];

  await discardAllTabs(false, true);

  assert.deepStrictEqual(discardedTabs, [10]);
  assert.strictEqual(markerExecutions.length, 0);
});

test('discardAllTabs marks a complete eligible tab before discarding it', async () => {
  markerPermissionGranted = true;
  markerExecutions.length = 0;
  discardedTabs.length = 0;
  queryTabs = [
    {
      id: 11,
      windowId: 1,
      url: 'https://example.com',
      status: 'complete',
      active: false,
      discarded: false,
      favIconUrl: 'https://example.com/favicon.ico'
    }
  ];

  await discardAllTabs(false, true, true);

  assert.strictEqual(markerExecutions.length, 1);
  assert.strictEqual(markerExecutions[0].target.tabId, 11);
  assert.deepStrictEqual(discardedTabs, [11]);
});


test('discardAllTabs skips tabs without live documents and existing exclusions', async () => {
  markerPermissionGranted = true;
  markerExecutions.length = 0;
  discardedTabs.length = 0;
  queryTabs = [
    {id: 20, windowId: 1, url: 'https://unloaded.example', status: 'unloaded', active: false, discarded: false},
    {id: 21, windowId: 1, url: 'chrome://settings', status: 'complete', active: false, discarded: false},
    {id: 22, windowId: 1, url: 'https://active.example', status: 'complete', active: true, discarded: false},
    {id: 23, windowId: 1, url: 'https://pinned.example', status: 'complete', active: false, pinned: true, discarded: false}
  ];

  await discardAllTabs(false, false, true);

  assert.deepStrictEqual(discardedTabs, [20]);
  assert.strictEqual(markerExecutions.length, 0);
});

test('discardAllTabs continues when one discard reports an error', async () => {
  markerPermissionGranted = false;
  discardErrorMessage = 'cannot discard';
  discardedTabs.length = 0;
  queryTabs = [
    {id: 30, windowId: 1, url: 'https://first.example', active: false, discarded: false},
    {id: 31, windowId: 1, url: 'https://second.example', active: false, discarded: false}
  ];

  await discardAllTabs(false, true);

  assert.deepStrictEqual(discardedTabs, [30, 31]);
  discardErrorMessage = null;
});

test('isNewTab', async (t) => {
  await t.test('returns true for chrome://newtab/', () => {
    assert.strictEqual(isNewTab({url: 'chrome://newtab/'}), true);
  });

  await t.test('returns false for other URLs', () => {
    assert.strictEqual(isNewTab({url: 'https://google.com'}), false);
    assert.strictEqual(isNewTab({url: 'chrome://settings/'}), false);
  });

  await t.test('returns false for chrome://newtab (no trailing slash)', () => {
    assert.strictEqual(isNewTab({url: 'chrome://newtab'}), false);
  });

  await t.test('handles missing or empty URL', () => {
    assert.strictEqual(isNewTab({}), false);
    assert.strictEqual(isNewTab({url: ''}), false);
    assert.strictEqual(isNewTab({url: null}), false);
  });

});

test('isDiscarded', async (t) => {
  await t.test('returns true when tab is discarded', () => {
    assert.strictEqual(isDiscarded({discarded: true}), true);
  });

  await t.test('returns false when tab is not discarded', () => {
    assert.strictEqual(isDiscarded({discarded: false}), false);
  });

  await t.test('handles missing discarded property', () => {
    assert.strictEqual(isDiscarded({}), undefined);
  });
});
