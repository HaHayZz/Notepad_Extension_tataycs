// ===== Constants =====
var DATA_KEY = "tataycs_notches_data";
var SETTINGS_KEY = "tataycs_notches_settings";
var CHAR_LIMIT = 50000;
var CHAR_WARN = 45000;
var DEBOUNCE_MS = 300;
var MAX_TABS = 20;

// ===== Templates =====
var TEMPLATES = {
  blank: { name: "New Note", content: "" },
  todo: { name: "Todo List", content: "# Todo List\n\n- [ ] Task 1\n- [ ] Task 2\n- [ ] Task 3\n" },
  meeting: { name: "Meeting Notes", content: "# Meeting Notes\n\nDate: \nAttendees: \n\n## Agenda\n- \n\n## Notes\n- \n\n## Action Items\n- [ ] \n" },
  idea: { name: "Quick Idea", content: "# Idea\n\n## What?\n\n\n## Why?\n\n\n## How?\n\n" }
};

// ===== DOM References =====
var notepad = document.getElementById("notepad");
var clearBtn = document.getElementById("clear-btn");
var exportBtn = document.getElementById("export-btn");
var exportAllBtn = document.getElementById("export-all-btn");
var importBtn = document.getElementById("import-btn");
var fileInput = document.getElementById("file-input");
var charCount = document.getElementById("char-count");
var wordCount = document.getElementById("word-count");
var lastSavedEl = document.getElementById("last-saved");
var createdAtEl = document.getElementById("created-at");
var tabsContainer = document.getElementById("tabs-container");
var addTabBtn = document.getElementById("add-tab-btn");
var darkModeBtn = document.getElementById("dark-mode-btn");
var searchBar = document.getElementById("search-bar");
var searchInput = document.getElementById("search-input");
var searchCountEl = document.getElementById("search-count");
var searchPrevBtn = document.getElementById("search-prev");
var searchNextBtn = document.getElementById("search-next");
var searchCloseBtn = document.getElementById("search-close");
var mdPreviewBtn = document.getElementById("md-preview-btn");
var mdPreview = document.getElementById("md-preview");
var monoBtn = document.getElementById("mono-btn");
var limitWarning = document.getElementById("limit-warning");
var toastEl = document.getElementById("toast");
var templateBtn = document.getElementById("template-btn");
var templateModal = document.getElementById("template-modal");
var deleteModal = document.getElementById("delete-modal");
var modalCancel = document.getElementById("modal-cancel");
var modalConfirm = document.getElementById("modal-confirm");
var contextMenu = document.getElementById("tab-context-menu");

// ===== State =====
var state = null;
var settings = null;
var saveTimer = null;
var toastTimer = null;
var deleteTargetIndex = null;
var contextTabIndex = null;
var searchMatches = [];
var currentMatchIndex = -1;
var dragFromIndex = null;
var previewMode = false;

// ===== Storage (chrome.storage.local) =====

function loadState() {
  return new Promise(function (resolve) {
    chrome.storage.local.get(DATA_KEY, function (result) {
      if (result[DATA_KEY]) {
        resolve(result[DATA_KEY]);
      } else {
        resolve({ activeTab: 0, tabs: [createTab("Note 1", "")] });
      }
    });
  });
}

function loadSettings() {
  return new Promise(function (resolve) {
    chrome.storage.local.get(SETTINGS_KEY, function (result) {
      if (result[SETTINGS_KEY]) {
        resolve(result[SETTINGS_KEY]);
      } else {
        resolve({ darkMode: false, monospace: false });
      }
    });
  });
}

function saveStateToDisk() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(function () {
    state.tabs[state.activeTab].lastSaved = Date.now();
    var obj = {};
    obj[DATA_KEY] = state;
    chrome.storage.local.set(obj, function () {
      if (chrome.runtime.lastError) {
        showToast("Storage full! Consider deleting some tabs.", "error");
      }
    });
    updateTimestamps();
  }, DEBOUNCE_MS);
}

function saveSettingsToDisk() {
  var obj = {};
  obj[SETTINGS_KEY] = settings;
  chrome.storage.local.set(obj);
}

// ===== Tab Factory =====

