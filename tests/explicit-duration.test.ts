import assert from "node:assert/strict";
import { test } from "vitest";
import {
  addIntent,
  computeDesiredEstimate,
  createStats,
  estimateWasProbablyInferred,
  explicitIntentMatchesCurrentTitle,
  normalizeTitleForMatch,
  patchTaskInput,
  patchTaskInstance,
  parseBareDuration,
  parseExplicitDuration,
  stripExplicitDurationSyntax,
} from "../src/page/explicit-duration";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

test("recognizes bare numeric duration phrases in prose", () => {
  assert.equal(parseBareDuration("Learn the 5 minute breathing exercise"), 5 * MINUTE);
  assert.equal(parseBareDuration("Check oven after 3 hours"), 3 * HOUR);
  assert.equal(parseBareDuration("Watch the 10 hour marathon with John"), 10 * HOUR);
});
test("recognizes spelled-out duration phrases defensively", () => {
  assert.equal(parseBareDuration("Watch the Ten Hour Marathon with John"), 10 * HOUR);
  assert.equal(parseBareDuration("Try the five minute exercise"), 5 * MINUTE);
});

test("does not mistake clock times or hyphenated prose for bare durations", () => {
  assert.equal(parseBareDuration("10:00pm Watch a marathon"), 0);
  assert.equal(parseBareDuration("Learn the 5-minute breathing exercise"), 0);
});

test("parses explicit compound durations", () => {
  assert.equal(parseExplicitDuration("Task ~2h")?.millis, 2 * HOUR);
  assert.equal(parseExplicitDuration("Task ~1h 30m")?.millis, 90 * MINUTE);
  assert.equal(parseExplicitDuration("Task ca. 20m")?.millis, 20 * MINUTE);
});

test("explicit duration wins instead of being added to incidental prose", () => {
  const decision = computeDesiredEstimate("Watch the 10 hour marathon ~2h", null);
  assert.deepEqual(decision, { desiredEstimate: 2 * HOUR, kind: "explicit" });
});

test("the cleaned title still matches the raw explicit-title intent", () => {
  assert.equal(
    normalizeTitleForMatch("Watch the 10 hour marathon ~20m"),
    normalizeTitleForMatch("Watch the 10 hour marathon"),
  );
});

test("accepting Marvin's autocomplete cannot replace an explicit intent with a bare one", () => {
  const inputInstance = {};
  const runtime = {
    inputExplicitIntents: new WeakMap(),
    pendingIntents: [] as Array<{ desiredEstimate: number; kind: string }>,
    stats: createStats(),
    trustedEstimates: {},
  };
  const typedRuntime = runtime as unknown as Parameters<typeof addIntent>[0];

  const explicit = addIntent(
    typedRuntime,
    "Watch the 10 hour marathon ~20m",
    { _id: "temp", timeEstimate: 0 },
    "first Enter",
    inputInstance,
  );
  const afterAutocomplete = addIntent(
    typedRuntime,
    "Watch the 10 hour marathon",
    { _id: "temp", timeEstimate: 0 },
    "second Enter",
    inputInstance,
  );

  assert.equal(afterAutocomplete, explicit);
  assert.equal(runtime.pendingIntents.length, 1);
  assert.equal(runtime.pendingIntents[0]!.kind, "explicit");
  assert.equal(runtime.pendingIntents[0]!.desiredEstimate, 20 * MINUTE);
});

test("a cleaned inline task update cannot override its matching explicit duration edit", () => {
  const inputInstance = {};
  const runtime = {
    inputExplicitIntents: new WeakMap(),
    pendingIntents: [] as Array<{ desiredEstimate: number; kind: string }>,
    stats: createStats(),
    trustedEstimates: {
      "task-1": { value: 0, updatedAt: Date.now(), source: "test" },
    },
  };
  const typedRuntime = runtime as unknown as Parameters<typeof addIntent>[0];
  const task = {
    _id: "task-1",
    title: "8:00am Watch the 10 hour marathon",
    timeEstimate: 0,
  };

  const explicit = addIntent(
    typedRuntime,
    "8:00am Watch the 10 hour marathon ~20m",
    task,
    "keydown:Enter",
    inputInstance,
  );
  const cleanedUpdate = addIntent(
    typedRuntime,
    "8:00am Watch the 10 hour marathon",
    task,
    "Task.updateTask",
  );

  assert.equal(cleanedUpdate, explicit);
  assert.equal(runtime.pendingIntents.length, 1);
  assert.equal(runtime.pendingIntents[0]!.kind, "explicit");
  assert.equal(runtime.pendingIntents[0]!.desiredEstimate, 20 * MINUTE);
});

