const VERSION = "1.1.0";

declare global {
  // Installed by the isolated extension content script before this page module.
  var __MES_API_REQUEST__: ((operation: string, payload: unknown) => Promise<unknown>) | undefined;
}

export interface MarvinTask {
  [key: string]: unknown;
  _deleted?: boolean;
  _doc_id_rev?: string;
  _id?: string;
  backburner?: boolean;
  createdAt?: unknown;
  db?: string;
  done?: boolean;
  inert?: boolean;
  isInert?: boolean;
  itemSnoozeTime?: unknown;
  permaSnoozeTime?: unknown;
  rank?: number;
  taskTime?: string;
  timeEstimate?: number;
  title?: string;
}

interface PouchMetadata {
  data?: string;
  seq?: IDBValidKey;
}

interface PouchChange {
  doc: MarvinTask;
  key: IDBValidKey;
}

interface TimeParts {
  hasSuffix: boolean;
  hour: number;
  hourText: string;
  index: number | null;
  length: number;
  minute: number;
  minuteText: string;
  padHour: boolean;
  source: "title" | "taskTime";
  suffix: string;
}

interface RawTimeParts {
  hourText: string;
  index: number | null;
  length: number;
  minuteText: string;
  source: "title" | "taskTime";
  suffix: string;
}

interface LoopMarker {
  counterWidth: number;
  endIndex: number;
  parenthesized: boolean;
  startIndex: number;
}

interface LoopRange {
  end: number;
  marker: LoopMarker;
  start: number;
}

export interface ParsedLoop extends LoopRange {
  durationMillis: number | null;
  rawText: string;
  time: TimeParts | null;
}

export interface TaskSpec {
  taskTime?: string;
  title: string;
}

export interface AddTaskPayload extends MarvinTask {
  done: false;
  title: string;
}

export interface UnrollReceipt {
  completedAt?: number;
  createdTaskIds: string[];
  createdTitles: string[];
  error?: string;
  expandedFirstTitle: string;
  id: string;
  originalRenamed?: boolean;
  originalTaskTime?: string;
  originalTitle: string;
  sourceTaskId: string;
  startedAt: number;
  status: "started" | "complete" | "partial" | "failed" | "undone";
  undoneAt?: number;
  updatedAt?: number;
}

interface TaskUnrollerRuntime {
  databasePollInFlight: boolean;
  databaseReady: boolean;
  databaseSequences: Map<string, IDBValidKey>;
}

interface ApiResult {
  [key: string]: unknown;
  _id?: string;
  id?: string;
  item?: { _id?: string };
  task?: { _id?: string; id?: string };
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;
  const BRIDGE_CHANNEL = "marvin-enhancement-suite";
  const RECEIPTS_KEY = "mes.taskUnroller.receipts.v1";
  const MAX_RECEIPTS = 50;
  const MAX_EXPANSION_COUNT = 50;
  const CONFIRM_EXPANSION_COUNT = 10;
  const RANGE_LOOP_PATTERN = /\$(\d+)\s*\.\.\s*(\d+)/;
  const NATURAL_LOOP_PATTERN = /\(\s*1\s*\/\s*(\d+)\s*\)/;
  const LOOP_CANDIDATE_PATTERN = new RegExp(`${RANGE_LOOP_PATTERN.source}|${NATURAL_LOOP_PATTERN.source}`);
  const TASK_SELECTOR = '[data-item-type="task"]';
  const TITLE_SELECTOR = ".TitlePart";
  const API_DELAY_MS = 250;
  const DOC_READ_RETRIES = 7;
  const DOC_READ_RETRY_MS = 250;
  const MAX_TRIGGER_TASK_AGE_MS = 2 * 60 * 1000;
  const DATABASE_POLL_INTERVAL_MS = 300;

  const ADD_TASK_FIELDS = [
    "day",
    "parentId",
    "labelIds",
    "firstScheduled",
    "rank",
    "dailySection",
    "bonusSection",
    "customSection",
    "timeBlockSection",
    "note",
    "dueDate",
    "timeEstimate",
    "isReward",
    "isStarred",
    "isFrogged",
    "plannedWeek",
    "plannedMonth",
    "rewardPoints",
    "rewardId",
    "backburner",
    "reviewDate",
    "itemSnoozeTime",
    "permaSnoozeTime",
  ];

  const processedTaskIds = new Set();
  let apiQueue: Promise<unknown> = Promise.resolve();

  /*
   * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
   * +++++++++++++++++++++ Frontend / Toast +++++++++++++++++++++
   * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
   */

