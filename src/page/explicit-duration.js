// ==UserScript==
// @name         Amazing Marvin - Explicit Duration Estimates Only
// @namespace    https://app.amazingmarvin.com/
// @version      0.1.2
// @description  Prevents prose such as "10 hour marathon" from becoming a duration; use ~2h, ca. 2h, or Marvin's duration control explicitly.
// @author       Raj Piskala
// @match        https://app.amazingmarvin.com/*
// @match        https://amazingmarvin.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function bootstrap(root, factory) {
  "use strict";

  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (!root?.document) return;
  if (root.AMMarvinExplicitDurationFix?.installed) return;

  root.AMMarvinExplicitDurationFix = api.install(root.document);
})(typeof window === "undefined" ? globalThis : window, function createApi() {
  "use strict";

  const VERSION = "0.1.2";
  const TASK_INPUT_SELECTOR = ".TaskInput__input";
  const TASK_ROW_SELECTOR = '[data-item-type="task"][data-item-id]';
  const TRUSTED_ESTIMATES_KEY = "amExplicitDurationFix.trustedEstimates.v1";
  const INTENT_TTL_MS = 12_000;
  const PARSER_GUARD_MS = 3_000;
  const SCAN_INTERVAL_MS = 350;
  const DATABASE_POLL_INTERVAL_MS = 500;
  const CORRECTION_DELAY_MS = 80;
  const EXPLICIT_NO_TITLE_CHANGE_DELAY_MS = 650;
  const MAX_TRUSTED_ESTIMATES = 1_000;

  const NUMBER_WORDS = Object.freeze({
    zero: 0,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
    thirteen: 13,
    fourteen: 14,
    fifteen: 15,
    sixteen: 16,
    seventeen: 17,
    eighteen: 18,
    nineteen: 19,
    twenty: 20,
    thirty: 30,
    forty: 40,
    fifty: 50,
    sixty: 60,
    seventy: 70,
    eighty: 80,
    ninety: 90,
  });

  const AMOUNT_SOURCE = `(?:\\d+(?:\\.\\d+)?|${Object.keys(NUMBER_WORDS).join("|")})`;
  const UNIT_SOURCE = "(?:hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)";
  const DURATION_TOKEN_AT_START = new RegExp(`^\\s*(${AMOUNT_SOURCE})\\s*(${UNIT_SOURCE})\\b`, "i");
  const DURATION_TOKEN_GLOBAL = new RegExp(`\\b(${AMOUNT_SOURCE})\\s*(${UNIT_SOURCE})\\b`, "gi");
  const EXPLICIT_MARKER_GLOBAL = /(?:^|[\s(])(?:~|ca\.?)\s*/gi;

  function normalizeEstimate(value) {
    const estimate = Number(value);
    return Number.isFinite(estimate) && estimate > 0 ? Math.round(estimate) : 0;
  }

  function parseAmount(value) {
    if (/^\d/i.test(value)) return Number(value);
    return NUMBER_WORDS[String(value).toLowerCase()] ?? NaN;
  }

  function durationMillis(amountText, unitText) {
    const amount = parseAmount(amountText);
    if (!Number.isFinite(amount) || amount <= 0) return 0;

    const unit = String(unitText).toLowerCase();
    const multiplier = unit.startsWith("h") ? 60 * 60 * 1000 : unit.startsWith("s") ? 1000 : 60 * 1000;
    return Math.round(amount * multiplier);
  }

  function parseExplicitDuration(text) {
    const source = String(text || "");
    const spans = [];
    let millis = 0;
    let marker;

    EXPLICIT_MARKER_GLOBAL.lastIndex = 0;
    while ((marker = EXPLICIT_MARKER_GLOBAL.exec(source))) {
      let cursor = marker.index + marker[0].length;
      let markerMillis = 0;
      let tokenCount = 0;

      while (cursor < source.length) {
        const token = DURATION_TOKEN_AT_START.exec(source.slice(cursor));
        if (!token) break;

        const value = durationMillis(token[1], token[2]);
        if (!value) break;

        markerMillis += value;
        tokenCount += 1;
        cursor += token[0].length;
      }

      if (tokenCount > 0) {
        millis += markerMillis;
        spans.push({ start: marker.index, end: cursor });
        EXPLICIT_MARKER_GLOBAL.lastIndex = cursor;
      }
    }

    return millis > 0 ? { millis, spans } : null;
  }

  function hasExplicitMarkerImmediatelyBefore(source, index) {
    const prefix = source.slice(Math.max(0, index - 12), index);
    return /(?:~|ca\.?)\s*$/i.test(prefix);
  }

  function parseBareDuration(text) {
    const source = String(text || "");
    let millis = 0;
    let match;

    DURATION_TOKEN_GLOBAL.lastIndex = 0;
    while ((match = DURATION_TOKEN_GLOBAL.exec(source))) {
      if (hasExplicitMarkerImmediatelyBefore(source, match.index)) continue;
      millis += durationMillis(match[1], match[2]);
    }

    return millis;
  }

  function stripExplicitDurationSyntax(text) {
    const source = String(text || "");
    const explicit = parseExplicitDuration(source);
    if (!explicit) return source;

    let result = source;
    for (const span of [...explicit.spans].sort((a, b) => b.start - a.start)) {
      result = `${result.slice(0, span.start)} ${result.slice(span.end)}`;
    }
    return result;
  }

  function normalizeTitleForMatch(text) {
    return stripExplicitDurationSyntax(text)
      .replace(/^\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)\b\s*/i, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function snapshotTask(task) {
    if (!task || typeof task !== "object") return null;
    return {
      _id: task._id || taskIdFromDoc(task),
      createdAt: task.createdAt,
      title: String(task.title || ""),
      timeEstimate: normalizeEstimate(task.timeEstimate),
      updatedAt: task.updatedAt,
    };
  }

  function taskIdFromDoc(task) {
    if (task?._id) return task._id;
    return String(task?._doc_id_rev || "").split("::")[0] || null;
  }

  function looksLikeMarvinTask(task) {
    return Boolean(task && !task._deleted && task.db === "Tasks" && taskIdFromDoc(task) && typeof task.title === "string");
  }

  function estimateWasProbablyInferred(task) {
    const estimate = normalizeEstimate(task?.timeEstimate);
    const inferred = parseBareDuration(task?.title);
    return inferred > 0 && estimate === inferred;
  }

  function computeDesiredEstimate(rawTitle, beforeTask, trustedEstimate) {
    const explicit = parseExplicitDuration(rawTitle);
    if (explicit) {
      return {
        desiredEstimate: explicit.millis,
        kind: "explicit",
      };
    }

    const bare = parseBareDuration(rawTitle);
    if (!bare) return null;

    if (trustedEstimate !== undefined) {
      return {
        desiredEstimate: normalizeEstimate(trustedEstimate),
        kind: "bare-preserve-trusted",
      };
    }

    if (!beforeTask || beforeTask._id === "temp") {
      return {
        desiredEstimate: 0,
        kind: "bare-new-task",
      };
    }

    return {
      desiredEstimate: estimateWasProbablyInferred(beforeTask) ? 0 : normalizeEstimate(beforeTask.timeEstimate),
      kind: estimateWasProbablyInferred(beforeTask) ? "bare-replace-inferred" : "bare-preserve-existing",
    };
  }

  function findReactFiber(element) {
    if (!element || typeof element !== "object") return null;
    const key = Object.keys(element).find(
      (name) => name.startsWith("__reactFiber$") || name.startsWith("__reactInternalInstance$"),
    );
    return key ? element[key] : null;
  }

  function findTaskInputInstance(input) {
    let fiber = findReactFiber(input);
    let depth = 0;

    while (fiber && depth < 80) {
      const instance = fiber.stateNode;
      if (
        instance &&
        typeof instance === "object" &&
        typeof instance.getTask === "function" &&
        typeof instance.submit === "function" &&
        instance.state &&
        typeof instance.state.value === "string"
      ) {
        return instance;
      }
      fiber = fiber.return;
      depth += 1;
    }

    return null;
  }

  function findTaskInstance(row) {
    const itemId = row?.getAttribute?.("data-item-id");
    const starts = [row, ...Array.from(row?.querySelectorAll?.("*") || []).slice(0, 20)];

    for (const start of starts) {
      let fiber = findReactFiber(start);
      let depth = 0;

      while (fiber && depth < 80) {
        const instance = fiber.stateNode;
        if (
          instance &&
          typeof instance === "object" &&
          typeof instance.updateTask === "function" &&
          instance.props?.task &&
          (!itemId || instance.props.task._id === itemId)
        ) {
          return instance;
        }
        fiber = fiber.return;
        depth += 1;
      }
    }

    return null;
  }

  function createStats() {
    return {
      inputsPatched: 0,
      taskInstancesPatched: 0,
      intentsRecorded: 0,
      correctionsRequested: 0,
      correctionsApplied: 0,
      correctionsSkippedStale: 0,
      databaseTaskChangesSeen: 0,
      manualEstimatesRemembered: 0,
      errors: 0,
    };
  }

  function loadTrustedEstimates(windowObject) {
    try {
      const parsed = JSON.parse(windowObject.localStorage.getItem(TRUSTED_ESTIMATES_KEY) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function saveTrustedEstimates(runtime) {
    try {
      const entries = Object.entries(runtime.trustedEstimates)
        .sort(([, a], [, b]) => Number(b?.updatedAt || 0) - Number(a?.updatedAt || 0))
        .slice(0, MAX_TRUSTED_ESTIMATES);
      runtime.trustedEstimates = Object.fromEntries(entries);
      runtime.window.localStorage.setItem(TRUSTED_ESTIMATES_KEY, JSON.stringify(runtime.trustedEstimates));
    } catch (error) {
      runtime.stats.errors += 1;
      console.warn("[Marvin explicit-duration fix] Could not persist a trusted duration.", error);
    }
  }

  function trustedEstimateFor(runtime, taskId) {
    const entry = taskId ? runtime.trustedEstimates[taskId] : null;
    return entry && Number.isFinite(Number(entry.value)) ? normalizeEstimate(entry.value) : undefined;
  }

  function rememberTrustedEstimate(runtime, taskId, value, source) {
    if (!taskId || taskId === "temp") return;

    runtime.trustedEstimates[taskId] = {
      source,
      updatedAt: Date.now(),
      value: normalizeEstimate(value),
    };
    runtime.stats.manualEstimatesRemembered += 1;
    saveTrustedEstimates(runtime);
  }

  function pruneIntents(runtime, now = Date.now()) {
    runtime.pendingIntents = runtime.pendingIntents.filter((intent) => now - intent.recordedAt <= INTENT_TTL_MS);
  }

  function explicitIntentMatchesCurrentTitle(intent, task) {
    return Boolean(
      intent?.kind === "explicit" &&
        intent.taskId &&
        task?._id === intent.taskId &&
        normalizeTitleForMatch(task.title) === intent.expectedTitle,
    );
  }

  function scheduleExplicitWithoutTitleChange(runtime, intent) {
    if (
      !intent?.taskId ||
      intent.kind !== "explicit" ||
      !runtime.explicitFallbackTimers ||
      !runtime.taskSnapshots ||
      !runtime.window?.setTimeout
    ) {
      return;
    }

    const earlierTimer = runtime.explicitFallbackTimers.get(intent.taskId);
    if (earlierTimer != null) runtime.window.clearTimeout(earlierTimer);

    const timer = runtime.window.setTimeout(() => {
      runtime.explicitFallbackTimers.delete(intent.taskId);
      if (!runtime.pendingIntents.includes(intent)) return;

      const currentTask = runtime.taskSnapshots.get(intent.taskId) || intent.beforeTask;
      if (!explicitIntentMatchesCurrentTitle(intent, currentTask)) return;

      runtime.pendingIntents = runtime.pendingIntents.filter((candidate) => candidate !== intent);
      if (intent.inputInstance) runtime.inputExplicitIntents.delete(intent.inputInstance);
      const decision = {
        desiredEstimate: intent.desiredEstimate,
        kind: "explicit-without-title-change",
      };
      armParserGuard(runtime, currentTask, decision);
      void applyCorrection(runtime, currentTask, null, decision);
    }, EXPLICIT_NO_TITLE_CHANGE_DELAY_MS);

    runtime.explicitFallbackTimers.set(intent.taskId, timer);
  }

  function addIntent(runtime, rawTitle, task, source, inputInstance = null) {
    const title = String(rawTitle || "").trim();
    const beforeTask = snapshotTask(task);
    const taskId = beforeTask?._id && beforeTask._id !== "temp" ? beforeTask._id : null;
    const trusted = trustedEstimateFor(runtime, taskId);
    const decision = computeDesiredEstimate(title, beforeTask, trusted);
    if (!decision) return null;

    const now = Date.now();
    pruneIntents(runtime, now);
    const expectedTitle = normalizeTitleForMatch(title);

    const inputExplicit = inputInstance ? runtime.inputExplicitIntents.get(inputInstance) : null;
    const matchingExplicit = [...runtime.pendingIntents].reverse().find(
      (intent) =>
        intent.kind === "explicit" &&
        intent.expectedTitle === expectedTitle &&
        (intent.taskId === taskId ||
          (inputInstance && intent.inputInstance === inputInstance) ||
          (!intent.taskId && taskId && now - intent.recordedAt < 1_500)),
    );
    const earlierExplicit = inputExplicit || matchingExplicit;
    if (
      earlierExplicit &&
      runtime.pendingIntents.includes(earlierExplicit) &&
      earlierExplicit.kind === "explicit" &&
      decision.kind !== "explicit" &&
      earlierExplicit.expectedTitle === expectedTitle
    ) {
      earlierExplicit.recordedAt = now;
      earlierExplicit.source = `${earlierExplicit.source} -> ${source}`;
      if (!earlierExplicit.taskId && taskId) earlierExplicit.taskId = taskId;
      scheduleExplicitWithoutTitleChange(runtime, earlierExplicit);
      return earlierExplicit;
    }

    const duplicate = [...runtime.pendingIntents].reverse().find(
      (intent) =>
        intent.taskId === taskId &&
        intent.rawTitle === title &&
        now - intent.recordedAt < 750,
    );
    if (duplicate) {
      if (duplicate.kind !== "explicit" || decision.kind === "explicit") {
        duplicate.beforeTask = beforeTask;
        duplicate.desiredEstimate = decision.desiredEstimate;
        duplicate.kind = decision.kind;
        duplicate.recordedAt = now;
        duplicate.source = source;
      }
      scheduleExplicitWithoutTitleChange(runtime, duplicate);
      return duplicate;
    }

    const intent = {
      beforeTask,
      desiredEstimate: decision.desiredEstimate,
      expectedTitle,
      kind: decision.kind,
      rawTitle: title,
      recordedAt: now,
      source,
      taskId,
      inputInstance,
    };
    runtime.pendingIntents.push(intent);
    if (inputInstance && decision.kind === "explicit") {
      runtime.inputExplicitIntents.set(inputInstance, intent);
    }
    runtime.stats.intentsRecorded += 1;
    scheduleExplicitWithoutTitleChange(runtime, intent);
    return intent;
  }

  function findIntent(runtime, task, allowUntargeted) {
    const now = Date.now();
    pruneIntents(runtime, now);
    const taskId = taskIdFromDoc(task);
    const normalizedTitle = normalizeTitleForMatch(task?.title);

    let index = -1;
    for (let i = runtime.pendingIntents.length - 1; i >= 0; i -= 1) {
      if (runtime.pendingIntents[i].taskId === taskId) {
        index = i;
        break;
      }
    }

    if (index < 0 && allowUntargeted) {
      for (let i = runtime.pendingIntents.length - 1; i >= 0; i -= 1) {
        const intent = runtime.pendingIntents[i];
        if (!intent.taskId && intent.expectedTitle === normalizedTitle) {
          index = i;
          break;
        }
      }
    }

    if (index < 0) return null;
    const intent = runtime.pendingIntents.splice(index, 1)[0];
    if (intent.inputInstance) runtime.inputExplicitIntents.delete(intent.inputInstance);
    return intent;
  }

  function taskInputTask(instance) {
    return instance?.props?.task || null;
  }

  function recordTaskInputIntent(runtime, input, source) {
    const instance = findTaskInputInstance(input);
    if (!instance) return null;
    return addIntent(runtime, instance.state?.value ?? input.value, taskInputTask(instance), source, instance);
  }

  function patchTaskInput(input, runtime) {
    if (!input?.matches?.(TASK_INPUT_SELECTOR)) return false;
    const instance = findTaskInputInstance(input);
    if (!instance) return false;
    if (runtime.patchedInputs.has(instance)) return true;

    // Do not wrap TaskInput.submit or TaskInput.blur. Marvin uses those method
    // identities while committing metadata such as categories. Capture-phase
    // keydown/focusout listeners below see the raw title early enough without
    // mutating Marvin's input component.
    runtime.patchedInputs.add(instance);
    runtime.stats.inputsPatched += 1;
    return true;
  }

  function patchTaskInstance(instance, runtime) {
    if (!instance || typeof instance.updateTask !== "function") return false;
    if (runtime.patchedTasks.has(instance)) return true;

    // Observing the instance is enough to reuse Marvin's updater later. Do not
    // replace updateTask: Marvin also routes category, label, date, and other
    // metadata commits through this method and relies on its original identity.
    runtime.patchedTasks.add(instance);
    runtime.stats.taskInstancesPatched += 1;
    return true;
  }

  function currentTaskInstance(runtime, taskId) {
    for (const row of runtime.document.querySelectorAll(TASK_ROW_SELECTOR)) {
      if (row.getAttribute("data-item-id") !== taskId) continue;
      const instance = findTaskInstance(row);
      if (instance) return instance;
    }
    return null;
  }

  function createSurrogateTaskInstance(runtime, task) {
    const template = runtime.updaterTemplate;
    const taskId = taskIdFromDoc(task);
    if (!template || !taskId) return null;

    try {
      return new template.constructor({
        ...template.props,
        onMogrify: null,
        onUpdate: "default",
        task: {
          ...task,
          _id: taskId,
        },
      });
    } catch (error) {
      runtime.stats.errors += 1;
      console.warn("[Marvin explicit-duration fix] Could not create an off-screen task updater.", error);
      return null;
    }
  }

  async function applyCorrection(runtime, task, instance, decision) {
    const taskId = taskIdFromDoc(task);
    if (!taskId || runtime.correctionsInFlight.has(taskId)) return;

    const desired = normalizeEstimate(decision.desiredEstimate);
    if (normalizeEstimate(task.timeEstimate) === desired) {
      rememberTrustedEstimate(runtime, taskId, desired, decision.kind);
      return;
    }

    runtime.correctionsInFlight.add(taskId);
    runtime.stats.correctionsRequested += 1;

    try {
      await new Promise((resolve) => runtime.window.setTimeout(resolve, CORRECTION_DELAY_MS));
      const target = currentTaskInstance(runtime, taskId) || instance || createSurrogateTaskInstance(runtime, task);
      const currentTask = snapshotTask(target?.props?.task);

      if (!target || !currentTask || currentTask._id !== taskId) {
        throw new Error(`Could not find a live Marvin updater for task ${taskId}.`);
      }

      if (currentTask.title !== task.title) {
        runtime.stats.correctionsSkippedStale += 1;
        return;
      }

      if (normalizeEstimate(currentTask.timeEstimate) === desired) {
        rememberTrustedEstimate(runtime, taskId, desired, decision.kind);
        return;
      }

      rememberTrustedEstimate(runtime, taskId, desired, decision.kind);
      await target.updateTask({ timeEstimate: desired });
      runtime.stats.correctionsApplied += 1;
      console.info("[Marvin explicit-duration fix] Corrected duration.", {
        desiredEstimate: desired,
        kind: decision.kind,
        taskId,
        title: task.title,
      });
    } catch (error) {
      runtime.stats.errors += 1;
      console.error("[Marvin explicit-duration fix] Could not correct duration.", error);
    } finally {
      runtime.correctionsInFlight.delete(taskId);
      runtime.scheduleScan(60);
    }
  }

  function armParserGuard(runtime, task, decision) {
    const taskId = taskIdFromDoc(task);
    if (!taskId || !decision || parseBareDuration(task?.title) <= 0) return;

    runtime.parserGuards.set(taskId, {
      desiredEstimate: normalizeEstimate(decision.desiredEstimate),
      expectedTitle: normalizeTitleForMatch(task.title),
      until: Date.now() + PARSER_GUARD_MS,
    });
  }

  function activeParserGuard(runtime, task) {
    const taskId = taskIdFromDoc(task);
    const guard = taskId ? runtime.parserGuards.get(taskId) : null;
    if (!guard) return null;
    if (guard.until < Date.now()) {
      runtime.parserGuards.delete(taskId);
      return null;
    }
    return guard.expectedTitle === normalizeTitleForMatch(task.title) ? guard : null;
  }

  function pruneParserGuards(runtime, now = Date.now()) {
    for (const [taskId, guard] of runtime.parserGuards) {
      if (guard.until < now) runtime.parserGuards.delete(taskId);
    }
  }

  function processTaskChange(runtime, task, beforeTask, instance, isNew) {
    const taskId = taskIdFromDoc(task);
    const titleChanged = Boolean(beforeTask && beforeTask.title !== task.title);
    const estimateChanged = Boolean(beforeTask && beforeTask.timeEstimate !== normalizeEstimate(task.timeEstimate));

    if (!isNew && !titleChanged && estimateChanged && !runtime.correctionsInFlight.has(taskId)) {
      const bare = parseBareDuration(task.title);
      const currentEstimate = normalizeEstimate(task.timeEstimate);
      const guard = activeParserGuard(runtime, task);

      if (
        bare > 0 &&
        guard &&
        currentEstimate === bare &&
        currentEstimate !== guard.desiredEstimate
      ) {
        void applyCorrection(runtime, task, instance, {
          desiredEstimate: guard.desiredEstimate,
          kind: "remove-guarded-late-inferred-duration",
        });
      } else {
        rememberTrustedEstimate(runtime, taskId, task.timeEstimate, "observed manual duration change");
      }
      return;
    }

    if (!isNew && !titleChanged) return;

    const intent = findIntent(runtime, task, isNew);
    if (isNew && !intent) {
      const bare = parseBareDuration(task.title);
      const currentEstimate = normalizeEstimate(task.timeEstimate);
      if (bare > 0 && currentEstimate !== bare) {
        rememberTrustedEstimate(runtime, taskId, currentEstimate, "observed existing explicit/manual duration");
      }
      return;
    }

    const rawTitle = intent?.rawTitle || task.title;
    const baseline = intent?.beforeTask || beforeTask;
    const trusted = trustedEstimateFor(runtime, taskId);
    const decision = intent
      ? { desiredEstimate: intent.desiredEstimate, kind: intent.kind }
      : computeDesiredEstimate(rawTitle, baseline, trusted);

    if (!decision) return;
    armParserGuard(runtime, task, decision);
    void applyCorrection(runtime, task, instance, decision);
  }

  function observeTask(runtime, taskValue, instance, initial = false) {
    const task = snapshotTask(taskValue);
    const taskId = task?._id;
    if (!task || !taskId) return;

    const beforeTask = runtime.taskSnapshots.get(taskId) || null;
    runtime.taskSnapshots.set(taskId, task);

    if (initial && !beforeTask) return;
    if (!beforeTask) {
      processTaskChange(runtime, task, null, instance, true);
      return;
    }

    if (
      beforeTask.title !== task.title ||
      beforeTask.timeEstimate !== task.timeEstimate ||
      beforeTask.updatedAt !== task.updatedAt
    ) {
      processTaskChange(runtime, task, beforeTask, instance, false);
    }
  }

  function scanDocument(runtime, initial = false) {
    runtime.scanTimer = null;
    pruneParserGuards(runtime);

    runtime.document.querySelectorAll(TASK_INPUT_SELECTOR).forEach((input) => patchTaskInput(input, runtime));

    const seenTaskIds = new Set();
    for (const row of runtime.document.querySelectorAll(TASK_ROW_SELECTOR)) {
      const taskId = row.getAttribute("data-item-id");
      if (!taskId || seenTaskIds.has(taskId)) continue;

      const instance = findTaskInstance(row);
      if (!instance) continue;
      seenTaskIds.add(taskId);
      patchTaskInstance(instance, runtime);
      runtime.updaterTemplate ||= instance;
      observeTask(runtime, instance.props?.task, instance, initial);
    }
  }

  function indexedDbRequest(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function getPouchDbNames(windowObject) {
    if (!windowObject.indexedDB || typeof windowObject.indexedDB.databases !== "function") return [];
    const databases = await windowObject.indexedDB.databases();
    return databases.map((database) => database.name).filter((name) => name?.startsWith("_pouch_"));
  }

  function readLatestSequence(db) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("by-sequence", "readonly");
      const request = transaction.objectStore("by-sequence").openCursor(null, "prev");
      request.onsuccess = (event) => resolve(event.target.result?.key ?? 0);
      request.onerror = () => reject(request.error);
    });
  }

  function readChangesAfter(runtime, db, sequence) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("by-sequence", "readonly");
      const store = transaction.objectStore("by-sequence");
      const range = runtime.window.IDBKeyRange.lowerBound(sequence, true);
      const request = store.openCursor(range, "next");
      const changes = [];

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (!cursor) {
          resolve(changes);
          return;
        }

        changes.push({ key: cursor.key, doc: cursor.value });
        cursor.continue();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async function initializeDatabaseCursors(runtime) {
    const names = await getPouchDbNames(runtime.window);

    for (const name of names) {
      let db;
      try {
        db = await indexedDbRequest(runtime.window.indexedDB.open(name));
        if (!db.objectStoreNames.contains("by-sequence")) continue;
        runtime.databaseSequences.set(name, await readLatestSequence(db));
      } catch (error) {
        runtime.stats.errors += 1;
        console.warn("[Marvin explicit-duration fix] Could not initialize a Marvin database watcher.", name, error);
      } finally {
        db?.close();
      }
    }

    runtime.databaseReady = true;
  }

  async function pollDatabases(runtime) {
    if (!runtime.databaseReady || runtime.databasePollInFlight) return;
    runtime.databasePollInFlight = true;

    try {
      const names = await getPouchDbNames(runtime.window);

      for (const name of names) {
        let db;
        try {
          db = await indexedDbRequest(runtime.window.indexedDB.open(name));
          if (!db.objectStoreNames.contains("by-sequence")) continue;

          if (!runtime.databaseSequences.has(name)) {
            runtime.databaseSequences.set(name, await readLatestSequence(db));
            continue;
          }

          const lastSequence = runtime.databaseSequences.get(name);
          const changes = await readChangesAfter(runtime, db, lastSequence);
          for (const change of changes) {
            runtime.databaseSequences.set(name, change.key);
            if (!looksLikeMarvinTask(change.doc)) continue;
            runtime.stats.databaseTaskChangesSeen += 1;
            observeTask(runtime, { ...change.doc, _id: taskIdFromDoc(change.doc) }, null, false);
          }
        } catch (error) {
          runtime.stats.errors += 1;
          console.warn("[Marvin explicit-duration fix] Marvin database polling failed safely.", name, error);
        } finally {
          db?.close();
        }
      }
    } finally {
      runtime.databasePollInFlight = false;
    }
  }

  function install(documentObject) {
    const windowObject = documentObject.defaultView || globalThis;
    const runtime = {
      correctionsInFlight: new Set(),
      document: documentObject,
      explicitFallbackTimers: new Map(),
      inputExplicitIntents: new WeakMap(),
      patchedInputs: new Set(),
      patchedTasks: new Set(),
      pendingIntents: [],
      parserGuards: new Map(),
      scanTimer: null,
      stats: createStats(),
      taskSnapshots: new Map(),
      trustedEstimates: loadTrustedEstimates(windowObject),
      databasePollInFlight: false,
      databaseReady: false,
      databaseSequences: new Map(),
      updaterTemplate: null,
      window: windowObject,
    };

    runtime.scheduleScan = (delay = 0) => {
      if (runtime.scanTimer != null) return;
      runtime.scanTimer = windowObject.setTimeout(() => scanDocument(runtime, false), delay);
    };

    const handleKeyDown = (event) => {
      if (event.key !== "Enter" && event.key !== "Tab") return;
      const input = event.target?.closest?.(TASK_INPUT_SELECTOR);
      if (input) recordTaskInputIntent(runtime, input, `keydown:${event.key}`);
    };

    const handleFocusOut = (event) => {
      const input = event.target?.closest?.(TASK_INPUT_SELECTOR);
      if (input) recordTaskInputIntent(runtime, input, "focusout");
    };

    const observer = new windowObject.MutationObserver(() => runtime.scheduleScan(20));
    observer.observe(documentObject.documentElement || documentObject, {
      childList: true,
      subtree: true,
    });

    documentObject.addEventListener("keydown", handleKeyDown, true);
    documentObject.addEventListener("focusout", handleFocusOut, true);
    scanDocument(runtime, true);
    void initializeDatabaseCursors(runtime);
    const interval = windowObject.setInterval(() => scanDocument(runtime, false), SCAN_INTERVAL_MS);
    const databaseInterval = windowObject.setInterval(
      () => void pollDatabases(runtime),
      DATABASE_POLL_INTERVAL_MS,
    );

    return {
      installed: true,
      version: VERSION,
      classify(rawTitle, beforeTask, trustedEstimate) {
        return computeDesiredEstimate(rawTitle, beforeTask, trustedEstimate);
      },
      disconnect() {
        observer.disconnect();
        windowObject.clearInterval(interval);
        windowObject.clearInterval(databaseInterval);
        if (runtime.scanTimer != null) windowObject.clearTimeout(runtime.scanTimer);
        documentObject.removeEventListener("keydown", handleKeyDown, true);
        documentObject.removeEventListener("focusout", handleFocusOut, true);
        for (const timer of runtime.explicitFallbackTimers.values()) windowObject.clearTimeout(timer);
        runtime.explicitFallbackTimers.clear();

        runtime.patchedInputs.clear();
        runtime.patchedTasks.clear();
        runtime.parserGuards.clear();
      },
      rescan() {
        scanDocument(runtime, false);
        return this.status();
      },
      status() {
        return {
          installed: true,
          version: VERSION,
          pendingIntents: runtime.pendingIntents.length,
          databaseReady: runtime.databaseReady,
          watchedDatabases: runtime.databaseSequences.size,
          trackedTasks: runtime.taskSnapshots.size,
          trustedEstimates: Object.keys(runtime.trustedEstimates).length,
          ...runtime.stats,
        };
      },
    };
  }

  return {
    CORRECTION_DELAY_MS,
    DATABASE_POLL_INTERVAL_MS,
    INTENT_TTL_MS,
    VERSION,
    addIntent,
    computeDesiredEstimate,
    createStats,
    durationMillis,
    estimateWasProbablyInferred,
    explicitIntentMatchesCurrentTitle,
    findTaskInputInstance,
    findTaskInstance,
    install,
    normalizeEstimate,
    normalizeTitleForMatch,
    patchTaskInput,
    patchTaskInstance,
    parseBareDuration,
    parseExplicitDuration,
    stripExplicitDurationSyntax,
  };
});
