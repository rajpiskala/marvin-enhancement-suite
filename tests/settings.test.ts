import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, normalizeSettings } from "../src/settings";

describe("settings", () => {
  it("defaults only conservative compatibility fixes on", () => {
    expect(DEFAULT_SETTINGS.features).toEqual({
      autocompleteCleanup: true,
      procrastinationDate: true,
      explicitDurations: false,
      subtaskToggle: false,
      taskUnroller: false,
    });
  });

  it("merges partial persisted settings without losing new defaults", () => {
    expect(normalizeSettings({ features: { autocompleteCleanup: false } })).toMatchObject({
      masterEnabled: true,
      features: {
        autocompleteCleanup: false,
        procrastinationDate: true,
        explicitDurations: false,
      },
    });
  });

  it("does not coerce malformed values", () => {
    expect(normalizeSettings({ masterEnabled: "false", features: { taskUnroller: 1 } })).toEqual(DEFAULT_SETTINGS);
  });
});
