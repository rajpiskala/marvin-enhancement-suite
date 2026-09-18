const test = require("node:test");
const assert = require("node:assert/strict");

const { describe, getCheckboxState, getSelectedTaskItems, isShortcut } = require("../src/page/subtask-toggle.js");

function fakeCheckbox({ input = false, disabled = false, checked = false, aria = null, className = "" } = {}) {
  return {
    disabled,
    checked,
    className,
    matches: (selector) => input && selector === 'input[type="checkbox"]',
    getAttribute: (name) => (name === "aria-checked" ? aria : null),
  };
}

test("recognizes only the intended keyboard shortcut", () => {
  assert.equal(isShortcut({ key: "d", altKey: true, shiftKey: true, ctrlKey: false, metaKey: false }), true);
  assert.equal(isShortcut({ key: "d", altKey: true, shiftKey: false, ctrlKey: false, metaKey: false }), false);
  assert.equal(isShortcut({ key: "d", altKey: true, shiftKey: true, ctrlKey: true, metaKey: false }), false);
});

test("reads native, ARIA, and Marvin checkbox state", () => {
  assert.equal(getCheckboxState(fakeCheckbox({ input: true, checked: true })), true);
  assert.equal(getCheckboxState(fakeCheckbox({ input: true, disabled: true })), null);
  assert.equal(getCheckboxState(fakeCheckbox({ aria: "false" })), false);
  assert.equal(getCheckboxState(fakeCheckbox({ className: "Checkbox Checkbox-checked" })), true);
});

test("describes no-op and completed actions", () => {
  assert.match(describe({ ok: false, reason: "No selected task found." }), /Alt\+Shift\+D/);
  assert.equal(describe({ ok: true, changedCount: 2, totalSubtaskCount: 2, action: "checked" }), "Checked 2 subtasks.");
});

test("falls back to the hovered current-Marvin task when nothing is selected", () => {
  const hovered = {
    matches: (selector) => selector.includes('[data-uid="SingleTask"]'),
    querySelector: () => null,
  };
  const documentObject = {
    activeElement: null,
    querySelectorAll: () => [],
  };

  assert.deepEqual(getSelectedTaskItems(documentObject, hovered), [hovered]);
});

test("accepts a hovered subtask list in Marvin's task-details view", () => {
  const hoveredList = {
    matches: () => false,
    querySelector: (selector) => (selector.includes('data-item-type="subtask"') ? {} : null),
  };
  const documentObject = {
    activeElement: null,
    querySelectorAll: () => [],
  };

  assert.deepEqual(getSelectedTaskItems(documentObject, hoveredList), [hoveredList]);
});
