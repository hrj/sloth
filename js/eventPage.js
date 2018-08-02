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
  var autoNewTab = localStorage.getItem('autoNewTab') == 'true';
  discardAllTabs(autoNewTab);
});

chrome.browserAction.onClicked.addListener(function(tab) {
  if(confirm("Suspend all tabs?\nThis might lead to loss of data in form inputs.")) {
    var autoNewTab = localStorage.getItem('autoNewTab') == 'true';
    discardAllTabs(autoNewTab);
  }
});

// discard all tabs in all windows
function discardAllTabs(autoNewTab) {
  // discard all tabs at startup
  chrome.tabs.query({}, function (tabs) {
    if (autoNewTab) {
      var windowIds = {};

      // First check for new tabs in all windows
      for (var i = 0; i < tabs.length; ++i) {
        var tab = tabs[i];
        if (!windowIds.hasOwnProperty(tab.windowId)) {
          windowIds[tab.windowId] = [];
        }
        if(isNewTab(tab)) {
          windowIds[tab.windowId].push(tab.index);
        }
      }

      for (var wid in windowIds) {
        if (windowIds[wid].length == 0) {
          chrome.tabs.create({windowId: Number.parseInt(wid), active: true});
        }
      }
    }

    for (var i = 0; i < tabs.length; ++i) {
      requestTabSuspension(autoNewTab, tabs[i]);
    }

    // highlightNewTabs();
  });
}

// request tab suspension
function requestTabSuspension(autoNewTab, tab) {
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
  
  discardTab(tab);
}

// check to see if the tab is discarded
function isDiscarded(tab) {
  return tab.discarded;
}

// check to see if the tab is special
function isSpecialTab(tab) {
  var url = tab.url;
  
  if (url.indexOf('chrome-extension:') === 0 ||
      url.indexOf('chrome:') === 0 ||
      url.indexOf('chrome-devtools:') === 0 ||
      url.indexOf('file:') === 0 ||
      url.indexOf('chrome.google.com/webstore') >= 0) {
        return true;
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
        log(chrome.runtime.lastError.message);
      }
    });
    });
  }
}

function log() {
  chrome.extension.getBackgroundPage().console.log.apply(console, arguments);
}

function isNewTab(tab) {
  return tab.url === 'chrome://newtab/';
}

function isActiveTab(tab) {
  return tab.active;
}
