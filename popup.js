// Storage keys
const DATA_KEY = "tataycs_notches_data";
const DARK_KEY = "tataycs_notches_dark";

// DOM references
const notepad = document.getElementById("notepad");
const clearBtn = document.getElementById("clear-btn");
const exportBtn = document.getElementById("export-btn");
const charCount = document.getElementById("char-count");
const wordCount = document.getElementById("word-count");
const lastSaved = document.getElementById("last-saved");
const tabsContainer = document.getElementById("tabs-container");
const addTabBtn = document.getElementById("add-tab-btn");
const darkModeBtn = document.getElementById("dark-mode-btn");
const searchBar = document.getElementById("search-bar");
const searchInput = document.getElementById("search-input");
const searchCount = document.getElementById("search-count");
const searchPrev = document.getElementById("search-prev");
const searchNext = document.getElementById("search-next");
const searchClose = document.getElementById("search-close");

// App state
let state = loadState();
let searchMatches = [];
let currentMatchIndex = -1;

// ===== State Management =====

function loadState() {
  const raw = localStorage.getItem(DATA_KEY);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch (e) {
      // corrupted data, start fresh
    }
  }
  return {
    activeTab: 0,
    tabs: [{ name: "Note 1", content: "", lastSaved: null }]
  };
}

function saveState() {
  state.tabs[state.activeTab].lastSaved = Date.now();
  localStorage.setItem(DATA_KEY, JSON.stringify(state));
  updateLastSaved();
}

// ===== Dark Mode =====

function initDarkMode() {
  var dark = localStorage.getItem(DARK_KEY) === "true";
  if (dark) document.body.classList.add("dark");
}

function toggleDarkMode() {
  document.body.classList.toggle("dark");
  var isDark = document.body.classList.contains("dark");
  localStorage.setItem(DARK_KEY, isDark ? "true" : "false");
  darkModeBtn.textContent = isDark ? "\u2600\uFE0F" : "\uD83C\uDF19";
}

// ===== Stats =====

function updateStats() {
  var text = notepad.value;
  // Character count
  charCount.textContent = text.length + " chars";
  // Word count
  var words = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
  wordCount.textContent = words + (words === 1 ? " word" : " words");
}

function updateLastSaved() {
  var tab = state.tabs[state.activeTab];
  if (tab.lastSaved) {
    var d = new Date(tab.lastSaved);
    var h = d.getHours();
    var m = d.getMinutes().toString().padStart(2, "0");
    var ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    lastSaved.textContent = "Saved at " + h + ":" + m + " " + ampm;
  } else {
    lastSaved.textContent = "";
  }
}

// ===== Tab Rendering =====

function renderTabs() {
  tabsContainer.innerHTML = "";

  state.tabs.forEach(function (tab, index) {
    var tabEl = document.createElement("div");
    tabEl.className = "tab" + (index === state.activeTab ? " active" : "");

    var nameSpan = document.createElement("span");
    nameSpan.className = "tab-name";
    nameSpan.textContent = tab.name;
    tabEl.appendChild(nameSpan);

    if (state.tabs.length > 1) {
      var closeSpan = document.createElement("span");
      closeSpan.className = "tab-close";
      closeSpan.textContent = "\u00d7";
      closeSpan.title = "Close tab";
      closeSpan.addEventListener("click", function (e) {
        e.stopPropagation();
        deleteTab(index);
      });
      tabEl.appendChild(closeSpan);
    }

    tabEl.addEventListener("click", function () {
      switchTab(index);
    });

    tabEl.addEventListener("dblclick", function (e) {
      e.stopPropagation();
      startRenameTab(index, nameSpan);
    });

    tabsContainer.appendChild(tabEl);
  });
}

// ===== Tab Actions =====

function switchTab(index) {
  state.tabs[state.activeTab].content = notepad.value;
  state.activeTab = index;
  notepad.value = state.tabs[index].content;
  saveState();
  renderTabs();
  updateStats();
  updateLastSaved();
  notepad.focus();
}

function addTab() {
  state.tabs[state.activeTab].content = notepad.value;
  var num = state.tabs.length + 1;
  state.tabs.push({ name: "Note " + num, content: "", lastSaved: null });
  state.activeTab = state.tabs.length - 1;
  notepad.value = "";
  saveState();
  renderTabs();
  updateStats();
  notepad.focus();
}

function deleteTab(index) {
  if (state.tabs.length <= 1) return;
  state.tabs.splice(index, 1);

  if (state.activeTab >= state.tabs.length) {
    state.activeTab = state.tabs.length - 1;
  } else if (state.activeTab > index) {
    state.activeTab--;
  } else if (state.activeTab === index) {
    state.activeTab = Math.min(index, state.tabs.length - 1);
  }

  notepad.value = state.tabs[state.activeTab].content;
  saveState();
  renderTabs();
  updateStats();
  updateLastSaved();
}

