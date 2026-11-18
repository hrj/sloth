const markerPermissions = {
  permissions: ['scripting'],
  origins: ['*://*/*']
};

function setStatus(message) {
  const status = document.getElementById('status');
  status.textContent = message;
  setTimeout(function() {
    status.textContent = '\u00A0';
  }, 750);
}

function requestMarkerPermission() {
  return new Promise(resolve => {
    if (!chrome.permissions || !chrome.permissions.request) {
      resolve(false);
      return;
    }

    chrome.permissions.request(markerPermissions, granted => resolve(granted));
  });
}

function removeMarkerPermission() {
  return new Promise(resolve => {
    if (!chrome.permissions || !chrome.permissions.remove) {
      resolve(false);
      return;
    }

    chrome.permissions.remove(markerPermissions, removed => resolve(removed));
  });
}

// Saves options to chrome.storage
function save_options() {
  const autoNewTab = document.getElementById('autoNewTab').checked;
  const discardPinned = document.getElementById('discardPinned').checked;
  const markerCheckbox = document.getElementById('showDiscardedMarker');
  const markerEnabled = markerCheckbox.checked;

  const permissionPromise = markerEnabled
    ? requestMarkerPermission()
    : removeMarkerPermission().then(() => false);

  permissionPromise.then(granted => {
    markerCheckbox.checked = markerEnabled && granted;
    chrome.storage.local.set({
      autoNewTab: autoNewTab,
      discardPinned: discardPinned,
      showDiscardedMarker: markerCheckbox.checked
    }, function() {
      setStatus(markerCheckbox.checked ? 'Options saved.' : 'Options saved; marker access is off.');
    });
  });
}

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
function restore_options() {
  // Use default value = true.
  chrome.storage.local.get({
    autoNewTab: true,
    discardPinned: true,
    showDiscardedMarker: false
  }, function(items) {
    document.getElementById('autoNewTab').checked = items.autoNewTab;
    document.getElementById('discardPinned').checked = items.discardPinned;

    if (!items.showDiscardedMarker || !chrome.permissions || !chrome.permissions.contains) {
      document.getElementById('showDiscardedMarker').checked = false;
      return;
    }

    chrome.permissions.contains(markerPermissions, granted => {
      document.getElementById('showDiscardedMarker').checked = granted;
    });
  });
}

document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('save').addEventListener('click', save_options);

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    save_options,
    restore_options
  };
}
