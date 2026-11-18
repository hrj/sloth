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

chrome.runtime.onStartup.addListener(async function () {
  const items = await getSettings();
  await discardAllTabs(items.autoNewTab, items.discardPinned, items.showDiscardedMarker);
});

chrome.action.onClicked.addListener(async function() {
  // No confirmation dialog in service workers.
  const items = await getSettings();
  await discardAllTabs(items.autoNewTab, items.discardPinned, items.showDiscardedMarker);
});

function getSettings() {
  return new Promise(resolve => {
    chrome.storage.local.get({
      autoNewTab: true,
      discardPinned: true,
      showDiscardedMarker: false
    }, resolve);
  });
}

const MARKER_SETTLE_DELAY_MS = 1000;
const MARKER_ATTEMPT_TIMEOUT_MS = 1000;

// discard all tabs in all windows
async function discardAllTabs(autoNewTab, discardPinned, showDiscardedMarker = false) {
  const tabs = await queryTabs();
  const markerEnabled = showDiscardedMarker && await hasMarkerPermission();

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

  tabs.filter(isNewTab).forEach(tab => chrome.tabs.update(tab.id, {active: true}));

  const candidates = tabs.filter(tab => isDiscardCandidate(autoNewTab, discardPinned, tab));

  if (markerEnabled) {
    const markerStartedAt = Date.now();
    await Promise.all(candidates.map(tab => {
      const cancellation = {cancelled: false};
      const attempt = markTabForDiscard(tab, cancellation);
      return withTimeout(attempt, MARKER_ATTEMPT_TIMEOUT_MS, () => {
        cancellation.cancelled = true;
      });
    }));
    const elapsed = Date.now() - markerStartedAt;
    const remaining = MARKER_SETTLE_DELAY_MS - elapsed;
    if (remaining > 0) {
      await delay(remaining);
    }
  }

  await Promise.all(candidates.map(tab => discardTab(tab)));
}

function queryTabs() {
  return new Promise(resolve => chrome.tabs.query({}, resolve));
}

function hasMarkerPermission() {
  return new Promise(resolve => {
    if (!chrome.permissions || !chrome.permissions.contains) {
      resolve(false);
      return;
    }

    chrome.permissions.contains({
      permissions: ['scripting'],
      origins: ['*://*/*']
    }, resolve);
  });
}

function delay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function withTimeout(promise, milliseconds, onTimeout) {
  return Promise.race([
    promise,
    delay(milliseconds).then(() => {
      if (onTimeout) {
        onTimeout();
      }
      return false;
    })
  ]);
}

function isDiscardCandidate(autoNewTab, discardPinned, tab) {
  if (tab === undefined || isNewTab(tab)) {
    return false;
  }

  if (isDiscarded(tab) || isSpecialTab(tab)) {
    return false;
  }

  if (isActiveTab(tab) && !autoNewTab) {
    return false;
  }

  if (tab.pinned && !discardPinned) {
    return false;
  }

  return true;
}

async function markTabForDiscard(tab, cancellation = {cancelled: false}) {
  if (!tab || tab.status !== 'complete' || !tab.url || !chrome.scripting) {
    return false;
  }

  let markerDataUrl;
  try {
    markerDataUrl = await createDiscardMarkerDataUrl(tab.favIconUrl);
  } catch (error) {
    markerDataUrl = undefined;
  }

  if (cancellation.cancelled) {
    return false;
  }

  const marked = await executeMarkerScript(tab.id, markerDataUrl);
  if (marked || cancellation.cancelled) {
    return marked;
  }

  return withTimeout(executeTitleFallbackScript(tab.id), MARKER_ATTEMPT_TIMEOUT_MS);
}

async function createDiscardMarkerDataUrl(faviconUrl) {
  if (!faviconUrl || typeof fetch !== 'function' ||
      typeof createImageBitmap !== 'function' || typeof OffscreenCanvas !== 'function') {
    return undefined;
  }

  const controller = typeof AbortController === 'function' ? new AbortController() : undefined;
  const timeout = controller ? setTimeout(() => controller.abort(), MARKER_ATTEMPT_TIMEOUT_MS) : undefined;
  let response;
  try {
    response = await fetch(faviconUrl, controller ? {signal: controller.signal} : undefined);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
  if (!response.ok) {
    throw new Error(`Unable to fetch favicon: ${response.status}`);
  }

  const source = await createImageBitmap(await response.blob());
  const size = 32;
  const canvas = new OffscreenCanvas(size, size);
  const context = canvas.getContext('2d');
  context.save();
  context.beginPath();
  context.arc(size / 2, size / 2, size * 0.35, 0, Math.PI * 2);
  context.clip();
  context.drawImage(source, size * 0.15, size * 0.15, size * 0.7, size * 0.7);
  context.restore();

  context.strokeStyle = '#5f6368';
  context.lineWidth = 3;
  context.lineCap = 'round';
  const degrees = Math.PI / 180;
  const radius = size / 2 - 2;
  context.beginPath();
  context.arc(size / 2, size / 2, radius, 100 * degrees, 260 * degrees);
  context.stroke();
  for (let index = 0; index < 4; ++index) {
    const start = (280 + index * 45) * degrees;
    context.beginPath();
    context.arc(size / 2, size / 2, radius, start, start + 25 * degrees);
    context.stroke();
  }

  source.close();
  return blobToDataUrl(await canvas.convertToBlob({type: 'image/png'}));
}

async function blobToDataUrl(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(binary)}`;
}

function executeMarkerScript(tabId, faviconDataUrl) {
  return new Promise(resolve => {
    chrome.scripting.executeScript({
      target: {tabId},
      func: applyDiscardMarker,
      args: [faviconDataUrl || null]
    }, () => resolve(!chrome.runtime.lastError));
  });
}

function executeTitleFallbackScript(tabId) {
  return new Promise(resolve => {
    chrome.scripting.executeScript({
      target: {tabId},
      func: () => {
        const prefix = '\ud83d\udca4 ';
        if (!document.title.startsWith(prefix)) {
          document.title = `${prefix}${document.title || location.href}`;
        }
      }
    }, () => resolve(!chrome.runtime.lastError));
  });
}

function applyDiscardMarker(markerDataUrl) {
  const prefix = '\ud83d\udca4 ';
  if (!markerDataUrl || document.readyState !== 'complete') {
    if (!document.title.startsWith(prefix)) {
      document.title = `${prefix}${document.title || location.href}`;
    }
    return;
  }

  const iconLinks = document.querySelectorAll('link[rel~="icon"], link[rel*="icon"]');
  iconLinks.forEach(link => link.remove());
  const iconLink = document.createElement('link');
  iconLink.rel = 'icon';
  iconLink.type = 'image/png';
  iconLink.href = markerDataUrl;
  document.head.appendChild(iconLink);
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
    return Promise.resolve(false);
  }

  return new Promise(resolve => {
    chrome.tabs.update(tab.id, {active: false}, function() {
      chrome.tabs.discard(tab.id, function (discardedTab) {
        if (chrome.runtime.lastError) {
          console.log(chrome.runtime.lastError.message);
          resolve(false);
          return;
        }
        resolve(Boolean(discardedTab));
      });
    });
  });
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
