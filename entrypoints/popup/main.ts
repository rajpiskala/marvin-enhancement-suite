import { browser } from "wxt/browser";
import { getSettings, saveSettings } from "../../src/settings";
import { reloadMarvinTabs } from "../../src/reload-marvin";

const master = document.querySelector<HTMLInputElement>("#master-enabled");
const count = document.querySelector<HTMLElement>("#feature-count");
const settingsButton = document.querySelector<HTMLButtonElement>("#settings");
const status = document.querySelector<HTMLElement>("#status");
if (!master || !count || !settingsButton || !status) throw new Error("MES popup is incomplete.");

void getSettings().then((settings) => {
  master.checked = settings.masterEnabled;
  const enabledCount = Object.values(settings.features).filter(Boolean).length;
  count.textContent = `${enabledCount} of ${Object.keys(settings.features).length} modules enabled`;
});

master.addEventListener("change", async () => {
  const settings = await getSettings();
  settings.masterEnabled = master.checked;
  await saveSettings(settings);
  const reloaded = await reloadMarvinTabs();
  status.textContent = `${master.checked ? "Enabled" : "Paused"}; reloaded ${reloaded} Marvin ${reloaded === 1 ? "tab" : "tabs"}.`;
});

settingsButton.addEventListener("click", () => void browser.runtime.openOptionsPage());
