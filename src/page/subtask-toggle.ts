export const VERSION = "0.2.0";
export const SHORTCUT_LABEL = "Alt+Shift+D";

const SELECTORS = {
  taskItem: '[data-item-type="task"], [data-uid="SingleTask"].Task',
  subtaskItem: '[data-item-type="subtask"]',
  selectedTask: ".Task-selected",
  checkbox: '.Checkbox, [role="checkbox"], input[type="checkbox"]',
} as const;

export interface ShortcutLike {
  key: string;
  altKey: boolean;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}

export type ToggleResult =
  | { ok: false; reason: string; changedCount: 0; taskCount: 0 }
  | {
      ok: true;
      action: "checked" | "unchecked";
      changedCount: number;
      totalSubtaskCount: number;
      taskCount: number;
    };

interface CheckboxTarget {
  checkbox: Element;
  itemId: string | null;
}

export interface SubtaskToggleHandle {
  installed: true;
  version: string;
  shortcut: string;
  toggle(): Promise<ToggleResult>;
  disconnect(): void;
}

export function isShortcut(event: ShortcutLike): boolean {
  return event.key.toLowerCase() === "d"
    && event.altKey
    && event.shiftKey
    && !event.ctrlKey
    && !event.metaKey;
}

function isDomElement(target: EventTarget | null): target is Element {
  return Boolean(target && typeof (target as Element).closest === "function");
}

export function isEditableTarget(target: EventTarget | null): boolean {
  return isDomElement(target)
    && Boolean(target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]'));
}

export function getSelectedTaskItems(documentObject: Document = document, hoveredTask: Element | null = null): Element[] {
  const activeTask = isDomElement(documentObject.activeElement)
    ? documentObject.activeElement.closest(SELECTORS.taskItem)
    : null;
  if (activeTask) return [activeTask];

  const selected = Array.from(documentObject.querySelectorAll(SELECTORS.selectedTask))
    .map((task) => task.closest(SELECTORS.taskItem))
    .filter((task): task is Element => task !== null);
  const uniqueSelected = Array.from(new Set(selected));
  if (uniqueSelected.length > 0) return uniqueSelected;

  if (!hoveredTask) return [];
  const hoveredHasSubtasks = hoveredTask.querySelector(SELECTORS.subtaskItem);
  return hoveredTask.matches(SELECTORS.taskItem) || hoveredHasSubtasks ? [hoveredTask] : [];
}

export function getCheckboxState(element: Element): boolean | null {
  if (element.matches('input[type="checkbox"]')) {
    const input = element as HTMLInputElement;
    return input.disabled ? null : input.checked;
  }
  const ariaChecked = element.getAttribute("aria-checked");
  if (ariaChecked != null) return ariaChecked === "true";
  const className = typeof element.className === "string" ? element.className : "";
  if (/\bCheckbox-checked\b/.test(className)) return true;
  if (/\bCheckbox-unchecked\b/.test(className)) return false;
  return null;
}

export function getSubtaskCheckboxes(taskItem: Element): Element[] {
  return Array.from(taskItem.querySelectorAll(SELECTORS.subtaskItem))
    .map((subtask) => Array.from(subtask.querySelectorAll(SELECTORS.checkbox))
      .find((checkbox) => getCheckboxState(checkbox) != null))
    .filter((checkbox): checkbox is Element => checkbox !== undefined);
}

function clickCheckbox(checkbox: Element, windowObject: Window): void {
  const MouseEventConstructor = (windowObject as Window & typeof globalThis).MouseEvent;
  checkbox.dispatchEvent(new MouseEventConstructor("click", {
    bubbles: true,
    cancelable: true,
    view: windowObject,
  }));
}

function waitForRender(documentObject: Document, milliseconds = 120): Promise<void> {
  return new Promise((resolve) => documentObject.defaultView?.setTimeout(resolve, milliseconds));
}

function findCurrentCheckbox(documentObject: Document, target: CheckboxTarget): Element | null {
  if (!target.itemId) return target.checkbox;
  const subtask = Array.from(documentObject.querySelectorAll(SELECTORS.subtaskItem))
    .find((item) => item.getAttribute("data-item-id") === target.itemId);
  return subtask
    ? Array.from(subtask.querySelectorAll(SELECTORS.checkbox))
      .find((checkbox) => getCheckboxState(checkbox) != null) ?? null
    : null;
}

export async function toggle(
  documentObject: Document = document,
  hoveredTask: Element | null = null,
): Promise<ToggleResult> {
  const taskItems = getSelectedTaskItems(documentObject, hoveredTask);
  if (taskItems.length === 0) {
    return { ok: false, reason: "No selected task found.", changedCount: 0, taskCount: 0 };
  }

  const checkboxes = Array.from(new Set(taskItems.flatMap(getSubtaskCheckboxes)));
  const unchecked = checkboxes.filter((checkbox) => getCheckboxState(checkbox) === false);
  const uncheck = checkboxes.length > 0 && unchecked.length === 0;
  const desiredState = !uncheck;
  const targets: CheckboxTarget[] = (uncheck ? checkboxes : unchecked).map((checkbox) => ({
    checkbox,
    itemId: checkbox.closest(SELECTORS.subtaskItem)?.getAttribute("data-item-id") ?? null,
  }));

  let changedCount = 0;
  for (const target of targets) {
    const currentCheckbox = findCurrentCheckbox(documentObject, target);
    if (!currentCheckbox || getCheckboxState(currentCheckbox) === desiredState) continue;
    const view = documentObject.defaultView;
    if (!view) continue;
    clickCheckbox(currentCheckbox, view);
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

export function describe(result: ToggleResult): string {
  if (!result.ok) return `${result.reason} (${SHORTCUT_LABEL})`;
  if (result.totalSubtaskCount === 0) return "No subtasks found.";
  const noun = result.changedCount === 1 ? "subtask" : "subtasks";
  return `${result.action === "unchecked" ? "Unchecked" : "Checked"} ${result.changedCount} ${noun}.`;
}

function showToast(documentObject: Document, message: string): void {
  documentObject.getElementById("mes-subtask-toggle-toast")?.remove();
  const toast = documentObject.createElement("div");
  toast.id = "mes-subtask-toggle-toast";
  toast.textContent = message;
  Object.assign(toast.style, {
    position: "fixed",
    right: "18px",
    bottom: "18px",
    zIndex: "2147483647",
    padding: "10px 12px",
    borderRadius: "7px",
    background: "rgba(38,38,38,.94)",
    color: "#fff",
    font: "13px/1.35 system-ui, sans-serif",
    boxShadow: "0 6px 20px rgba(0,0,0,.22)",
    pointerEvents: "none",
  });
  documentObject.body.appendChild(toast);
  documentObject.defaultView?.setTimeout(() => toast.remove(), 2_200);
}

export function install(documentObject: Document): SubtaskToggleHandle {
  let hoveredTask: Element | null = null;
  let inFlight = false;

  const handlePointerOver = (event: Event): void => {
    if (!isDomElement(event.target)) return;
    const subtask = event.target.closest(SELECTORS.subtaskItem);
    const task = event.target.closest(SELECTORS.taskItem) ?? subtask?.closest(".List2");
    if (task) hoveredTask = task;
  };

  const handleKeydown = async (event: KeyboardEvent): Promise<void> => {
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
