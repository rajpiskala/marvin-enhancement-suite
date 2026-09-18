const VERSION = "0.1.2";

type DecisionKind =
  | "explicit"
  | "explicit-without-title-change"
  | "bare-preserve-trusted"
  | "bare-new-task"
  | "bare-replace-inferred"
  | "bare-preserve-existing"
  | "remove-guarded-late-inferred-duration"
  | string;

export interface MarvinTask {
  [key: string]: unknown;
  _deleted?: boolean;
  _doc_id_rev?: string;
  _id?: string | null;
  createdAt?: unknown;
  db?: string;
  timeEstimate?: unknown;
  title?: string;
  updatedAt?: unknown;
}

export interface TaskSnapshot extends MarvinTask {
  _id: string | null;
  createdAt: unknown;
  title: string;
  timeEstimate: number;
  updatedAt: unknown;
}

export interface DurationDecision {
  desiredEstimate: number;
  kind: DecisionKind;
}

export interface ExplicitDurationSpan {
  start: number;
  end: number;
}

export interface ExplicitDuration {
  millis: number;
  spans: ExplicitDurationSpan[];
}

interface TaskInputInstance {
  blur?: (...args: unknown[]) => unknown;
  getTask: (...args: unknown[]) => unknown;
  props?: { task?: MarvinTask };
  state: { value: string };
  submit: (...args: unknown[]) => unknown;
}

interface TaskInstance {
  props: { task?: MarvinTask; [key: string]: unknown };
  updateTask: (fields: Partial<MarvinTask>) => Promise<unknown> | unknown;
}

interface ReactFiber {
  return?: ReactFiber | null;
  stateNode?: unknown;
}

interface TrustedEstimate {
  source: string;
  updatedAt: number;
  value: number;
}

interface ExplicitIntent {
  beforeTask: TaskSnapshot | null;
  desiredEstimate: number;
  expectedTitle: string;
  inputInstance: object | null;
  kind: DecisionKind;
  rawTitle: string;
  recordedAt: number;
  source: string;
  taskId: string | null;
}

interface ParserGuard {
  desiredEstimate: number;
  expectedTitle: string;
  until: number;
}

export interface ExplicitDurationStats {
  inputsPatched: number;
  taskInstancesPatched: number;
  intentsRecorded: number;
  correctionsRequested: number;
  correctionsApplied: number;
  correctionsSkippedStale: number;
  databaseTaskChangesSeen: number;
  manualEstimatesRemembered: number;
  errors: number;
}

interface ExplicitDurationRuntime {
  correctionsInFlight: Set<string>;
  databasePollInFlight: boolean;
  databaseReady: boolean;
  databaseSequences: Map<string, IDBValidKey>;
  document: Document;
  explicitFallbackTimers: Map<string, number>;
  inputExplicitIntents: WeakMap<object, ExplicitIntent>;
  patchedInputs: Set<TaskInputInstance>;
  patchedTasks: Set<TaskInstance>;
  parserGuards: Map<string, ParserGuard>;
  pendingIntents: ExplicitIntent[];
  scanTimer: number | null;
  scheduleScan: (delay?: number) => void;
  stats: ExplicitDurationStats;
  taskSnapshots: Map<string, TaskSnapshot>;
  trustedEstimates: Record<string, TrustedEstimate>;
  updaterTemplate: TaskInstance | null;
  window: Window;
}

