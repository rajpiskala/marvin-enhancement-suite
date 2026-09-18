import { browser } from "wxt/browser";
import { getSettings, saveSettings, type MesSettings } from "../../src/settings";
import { reloadMarvinTabs } from "../../src/reload-marvin";

const elements = {
  master: requiredInput("master-enabled"),
  autocomplete: requiredInput("feature-autocomplete"),
  procrastination: requiredInput("feature-procrastination"),
  duration: requiredInput("feature-duration"),
  subtasks: requiredInput("feature-subtasks"),
  unroller: requiredInput("feature-unroller"),
  apiToken: requiredInput("api-token"),
  fullAccessToken: requiredInput("full-access-token"),
  credentials: requiredElement("unroller-credentials"),
  save: requiredButton("save"),
  undoUnroll: requiredButton("undo-unroll"),
  advanced: requiredDetails("advanced-controls"),
  advancedAction: requiredElement("advanced-summary-action"),
  status: requiredElement("status"),
};

function requiredElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element;
}

function requiredInput(id: string): HTMLInputElement {
  const element = requiredElement(id);
  if (!(element instanceof HTMLInputElement)) throw new Error(`#${id} is not an input.`);
  return element;
}

function requiredButton(id: string): HTMLButtonElement {
  const element = requiredElement(id);
  if (!(element instanceof HTMLButtonElement)) throw new Error(`#${id} is not a button.`);
  return element;
}

function requiredDetails(id: string): HTMLDetailsElement {
  const element = requiredElement(id);
  if (!(element instanceof HTMLDetailsElement)) throw new Error(`#${id} is not a details element.`);
  return element;
}

function render(settings: MesSettings): void {
  elements.master.checked = settings.masterEnabled;
  elements.autocomplete.checked = settings.features.autocompleteCleanup;
  elements.procrastination.checked = settings.features.procrastinationDate;
  elements.duration.checked = settings.features.explicitDurations;
  elements.subtasks.checked = settings.features.subtaskToggle;
  elements.unroller.checked = settings.features.taskUnroller;
  elements.apiToken.value = settings.unrollerApiToken;
  elements.fullAccessToken.value = settings.unrollerFullAccessToken;
  elements.credentials.hidden = !settings.features.taskUnroller;
}

function readForm(): MesSettings {
  return {
    masterEnabled: elements.master.checked,
    features: {
      autocompleteCleanup: elements.autocomplete.checked,
      procrastinationDate: elements.procrastination.checked,
      explicitDurations: elements.duration.checked,
      subtaskToggle: elements.subtasks.checked,
      taskUnroller: elements.unroller.checked,
    },
    unrollerApiToken: elements.apiToken.value.trim(),
    unrollerFullAccessToken: elements.fullAccessToken.value.trim(),
  };
}

elements.unroller.addEventListener("change", () => {
  elements.credentials.hidden = !elements.unroller.checked;
});

elements.advanced.addEventListener("toggle", () => {
  elements.advancedAction.textContent = elements.advanced.open ? "Hide controls" : "Show all 5 controls";
});

elements.undoUnroll.addEventListener("click", async () => {
  const confirmed = window.confirm(
    "Undo the latest completed task unroll? Generated tasks will be moved to Marvin Trash and the original title restored.",
  );
  if (!confirmed) return;

  elements.undoUnroll.disabled = true;
  elements.status.textContent = "Undoing latest task unroll…";
  try {
    const tabs = await browser.tabs.query({ url: "https://app.amazingmarvin.com/*" });
    const target = tabs.find((tab) => typeof tab.id === "number");
    if (typeof target?.id !== "number") throw new Error("Open Amazing Marvin before undoing a task unroll.");
    const result = await browser.tabs.sendMessage(target.id, { type: "mes:task-unroller:undo-latest" }) as {
      ok?: boolean;
      createdTaskCount?: number;
    };
    if (!result?.ok) throw new Error("MES could not undo the latest task unroll.");
    const count = result.createdTaskCount || 0;
    elements.status.textContent = `Undone. Moved ${count} generated ${count === 1 ? "task" : "tasks"} to Marvin Trash.`;
  } catch (error) {
    elements.status.textContent = error instanceof Error ? error.message : String(error);
  } finally {
    elements.undoUnroll.disabled = false;
  }
});

elements.save.addEventListener("click", async () => {
  elements.save.disabled = true;
  elements.status.textContent = "Saving…";

  try {
    const settings = readForm();
    if (settings.features.taskUnroller) {
      const granted = await browser.permissions.request({ origins: ["https://serv.amazingmarvin.com/*"] });
      if (!granted) throw new Error("Marvin API permission was not granted; task unroller remains disabled.");
    } else {
      await browser.permissions.remove({ origins: ["https://serv.amazingmarvin.com/*"] });
    }

    await saveSettings(settings);
    const count = await reloadMarvinTabs();
    elements.status.textContent = `Saved. Reloaded ${count} Marvin ${count === 1 ? "tab" : "tabs"}.`;
  } catch (error) {
    elements.status.textContent = error instanceof Error ? error.message : String(error);
  } finally {
    elements.save.disabled = false;
  }
});

void getSettings().then(render);