function createTab(name, content) {
  return {
    name: name,
    content: content,
    pinned: false,
    color: "",
    createdAt: Date.now(),
    lastSaved: null
  };
}

// ===== Toast =====

function showToast(message, type) {
  clearTimeout(toastTimer);
  toastEl.textContent = message;
  toastEl.className = "toast " + (type || "info");
  toastTimer = setTimeout(function () {
    toastEl.classList.add("hidden");
  }, 2200);
}

// ===== Dark Mode =====

function applyDarkMode() {
  if (settings.darkMode) {
    document.body.classList.add("dark");
    darkModeBtn.textContent = "\u2600\uFE0F";
  } else {
    document.body.classList.remove("dark");
    darkModeBtn.textContent = "\uD83C\uDF19";
  }
}

function toggleDarkMode() {
  settings.darkMode = !settings.darkMode;
  applyDarkMode();
  saveSettingsToDisk();
}

// ===== Monospace =====

function applyMonospace() {
  if (settings.monospace) {
    notepad.classList.add("monospace");
    monoBtn.classList.add("active");
  } else {
    notepad.classList.remove("monospace");
    monoBtn.classList.remove("active");
  }
}

function toggleMonospace() {
  settings.monospace = !settings.monospace;
  applyMonospace();
  saveSettingsToDisk();
}

// ===== Stats =====

function updateStats() {
  var text = notepad.value;
  var len = text.length;
  charCount.textContent = len + " chars";
  var words = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
  wordCount.textContent = words + (words === 1 ? " word" : " words");

  // Limit warnings
  if (len >= CHAR_LIMIT) {
    limitWarning.textContent = "\u26D4 Limit reached";
    limitWarning.className = "limit-warning danger";
  } else if (len >= CHAR_WARN) {
    limitWarning.textContent = "\u26A0 " + len + "/" + CHAR_LIMIT;
    limitWarning.className = "limit-warning warn";
  } else {
    limitWarning.className = "limit-warning hidden";
  }
}

function updateTimestamps() {
  var tab = state.tabs[state.activeTab];
  if (tab.createdAt) {
    createdAtEl.textContent = "Created " + formatDate(tab.createdAt);
  } else {
    createdAtEl.textContent = "";
  }
  if (tab.lastSaved) {
    lastSavedEl.textContent = " \u00B7 Saved " + formatTime(tab.lastSaved);
  } else {
    lastSavedEl.textContent = "";
  }
}

function formatDate(ts) {
  var d = new Date(ts);
  var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return months[d.getMonth()] + " " + d.getDate();
}

function formatTime(ts) {
  var d = new Date(ts);
  var h = d.getHours();
  var m = d.getMinutes().toString().padStart(2, "0");
  var ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return h + ":" + m + " " + ampm;
}

// ===== Tab Rendering =====

function renderTabs() {
  tabsContainer.innerHTML = "";

  state.tabs.forEach(function (tab, index) {
    var tabEl = document.createElement("div");
    tabEl.className = "tab" + (index === state.activeTab ? " active" : "");
    tabEl.draggable = true;

    // Color dot
    if (tab.color) {
      var dot = document.createElement("span");
      dot.className = "tab-color-dot";
      dot.style.backgroundColor = tab.color;
      tabEl.appendChild(dot);
    }

    // Pin icon
    if (tab.pinned) {
      var pinIcon = document.createElement("span");
      pinIcon.className = "tab-pin";
      pinIcon.textContent = "\uD83D\uDCCC";
      tabEl.appendChild(pinIcon);
    }

    // Tab name
    var nameSpan = document.createElement("span");
    nameSpan.className = "tab-name";
    nameSpan.textContent = tab.name;
    tabEl.appendChild(nameSpan);

    // Close button (not on pinned, not if only 1 tab)
    if (state.tabs.length > 1 && !tab.pinned) {
      var closeSpan = document.createElement("span");
      closeSpan.className = "tab-close";
      closeSpan.textContent = "\u00d7";
      closeSpan.title = "Close tab";
      closeSpan.addEventListener("click", function (e) {
        e.stopPropagation();
        requestDeleteTab(index);
      });
      tabEl.appendChild(closeSpan);
    }

    // Click to switch
    tabEl.addEventListener("click", function () {
      switchTab(index);
    });

    // Double-click to rename
    tabEl.addEventListener("dblclick", function (e) {
      e.stopPropagation();
      startRenameTab(index, nameSpan);
    });

    // Right-click context menu
    tabEl.addEventListener("contextmenu", function (e) {
      e.preventDefault();
      e.stopPropagation();
      contextTabIndex = index;
      showContextMenu(e.clientX, e.clientY);
    });

    // Drag and drop
    tabEl.addEventListener("dragstart", function (e) {
      dragFromIndex = index;
      tabEl.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });
    tabEl.addEventListener("dragend", function () {
      tabEl.classList.remove("dragging");
      dragFromIndex = null;
    });
    tabEl.addEventListener("dragover", function (e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    });
    tabEl.addEventListener("dragenter", function (e) {
      e.preventDefault();
      if (dragFromIndex !== null && dragFromIndex !== index) {
        tabEl.classList.add("drag-over");
      }
    });
    tabEl.addEventListener("dragleave", function () {
      tabEl.classList.remove("drag-over");
    });
    tabEl.addEventListener("drop", function (e) {
      e.preventDefault();
      tabEl.classList.remove("drag-over");
      if (dragFromIndex === null || dragFromIndex === index) return;
      // Prevent crossing pin boundary
      if (state.tabs[dragFromIndex].pinned !== state.tabs[index].pinned) return;
      reorderTab(dragFromIndex, index);
    });

    tabsContainer.appendChild(tabEl);
  });
}

