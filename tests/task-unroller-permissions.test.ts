import { describe, expect, it } from "vitest";
import {
  MARVIN_API_ORIGIN,
  TASK_UNROLLER_DATA_TYPES,
  taskUnrollerPermissions,
} from "../src/task-unroller-permissions";

describe("taskUnrollerPermissions", () => {
  it("requests only the optional API origin in Chromium", () => {
    expect(taskUnrollerPermissions("chrome")).toEqual({
      origins: [MARVIN_API_ORIGIN],
    });
  });

  it("requests Firefox data consent with the optional API origin", () => {
    expect(taskUnrollerPermissions("firefox")).toEqual({
      origins: [MARVIN_API_ORIGIN],
      data_collection: [...TASK_UNROLLER_DATA_TYPES],
    });
  });
});
