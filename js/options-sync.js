// Saves options to chrome.storage
function save_options() {
  var autoNewTab = document.getElementById('autoNewTab').checked;
  localStorage.setItem('autoNewTab', ''+autoNewTab);
  var discardPinned = document.getElementById('discardPinned').checked;
  localStorage.setItem('discardPinned', ''+discardPinned);
  // Update status to let user know options were saved.
  var status = document.getElementById('status');
  status.textContent = 'Options saved.';
  setTimeout(function() {
    status.innerHTML = '&nbsp;';
  }, 750);
}

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
function restore_options() {
  var autoNewTab = localStorage.getItem('autoNewTab');
  if (!autoNewTab) {
    autoNewTab = 'true';
  }

  document.getElementById('autoNewTab').checked = autoNewTab == 'true';

  var discardPinned = localStorage.getItem('discardPinned');
  if (!discardPinned) {
    discardPinned = 'true';
  }

  document.getElementById('discardPinned').checked = discardPinned == 'true';
}

document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('save').addEventListener('click', save_options);
