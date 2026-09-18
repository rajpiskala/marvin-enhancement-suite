const test = require("node:test");
const assert = require("node:assert/strict");

const {
  MAX_EXPANSION_COUNT,
  buildAddTaskPayload,
  clearReceipt,
  createdTaskId,
  expandLoop,
  getLoopCandidateCount,
  loadReceipts,
  looksLikeMarvinTask,
  parseDurationMillis,
  parseLoop,
  putReceipt,
  receiptForTask,
  requireConfirmation,
} = require("../src/page/task-unroller.js");

test("recognizes Marvin task database records used by the change watcher", () => {
  assert.equal(looksLikeMarvinTask({ _id: "task", db: "Tasks", title: "Loop (1/3)" }), true);
  assert.equal(looksLikeMarvinTask({ _id: "category", db: "Categories", title: "Loop (1/3)" }), false);
  assert.equal(looksLikeMarvinTask({ _id: "task", db: "Tasks", title: "Loop (1/3)", _deleted: true }), false);
});

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

test("explicit duration wins over duration-looking prose", () => {
  assert.equal(parseDurationMillis("Watch the 4 Hour Race ~1h"), 60 * 60 * 1000);
  assert.equal(parseDurationMillis("Read 20m"), 20 * 60 * 1000);
});

test("expands natural counters and advances clock time across midnight", () => {
  const loop = parseLoop("11:30pm Watch 1h (1/3)", {});
  assert.deepEqual(
    expandLoop(loop).map((item) => item.title),
    ["11:30pm Watch 1h (1/3)", "12:30am Watch 1h (2/3)", "1:30am Watch 1h (3/3)"],
  );
});

test("supports explicit ranges and preserves counter width", () => {
  const loop = parseLoop("Review ($01..03)", {});
  assert.deepEqual(expandLoop(loop).map((item) => item.title), ["Review (01/3)", "Review (02/3)", "Review (03/3)"]);
});

test("rejects unsafe expansion sizes", () => {
  assert.equal(getLoopCandidateCount(`Task (1/${MAX_EXPANSION_COUNT + 1})`), MAX_EXPANSION_COUNT + 1);
  assert.throws(() => parseLoop(`Task (1/${MAX_EXPANSION_COUNT + 1})`, {}), /limited/);
});

test("requires confirmation only for larger expansions", () => {
  assert.equal(requireConfirmation(3, "Task", () => false), true);
  assert.equal(requireConfirmation(11, "Task", () => false), false);
  assert.equal(requireConfirmation(11, "Task", () => true), true);
});

test("copies supported task fields without completion state", () => {
  const payload = buildAddTaskPayload(
    { title: "Old", parentId: "parent", day: "2026-09-18", labelIds: ["label"], done: true, rank: 4 },
    { title: "New" },
    2,
  );
  assert.deepEqual(payload, {
    title: "New",
    done: false,
    day: "2026-09-18",
    parentId: "parent",
    labelIds: ["label"],
    rank: 4.002,
  });
});

test("extracts task IDs from supported Marvin response shapes", () => {
  assert.equal(createdTaskId({ _id: "one" }), "one");
  assert.equal(createdTaskId({ task: { id: "two" } }), "two");
  assert.equal(createdTaskId({ ok: true }), null);
});

test("persists, locates, and explicitly clears duplicate-prevention receipts", () => {
  const storage = new MemoryStorage();
  putReceipt({ id: "r1", sourceTaskId: "task-1", status: "started" }, storage);
  assert.equal(loadReceipts(storage).length, 1);
  assert.equal(receiptForTask("task-1", storage).id, "r1");
  clearReceipt("task-1", storage);
  assert.equal(receiptForTask("task-1", storage), null);
});
