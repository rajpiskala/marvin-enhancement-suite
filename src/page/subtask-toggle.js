(function bootstrap(root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (!root?.document || root.MESSubtaskToggle?.installed) return;
  root.MESSubtaskToggle = api.install(root.document);
})(typeof window === "undefined" ? globalThis : window, function createApi() {
  "use strict";

  const VERSION = "0.2.0";
  const SHORTCUT_LABEL = "Alt+Shift+D";
  const SELECTORS = {
    taskItem: '[data-item-type="task"], [data-uid="SingleTask"].Task',
    subtaskItem: '[data-item-type="subtask"]',
    selectedTask: ".Task-selected",
    checkbox: '.Checkbox, [role="checkbox"], input[type="checkbox"]',
  };

  function isShortcut(event) {
    return event.key.toLowerCase() === "d" && event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey;
  }

  function isEditableTarget(target) {
    if (!(target instanceof Element)) return false;
    return Boolean(target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]'));
  }

  function getSelectedTaskItems(documentObject = document, hoveredTask = null) {
    const activeTask = documentObject.activeElement?.closest?.(SELECTORS.taskItem);
    if (activeTask) return [activeTask];
    const selected = Array.from(documentObject.querySelectorAll(SELECTORS.selectedTask))
      .map((task) => task.closest(SELECTORS.taskItem))
      .filter(Boolean);
    const uniqueSelected = Array.from(new Set(selected));
    if (uniqueSelected.length > 0) return uniqueSelected;
    const hoveredHasSubtasks = hoveredTask?.querySelector?.(SELECTORS.subtaskItem);
    return hoveredTask?.matches?.(SELECTORS.taskItem) || hoveredHasSubtasks ? [hoveredTask] : [];
  }

  function getCheckboxState(element) {
    if (element.matches?.('input[type="checkbox"]')) return element.disabled ? null : element.checked;
    const ariaChecked = element.getAttribute("aria-checked");
    if (ariaChecked != null) return ariaChecked === "true";
    const className = element.className || "";
    if (/\bCheckbox-checked\b/.test(className)) return true;
    if (/\bCheckbox-unchecked\b/.test(className)) return false;
    return null;
  }

  function getSubtaskCheckboxes(taskItem) {
    return Array.from(taskItem.querySelectorAll(SELECTORS.subtaskItem))
      .map((subtask) =>
        Array.from(subtask.querySelectorAll(SELECTORS.checkbox)).find((checkbox) => getCheckboxState(checkbox) != null),
      )
      .filter(Boolean);
  }

  function clickCheckbox(checkbox, windowObject = window) {
    checkbox.dispatchEvent(new windowObject.MouseEvent("click", { bubbles: true, cancelable: true, view: windowObject }));
  }

  function waitForRender(documentObject, milliseconds = 120) {
    return new Promise((resolve) => documentObject.defaultView.setTimeout(resolve, milliseconds));
  }

  function findCurrentCheckbox(documentObject, target) {
    if (!target.itemId) return target.checkbox;
    const subtask = Array.from(documentObject.querySelectorAll(SELECTORS.subtaskItem))
      .find((item) => item.getAttribute("data-item-id") === target.itemId);
    return subtask
      ? Array.from(subtask.querySelectorAll(SELECTORS.checkbox)).find((checkbox) => getCheckboxState(checkbox) != null)
      : null;
  }

  async function toggle(documentObject = document, hoveredTask = null) {
    const taskItems = getSelectedTaskItems(documentObject, hoveredTask);
    if (taskItems.length === 0) return { ok: false, reason: "No selected task found.", changedCount: 0, taskCount: 0 };
    const checkboxes = Array.from(new Set(taskItems.flatMap(getSubtaskCheckboxes)));
    const unchecked = checkboxes.filter((checkbox) => getCheckboxState(checkbox) === false);
    const uncheck = checkboxes.length > 0 && unchecked.length === 0;
    const desiredState = !uncheck;
    const targets = (uncheck ? checkboxes : unchecked).map((checkbox) => ({
      checkbox,
      itemId: checkbox.closest?.(SELECTORS.subtaskItem)?.getAttribute("data-item-id") || null,
    }));
    let changedCount = 0;
    for (const target of targets) {
      const currentCheckbox = findCurrentCheckbox(documentObject, target);
      if (!currentCheckbox || getCheckboxState(currentCheckbox) === desiredState) continue;
      clickCheckbox(currentCheckbox, documentObject.defaultView);
      changedCount += 1;
      await waitForRender(documentObject);
    }
    return {
      ok: true,
      action: uncheck ? "unchecked" : "checked",
      changedCount,
      totalSubtaskCount: checkboxes.length,
      taskCount: taskItems.length,
    };
  }

  function describe(result) {
    if (!result.ok) return `${result.reason} (${SHORTCUT_LABEL})`;
    if (result.totalSubtaskCount === 0) return "No subtasks found.";
    const noun = result.changedCount === 1 ? "subtask" : "subtasks";
    return `${result.action === "unchecked" ? "Unchecked" : "Checked"} ${result.changedCount} ${noun}.`;
  }

  function showToast(documentObject, message) {
    documentObject.getElementById("mes-subtask-toggle-toast")?.remove();
    const toast = documentObject.createElement("div");
    toast.id = "mes-subtask-toggle-toast";
    toast.textContent = message;
    Object.assign(toast.style, {
      position: "fixed", right: "18px", bottom: "18px", zIndex: "2147483647", padding: "10px 12px",
      borderRadius: "7px", background: "rgba(38,38,38,.94)", color: "#fff",
      font: "13px/1.35 system-ui, sans-serif", boxShadow: "0 6px 20px rgba(0,0,0,.22)", pointerEvents: "none",
    });
    documentObject.body.appendChild(toast);
    documentObject.defaultView.setTimeout(() => toast.remove(), 2200);
  }

  function install(documentObject) {
    let hoveredTask = null;
    let inFlight = false;
    const handlePointerOver = (event) => {
      const subtask = event.target?.closest?.(SELECTORS.subtaskItem);
      const task = event.target?.closest?.(SELECTORS.taskItem) || subtask?.closest?.(".List2");
      if (task) hoveredTask = task;
    };
    const handleKeydown = async (event) => {
      if (!isShortcut(event) || isEditableTarget(event.target)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (inFlight) return;
      inFlight = true;
      try {
        showToast(documentObject, describe(await toggle(documentObject, hoveredTask)));
      } finally {
        inFlight = false;
      }
    };
    documentObject.addEventListener("pointerover", handlePointerOver, true);
    documentObject.addEventListener("keydown", handleKeydown, true);
    return {
      installed: true,
      version: VERSION,
      shortcut: SHORTCUT_LABEL,
      toggle: () => toggle(documentObject, hoveredTask),
      disconnect: () => {
        documentObject.removeEventListener("pointerover", handlePointerOver, true);
        documentObject.removeEventListener("keydown", handleKeydown, true);
      },
    };
  }

  return { VERSION, describe, getCheckboxState, getSelectedTaskItems, getSubtaskCheckboxes, install, isShortcut, toggle };
});
