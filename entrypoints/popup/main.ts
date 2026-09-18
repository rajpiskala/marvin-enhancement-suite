import { browser } from "wxt/browser";
import { getSettings, saveSettings, type FeatureId, type MesSettings } from "../../src/settings";
import { reloadMarvinTabs } from "../../src/reload-marvin";

const elements = {
  master: requiredButton("master-toggle"),
  masterLabel: requiredElement("master-label"),
  masterHint: requiredElement("master-hint"),
  masterAction: requiredElement("master-action"),
  options: requiredButton("options-toggle"),
  optionsLabel: requiredElement("options-toggle-label"),
  panel: requiredElement("customization-panel"),
  count: requiredElement("feature-count"),
  autocomplete: requiredInput("feature-autocomplete"),
  procrastination: requiredInput("feature-procrastination"),
  duration: requiredInput("feature-duration"),
  subtasks: requiredInput("feature-subtasks"),
  unroller: requiredInput("feature-unroller"),
  unrollerBadge: requiredElement("unroller-badge"),
  unrollerSetup: requiredDetails("unroller-setup"),
  credentialStatus: requiredElement("credential-status"),
  apiToken: requiredInput("api-token"),
  fullAccessToken: requiredInput("full-access-token"),
  saveCredentials: requiredButton("save-credentials"),
  undoUnroll: requiredButton("undo-unroll"),
  undoHelp: requiredElement("undo-help"),
  status: requiredElement("status"),
};

const featureInputs: Array<[FeatureId, HTMLInputElement]> = [
  ["autocompleteCleanup", elements.autocomplete],
  ["procrastinationDate", elements.procrastination],
  ["explicitDurations", elements.duration],
  ["subtaskToggle", elements.subtasks],
  ["taskUnroller", elements.unroller],
];

let currentSettings: MesSettings | null = null;
let credentialsDirty = false;

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

function cloneSettings(settings: MesSettings): MesSettings {
  return {
    ...settings,
    features: { ...settings.features },
  };
}

function setBusy(busy: boolean): void {
  elements.master.disabled = busy || !currentSettings;
  for (const [, input] of featureInputs) input.disabled = busy || !currentSettings;
  elements.apiToken.disabled = busy || !currentSettings;
  elements.fullAccessToken.disabled = busy || !currentSettings;
  elements.saveCredentials.disabled = busy || !credentialsDirty || !currentSettings;
  elements.undoUnroll.disabled = busy || !currentSettings?.features.taskUnroller;
}

function render(settings: MesSettings): void {
  currentSettings = cloneSettings(settings);
  elements.master.classList.toggle("is-paused", !settings.masterEnabled);
  elements.master.setAttribute("aria-pressed", String(settings.masterEnabled));
  elements.masterLabel.textContent = settings.masterEnabled ? "MES is active" : "MES is paused";
  elements.masterHint.textContent = settings.masterEnabled
    ? "Fixes and enabled tools run on Marvin"
    : "All MES changes are temporarily off";
  elements.masterAction.textContent = settings.masterEnabled ? "Pause" : "Resume";

  for (const [feature, input] of featureInputs) input.checked = settings.features[feature];
  const enabledCount = Object.values(settings.features).filter(Boolean).length;
  elements.count.textContent = `${enabledCount} of ${featureInputs.length} modules enabled`;

  const credentialsComplete = Boolean(settings.unrollerApiToken && settings.unrollerFullAccessToken);
  const credentialsPartial = Boolean(settings.unrollerApiToken || settings.unrollerFullAccessToken);
  elements.credentialStatus.textContent = credentialsComplete
    ? "Credentials saved"
    : credentialsPartial
      ? "Setup incomplete"
      : "Not configured";
  elements.unrollerBadge.textContent = credentialsComplete ? "Optional · ready" : "Optional · API setup";
  elements.unrollerBadge.classList.toggle("is-ready", credentialsComplete);
  elements.undoHelp.textContent = settings.features.taskUnroller
    ? "Undo restores the original title and moves generated tasks to Marvin Trash."
    : "Enable Task Unroller before using undo.";

  if (!credentialsDirty) {
    elements.apiToken.value = settings.unrollerApiToken;
    elements.fullAccessToken.value = settings.unrollerFullAccessToken;
    elements.saveCredentials.disabled = true;
  }
  setBusy(false);
}