  function showToast(message: string, isError = false): void {
    document.getElementById("am-task-unroller-toast")?.remove();

    const toast = document.createElement("div");
    toast.id = "am-task-unroller-toast";
    toast.textContent = message;
    Object.assign(toast.style, {
      position: "fixed",
      right: "18px",
      bottom: "18px",
      zIndex: "2147483647",
      padding: "10px 12px",
      borderRadius: "6px",
      background: isError ? "rgba(180, 38, 38, 0.95)" : "rgba(38, 38, 38, 0.94)",
      color: "#fff",
      font: "13px/1.35 -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
      boxShadow: "0 6px 20px rgba(0, 0, 0, 0.22)",
      pointerEvents: "none",
      maxWidth: "390px",
    });

    document.body.appendChild(toast);
    window.setTimeout(() => toast.remove(), isError ? 5200 : 2800);
  }

  /*
   * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
   * +++++++++++++++++++++ Backend / API ++++++++++++++++++++++++
   * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
   */

  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function logProfile(label: string, details: Record<string, unknown>): void {
    console.info("[Task Unroller profile]", label, details);
  }

  function queueApiCall<T>(work: () => Promise<T>, delayAfter = API_DELAY_MS, label = "api"): Promise<T> {
    const queuedAt = performance.now();
    const result = apiQueue.then(async () => {
      const startedAt = performance.now();

      try {
        const value = await work();
        logProfile(label, {
          queueMs: Math.round(startedAt - queuedAt),
          requestMs: Math.round(performance.now() - startedAt),
          delayAfterMs: delayAfter,
        });
        return value;
      } catch (error) {
        logProfile(`${label}:failed`, {
          queueMs: Math.round(startedAt - queuedAt),
          requestMs: Math.round(performance.now() - startedAt),
          message: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    });
    apiQueue = result.catch(() => undefined).then(() => sleep(delayAfter));
    return result;
  }

  function requestViaBridge<T = unknown>(operation: string, payload: unknown, timeoutMs = 15_000): Promise<T> {
    if (typeof globalThis.__MES_API_REQUEST__ === "function") {
      return globalThis.__MES_API_REQUEST__(operation, payload) as Promise<T>;
    }
    return new Promise((resolve, reject) => {
      const id = `mes-unroller-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const timer = window.setTimeout(() => {
        window.removeEventListener("message", handleResponse);
        reject(new Error("MES timed out waiting for the Marvin API."));
      }, timeoutMs);

      function handleResponse(event: MessageEvent): void {
        const data = event.data as {
          channel?: string;
          direction?: string;
          error?: string;
          id?: string;
          ok?: boolean;
          result?: T;
        } | null;
        if (
          event.source !== window ||
          data?.channel !== BRIDGE_CHANNEL ||
          data?.direction !== "extension-to-page" ||
          data?.id !== id
        ) return;
        window.clearTimeout(timer);
        window.removeEventListener("message", handleResponse);
        if (data.ok) resolve(data.result as T);
        else reject(new Error(data.error || "Marvin API request failed."));
      }

      window.addEventListener("message", handleResponse);
      window.postMessage(
        { channel: BRIDGE_CHANNEL, direction: "page-to-extension", id, operation, payload },
        window.location.origin,
      );
    });
  }

  function readDoc(itemId: string): Promise<MarvinTask> {
    return queueApiCall(() => requestViaBridge<MarvinTask>("readDoc", { itemId }), 0, "read remote doc");
  }

  function indexedDbRequest<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function getPouchDbNames(): Promise<string[]> {
    if (!window.indexedDB) return [];

    if (typeof indexedDB.databases === "function") {
      try {
        const databases = await indexedDB.databases();
        return databases.map((database) => database.name).filter((name): name is string => Boolean(name?.startsWith("_pouch_")));
      } catch {
        // Fall through to the localStorage hint below.
      }
    }

    return Object.keys(localStorage).filter((key) => key.startsWith("_pouch_"));
  }

  async function openIndexedDb(name: string): Promise<IDBDatabase> {
    return indexedDbRequest(indexedDB.open(name));
  }

  function normalizeLocalDoc(doc: unknown, itemId: string): MarvinTask | null {
    if (!doc || typeof doc !== "object") return null;
    const candidate = doc as MarvinTask;
    if (candidate._deleted) return null;

    const docId = candidate._id || String(candidate._doc_id_rev || "").split("::")[0] || itemId;
    if (docId !== itemId) return null;

    return {
      ...candidate,
      _id: docId,
    };
  }

  async function readLocalDocFromDb(db: IDBDatabase, itemId: string): Promise<MarvinTask | null> {
    if (!db.objectStoreNames.contains("document-store") || !db.objectStoreNames.contains("by-sequence")) {
      return null;
    }

    const metaTransaction = db.transaction("document-store", "readonly");
    const rawMeta = await indexedDbRequest(metaTransaction.objectStore("document-store").get(itemId));
    const meta = rawMeta && typeof rawMeta === "object" ? rawMeta as PouchMetadata : {};
    const parsed = meta.data ? JSON.parse(meta.data) as PouchMetadata : null;
    const seq = meta.seq ?? parsed?.seq;
    if (seq == null) return readLocalDocByCursor(db, itemId);

    const docTransaction = db.transaction("by-sequence", "readonly");
    return normalizeLocalDoc(await indexedDbRequest(docTransaction.objectStore("by-sequence").get(seq)), itemId) ||
      readLocalDocByCursor(db, itemId);
  }

  function readLocalDocByCursor(db: IDBDatabase, itemId: string): Promise<MarvinTask | null> {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("by-sequence", "readonly");
      const request = transaction.objectStore("by-sequence").openCursor(null, "prev");

      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve(null);
          return;
        }

        const doc = normalizeLocalDoc(cursor.value, itemId);
        if (doc?._id) {
          resolve(doc);
          return;
        }

        cursor.continue();
      };

      request.onerror = () => reject(request.error);
    });
  }

  async function readLocalDoc(itemId: string): Promise<MarvinTask | null> {
    const dbNames = await getPouchDbNames();

    for (const dbName of dbNames) {
      let db: IDBDatabase | null = null;
      try {
        db = await openIndexedDb(dbName);
        const doc = await readLocalDocFromDb(db, itemId);
        if (doc?._id) return doc;
      } catch (error) {
        console.debug("[Task Unroller] Could not read local Marvin doc:", dbName, error);
      } finally {
        db?.close();
      }
    }

    return null;
  }

  function taskIdFromDoc(task: MarvinTask | null | undefined): string | null {
    if (task?._id) return task._id;
    return String(task?._doc_id_rev || "").split("::")[0] || null;
  }

  function looksLikeMarvinTask(task: unknown): task is MarvinTask {
    if (!task || typeof task !== "object") return false;
    const candidate = task as MarvinTask;
    return Boolean(!candidate._deleted && candidate.db === "Tasks" && taskIdFromDoc(candidate) && typeof candidate.title === "string");
  }

  function readLatestSequence(db: IDBDatabase): Promise<IDBValidKey> {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("by-sequence", "readonly");
      const request = transaction.objectStore("by-sequence").openCursor(null, "prev");
      request.onsuccess = () => resolve(request.result?.key ?? 0);
      request.onerror = () => reject(request.error);
    });
  }

  function readChangesAfter(db: IDBDatabase, sequence: IDBValidKey): Promise<PouchChange[]> {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("by-sequence", "readonly");
      const store = transaction.objectStore("by-sequence");
      const request = store.openCursor(IDBKeyRange.lowerBound(sequence, true), "next");
      const changes: PouchChange[] = [];
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return resolve(changes);
        changes.push({ key: cursor.key, doc: cursor.value as MarvinTask });
        cursor.continue();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async function readTaskDoc(itemId: string): Promise<MarvinTask> {
    const localDoc = await readLocalDoc(itemId);
    if (localDoc?._id) return localDoc;
    return readDocWithRetry(itemId);
  }

  async function readDocWithRetry(itemId: string): Promise<MarvinTask> {
    let lastError: unknown = null;

    for (let attempt = 0; attempt < DOC_READ_RETRIES; attempt += 1) {
      try {
        const doc = await readDoc(itemId);
        if (doc?._id) return doc;
      } catch (error) {
        lastError = error;
      }
      await sleep(DOC_READ_RETRY_MS);
    }

    throw lastError || new Error(`Could not read created Marvin task ${itemId}.`);
  }

  function updateTaskFields(
    itemId: string,
    fields: Record<string, unknown>,
    label = "update task",
  ): Promise<unknown> {
    const now = Date.now();
    const setters: Array<{ key: string; val: unknown }> = [];
    for (const [key, val] of Object.entries(fields)) {
      setters.push({ key, val });
      setters.push({ key: `fieldUpdates.${key}`, val: now });
    }
    setters.push({ key: "updatedAt", val: now });
    return queueApiCall(() => requestViaBridge("updateDoc", { itemId, setters }), undefined, label);
  }

  function updateOriginalTask(itemId: string, spec: TaskSpec): Promise<unknown> {
    const fields: Record<string, unknown> = { title: spec.title };
    if (Object.prototype.hasOwnProperty.call(spec, "taskTime")) fields.taskTime = spec.taskTime;
    return updateTaskFields(itemId, fields, "update original task");
  }

  function addTask(task: AddTaskPayload): Promise<ApiResult> {
    return queueApiCall(
      () => requestViaBridge<ApiResult>("addTask", { ...task, timeZoneOffset: -new Date().getTimezoneOffset() }),
      undefined,
      `add task: ${task.title}`,
    );
  }

  /*
   * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
   * +++++++++++++++++++++ Loop Expansion +++++++++++++++++++++++
   * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
   */

  function parseDurationMillis(text: unknown): number | null {
    const source = String(text || "");
    const match =
      source.match(/(?:^|\s)(?:~|ca\.?\s*)(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m)\b/i) ||
      source.match(/(?:^|\s)(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m)\b/i);
    if (!match) return null;

    const amount = Number(match[1]);
    if (!Number.isFinite(amount) || amount <= 0) return null;

    return Math.round(amount * (match[2]!.toLowerCase().startsWith("h") ? 60 : 1) * 60 * 1000);
  }

  function parseTitleTime(text: unknown): TimeParts | null {
    const match =
      String(text || "").match(/^(\s*)(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i) ||
      String(text || "").match(/(^|\s)(\d{1,2})(?:(?::(\d{2}))\s*(am|pm)?|\s+(am|pm))\b/i);
    if (!match) return null;

    return normalizeTimeParts({
      index: (match.index ?? 0) + match[1]!.length,
      length: match[0].length - match[1]!.length,
      hourText: match[2]!,
      minuteText: match[3] ?? "00",
      suffix: match[4] || match[5] || "",
      source: "title",
    });
  }

  function parseStoredTaskTime(taskTime: unknown): TimeParts | null {
    const match = String(taskTime || "").match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;

    return normalizeTimeParts({
      index: null,
      length: 0,
      hourText: match[1]!,
      minuteText: match[2]!,
      suffix: "",
      source: "taskTime",
    });
  }

  function normalizeTimeParts(parts: RawTimeParts): TimeParts | null {
    let hour = Number(parts.hourText);
    const minute = Number(parts.minuteText);
    if (!Number.isInteger(hour) || !Number.isInteger(minute) || minute < 0 || minute > 59) return null;

    if (parts.suffix) {
      const suffix = parts.suffix.toLowerCase();
      if (hour < 1 || hour > 12) return null;
      if (suffix === "pm" && hour !== 12) hour += 12;
      if (suffix === "am" && hour === 12) hour = 0;
    } else if (hour > 23) {
      return null;
    }

    return {
      ...parts,
      hour,
      minute,
      hasSuffix: Boolean(parts.suffix),
      padHour: parts.source === "taskTime" || parts.hourText.length > 1,
    };
  }

  function formatShiftedTime(time: TimeParts, offsetMillis: number): string {
    const totalMinutes = (time.hour * 60 + time.minute + Math.round(offsetMillis / 60000)) % 1440;
    const normalizedMinutes = totalMinutes < 0 ? totalMinutes + 1440 : totalMinutes;
    let hour = Math.floor(normalizedMinutes / 60);
    const minute = normalizedMinutes % 60;

    if (time.source === "taskTime") {
      return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    }

    if (time.hasSuffix) {
      const suffix = hour >= 12 ? "pm" : "am";
      hour %= 12;
      if (hour === 0) hour = 12;
      return `${hour}:${String(minute).padStart(2, "0")}${suffix}`;
    }

    return `${time.padHour ? String(hour).padStart(2, "0") : String(hour)}:${String(minute).padStart(2, "0")}`;
  }

  function getRangeLoopMarker(text: string, loopMatch: RegExpMatchArray): LoopMarker {
    let startIndex = loopMatch.index ?? 0;
    let endIndex = startIndex + loopMatch[0].length;
    let parenthesized = false;

    const openMatch = text.slice(0, startIndex).match(/\(\s*$/);
    const closeMatch = text.slice(endIndex).match(/^\s*\)/);
    if (openMatch && closeMatch) {
      startIndex -= openMatch[0].length;
      endIndex += closeMatch[0].length;
      parenthesized = true;
    }

    return {
      startIndex,
      endIndex,
      parenthesized,
      counterWidth: loopMatch[1]!.length,
    };
  }

  function expansionCount(start: number, end: number): number | null {
    if (!Number.isInteger(start) || !Number.isInteger(end) || end < start) return null;
    return end - start + 1;
  }

  function assertSafeExpansionCount(start: number, end: number): number {
    const count = expansionCount(start, end);
    if (count == null) throw new Error("The task-unroll range is invalid.");
    if (count > MAX_EXPANSION_COUNT) {
      throw new Error(`Task unrolling is limited to ${MAX_EXPANSION_COUNT} tasks at a time.`);
    }
    return count;
  }

  function getNaturalLoopMarker(loopMatch: RegExpMatchArray): LoopMarker {
    return {
      startIndex: loopMatch.index ?? 0,
      endIndex: (loopMatch.index ?? 0) + loopMatch[0].length,
      parenthesized: true,
      counterWidth: 1,
    };
  }

  function parseRangeLoop(rawText: string): LoopRange | null {
    const loopMatch = rawText.match(RANGE_LOOP_PATTERN);
    if (!loopMatch) return null;

    const start = Number(loopMatch[1]);
    const end = Number(loopMatch[2]);
    if (!Number.isInteger(start) || !Number.isInteger(end) || end < start) return null;
    assertSafeExpansionCount(start, end);

    return {
      start,
      end,
      marker: getRangeLoopMarker(rawText, loopMatch),
    };
  }

  function getLoopCandidateType(text: unknown): "range" | "natural" | "" {
    const rawText = String(text || "");
    if (RANGE_LOOP_PATTERN.test(rawText)) return "range";
    if (NATURAL_LOOP_PATTERN.test(rawText)) return "natural";
    return "";
  }

  function getLoopCandidateCount(text: unknown): number | null {
    const rawText = String(text || "");
    const rangeMatch = rawText.match(RANGE_LOOP_PATTERN);
    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      return expansionCount(start, end);
    }

    const naturalMatch = rawText.match(NATURAL_LOOP_PATTERN);
    if (!naturalMatch) return null;

    const end = Number(naturalMatch[1]);
    return Number.isInteger(end) && end >= 2 ? expansionCount(1, end) : null;
  }

  function parseNaturalLoop(rawText: string, _doc: MarvinTask | null | undefined, _time: TimeParts | null): LoopRange | null {
    const loopMatch = rawText.match(NATURAL_LOOP_PATTERN);
    if (!loopMatch) return null;

    const end = Number(loopMatch[1]);
    if (!Number.isInteger(end) || end < 2) return null;
    assertSafeExpansionCount(1, end);

    return {
      start: 1,
      end,
      marker: getNaturalLoopMarker(loopMatch),
    };
  }

  function replaceLoopMarker(text: string, loop: ParsedLoop, counter: number): string {
    const counterText = String(counter).padStart(loop.marker.counterWidth, "0");
    const replacement = loop.marker.parenthesized ? `(${counterText}/${loop.end})` : counterText;
    return `${text.slice(0, loop.marker.startIndex)}${replacement}${text.slice(loop.marker.endIndex)}`
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  function replaceTitleTime(text: string, time: TimeParts | null, offsetMillis: number): string {
    if (!time || time.source !== "title") return text;
    const index = time.index ?? 0;
    return `${text.slice(0, index)}${formatShiftedTime(time, offsetMillis)}${text.slice(index + time.length)}`;
  }

  function parseLoop(text: unknown, doc: MarvinTask | null | undefined): ParsedLoop | null {
    const rawText = String(text || "");
    const time = parseTitleTime(rawText) || parseStoredTaskTime(doc?.taskTime);
    const parsedLoop = parseRangeLoop(rawText) || parseNaturalLoop(rawText, doc, time);
    if (!parsedLoop) return null;

    const durationMillis = doc?.timeEstimate || parseDurationMillis(rawText);
    if (time && !durationMillis) {
      throw new Error("Looped timed tasks need a duration so later start times can be calculated.");
    }

    return {
      start: parsedLoop.start,
      end: parsedLoop.end,
      rawText,
      durationMillis: durationMillis || null,
      marker: parsedLoop.marker,
      time,
    };
  }

  function expandLoop(loop: ParsedLoop): TaskSpec[] {
    const specs: TaskSpec[] = [];

    for (let counter = loop.start; counter <= loop.end; counter += 1) {
      const offset = loop.durationMillis ? loop.durationMillis * (counter - loop.start) : 0;
      const title = replaceTitleTime(replaceLoopMarker(loop.rawText, loop, counter), loop.time, offset);
      const spec: TaskSpec = { title };
      if (loop.time?.source === "taskTime") spec.taskTime = formatShiftedTime(loop.time, offset);
      specs.push(spec);
    }

    return specs;
  }

  /*
   * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
   * +++++++++++++++++++++ Marvin Task Mapping ++++++++++++++++++
   * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
   */

  function copyIfPresent(target: Record<string, unknown>, source: MarvinTask, key: string): void {
    if (source?.[key] != null && source[key] !== "") target[key] = source[key];
  }

  function buildAddTaskPayload(originalTask: MarvinTask, spec: TaskSpec, index: number): AddTaskPayload {
    const payload: AddTaskPayload = {
      title: spec.title,
      done: false,
    };

    for (const field of ADD_TASK_FIELDS) copyIfPresent(payload, originalTask, field);
    if (typeof payload.rank === "number") payload.rank += index * 0.001;

    // Not documented for addTask, but cheap to pass through if this endpoint accepts it.
    if (spec.taskTime) payload.taskTime = spec.taskTime;

    return payload;
  }

  function parseTimestampMillis(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value < 100000000000 ? value * 1000 : value;
    }
    if (typeof value === "string" && value.trim()) {
      const numeric = Number(value);
      if (Number.isFinite(numeric)) return parseTimestampMillis(numeric);
      const timestamp = Date.parse(value);
      if (Number.isFinite(timestamp)) return timestamp;
    }
    return null;
  }

  function isRecentlyCreatedTask(task: MarvinTask | null | undefined): boolean {
    const createdAt = parseTimestampMillis(task?.createdAt);
    if (createdAt == null) return true;
    return Date.now() - createdAt <= MAX_TRIGGER_TASK_AGE_MS;
  }

  function isInactiveTask(task: MarvinTask | null | undefined): boolean {
    return Boolean(
      task?.done ||
        task?.inert ||
        task?.isInert ||
        task?.backburner ||
        task?.permaSnoozeTime ||
        task?.itemSnoozeTime,
    );
  }

  function getUnrollSkipReason(task: MarvinTask | null | undefined, _title?: string): string {
    if (isInactiveTask(task)) return "inactive";
    if (!isRecentlyCreatedTask(task)) return "not newly created";
    return "";
  }

  function loadReceipts(storage: StorageLike = window.localStorage): UnrollReceipt[] {
    try {
      const parsed = JSON.parse(storage.getItem(RECEIPTS_KEY) || "[]");
      return Array.isArray(parsed) ? parsed as UnrollReceipt[] : [];
    } catch {
      return [];
    }
  }

  function saveReceipts(receipts: UnrollReceipt[], storage: StorageLike = window.localStorage): void {
    storage.setItem(RECEIPTS_KEY, JSON.stringify(receipts.slice(-MAX_RECEIPTS)));
  }

  function receiptForTask(taskId: string, storage: StorageLike = window.localStorage): UnrollReceipt | null {
    return loadReceipts(storage).findLast?.((receipt) => receipt.sourceTaskId === taskId) ||
      [...loadReceipts(storage)].reverse().find((receipt) => receipt.sourceTaskId === taskId) ||
      null;
  }

  function putReceipt(receipt: UnrollReceipt, storage: StorageLike = window.localStorage): UnrollReceipt {
    const receipts = loadReceipts(storage).filter((item) => item.id !== receipt.id);
    receipts.push({ ...receipt, updatedAt: Date.now() });
    saveReceipts(receipts, storage);
    return receipt;
  }

  function clearReceipt(taskId: string, storage: StorageLike = window.localStorage): void {
    const receipts = loadReceipts(storage).filter((receipt) => receipt.sourceTaskId !== taskId);
    saveReceipts(receipts, storage);
  }

  function createdTaskId(response: ApiResult | null | undefined): string | null {
    const candidates = [response?._id, response?.id, response?.task?._id, response?.task?.id, response?.item?._id];
    return candidates.find((value): value is string => typeof value === "string" && Boolean(value)) || null;
  }

  function requireConfirmation(count: number, title: string, confirmFn: (message: string) => boolean = window.confirm): boolean {
    if (count <= CONFIRM_EXPANSION_COUNT) return true;
    return confirmFn(
      `Marvin Enhancement Suite will expand this task into ${count} tasks:\n\n${title}\n\nContinue?`,
    );
  }

  async function undoReceipt(receiptOrId?: UnrollReceipt | string): Promise<UnrollReceipt> {
    const receipts = loadReceipts();
    const receipt =
      typeof receiptOrId === "string"
        ? receipts.find((item) => item.id === receiptOrId)
        : receiptOrId || receipts.findLast?.((item) => item.status === "complete");
    if (!receipt) throw new Error("No completed task-unroll receipt is available.");
    if (receipt.status === "undone") return receipt;
    if (receipt.createdTaskIds.length !== receipt.createdTitles.length) {
      throw new Error("Undo is unavailable because Marvin did not return every created task ID.");
    }

    const now = Date.now();
    for (const itemId of [...receipt.createdTaskIds].reverse()) {
      await updateTaskFields(itemId, { deletedAt: now }, `trash unrolled task ${itemId}`);
    }
    const restore: Record<string, unknown> = { title: receipt.originalTitle };
    if (receipt.originalTaskTime !== undefined) restore.taskTime = receipt.originalTaskTime;
    await updateTaskFields(receipt.sourceTaskId, restore, "restore original task");
    receipt.status = "undone";
    receipt.undoneAt = Date.now();
    putReceipt(receipt);
    showToast(`Undid task unroll and moved ${receipt.createdTaskIds.length} generated tasks to Marvin Trash.`);
    return receipt;
  }

  async function isOriginalStillUnrollable(taskId: string, expectedTitles: string | string[]): Promise<boolean> {
    const startedAt = performance.now();
    const allowedTitles = Array.isArray(expectedTitles) ? expectedTitles : [expectedTitles];
    const currentTask = await readLocalDoc(taskId);
    const currentTitle = currentTask?.title ?? "";
    const alive =
      Boolean(currentTask?._id) &&
      allowedTitles.includes(currentTitle) &&
      !getUnrollSkipReason(currentTask, currentTitle) &&
      LOOP_CANDIDATE_PATTERN.test(currentTitle);

    logProfile("check original task", {
      taskId,
      alive,
      elapsedMs: Math.round(performance.now() - startedAt),
    });
    return alive;
  }

  async function unrollTask(taskId: string, titleHint: string): Promise<boolean> {
    const startedAt = performance.now();
    logProfile("unroll started", { taskId, titleHint });

    const originalTask = await readTaskDoc(taskId);
    if (!originalTask?._id) throw new Error(`Could not read created Marvin task ${taskId}.`);
    logProfile("read task doc", {
      taskId,
      elapsedMs: Math.round(performance.now() - startedAt),
      source: originalTask?._id ? "local-or-remote" : "missing",
    });

    const title = originalTask.title || titleHint;
    const skipReason = getUnrollSkipReason(originalTask, title);
    if (skipReason) {
      console.info("[Task Unroller] Ignoring task:", skipReason, { taskId, title });
      logProfile("unroll skipped", { taskId, reason: skipReason, elapsedMs: Math.round(performance.now() - startedAt) });
      return false;
    }

    const existingReceipt = receiptForTask(taskId);
    if (existingReceipt && existingReceipt.status !== "undone") {
      console.info("[MES Task Unroller] Duplicate expansion prevented by receipt.", existingReceipt);
      showToast("MES prevented a duplicate task unroll. Clear its receipt explicitly before retrying.", true);
      return false;
    }

    const loop = parseLoop(title, originalTask);
    if (!loop) {
      logProfile("unroll skipped", { taskId, reason: "no loop", elapsedMs: Math.round(performance.now() - startedAt) });
      return false;
    }

    const count = loop.end - loop.start + 1;
    if (!requireConfirmation(count, title)) {
      showToast("Task unroll cancelled.");
      return false;
    }

    const [first, ...rest] = expandLoop(loop);
    if (!first) {
      logProfile("unroll skipped", { taskId, reason: "empty expansion", elapsedMs: Math.round(performance.now() - startedAt) });
      return false;
    }

    showToast(`Unrolling into ${rest.length + 1} tasks...`);

    const receipt = putReceipt({
      id: `unroll-${taskId}-${Date.now()}`,
      sourceTaskId: taskId,
      originalTitle: originalTask.title || title,
      originalTaskTime: originalTask.taskTime,
      expandedFirstTitle: first.title,
      createdTaskIds: [],
      createdTitles: [],
      startedAt: Date.now(),
      status: "started",
    });

    try {
      let renamedOriginal = false;
      let expectedOriginalTitles = [title];
      if (first.title !== originalTask.title || (first.taskTime && first.taskTime !== originalTask.taskTime)) {
        if (!(await isOriginalStillUnrollable(originalTask._id, title))) {
          throw new Error("Cancelled because the original task changed or was deleted.");
        }

        await updateOriginalTask(originalTask._id, first);
        renamedOriginal = true;
        expectedOriginalTitles = [title, first.title];
        receipt.originalRenamed = true;
        putReceipt(receipt);
      }

      for (let index = 0; index < rest.length; index += 1) {
        if (!(await isOriginalStillUnrollable(originalTask._id, expectedOriginalTitles))) {
          throw new Error(`Cancelled before adding task ${index + 2}/${rest.length + 1} because the original changed.`);
        }

        const spec = rest[index];
        if (!spec) throw new Error(`Missing task specification ${index + 2}/${rest.length + 1}.`);
        const payload = buildAddTaskPayload(originalTask, spec, index + 1);
        const created = await addTask(payload);
        receipt.createdTitles.push(payload.title);
        const createdId = createdTaskId(created);
        if (createdId) receipt.createdTaskIds.push(createdId);
        putReceipt(receipt);
      }

      receipt.status = "complete";
      receipt.completedAt = Date.now();
      putReceipt(receipt);
      showToast(`${renamedOriginal ? "Renamed original and c" : "C"}reated ${rest.length} more ${rest.length === 1 ? "task" : "tasks"}.`);
      logProfile("unroll complete", {
        taskId: originalTask._id,
        created: rest.length,
        elapsedMs: Math.round(performance.now() - startedAt),
      });
      return true;
    } catch (error) {
      receipt.status = receipt.createdTitles.length ? "partial" : "failed";
      receipt.error = error instanceof Error ? error.message : String(error);
      putReceipt(receipt);
      throw new Error(
        `${receipt.error} MES recorded ${receipt.createdTitles.length} created ${receipt.createdTitles.length === 1 ? "task" : "tasks"} and will block automatic retry.`,
      );
    }
  }

  /*
   * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
   * ++++++++++++++++ Tampermonkey Event Handling +++++++++++++++
   * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
   */

  function taskIdFromElement(taskElement: Element): string {
    return taskElement.getAttribute("data-item-id") || taskElement.querySelector("[data-uid]")?.getAttribute("data-uid") || "";
  }

  function taskTitleFromElement(taskElement: Element): string {
    return taskElement.querySelector(TITLE_SELECTOR)?.textContent?.trim() || "";
  }

  function handleTaskCandidate(taskId: string | null, title: string): void {
    if (!taskId || processedTaskIds.has(taskId)) return;
    if (!LOOP_CANDIDATE_PATTERN.test(title)) return;

    processedTaskIds.add(taskId);
    const count = getLoopCandidateCount(title);
    showToast(count ? `Detected loop task. Unrolling into ${count} tasks...` : "Detected loop task. Unrolling...");
    unrollTask(taskId, title).catch((error) => {
      console.error("[Task Unroller]", error);
      showToast(error instanceof Error ? error.message : String(error), true);
    });
  }

  function handleAddedTask(taskElement: Element): void {
    handleTaskCandidate(taskIdFromElement(taskElement), taskTitleFromElement(taskElement));
  }

  async function initializeDatabaseCursors(runtime: TaskUnrollerRuntime): Promise<void> {
    const names = await getPouchDbNames();
    for (const name of names) {
      let db: IDBDatabase | undefined;
      try {
        db = await openIndexedDb(name);
        if (db.objectStoreNames.contains("by-sequence")) {
          runtime.databaseSequences.set(name, await readLatestSequence(db));
        }
      } catch (error) {
        console.warn("[MES Task Unroller] Could not initialize a Marvin database watcher.", name, error);
      } finally {
        db?.close();
      }
    }
    runtime.databaseReady = true;
  }

  async function pollDatabases(runtime: TaskUnrollerRuntime): Promise<void> {
    if (!runtime.databaseReady || runtime.databasePollInFlight) return;
    runtime.databasePollInFlight = true;
    try {
      const names = await getPouchDbNames();
      for (const name of names) {
        let db: IDBDatabase | undefined;
        try {
          db = await openIndexedDb(name);
          if (!db.objectStoreNames.contains("by-sequence")) continue;
          if (!runtime.databaseSequences.has(name)) {
            runtime.databaseSequences.set(name, await readLatestSequence(db));
            continue;
          }
          const lastSequence = runtime.databaseSequences.get(name);
          if (lastSequence === undefined) continue;
          const changes = await readChangesAfter(db, lastSequence);
          for (const change of changes) {
            runtime.databaseSequences.set(name, change.key);
            if (!looksLikeMarvinTask(change.doc)) continue;
            handleTaskCandidate(taskIdFromDoc(change.doc), change.doc.title ?? "");
          }
        } catch (error) {
          console.warn("[MES Task Unroller] Marvin database polling failed safely.", name, error);
        } finally {
          db?.close();
        }
      }
    } finally {
      runtime.databasePollInFlight = false;
    }
  }

  function observeAddedTasks(documentObject: Document): MutationObserver {
    const windowObject = documentObject.defaultView ?? window;
    const observer = new windowObject.MutationObserver((mutations: MutationRecord[]) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof windowObject.Element)) continue;
          if (node.matches(TASK_SELECTOR)) handleAddedTask(node);
          node.querySelectorAll?.(TASK_SELECTOR).forEach(handleAddedTask);
        }
      }
    });

    observer.observe(documentObject.body || documentObject.documentElement, { childList: true, subtree: true });
    return observer;
  }

  function install(documentObject: Document) {
    const observer = observeAddedTasks(documentObject);
    const runtime: TaskUnrollerRuntime = {
      databasePollInFlight: false,
      databaseReady: false,
      databaseSequences: new Map(),
    };
    void initializeDatabaseCursors(runtime);
    const databaseInterval = window.setInterval(() => void pollDatabases(runtime), DATABASE_POLL_INTERVAL_MS);
    return {
      installed: true,
      version: VERSION,
      disconnect() {
        observer.disconnect();
        window.clearInterval(databaseInterval);
        processedTaskIds.clear();
      },
      status() {
        return {
          installed: true,
          version: VERSION,
          processedTasks: processedTaskIds.size,
          receipts: loadReceipts().length,
          databaseReady: runtime.databaseReady,
          watchedDatabases: runtime.databaseSequences.size,
          maxExpansionCount: MAX_EXPANSION_COUNT,
          confirmExpansionCount: CONFIRM_EXPANSION_COUNT,
        };
      },
      undoLatest: () => undoReceipt(),
    };
  }

export {
    CONFIRM_EXPANSION_COUNT,
    MAX_EXPANSION_COUNT,
    VERSION,
    assertSafeExpansionCount,
    buildAddTaskPayload,
    clearReceipt,
    createdTaskId,
    expansionCount,
    expandLoop,
    getLoopCandidateType,
    getLoopCandidateCount,
    getUnrollSkipReason,
    install,
    looksLikeMarvinTask,
    loadReceipts,
    parseLoop,
    parseDurationMillis,
    parseStoredTaskTime,
    parseTitleTime,
    putReceipt,
    receiptForTask,
    requireConfirmation,
    unrollTask,
    undoReceipt,
};
