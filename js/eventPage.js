/**
 * This file is part of The Great Discarder.

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

// discard all tabs at startup
chrome.runtime.onStartup.addListener(function () {
  discardAllTabs();
});

// discard all tabs in all windows
function discardAllTabs() {
  chrome.tabs.query({}, function (tabs) {
    for (var i = 0; i < tabs.length; ++i) {
      requestTabSuspension(tabs[i]);
    }
  });
}

// request tab suspension
function requestTabSuspension(tab) {
  if (tab === undefined) {
    return;
  }
  
  if (isDiscarded(tab) || isSpecialTab(tab)) {
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
  chrome.tabs.discard(tab.id, function (discardedTab) {
    if (chrome.runtime.lastError) {
      console.log(chrome.runtime.lastError.message);
    }
  });
}