function reloadMessage(count: number): string {
  if (count === 0) return "Saved. No open Marvin tabs needed reloading.";
  return `Saved. Reloaded ${count} Marvin ${count === 1 ? "tab" : "tabs"}.`;
}

async function persist(next: MesSettings, successOverride?: string): Promise<void> {
  setBusy(true);
  elements.status.textContent = "Saving…";
  try {
    await saveSettings(next);
    const count = await reloadMarvinTabs();
    render(next);
    elements.status.textContent = successOverride || reloadMessage(count);
  } catch (error) {
    const stored = await getSettings();
    render(stored);
    elements.status.textContent = error instanceof Error ? error.message : String(error);
  }
}

elements.master.addEventListener("click", () => {
  if (!currentSettings) return;
  const next = cloneSettings(currentSettings);
  next.masterEnabled = !next.masterEnabled;
  void persist(next);
});

elements.options.addEventListener("click", () => {
  const expanded = elements.options.getAttribute("aria-expanded") !== "true";
  elements.options.setAttribute("aria-expanded", String(expanded));
  elements.optionsLabel.textContent = expanded ? "Hide options" : "Show options";
  elements.panel.hidden = !expanded;
});

for (const [feature, input] of featureInputs) {
  input.addEventListener("change", async () => {
    if (!currentSettings) return;

    if (feature === "taskUnroller" && input.checked) {
      const granted = await browser.permissions.request({ origins: ["https://serv.amazingmarvin.com/*"] });
      if (!granted) {
        input.checked = false;
        elements.status.textContent = "Task unroller stayed off because Marvin API access was not granted.";
        return;
      }
    }

    const next = cloneSettings(currentSettings);
    next.features[feature] = input.checked;
    const needsCredentials = feature === "taskUnroller"
      && input.checked
      && (!next.unrollerApiToken || !next.unrollerFullAccessToken);
    if (needsCredentials) elements.unrollerSetup.open = true;
    await persist(
      next,
      needsCredentials
        ? "Task Unroller is on, but needs both credentials before it can create tasks."
        : undefined,
    );

    if (feature === "taskUnroller" && !input.checked) {
      await browser.permissions.remove({ origins: ["https://serv.amazingmarvin.com/*"] });
    }
  });
}

for (const input of [elements.apiToken, elements.fullAccessToken]) {
  input.addEventListener("input", () => {
    credentialsDirty = true;
    elements.saveCredentials.disabled = !currentSettings;
  });
}

elements.saveCredentials.addEventListener("click", async () => {
  if (!currentSettings) return;
  const apiToken = elements.apiToken.value.trim();
  const fullAccessToken = elements.fullAccessToken.value.trim();
  if (Boolean(apiToken) !== Boolean(fullAccessToken)) {
    elements.status.textContent = "Enter both Task Unroller credentials, or clear both fields.";
    return;
  }

  elements.saveCredentials.disabled = true;
  elements.status.textContent = "Saving credentials…";
  const next = cloneSettings(currentSettings);
  next.unrollerApiToken = apiToken;
  next.unrollerFullAccessToken = fullAccessToken;
  try {
    await saveSettings(next);
    credentialsDirty = false;
    render(next);
    elements.status.textContent = apiToken
      ? "Task Unroller credentials saved in this browser profile."
      : "Task Unroller credentials cleared.";
  } catch (error) {
    elements.saveCredentials.disabled = false;
    elements.status.textContent = error instanceof Error ? error.message : String(error);
  }
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
    elements.undoUnroll.disabled = !currentSettings?.features.taskUnroller;
  }
});

void getSettings()
  .then(render)
  .catch((error: unknown) => {
    elements.status.textContent = error instanceof Error ? error.message : String(error);
  });
