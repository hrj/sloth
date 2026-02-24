/**
 * Sloth, an extension for Chromium.
 * This file was a part of The Great Discarder.

 * The Great Discarder is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.

 * The Great Discarder is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.

 * You should have received a copy of the GNU General Public License
 * along with The Great Discarder.  If not, see <http://www.gnu.org/licenses/>.
**/


"use strict";

/* Async storage doesn't help with tab discard
chrome.storage.local.get({
    autoNewTab: true
  }, function(items) {
  chrome.runtime.onStartup.addListener(function () {
    discardAllTabs(items.autoNewTab);
  });
});
*/

chrome.runtime.onStartup.addListener(function () {
  chrome.storage.local.get({
    autoNewTab: true,
    discardPinned: true
  }, function(items) {
    discardAllTabs(items.autoNewTab, items.discardPinned);
  });
});

chrome.action.onClicked.addListener(function(tab) {
  // No confirmation dialog in service workers.
  chrome.storage.local.get({
    autoNewTab: true,
    discardPinned: true
  }, function(items) {
    discardAllTabs(items.autoNewTab, items.discardPinned);
  });
});

// discard all tabs in all windows
function discardAllTabs(autoNewTab, discardPinned) {
  // discard all tabs at startup
  chrome.tabs.query({}, function (tabs) {
    if (autoNewTab) {
      const windowIds = new Set();
      const windowsWithNewTabs = new Set();

      // First check for new tabs in all windows
      for (let i = 0; i < tabs.length; ++i) {
        const tab = tabs[i];
        windowIds.add(tab.windowId);
        if (isNewTab(tab)) {
          windowsWithNewTabs.add(tab.windowId);
        }
      }

      windowIds.forEach(function(wid) {
        if (!windowsWithNewTabs.has(wid)) {
          chrome.tabs.create({windowId: wid, active: true});
        }
      });
    }

    for (let i = 0; i < tabs.length; ++i) {
      requestTabSuspension(autoNewTab, discardPinned, tabs[i]);
    }

    // highlightNewTabs();
  });
}

// request tab suspension
function requestTabSuspension(autoNewTab, discardPinned, tab) {
  if (tab === undefined) {
    return;
  }

  if (isNewTab(tab)) {
    chrome.tabs.update(tab.id, {active: true});
    return;
  }

  if (isDiscarded(tab) || isSpecialTab(tab)) {
    return;
  }

  if (isActiveTab(tab) && !autoNewTab) {
    return;
  }

  if (tab.pinned && !discardPinned) {
    return;
  }

  discardTab(tab);
}

// check to see if the tab is discarded
function isDiscarded(tab) {
  return tab.discarded;
}

// check to see if the tab is special
function isSpecialTab(tab) {
  const url = tab ? tab.url : undefined;

  if (!url) {
    return false;
  }
  
  try {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol;
    if (protocol === 'chrome:' ||
        protocol === 'chrome-extension:' ||
        protocol === 'chrome-devtools:' ||
        protocol === 'file:') {
      return true;
    }

    if (urlObj.hostname === 'chrome.google.com' && urlObj.pathname.startsWith('/webstore')) {
      return true;
    }

    if (urlObj.hostname === 'chromewebstore.google.com') {
      return true;
    }
  } catch (e) {
    // If URL is invalid, fallback to basic prefix checks
    if (url.startsWith('chrome-extension:') ||
        url.startsWith('chrome:') ||
        url.startsWith('chrome-devtools:') ||
        url.startsWith('file:')) {
      return true;
    }
  }

  return false;
}

// discard tab
function discardTab(tab) {
  if (isNewTab(tab)) {
    chrome.tabs.update(tab.id, {active: true});
  } else {
    chrome.tabs.update(tab.id, {active: false}, function() {
    chrome.tabs.discard(tab.id, function (discardedTab) {
      if (chrome.runtime.lastError) {
        console.log(chrome.runtime.lastError.message);
      }
    });
    });
  }
}

function isNewTab(tab) {
  return tab.url === 'chrome://newtab/';
}

function isActiveTab(tab) {
  return tab.active;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    isSpecialTab,
    isNewTab,
    isActiveTab,
    isDiscarded,
    discardAllTabs
  };
}