test("a same-title explicit edit can be applied even when Marvin skips the title save", () => {
  const intent = {
    expectedTitle: normalizeTitleForMatch("8:00am Watch the 10 hour marathon ~20m"),
    kind: "explicit",
    taskId: "task-1",
  };

  assert.equal(
    explicitIntentMatchesCurrentTitle(intent, {
      _id: "task-1",
      title: "8:00am Watch the 10 hour marathon",
    }),
    true,
  );
  assert.equal(
    explicitIntentMatchesCurrentTitle(intent, {
      _id: "task-1",
      title: "8:00am Watch a different marathon",
    }),
    false,
  );
});

test("observing a task input does not replace Marvin's submit or blur methods", () => {
  const submit = () => "submitted";
  const blur = () => "blurred";
  const instance = {
    blur,
    getTask() {},
    state: { value: "Test #systems" },
    submit,
  };
  const input = {
    __reactFiber$test: { stateNode: instance, return: null },
    matches: () => true,
  };
  const runtime = {
    patchedInputs: new Set(),
    stats: createStats(),
  };

  assert.equal(
    patchTaskInput(
      input as unknown as Parameters<typeof patchTaskInput>[0],
      runtime as unknown as Parameters<typeof patchTaskInput>[1],
    ),
    true,
  );
  assert.equal(instance.submit, submit);
  assert.equal(instance.blur, blur);
});

test("observing a task does not replace Marvin's metadata update method", () => {
  const updateTask = async () => "updated";
  const instance = { props: { task: { _id: "task-1" } }, updateTask };
  const runtime = {
    patchedTasks: new Set(),
    stats: createStats(),
  };

  assert.equal(
    patchTaskInstance(
      instance as unknown as Parameters<typeof patchTaskInstance>[0],
      runtime as unknown as Parameters<typeof patchTaskInstance>[1],
    ),
    true,
  );
  assert.equal(instance.updateTask, updateTask);
});

test("new tasks with a bare phrase are corrected to no estimate", () => {
  const decision = computeDesiredEstimate("Watch the 10 hour marathon", { _id: "temp", timeEstimate: 0 });
  assert.deepEqual(decision, { desiredEstimate: 0, kind: "bare-new-task" });
});

test("a second rename is corrected again after the first correction", () => {
  const afterFirstCorrection = {
    _id: "task-1",
    title: "Watch the 10 hour marathon",
    timeEstimate: 0,
  };
  const decision = computeDesiredEstimate(
    "Watch the 10 hour marathon with John",
    afterFirstCorrection,
    0,
  );
  assert.deepEqual(decision, { desiredEstimate: 0, kind: "bare-preserve-trusted" });
});

test("manual estimates survive later title edits", () => {
  const before = {
    _id: "task-2",
    title: "Watch a marathon",
    timeEstimate: 45 * MINUTE,
  };
  const decision = computeDesiredEstimate("Watch the 10 hour marathon", before, 45 * MINUTE);
  assert.deepEqual(decision, { desiredEstimate: 45 * MINUTE, kind: "bare-preserve-trusted" });
});

test("an old inferred estimate is not mistaken for a manual estimate", () => {
  const before = {
    _id: "task-3",
    title: "Watch the 10 hour marathon",
    timeEstimate: 10 * HOUR,
  };
  assert.equal(estimateWasProbablyInferred(before), true);
  assert.deepEqual(
    computeDesiredEstimate("Watch the 10 hour marathon with John", before),
    { desiredEstimate: 0, kind: "bare-replace-inferred" },
  );
});

test("explicit syntax is removed when matching Marvin's cleaned title", () => {
  assert.equal(stripExplicitDurationSyntax("Watch the 10 hour marathon ~2h"), "Watch the 10 hour marathon ");
  assert.equal(
    normalizeTitleForMatch("10:00pm Watch the 10 hour marathon ~2h"),
    "watch the 10 hour marathon",
  );
});

test("unrelated titles cannot match an explicit-duration intent", () => {
  assert.notEqual(
    normalizeTitleForMatch("AME-DURATION-FIX-02 Watch the 10 hour marathon"),
    normalizeTitleForMatch("Review the weekly systems-maintenance checklist"),
  );
});
