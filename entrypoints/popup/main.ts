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
  advanced: requiredButton("advanced-settings"),
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

function cloneSettings(settings: MesSettings): MesSettings {
  return {
    ...settings,
    features: { ...settings.features },
  };
}

function setBusy(busy: boolean): void {
  elements.master.disabled = busy || !currentSettings;
  for (const [, input] of featureInputs) input.disabled = busy || !currentSettings;
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
    await persist(
      next,
      feature === "taskUnroller" && input.checked && (!next.unrollerApiToken || !next.unrollerFullAccessToken)
        ? "Task unroller enabled. Add its credentials in Advanced settings before using it."
        : undefined,
    );

    if (feature === "taskUnroller" && !input.checked) {
      await browser.permissions.remove({ origins: ["https://serv.amazingmarvin.com/*"] });
    }
  });
}

elements.advanced.addEventListener("click", () => void browser.runtime.openOptionsPage());

void getSettings()
  .then(render)
  .catch((error: unknown) => {
    elements.status.textContent = error instanceof Error ? error.message : String(error);
  });
