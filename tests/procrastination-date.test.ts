import assert from "node:assert/strict";
import { test } from "vitest";
import { normalizeLocalDoc, taskIdForElement, withSinceDate } from "../src/page/procrastination-date";

test("appends the authoritative firstScheduled date", () => {
  assert.equal(
    withSinceDate("Days procrastinated: 10", "2026-09-08"),
    "Days procrastinated: 10 (since 2026-09-08)",
  );
});

test("replaces an earlier MES date idempotently", () => {
  assert.equal(
    withSinceDate("Days procrastinated: 10 (since 2026-09-07)", "2026-09-08"),
    "Days procrastinated: 10 (since 2026-09-08)",
  );
});

test("refuses inferred or malformed dates", () => {
  assert.equal(withSinceDate("Days procrastinated: 10", "09/08/2026"), null);
  assert.equal(withSinceDate("Age: 10", "2026-09-08"), null);
});

test("normalizes PouchDB document identifiers and rejects deleted records", () => {
  assert.equal(normalizeLocalDoc({ _id: "task-1", title: "x" }, "task-1")?._id, "task-1");
  assert.equal(normalizeLocalDoc({ _doc_id_rev: "task-1::2-abc" }, "task-1")?._id, "task-1");
  assert.equal(normalizeLocalDoc({ _id: "task-2" }, "task-1"), null);
  assert.equal(normalizeLocalDoc({ _id: "task-1", _deleted: true }, "task-1"), null);
});

test("finds a task ID through the closest Marvin task element", () => {
  const row = { getAttribute: (name: string) => (name === "data-item-id" ? "task-1" : null) };
  const element = { closest: () => row };
  assert.equal(taskIdForElement(element as unknown as Element), "task-1");
});
