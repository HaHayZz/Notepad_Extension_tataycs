// Storage keys
const DATA_KEY = "tataycs_notches_data";

// DOM references
const notepad = document.getElementById("notepad");
const clearBtn = document.getElementById("clear-btn");
const charCount = document.getElementById("char-count");
const tabsContainer = document.getElementById("tabs-container");
const addTabBtn = document.getElementById("add-tab-btn");

// App state
let state = loadState();

// ===== State Management =====

// Load full state from localStorage
function loadState() {
  const raw = localStorage.getItem(DATA_KEY);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch (e) {
      // corrupted data, start fresh
    }
  }
  // Default: one tab called "Note 1"
  return {
    activeTab: 0,
    tabs: [{ name: "Note 1", content: "" }]
  };
}

// Persist state to localStorage
function saveState() {
  localStorage.setItem(DATA_KEY, JSON.stringify(state));
}

// ===== Character Count =====

function updateCharCount() {
  const len = notepad.value.length;
  charCount.textContent = len + (len === 1 ? " character" : " characters");
}

// ===== Tab Rendering =====

function renderTabs() {
  tabsContainer.innerHTML = "";

  state.tabs.forEach(function (tab, index) {
    const tabEl = document.createElement("div");
    tabEl.className = "tab" + (index === state.activeTab ? " active" : "");

    // Tab name span
    const nameSpan = document.createElement("span");
    nameSpan.className = "tab-name";
    nameSpan.textContent = tab.name;
    tabEl.appendChild(nameSpan);

    // Close button (only if more than 1 tab)
    if (state.tabs.length > 1) {
      const closeSpan = document.createElement("span");
      closeSpan.className = "tab-close";
      closeSpan.textContent = "\u00d7";
      closeSpan.title = "Close tab";
      closeSpan.addEventListener("click", function (e) {
        e.stopPropagation();
        deleteTab(index);
      });
      tabEl.appendChild(closeSpan);
    }

    // Click to switch tab
    tabEl.addEventListener("click", function () {
      switchTab(index);
    });

    // Double-click to rename tab
    tabEl.addEventListener("dblclick", function (e) {
      e.stopPropagation();
      startRenameTab(index, nameSpan);
    });

    tabsContainer.appendChild(tabEl);
  });
}

// ===== Tab Actions =====

function switchTab(index) {
  // Save current tab content before switching
  state.tabs[state.activeTab].content = notepad.value;
  state.activeTab = index;
  notepad.value = state.tabs[index].content;
  saveState();
  renderTabs();
  updateCharCount();
  notepad.focus();
}

function addTab() {
  // Save current tab content
  state.tabs[state.activeTab].content = notepad.value;

  var num = state.tabs.length + 1;
  state.tabs.push({ name: "Note " + num, content: "" });
  state.activeTab = state.tabs.length - 1;
  notepad.value = "";
  saveState();
  renderTabs();
  updateCharCount();
  notepad.focus();
}

function deleteTab(index) {
  if (state.tabs.length <= 1) return;

  state.tabs.splice(index, 1);

  // Adjust active tab index
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
  updateCharCount();
}

function startRenameTab(index, nameSpan) {
  nameSpan.classList.add("editing");
  nameSpan.contentEditable = "true";
  nameSpan.focus();

  // Select all text
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

// ===== Clear Notes (current tab only) =====

function clearNote() {
  state.tabs[state.activeTab].content = "";
  notepad.value = "";
  saveState();
  updateCharCount();
  notepad.focus();
}

// ===== Auto-save on typing =====

notepad.addEventListener("input", function () {
  state.tabs[state.activeTab].content = notepad.value;
  saveState();
  updateCharCount();
});

// ===== Event Listeners =====

clearBtn.addEventListener("click", clearNote);
addTabBtn.addEventListener("click", addTab);

// ===== Initialize =====

notepad.value = state.tabs[state.activeTab].content;
renderTabs();
updateCharCount();