// ===== Tab Actions =====

function switchTab(index) {
  if (previewMode) togglePreview();
  state.tabs[state.activeTab].content = notepad.value;
  state.activeTab = index;
  notepad.value = state.tabs[index].content;
  saveStateToDisk();
  renderTabs();
  updateStats();
  updateTimestamps();
  notepad.focus();
}

function addTab() {
  if (state.tabs.length >= MAX_TABS) {
    showToast("Maximum " + MAX_TABS + " tabs reached", "error");
    return;
  }
  state.tabs[state.activeTab].content = notepad.value;
  var num = state.tabs.length + 1;
  state.tabs.push(createTab("Note " + num, ""));
  state.activeTab = state.tabs.length - 1;
  notepad.value = "";
  saveStateToDisk();
  renderTabs();
  updateStats();
  updateTimestamps();
  notepad.focus();
}

function addTabFromTemplate(key) {
  if (state.tabs.length >= MAX_TABS) {
    showToast("Maximum " + MAX_TABS + " tabs reached", "error");
    return;
  }
  var tmpl = TEMPLATES[key];
  if (!tmpl) return;
  state.tabs[state.activeTab].content = notepad.value;
  state.tabs.push(createTab(tmpl.name, tmpl.content));
  state.activeTab = state.tabs.length - 1;
  notepad.value = tmpl.content;
  saveStateToDisk();
  renderTabs();
  updateStats();
  updateTimestamps();
  notepad.focus();
  showToast("Created from template", "success");
}

function requestDeleteTab(index) {
  var tab = state.tabs[index];
  if (tab.pinned) return;
  if (state.tabs.length <= 1) return;
  if (tab.content.trim().length > 0) {
    deleteTargetIndex = index;
    deleteModal.classList.remove("hidden");
  } else {
    deleteTab(index);
  }
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
  saveStateToDisk();
  renderTabs();
  updateStats();
  updateTimestamps();
}

function duplicateTab(index) {
  if (state.tabs.length >= MAX_TABS) {
    showToast("Maximum " + MAX_TABS + " tabs reached", "error");
    return;
  }
  var src = state.tabs[index];
  var dup = createTab(src.name + " (copy)", src.content);
  dup.color = src.color;
  state.tabs.splice(index + 1, 0, dup);
  state.activeTab = index + 1;
  notepad.value = dup.content;
  saveStateToDisk();
  renderTabs();
  updateStats();
  updateTimestamps();
  showToast("Tab duplicated", "success");
}

