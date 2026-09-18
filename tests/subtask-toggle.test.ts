import assert from "node:assert/strict";
import { test } from "vitest";
import { describe, getCheckboxState, getSelectedTaskItems, isShortcut } from "../src/page/subtask-toggle";

interface FakeCheckboxOptions {
  aria?: string | null;
  checked?: boolean;
  className?: string;
  disabled?: boolean;
  input?: boolean;
}

function fakeCheckbox({ input = false, disabled = false, checked = false, aria = null, className = "" }: FakeCheckboxOptions = {}): Element {
  return {
    disabled,
    checked,
    className,
    matches: (selector: string) => input && selector === 'input[type="checkbox"]',
    getAttribute: (name: string) => (name === "aria-checked" ? aria : null),
  } as unknown as Element;
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
  assert.match(describe({ ok: false, reason: "No selected task found.", changedCount: 0, taskCount: 0 }), /Alt\+Shift\+D/);
  assert.equal(
    describe({ ok: true, changedCount: 2, totalSubtaskCount: 2, taskCount: 1, action: "checked" }),
    "Checked 2 subtasks.",
  );
});

test("falls back to the hovered current-Marvin task when nothing is selected", () => {
  const hovered = {
    matches: (selector: string) => selector.includes('[data-uid="SingleTask"]'),
    querySelector: () => null,
  };
  const documentObject = {
    activeElement: null,
    querySelectorAll: () => [],
  };

  assert.deepEqual(
    getSelectedTaskItems(documentObject as unknown as Document, hovered as unknown as Element),
    [hovered],
  );
});

test("accepts a hovered subtask list in Marvin's task-details view", () => {
  const hoveredList = {
    matches: () => false,
    querySelector: (selector: string) => (selector.includes('data-item-type="subtask"') ? {} : null),
  };
  const documentObject = {
    activeElement: null,
    querySelectorAll: () => [],
  };

  assert.deepEqual(
    getSelectedTaskItems(documentObject as unknown as Document, hoveredList as unknown as Element),
    [hoveredList],
  );
});