function startRenameTab(index, nameSpan) {
  nameSpan.classList.add("editing");
  nameSpan.contentEditable = "true";
  nameSpan.focus();

  var range = document.createRange();
  range.selectNodeContents(nameSpan);
  var sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  function finishRename() {
    nameSpan.contentEditable = "false";
    nameSpan.classList.remove("editing");
    var newName = nameSpan.textContent.trim();
    if (newName.length > 0 && newName.length <= 20) {
      state.tabs[index].name = newName;
    } else {
      nameSpan.textContent = state.tabs[index].name;
    }
    saveState();
    renderTabs();
  }

  nameSpan.addEventListener("blur", finishRename, { once: true });
  nameSpan.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      nameSpan.blur();
    } else if (e.key === "Escape") {
      nameSpan.textContent = state.tabs[index].name;
      nameSpan.blur();
    }
  });
}

// ===== Clear Notes (current tab) =====

function clearNote() {
  state.tabs[state.activeTab].content = "";
  notepad.value = "";
  saveState();
  updateStats();
  notepad.focus();
}

// ===== Export Note as .txt =====

function exportNote() {
  var tab = state.tabs[state.activeTab];
  var blob = new Blob([tab.content], { type: "text/plain" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  // Sanitize filename
  var safeName = tab.name.replace(/[^a-zA-Z0-9_\- ]/g, "").trim() || "note";
  a.download = safeName + ".txt";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ===== Search / Find =====

function toggleSearch() {
  var isHidden = searchBar.classList.contains("hidden");
  if (isHidden) {
    searchBar.classList.remove("hidden");
    searchInput.focus();
    searchInput.select();
  } else {
    closeSearch();
  }
}

function closeSearch() {
  searchBar.classList.add("hidden");
  searchInput.value = "";
  searchCount.textContent = "";
  searchMatches = [];
  currentMatchIndex = -1;
  notepad.focus();
}

function performSearch() {
  var query = searchInput.value;
  searchMatches = [];
  currentMatchIndex = -1;

  if (!query) {
    searchCount.textContent = "";
    return;
  }

  var text = notepad.value.toLowerCase();
  var q = query.toLowerCase();
  var start = 0;
  while (true) {
    var idx = text.indexOf(q, start);
    if (idx === -1) break;
    searchMatches.push(idx);
    start = idx + 1;
  }

  if (searchMatches.length > 0) {
    currentMatchIndex = 0;
    highlightMatch();
    searchCount.textContent = "1 / " + searchMatches.length;
  } else {
    searchCount.textContent = "No results";
  }
}

function highlightMatch() {
  if (searchMatches.length === 0 || currentMatchIndex < 0) return;
  var pos = searchMatches[currentMatchIndex];
  var len = searchInput.value.length;
  notepad.focus();
  notepad.setSelectionRange(pos, pos + len);
  searchCount.textContent = (currentMatchIndex + 1) + " / " + searchMatches.length;
}

function searchNextMatch() {
  if (searchMatches.length === 0) return;
  currentMatchIndex = (currentMatchIndex + 1) % searchMatches.length;
  highlightMatch();
}

function searchPrevMatch() {
  if (searchMatches.length === 0) return;
  currentMatchIndex = (currentMatchIndex - 1 + searchMatches.length) % searchMatches.length;
  highlightMatch();
}

// ===== Auto-save on typing =====

notepad.addEventListener("input", function () {
  state.tabs[state.activeTab].content = notepad.value;
  saveState();
  updateStats();
});

// ===== Event Listeners =====

clearBtn.addEventListener("click", clearNote);
exportBtn.addEventListener("click", exportNote);
addTabBtn.addEventListener("click", addTab);
darkModeBtn.addEventListener("click", toggleDarkMode);
searchInput.addEventListener("input", performSearch);
searchNext.addEventListener("click", searchNextMatch);
searchPrev.addEventListener("click", searchPrevMatch);
searchClose.addEventListener("click", closeSearch);

// Keyboard shortcuts
document.addEventListener("keydown", function (e) {
  // Ctrl+N — new tab
  if (e.ctrlKey && e.key === "n") {
    e.preventDefault();
    addTab();
  }
  // Ctrl+F — toggle search
  if (e.ctrlKey && e.key === "f") {
    e.preventDefault();
    toggleSearch();
  }
  // Escape — close search
  if (e.key === "Escape" && !searchBar.classList.contains("hidden")) {
    closeSearch();
  }
  // Enter in search — next match
  if (e.key === "Enter" && document.activeElement === searchInput) {
    e.preventDefault();
    if (e.shiftKey) {
      searchPrevMatch();
    } else {
      searchNextMatch();
    }
  }
});

// ===== Initialize =====

initDarkMode();
if (document.body.classList.contains("dark")) {
  darkModeBtn.textContent = "\u2600\uFE0F";
}
notepad.value = state.tabs[state.activeTab].content;
renderTabs();
updateStats();
updateLastSaved();
