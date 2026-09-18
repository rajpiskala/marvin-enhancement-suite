import type { MesSettings } from "./settings";

const MARVIN_APP_ORIGIN = "https://app.amazingmarvin.com";

export function isAllowedMarvinUrl(value: unknown): boolean {
  if (typeof value !== "string") return false;

  try {
    return new URL(value).origin === MARVIN_APP_ORIGIN;
  } catch {
    return false;
  }
}

export function canUseTaskUnroller(settings: MesSettings): boolean {
  return settings.masterEnabled && settings.features.taskUnroller;
}
