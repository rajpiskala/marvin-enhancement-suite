import { browser } from "wxt/browser";

export const SETTINGS_KEY = "mes.settings.v1";

export type FeatureId =
  | "autocompleteCleanup"
  | "procrastinationDate"
  | "explicitDurations"
  | "subtaskToggle"
  | "taskUnroller";

export type FeatureSettings = Record<FeatureId, boolean>;

export interface MesSettings {
  masterEnabled: boolean;
  features: FeatureSettings;
  unrollerApiToken: string;
  unrollerFullAccessToken: string;
}

export const DEFAULT_SETTINGS: MesSettings = {
  masterEnabled: true,
  features: {
    autocompleteCleanup: true,
    procrastinationDate: true,
    explicitDurations: false,
    subtaskToggle: false,
    taskUnroller: false,
  },
  unrollerApiToken: "",
  unrollerFullAccessToken: "",
};

export function normalizeSettings(value: unknown): MesSettings {
  const candidate = value && typeof value === "object" ? (value as Partial<MesSettings>) : {};
  const features: Partial<FeatureSettings> =
    candidate.features && typeof candidate.features === "object" ? candidate.features : {};

  return {
    masterEnabled:
      typeof candidate.masterEnabled === "boolean" ? candidate.masterEnabled : DEFAULT_SETTINGS.masterEnabled,
    features: {
      autocompleteCleanup:
        typeof features.autocompleteCleanup === "boolean"
          ? features.autocompleteCleanup
          : DEFAULT_SETTINGS.features.autocompleteCleanup,
      procrastinationDate:
        typeof features.procrastinationDate === "boolean"
          ? features.procrastinationDate
          : DEFAULT_SETTINGS.features.procrastinationDate,
      explicitDurations:
        typeof features.explicitDurations === "boolean"
          ? features.explicitDurations
          : DEFAULT_SETTINGS.features.explicitDurations,
      subtaskToggle:
        typeof features.subtaskToggle === "boolean"
          ? features.subtaskToggle
          : DEFAULT_SETTINGS.features.subtaskToggle,
      taskUnroller:
        typeof features.taskUnroller === "boolean"
          ? features.taskUnroller
          : DEFAULT_SETTINGS.features.taskUnroller,
    },
    unrollerApiToken: typeof candidate.unrollerApiToken === "string" ? candidate.unrollerApiToken : "",
    unrollerFullAccessToken:
      typeof candidate.unrollerFullAccessToken === "string" ? candidate.unrollerFullAccessToken : "",
  };
}

export async function getSettings(): Promise<MesSettings> {
  const stored = await browser.storage.local.get(SETTINGS_KEY);
  return normalizeSettings(stored[SETTINGS_KEY]);
}

export async function saveSettings(settings: MesSettings): Promise<void> {
  await browser.storage.local.set({ [SETTINGS_KEY]: normalizeSettings(settings) });
}

export function publicSettings(settings: MesSettings): Pick<MesSettings, "masterEnabled" | "features"> {
  return {
    masterEnabled: settings.masterEnabled,
    features: { ...settings.features },
  };
}