interface PouchChange {
  doc: MarvinTask;
  key: IDBValidKey;
}
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

  function normalizeEstimate(value: unknown): number {
    const estimate = Number(value);
    return Number.isFinite(estimate) && estimate > 0 ? Math.round(estimate) : 0;
  }

  function parseAmount(value: string): number {
    if (/^\d/i.test(value)) return Number(value);
    return (NUMBER_WORDS as Readonly<Record<string, number>>)[String(value).toLowerCase()] ?? Number.NaN;
  }

  function durationMillis(amountText: string, unitText: string): number {
    const amount = parseAmount(amountText);
    if (!Number.isFinite(amount) || amount <= 0) return 0;

    const unit = String(unitText).toLowerCase();
    const multiplier = unit.startsWith("h") ? 60 * 60 * 1000 : unit.startsWith("s") ? 1000 : 60 * 1000;
    return Math.round(amount * multiplier);
  }

  function parseExplicitDuration(text: unknown): ExplicitDuration | null {
    const source = String(text || "");
    const spans: ExplicitDurationSpan[] = [];
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

        const value = durationMillis(token[1]!, token[2]!);
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

  function hasExplicitMarkerImmediatelyBefore(source: string, index: number): boolean {
    const prefix = source.slice(Math.max(0, index - 12), index);
    return /(?:~|ca\.?)\s*$/i.test(prefix);
  }

  function parseBareDuration(text: unknown): number {
    const source = String(text || "");
    let millis = 0;
    let match;

    DURATION_TOKEN_GLOBAL.lastIndex = 0;
    while ((match = DURATION_TOKEN_GLOBAL.exec(source))) {
      if (hasExplicitMarkerImmediatelyBefore(source, match.index)) continue;
      millis += durationMillis(match[1]!, match[2]!);
    }

    return millis;
  }

  function stripExplicitDurationSyntax(text: unknown): string {
    const source = String(text || "");
    const explicit = parseExplicitDuration(source);
    if (!explicit) return source;

    let result = source;
    for (const span of [...explicit.spans].sort((a, b) => b.start - a.start)) {
      result = `${result.slice(0, span.start)} ${result.slice(span.end)}`;
    }
    return result;
  }

  function normalizeTitleForMatch(text: unknown): string {
    return stripExplicitDurationSyntax(text)
      .replace(/^\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)\b\s*/i, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function snapshotTask(task: MarvinTask | null | undefined): TaskSnapshot | null {
    if (!task || typeof task !== "object") return null;
    return {
      _id: task._id || taskIdFromDoc(task),
      createdAt: task.createdAt,
      title: String(task.title || ""),
      timeEstimate: normalizeEstimate(task.timeEstimate),
      updatedAt: task.updatedAt,
    };
  }

  function taskIdFromDoc(task: MarvinTask | TaskSnapshot | null | undefined): string | null {
    if (task?._id) return task._id;
    return String(task?._doc_id_rev || "").split("::")[0] || null;
  }

  function looksLikeMarvinTask(task: unknown): task is MarvinTask {
    if (!task || typeof task !== "object") return false;
    const candidate = task as MarvinTask;
    return Boolean(!candidate._deleted && candidate.db === "Tasks" && taskIdFromDoc(candidate) && typeof candidate.title === "string");
  }

  function estimateWasProbablyInferred(task: MarvinTask | TaskSnapshot | null | undefined): boolean {
    const estimate = normalizeEstimate(task?.timeEstimate);
    const inferred = parseBareDuration(task?.title);
    return inferred > 0 && estimate === inferred;
  }

  function computeDesiredEstimate(
    rawTitle: unknown,
    beforeTask: MarvinTask | TaskSnapshot | null | undefined,
    trustedEstimate?: unknown,
  ): DurationDecision | null {
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

  function findReactFiber(element: unknown): ReactFiber | null {
    if (!element || typeof element !== "object") return null;
    const record = element as Record<string, unknown>;
    const key = Object.keys(record).find(
      (name) => name.startsWith("__reactFiber$") || name.startsWith("__reactInternalInstance$"),
    );
    return key ? record[key] as ReactFiber : null;
  }

  function isTaskInputInstance(value: unknown): value is TaskInputInstance {
    if (!value || typeof value !== "object") return false;
    const instance = value as Partial<TaskInputInstance>;
    return typeof instance.getTask === "function"
      && typeof instance.submit === "function"
      && typeof instance.state?.value === "string";
  }

  function findTaskInputInstance(input: unknown): TaskInputInstance | null {
    let fiber = findReactFiber(input);
    let depth = 0;

    while (fiber && depth < 80) {
      const instance = fiber.stateNode;
      if (
        isTaskInputInstance(instance)
      ) {
        return instance;
      }
      fiber = fiber.return ?? null;
      depth += 1;
    }

    return null;
  }

  function isTaskInstance(value: unknown): value is TaskInstance {
    if (!value || typeof value !== "object") return false;
    const instance = value as Partial<TaskInstance>;
    return typeof instance.updateTask === "function" && Boolean(instance.props?.task);
  }

  function findTaskInstance(row: Element | null | undefined): TaskInstance | null {
    const itemId = row?.getAttribute("data-item-id");
    const starts: Element[] = row ? [row, ...Array.from(row.querySelectorAll("*")).slice(0, 20)] : [];

    for (const start of starts) {
      let fiber = findReactFiber(start);
      let depth = 0;

      while (fiber && depth < 80) {
        const instance = fiber.stateNode;
        if (
          isTaskInstance(instance) &&
          (!itemId || instance.props.task!._id === itemId)
        ) {
          return instance;
        }
        fiber = fiber.return ?? null;
        depth += 1;
      }
    }

    return null;
  }

  function createStats(): ExplicitDurationStats {
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

  function loadTrustedEstimates(windowObject: Window): Record<string, TrustedEstimate> {
    try {
      const parsed = JSON.parse(windowObject.localStorage.getItem(TRUSTED_ESTIMATES_KEY) || "{}");
      return parsed && typeof parsed === "object" ? parsed as Record<string, TrustedEstimate> : {};
    } catch {
      return {};
    }
  }

  function saveTrustedEstimates(runtime: ExplicitDurationRuntime): void {
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

  function trustedEstimateFor(runtime: ExplicitDurationRuntime, taskId: string | null): number | undefined {
    const entry = taskId ? runtime.trustedEstimates[taskId] : null;
    return entry && Number.isFinite(Number(entry.value)) ? normalizeEstimate(entry.value) : undefined;
  }

  function rememberTrustedEstimate(
    runtime: ExplicitDurationRuntime,
    taskId: string | null,
    value: unknown,
    source: string,
  ): void {
    if (!taskId || taskId === "temp") return;

    runtime.trustedEstimates[taskId] = {
      source,
      updatedAt: Date.now(),
      value: normalizeEstimate(value),
    };
    runtime.stats.manualEstimatesRemembered += 1;
    saveTrustedEstimates(runtime);
  }

  function pruneIntents(runtime: ExplicitDurationRuntime, now = Date.now()): void {
    runtime.pendingIntents = runtime.pendingIntents.filter((intent) => now - intent.recordedAt <= INTENT_TTL_MS);
  }

  function explicitIntentMatchesCurrentTitle(
    intent: Pick<ExplicitIntent, "expectedTitle" | "kind" | "taskId"> | null | undefined,
    task: MarvinTask | TaskSnapshot | null | undefined,
  ): boolean {
    return Boolean(
      intent?.kind === "explicit" &&
        intent.taskId &&
        task?._id === intent.taskId &&
        normalizeTitleForMatch(task.title) === intent.expectedTitle,
    );
  }

  function scheduleExplicitWithoutTitleChange(
    runtime: ExplicitDurationRuntime,
    intent: ExplicitIntent | null | undefined,
  ): void {
    if (
      !intent?.taskId ||
      intent.kind !== "explicit" ||
      !runtime.explicitFallbackTimers ||
      !runtime.taskSnapshots ||
      !runtime.window?.setTimeout
    ) {
      return;
    }

    const taskId = intent.taskId;
    const earlierTimer = runtime.explicitFallbackTimers.get(taskId);
    if (earlierTimer != null) runtime.window.clearTimeout(earlierTimer);

    const timer = runtime.window.setTimeout(() => {
      runtime.explicitFallbackTimers.delete(taskId);
      if (!runtime.pendingIntents.includes(intent)) return;

      const currentTask = runtime.taskSnapshots.get(taskId) || intent.beforeTask;
      if (!explicitIntentMatchesCurrentTitle(intent, currentTask)) return;

      runtime.pendingIntents = runtime.pendingIntents.filter((candidate) => candidate !== intent);
      if (intent.inputInstance) runtime.inputExplicitIntents.delete(intent.inputInstance);
      const decision = {
        desiredEstimate: intent.desiredEstimate,
        kind: "explicit-without-title-change",
      };
      if (!currentTask) return;
      armParserGuard(runtime, currentTask, decision);
      void applyCorrection(runtime, currentTask, null, decision);
    }, EXPLICIT_NO_TITLE_CHANGE_DELAY_MS);

    runtime.explicitFallbackTimers.set(taskId, timer);
  }

  function addIntent(
    runtime: ExplicitDurationRuntime,
    rawTitle: unknown,
    task: MarvinTask | TaskSnapshot | null | undefined,
    source: string,
    inputInstance: object | null = null,
  ): ExplicitIntent | null {
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

  function findIntent(
    runtime: ExplicitDurationRuntime,
    task: MarvinTask | TaskSnapshot,
    allowUntargeted: boolean,
  ): ExplicitIntent | null {
    const now = Date.now();
    pruneIntents(runtime, now);
    const taskId = taskIdFromDoc(task);
    const normalizedTitle = normalizeTitleForMatch(task?.title);

    let index = -1;
    for (let i = runtime.pendingIntents.length - 1; i >= 0; i -= 1) {
      if (runtime.pendingIntents[i]?.taskId === taskId) {
        index = i;
        break;
      }
    }

    if (index < 0 && allowUntargeted) {
      for (let i = runtime.pendingIntents.length - 1; i >= 0; i -= 1) {
        const intent = runtime.pendingIntents[i];
        if (intent && !intent.taskId && intent.expectedTitle === normalizedTitle) {
          index = i;
          break;
        }
      }
    }

    if (index < 0) return null;
    const intent = runtime.pendingIntents.splice(index, 1)[0];
    if (!intent) return null;
    if (intent.inputInstance) runtime.inputExplicitIntents.delete(intent.inputInstance);
    return intent;
  }

  function taskInputTask(instance: TaskInputInstance | null | undefined): MarvinTask | null {
    return instance?.props?.task || null;
  }

  function recordTaskInputIntent(runtime: ExplicitDurationRuntime, input: Element, source: string): ExplicitIntent | null {
    const instance = findTaskInputInstance(input);
    if (!instance) return null;
    return addIntent(runtime, instance.state?.value ?? (input as HTMLInputElement).value, taskInputTask(instance), source, instance);
  }

  function patchTaskInput(input: Element, runtime: ExplicitDurationRuntime): boolean {
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

  function patchTaskInstance(instance: TaskInstance | null | undefined, runtime: ExplicitDurationRuntime): boolean {
    if (!instance || typeof instance.updateTask !== "function") return false;
    if (runtime.patchedTasks.has(instance)) return true;

    // Observing the instance is enough to reuse Marvin's updater later. Do not
    // replace updateTask: Marvin also routes category, label, date, and other
    // metadata commits through this method and relies on its original identity.
    runtime.patchedTasks.add(instance);
    runtime.stats.taskInstancesPatched += 1;
    return true;
  }

  function currentTaskInstance(runtime: ExplicitDurationRuntime, taskId: string): TaskInstance | null {
    for (const row of runtime.document.querySelectorAll(TASK_ROW_SELECTOR)) {
      if (row.getAttribute("data-item-id") !== taskId) continue;
      const instance = findTaskInstance(row);
      if (instance) return instance;
    }
    return null;
  }

  function createSurrogateTaskInstance(
    runtime: ExplicitDurationRuntime,
    task: MarvinTask | TaskSnapshot,
  ): TaskInstance | null {
    const template = runtime.updaterTemplate;
    const taskId = taskIdFromDoc(task);
    if (!template || !taskId) return null;

    try {
      const Constructor = template.constructor as unknown as new (props: Record<string, unknown>) => TaskInstance;
      return new Constructor({
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

  async function applyCorrection(
    runtime: ExplicitDurationRuntime,
    task: MarvinTask | TaskSnapshot,
    instance: TaskInstance | null,
    decision: DurationDecision,
  ): Promise<void> {
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

  function armParserGuard(
    runtime: ExplicitDurationRuntime,
    task: MarvinTask | TaskSnapshot,
    decision: DurationDecision | null,
  ): void {
    const taskId = taskIdFromDoc(task);
    if (!taskId || !decision || parseBareDuration(task?.title) <= 0) return;

    runtime.parserGuards.set(taskId, {
      desiredEstimate: normalizeEstimate(decision.desiredEstimate),
      expectedTitle: normalizeTitleForMatch(task.title),
      until: Date.now() + PARSER_GUARD_MS,
    });
  }

  function activeParserGuard(runtime: ExplicitDurationRuntime, task: MarvinTask | TaskSnapshot): ParserGuard | null {
    const taskId = taskIdFromDoc(task);
    const guard = taskId ? runtime.parserGuards.get(taskId) : null;
    if (!guard) return null;
    if (guard.until < Date.now()) {
      if (taskId) runtime.parserGuards.delete(taskId);
      return null;
    }
    return guard.expectedTitle === normalizeTitleForMatch(task.title) ? guard : null;
  }

  function pruneParserGuards(runtime: ExplicitDurationRuntime, now = Date.now()): void {
    for (const [taskId, guard] of runtime.parserGuards) {
      if (guard.until < now) runtime.parserGuards.delete(taskId);
    }
  }

  function processTaskChange(
    runtime: ExplicitDurationRuntime,
    task: TaskSnapshot,
    beforeTask: TaskSnapshot | null,
    instance: TaskInstance | null,
    isNew: boolean,
  ): void {
    const taskId = taskIdFromDoc(task);
    const titleChanged = Boolean(beforeTask && beforeTask.title !== task.title);
    const estimateChanged = Boolean(beforeTask && beforeTask.timeEstimate !== normalizeEstimate(task.timeEstimate));

    if (!isNew && !titleChanged && estimateChanged && (!taskId || !runtime.correctionsInFlight.has(taskId))) {
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

  function observeTask(
    runtime: ExplicitDurationRuntime,
    taskValue: MarvinTask | null | undefined,
    instance: TaskInstance | null,
    initial = false,
  ): void {
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

  function scanDocument(runtime: ExplicitDurationRuntime, initial = false): void {
    runtime.scanTimer = null;
    pruneParserGuards(runtime);

    runtime.document.querySelectorAll(TASK_INPUT_SELECTOR).forEach((input) => patchTaskInput(input, runtime));

    const seenTaskIds = new Set<string>();
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

  function indexedDbRequest<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function getPouchDbNames(windowObject: Window): Promise<string[]> {
    if (!windowObject.indexedDB || typeof windowObject.indexedDB.databases !== "function") return [];
    const databases = await windowObject.indexedDB.databases();
    return databases.map((database) => database.name).filter((name): name is string => Boolean(name?.startsWith("_pouch_")));
  }

  function readLatestSequence(db: IDBDatabase): Promise<IDBValidKey> {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("by-sequence", "readonly");
      const request = transaction.objectStore("by-sequence").openCursor(null, "prev");
      request.onsuccess = () => resolve(request.result?.key ?? 0);
      request.onerror = () => reject(request.error);
    });
  }

  function readChangesAfter(
    runtime: ExplicitDurationRuntime,
    db: IDBDatabase,
    sequence: IDBValidKey,
  ): Promise<PouchChange[]> {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("by-sequence", "readonly");
      const store = transaction.objectStore("by-sequence");
      const range = IDBKeyRange.lowerBound(sequence, true);
      const request = store.openCursor(range, "next");
      const changes: PouchChange[] = [];

      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve(changes);
          return;
        }

        changes.push({ key: cursor.key, doc: cursor.value as MarvinTask });
        cursor.continue();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async function initializeDatabaseCursors(runtime: ExplicitDurationRuntime): Promise<void> {
    const names = await getPouchDbNames(runtime.window);

    for (const name of names) {
      let db: IDBDatabase | undefined;
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

  async function pollDatabases(runtime: ExplicitDurationRuntime): Promise<void> {
    if (!runtime.databaseReady || runtime.databasePollInFlight) return;
    runtime.databasePollInFlight = true;

    try {
      const names = await getPouchDbNames(runtime.window);

      for (const name of names) {
        let db: IDBDatabase | undefined;
        try {
          db = await indexedDbRequest(runtime.window.indexedDB.open(name));
          if (!db.objectStoreNames.contains("by-sequence")) continue;

          if (!runtime.databaseSequences.has(name)) {
            runtime.databaseSequences.set(name, await readLatestSequence(db));
            continue;
          }

          const lastSequence = runtime.databaseSequences.get(name);
          if (lastSequence === undefined) continue;
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

  function install(documentObject: Document) {
    const windowObject = documentObject.defaultView ?? window;
    const runtime: ExplicitDurationRuntime = {
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
      scheduleScan: () => undefined,
      window: windowObject,
    };

    runtime.scheduleScan = (delay = 0) => {
      if (runtime.scanTimer != null) return;
      runtime.scanTimer = windowObject.setTimeout(() => scanDocument(runtime, false), delay);
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Enter" && event.key !== "Tab") return;
      const input = event.target instanceof windowObject.Element
        ? event.target.closest(TASK_INPUT_SELECTOR)
        : null;
      if (input) recordTaskInputIntent(runtime, input, `keydown:${event.key}`);
    };

    const handleFocusOut = (event: FocusEvent): void => {
      const input = event.target instanceof windowObject.Element
        ? event.target.closest(TASK_INPUT_SELECTOR)
        : null;
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
      classify(
        rawTitle: unknown,
        beforeTask: MarvinTask | TaskSnapshot | null | undefined,
        trustedEstimate?: unknown,
      ) {
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

export {
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
