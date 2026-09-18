const test = require("node:test");
const assert = require("node:assert/strict");

const {
  RETRY_DELAYS_MS,
  createSafeAddDeleter,
  createStats,
  findTaskInputInstance,
  hasPendingMention,
  patchTaskInput,
} = require("../src/page/autocomplete-cleanup.js");

function makeSchedulers() {
  const microtasks = [];
  const timeouts = [];

  return {
    microtasks,
    timeouts,
    queueMicrotask(callback) {
      microtasks.push(callback);
    },
    setTimeout(callback, delay) {
      timeouts.push({ callback, delay });
    },
  };
}

function makeMarvinDeleter(instance, marker, addTrailingSpace = true) {
  return () => {
    let value = instance.state.value;
    const index = value.lastIndexOf(marker);
    value = `${value.slice(0, index)}${value.slice(index + marker.length)}`.trim();
    if (addTrailingSpace) value = `${value} `;
    instance.state.value = value;
    return value;
  };
}

test("recognizes Marvin's temporary task-input mention markup", () => {
  assert.equal(hasPendingMention("Task@@@[Today](_DATExx2026-08-27xxToday)"), true);
  assert.equal(hasPendingMention("Task #health"), false);
  assert.equal(hasPendingMention(""), false);
});
test("runs cleanup synchronously when the marker is already present", () => {
  const stats = createStats();
  const schedulers = makeSchedulers();
  const marker = "@@@[Today](_DATExx2026-08-27xxToday)";
  const instance = {
    props: {},
    state: { value: `Task${marker}` },
  };
  const safeAddDeleter = createSafeAddDeleter(stats, schedulers);

  safeAddDeleter.call(instance, makeMarvinDeleter(instance, marker));

  assert.equal(instance.state.value, "Task ");
  assert.equal(stats.deletionsImmediate, 1);
  assert.equal(schedulers.microtasks.length, 0);
  assert.equal(schedulers.timeouts.length, 0);
});

test("respects Marvin inputs that intentionally disable deletion", () => {
  const stats = createStats();
  const schedulers = makeSchedulers();
  const instance = {
    props: { noDeletes: true },
    state: { value: "Task@@@[Today](today)" },
  };
  let calls = 0;

  createSafeAddDeleter(stats, schedulers).call(instance, () => {
    calls += 1;
  });

  assert.equal(calls, 0);
  assert.equal(stats.skippedNoDeletes, 1);
  assert.equal(schedulers.microtasks.length, 0);
});

test("waits for a marker that has not reached React state yet", () => {
  const stats = createStats();
  const schedulers = makeSchedulers();
  const marker = "@@@[Health](health-id)";
  const instance = { props: {}, state: { value: "Task" } };
  let calls = 0;
  const safeAddDeleter = createSafeAddDeleter(stats, schedulers);

  safeAddDeleter.call(instance, () => {
    calls += 1;
    instance.state.value = "Task";
  });
  instance.state.value = `Task${marker}`;
  schedulers.microtasks.shift()();

  assert.equal(calls, 1);
  assert.equal(stats.retriesScheduled, 1);
  assert.equal(stats.deletionsRetried, 1);
  assert.equal(schedulers.timeouts.length, 0);
});

test("never invokes Marvin's unsafe deleter when its marker never appears", () => {
  const stats = createStats();
  const schedulers = makeSchedulers();
  const instance = { props: {}, state: { value: "" } };
  let calls = 0;
  const safeAddDeleter = createSafeAddDeleter(stats, schedulers);

  safeAddDeleter.call(instance, () => {
    calls += 1;
  });
  schedulers.microtasks.shift()();
  while (schedulers.timeouts.length > 0) {
    schedulers.timeouts.shift().callback();
  }

  assert.equal(calls, 0);
  assert.equal(stats.abandoned, 1);
  assert.equal(stats.errors, 0);
  assert.equal(RETRY_DELAYS_MS.length, 8);
});

test("eliminates the rapid double-Enter submit race", () => {
  const marker = "@@@[Today](_DATExx2026-08-27xxToday)";

  const broken = { props: {}, state: { value: `Task${marker}` } };
  const delayed = [];
  delayed.push(makeMarvinDeleter(broken, marker));
  const brokenStoredTitle = broken.state.value;
  broken.state.value = "";
  delayed.shift()();

  assert.equal(brokenStoredTitle, `Task${marker}`);
  assert.equal(broken.state.value, " ");

  const fixed = { props: {}, state: { value: `Task${marker}` } };
  const stats = createStats();
  createSafeAddDeleter(stats, makeSchedulers()).call(
    fixed,
    makeMarvinDeleter(fixed, marker),
  );
  const fixedStoredTitle = fixed.state.value.trim();
  fixed.state.value = "";

  assert.equal(fixedStoredTitle, "Task");
  assert.equal(fixed.state.value, "");
  assert.equal(stats.deletionsImmediate, 1);
});

test("finds and patches a TaskInput React class instance once", () => {
  const instance = {
    props: {},
    state: { value: "" },
    addDeleter() {},
  };
  const input = {
    __reactFiber$test: {
      stateNode: null,
      return: { stateNode: instance, return: null },
    },
    matches(selector) {
      return selector === ".TaskInput__input";
    },
  };
  const runtime = {
    patchedInstances: new WeakSet(),
    seenInputs: new WeakSet(),
    stats: createStats(),
  };

  assert.equal(findTaskInputInstance(input), instance);
  assert.equal(patchTaskInput(input, runtime), true);
  const patchedMethod = instance.addDeleter;
  assert.equal(patchTaskInput(input, runtime), true);
  assert.equal(instance.addDeleter, patchedMethod);
  assert.equal(runtime.stats.inputsSeen, 1);
  assert.equal(runtime.stats.instancesPatched, 1);
});
