// Key used for storing notes in localStorage
const STORAGE_KEY = "quicknote_data";

// DOM references
const notepad = document.getElementById("notepad");
const clearBtn = document.getElementById("clear-btn");

// Load saved note from localStorage when popup opens
function loadNote() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved !== null) {
    notepad.value = saved;
  }
}

// Save note to localStorage
function saveNote() {
  localStorage.setItem(STORAGE_KEY, notepad.value);
}

// Clear stored note and empty the textarea
function clearNote() {
  localStorage.removeItem(STORAGE_KEY);
  notepad.value = "";
  notepad.focus();
}

// Auto-save whenever the user types
notepad.addEventListener("input", saveNote);

// Clear button handler
clearBtn.addEventListener("click", clearNote);

// Load note on popup open
loadNote();
