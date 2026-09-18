import { describe, expect, it } from "vitest";
import { endpointFor, validateRequestPayload } from "../src/unroller-api";

describe("Marvin API routing", () => {
  it("encodes read-document identifiers", () => {
    expect(endpointFor("readDoc", { itemId: "a/b?c" })).toEqual({
      method: "GET",
      url: "https://serv.amazingmarvin.com/api/doc?id=a%2Fb%3Fc",
    });
  });

  it("routes writes only to fixed Marvin endpoints", () => {
    expect(endpointFor("updateDoc", {})).toMatchObject({ method: "POST", url: expect.stringMatching(/\/doc\/update$/) });
    expect(endpointFor("addTask", {})).toMatchObject({ method: "POST", url: expect.stringMatching(/\/addTask$/) });
  });

  it("requires a read-document ID", () => {
    expect(() => endpointFor("readDoc", {})).toThrow(/task ID/);
  });

  it("rejects arbitrary full-access document updates", () => {
    expect(() =>
      validateRequestPayload("updateDoc", {
        itemId: "task-1",
        setters: [{ key: "parentId", val: "other-project" }],
      }),
    ).toThrow(/does not allow/);
  });

  it("rejects undocumented fields on generated tasks", () => {
    expect(() => validateRequestPayload("addTask", { title: "Task", secret: true })).toThrow(/does not allow/);
  });
});