function pinTab(index) {
  var tab = state.tabs[index];
  if (tab.pinned) {
    // Unpin
    tab.pinned = false;
    var removed = state.tabs.splice(index, 1)[0];
    var insertAt = 0;
    for (var i = 0; i < state.tabs.length; i++) {
      if (state.tabs[i].pinned) insertAt = i + 1;
    }
    state.tabs.splice(insertAt, 0, removed);
    state.activeTab = insertAt;
    showToast("Tab unpinned", "info");
  } else {
    // Pin
    tab.pinned = true;
    var removed2 = state.tabs.splice(index, 1)[0];
    var insertAt2 = 0;
    for (var j = 0; j < state.tabs.length; j++) {
      if (state.tabs[j].pinned) insertAt2 = j + 1;
    }
    state.tabs.splice(insertAt2, 0, removed2);
    state.activeTab = insertAt2;
    showToast("Tab pinned", "info");
  }
  notepad.value = state.tabs[state.activeTab].content;
  saveStateToDisk();
  renderTabs();
  updateStats();
}

function setTabColor(index, color) {
  state.tabs[index].color = color;
  saveStateToDisk();
  renderTabs();
}

function reorderTab(fromIndex, toIndex) {
  var moved = state.tabs.splice(fromIndex, 1)[0];
  state.tabs.splice(toIndex, 0, moved);
  if (state.activeTab === fromIndex) {
    state.activeTab = toIndex;
  } else if (fromIndex < state.activeTab && toIndex >= state.activeTab) {
    state.activeTab--;
  } else if (fromIndex > state.activeTab && toIndex <= state.activeTab) {
    state.activeTab++;
  }
  saveStateToDisk();
  renderTabs();
}

