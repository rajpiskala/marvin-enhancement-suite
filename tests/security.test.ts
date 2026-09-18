import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, type MesSettings } from "../src/settings";
import { canUseTaskUnroller, isAllowedMarvinUrl } from "../src/security";

function settingsWithUnroller(masterEnabled: boolean, taskUnroller: boolean): MesSettings {
  return {
    ...DEFAULT_SETTINGS,
    masterEnabled,
    features: { ...DEFAULT_SETTINGS.features, taskUnroller },
  };
}

describe("background bridge security", () => {
  it("accepts only the exact Marvin app origin", () => {
    expect(isAllowedMarvinUrl("https://app.amazingmarvin.com/")).toBe(true);
    expect(isAllowedMarvinUrl("https://app.amazingmarvin.com/day/2026-09-18")).toBe(true);
    expect(isAllowedMarvinUrl("https://app.amazingmarvin.com.evil.example/")).toBe(false);
    expect(isAllowedMarvinUrl("not a URL")).toBe(false);
  });

  it("requires both the master switch and Task Unroller", () => {
    expect(canUseTaskUnroller(settingsWithUnroller(true, true))).toBe(true);
    expect(canUseTaskUnroller(settingsWithUnroller(true, false))).toBe(false);
    expect(canUseTaskUnroller(settingsWithUnroller(false, true))).toBe(false);
  });
});
