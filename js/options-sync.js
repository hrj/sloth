// Saves options to chrome.storage
function save_options() {
  const autoNewTab = document.getElementById('autoNewTab').checked;
  const discardPinned = document.getElementById('discardPinned').checked;
  chrome.storage.local.set({
    autoNewTab: autoNewTab,
    discardPinned: discardPinned
  }, function() {
    // Update status to let user know options were saved.
    const status = document.getElementById('status');
    status.textContent = 'Options saved.';
    setTimeout(function() {
      status.textContent = '\u00A0';
    }, 750);
  });
}

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
function restore_options() {
  // Use default value = true.
  chrome.storage.local.get({
    autoNewTab: true,
    discardPinned: true
  }, function(items) {
    document.getElementById('autoNewTab').checked = items.autoNewTab;
    document.getElementById('discardPinned').checked = items.discardPinned;
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