function startRenameTab(index, nameSpan) {
  nameSpan.classList.add("editing");
  nameSpan.contentEditable = "true";
  nameSpan.style.pointerEvents = "auto";
  nameSpan.focus();
  var range = document.createRange();
  range.selectNodeContents(nameSpan);
  var sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  function finishRename() {
    nameSpan.contentEditable = "false";
    nameSpan.classList.remove("editing");
    nameSpan.style.pointerEvents = "";
    var newName = nameSpan.textContent.trim();
    if (newName.length > 0 && newName.length <= 20) {
      state.tabs[index].name = newName;
    } else if (newName.length === 0) {
      nameSpan.textContent = state.tabs[index].name;
      showToast("Tab name cannot be empty", "error");
    } else {
      nameSpan.textContent = state.tabs[index].name;
      showToast("Max 20 characters", "error");
    }
    saveStateToDisk();
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

// ===== Context Menu =====

function showContextMenu(x, y) {
  var tab = state.tabs[contextTabIndex];
  // Update pin label
  var pinItem = contextMenu.querySelector('[data-action="pin"]');
  pinItem.innerHTML = '<span class="ctx-icon">\uD83D\uDCCC</span> ' + (tab.pinned ? "Unpin Tab" : "Pin Tab");
  // Hide delete for pinned
  var delItem = contextMenu.querySelector('[data-action="delete"]');
  delItem.style.display = tab.pinned ? "none" : "flex";

  contextMenu.classList.remove("hidden");
  // Position within viewport
  var menuW = 170;
  var menuH = 180;
  if (x + menuW > document.body.clientWidth) x = document.body.clientWidth - menuW - 4;
  if (y + menuH > document.body.clientHeight) y = document.body.clientHeight - menuH - 4;
  contextMenu.style.left = x + "px";
  contextMenu.style.top = y + "px";
}

function hideContextMenu() {
  contextMenu.classList.add("hidden");
  contextTabIndex = null;
}

// ===== Markdown Preview =====

function togglePreview() {
  previewMode = !previewMode;
  if (previewMode) {
    state.tabs[state.activeTab].content = notepad.value;
    mdPreview.innerHTML = renderMarkdown(notepad.value);
    notepad.style.display = "none";
    mdPreview.classList.remove("hidden");
    mdPreviewBtn.classList.add("active");
  } else {
    notepad.style.display = "";
    mdPreview.classList.add("hidden");
    mdPreviewBtn.classList.remove("active");
    notepad.focus();
  }
}

function renderMarkdown(text) {
  // Escape HTML first for safety
  var html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  var lines = html.split("\n");
  var result = [];
  var inList = false;

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (line.match(/^### /)) {
      if (inList) { result.push("</ul>"); inList = false; }
      result.push("<h3>" + line.slice(4) + "</h3>");
    } else if (line.match(/^## /)) {
      if (inList) { result.push("</ul>"); inList = false; }
      result.push("<h2>" + line.slice(3) + "</h2>");
    } else if (line.match(/^# /)) {
      if (inList) { result.push("</ul>"); inList = false; }
      result.push("<h1>" + line.slice(2) + "</h1>");
    } else if (line.match(/^- \[x\] /i)) {
      if (!inList) { result.push("<ul>"); inList = true; }
      result.push('<li class="checked">\u2611 ' + line.slice(6) + "</li>");
    } else if (line.match(/^- \[ \] /)) {
      if (!inList) { result.push("<ul>"); inList = true; }
      result.push("<li>\u2610 " + line.slice(6) + "</li>");
    } else if (line.match(/^- /)) {
      if (!inList) { result.push("<ul>"); inList = true; }
      result.push("<li>" + line.slice(2) + "</li>");
    } else if (line.trim() === "") {
      if (inList) { result.push("</ul>"); inList = false; }
      result.push("<br>");
    } else {
      if (inList) { result.push("</ul>"); inList = false; }
      result.push("<p>" + line + "</p>");
    }
  }
  if (inList) result.push("</ul>");

  html = result.join("\n");
  // Inline formatting (applied after HTML escaping, so safe)
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/`(.+?)`/g, "<code>$1</code>");

  return html;
}

// ===== Clear Notes =====

function clearNote() {
  state.tabs[state.activeTab].content = "";
  notepad.value = "";
  if (previewMode) togglePreview();
  saveStateToDisk();
  updateStats();
  notepad.focus();
}

// ===== Export =====

function exportNote() {
  var tab = state.tabs[state.activeTab];
  downloadFile(sanitizeFilename(tab.name) + ".txt", tab.content);
  showToast("Note exported", "success");
}

function exportAllNotes() {
  var combined = "";
  state.tabs.forEach(function (tab, i) {
    combined += "=== " + tab.name + " ===\n\n";
    combined += tab.content;
    if (i < state.tabs.length - 1) combined += "\n\n---\n\n";
  });
  downloadFile("tataycs_notches_all.txt", combined);
  showToast("All notes exported", "success");
}

function downloadFile(filename, content) {
  var blob = new Blob([content], { type: "text/plain" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9_\- ]/g, "").trim() || "note";
}

// ===== Import =====

function importTxtFile() {
  fileInput.click();
}

function handleFileImport(e) {
  var file = e.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function (evt) {
    var content = evt.target.result;
    var name = file.name.replace(/\.txt$/i, "").slice(0, 20) || "Imported";
    state.tabs[state.activeTab].content = notepad.value;
    state.tabs.push(createTab(name, content));
    state.activeTab = state.tabs.length - 1;
    notepad.value = content;
    saveStateToDisk();
    renderTabs();
    updateStats();
    updateTimestamps();
    showToast("Imported: " + name, "success");
  };
  reader.readAsText(file);
  fileInput.value = "";
}

// ===== Search =====

function toggleSearch() {
  if (searchBar.classList.contains("hidden")) {
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
  searchCountEl.textContent = "";
  searchMatches = [];
  currentMatchIndex = -1;
  notepad.focus();
}

function performSearch() {
  var query = searchInput.value;
  searchMatches = [];
  currentMatchIndex = -1;
  if (!query) { searchCountEl.textContent = ""; return; }
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
  } else {
    searchCountEl.textContent = "No results";
  }
}

function highlightMatch() {
  if (searchMatches.length === 0 || currentMatchIndex < 0) return;
  var pos = searchMatches[currentMatchIndex];
  var len = searchInput.value.length;
  notepad.focus();
  notepad.setSelectionRange(pos, pos + len);
  searchCountEl.textContent = (currentMatchIndex + 1) + " / " + searchMatches.length;
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
  saveStateToDisk();
  updateStats();
});

// ===== Event Listeners =====

clearBtn.addEventListener("click", clearNote);
exportBtn.addEventListener("click", exportNote);
exportAllBtn.addEventListener("click", exportAllNotes);
importBtn.addEventListener("click", importTxtFile);
fileInput.addEventListener("change", handleFileImport);
addTabBtn.addEventListener("click", addTab);
darkModeBtn.addEventListener("click", toggleDarkMode);
monoBtn.addEventListener("click", toggleMonospace);
mdPreviewBtn.addEventListener("click", togglePreview);
searchInput.addEventListener("input", performSearch);
searchNextBtn.addEventListener("click", searchNextMatch);
searchPrevBtn.addEventListener("click", searchPrevMatch);
searchCloseBtn.addEventListener("click", closeSearch);
templateBtn.addEventListener("click", function () {
  templateModal.classList.remove("hidden");
});

// Template selection
document.querySelectorAll(".template-option").forEach(function (btn) {
  btn.addEventListener("click", function () {
    var key = btn.getAttribute("data-template");
    templateModal.classList.add("hidden");
    addTabFromTemplate(key);
  });
});

// Template modal close on overlay click
templateModal.querySelector(".modal-overlay").addEventListener("click", function () {
  templateModal.classList.add("hidden");
});

// Delete modal
modalConfirm.addEventListener("click", function () {
  if (deleteTargetIndex !== null) {
    deleteTab(deleteTargetIndex);
    deleteTargetIndex = null;
  }
  deleteModal.classList.add("hidden");
});
modalCancel.addEventListener("click", function () {
  deleteTargetIndex = null;
  deleteModal.classList.add("hidden");
});
deleteModal.querySelector(".modal-overlay").addEventListener("click", function () {
  deleteTargetIndex = null;
  deleteModal.classList.add("hidden");
});

// Context menu actions
contextMenu.addEventListener("click", function (e) {
  var target = e.target.closest("[data-action]");
  if (!target || contextTabIndex === null) return;
  var action = target.getAttribute("data-action");
  if (action === "pin") pinTab(contextTabIndex);
  else if (action === "duplicate") duplicateTab(contextTabIndex);
  else if (action === "delete") requestDeleteTab(contextTabIndex);
  hideContextMenu();
});

// Color dots in context menu
document.querySelectorAll(".color-dot").forEach(function (dot) {
  dot.addEventListener("click", function (e) {
    e.stopPropagation();
    if (contextTabIndex !== null) {
      setTabColor(contextTabIndex, dot.getAttribute("data-color"));
      hideContextMenu();
    }
  });
});

// Close context menu on click outside
document.addEventListener("click", function (e) {
  if (!contextMenu.contains(e.target)) {
    hideContextMenu();
  }
});

// ===== Keyboard Shortcuts =====

document.addEventListener("keydown", function (e) {
  // Ctrl+N — new tab
  if (e.ctrlKey && e.key === "n") {
    e.preventDefault();
    addTab();
  }
  // Ctrl+F — search
  if (e.ctrlKey && e.key === "f") {
    e.preventDefault();
    toggleSearch();
  }
  // Ctrl+S — export
  if (e.ctrlKey && e.key === "s") {
    e.preventDefault();
    exportNote();
  }
  // Ctrl+Tab / Ctrl+Shift+Tab — switch tabs
  if (e.ctrlKey && e.key === "Tab") {
    e.preventDefault();
    if (e.shiftKey) {
      switchTab((state.activeTab - 1 + state.tabs.length) % state.tabs.length);
    } else {
      switchTab((state.activeTab + 1) % state.tabs.length);
    }
  }
  // Escape
  if (e.key === "Escape") {
    if (!searchBar.classList.contains("hidden")) closeSearch();
    else if (!templateModal.classList.contains("hidden")) templateModal.classList.add("hidden");
    else if (!deleteModal.classList.contains("hidden")) { deleteTargetIndex = null; deleteModal.classList.add("hidden"); }
    else hideContextMenu();
  }
  // Enter in search
  if (e.key === "Enter" && document.activeElement === searchInput) {
    e.preventDefault();
    if (e.shiftKey) searchPrevMatch();
    else searchNextMatch();
  }
});

// ===== Initialize =====

(function init() {
  Promise.all([loadState(), loadSettings()]).then(function (results) {
    state = results[0];
    settings = results[1];
    applyDarkMode();
    applyMonospace();
    notepad.value = state.tabs[state.activeTab].content;
    renderTabs();
    updateStats();
    updateTimestamps();
    notepad.focus();
  });
})();
