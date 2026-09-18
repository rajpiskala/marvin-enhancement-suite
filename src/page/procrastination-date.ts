export const VERSION = "0.1.0";

const ATTR = "data-lhover3";
const TOOLTIP_PATTERN = /(procrastinated\s*:\s*)\d+/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TASK_SELECTOR = '[data-item-id], [data-uid]';

export interface MarvinLocalDoc {
  _deleted?: boolean;
  _doc_id_rev?: string;
  _id?: string;
  firstScheduled?: string;
  [key: string]: unknown;
}

interface PouchMetadata {
  data?: string;
  seq?: IDBValidKey;
}

interface ProcrastinationStats {
  exactDatesApplied: number;
  missingTaskId: number;
  missingFirstScheduled: number;
  errors: number;
}

export interface ProcrastinationDateHandle {
  installed: true;
  version: string;
  disconnect: () => void;
  status: () => ProcrastinationStats & { installed: true; version: string; cachedTasks: number };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}

export function taskIdForElement(element: Element | null | undefined): string {
  const row = element?.closest(TASK_SELECTOR);
  return row?.getAttribute("data-item-id") || row?.getAttribute("data-uid") || "";
}

export function withSinceDate(text: unknown, firstScheduled: unknown): string | null {
  if (typeof text !== "string" || !TOOLTIP_PATTERN.test(text)) return null;
  if (!DATE_PATTERN.test(String(firstScheduled || ""))) return null;
  const base = text.replace(/\s*\(since\s+\d{4}-\d{2}-\d{2}\)\s*$/i, "");
  return `${base} (since ${String(firstScheduled)})`;
}

function indexedDbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function pouchDatabaseNames(windowObject: Window): Promise<string[]> {
  if (typeof windowObject.indexedDB.databases === "function") {
    try {
      const databases = await windowObject.indexedDB.databases();
      return databases
        .map((database) => database.name)
        .filter((name): name is string => Boolean(name?.startsWith("_pouch_")));
    } catch {
      // Older Firefox versions can reject indexedDB.databases().
    }
  }
  return Object.keys(windowObject.localStorage).filter((key) => key.startsWith("_pouch_"));
}

export function normalizeLocalDoc(doc: unknown, itemId: string): MarvinLocalDoc | null {
  if (!isRecord(doc) || doc._deleted) return null;
  const id =
    (typeof doc._id === "string" && doc._id) ||
    (typeof doc._doc_id_rev === "string" && doc._doc_id_rev.split("::")[0]) ||
    itemId;
  return id === itemId ? { ...doc, _id: id } : null;
}

function readByCursor(db: IDBDatabase, itemId: string): Promise<MarvinLocalDoc | null> {
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains("by-sequence")) {
      resolve(null);
      return;
    }
    const transaction = db.transaction("by-sequence", "readonly");
    const request = transaction.objectStore("by-sequence").openCursor(null, "prev");
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve(null);
        return;
      }
      const doc = normalizeLocalDoc(cursor.value, itemId);
      if (doc) resolve(doc);
      else cursor.continue();
    };
    request.onerror = () => reject(request.error);
  });
}

async function readFromDatabase(db: IDBDatabase, itemId: string): Promise<MarvinLocalDoc | null> {
  if (!db.objectStoreNames.contains("document-store")) return readByCursor(db, itemId);
  const transaction = db.transaction("document-store", "readonly");
  const rawMetadata = await indexedDbRequest(transaction.objectStore("document-store").get(itemId));
  const metadata: PouchMetadata = isRecord(rawMetadata) ? rawMetadata as PouchMetadata : {};
  let parsed: PouchMetadata | null = null;
  if (typeof metadata.data === "string") {
    try {
      const value: unknown = JSON.parse(metadata.data);
      parsed = isRecord(value) ? value as PouchMetadata : null;
    } catch {
      parsed = null;
    }
  }
  const sequence = metadata.seq ?? parsed?.seq;
  if (sequence == null || !db.objectStoreNames.contains("by-sequence")) return readByCursor(db, itemId);
  const docTransaction = db.transaction("by-sequence", "readonly");
  const exact = normalizeLocalDoc(
    await indexedDbRequest(docTransaction.objectStore("by-sequence").get(sequence)),
    itemId,
  );
  return exact ?? readByCursor(db, itemId);
}

async function readLocalDoc(windowObject: Window, itemId: string): Promise<MarvinLocalDoc | null> {
  const names = await pouchDatabaseNames(windowObject);
  for (const name of names) {
    let db: IDBDatabase | undefined;
    try {
      db = await indexedDbRequest(windowObject.indexedDB.open(name));
      const doc = await readFromDatabase(db, itemId);
      if (doc) return doc;
    } finally {
      db?.close();
    }
  }
  return null;
}

export function install(documentObject: Document): ProcrastinationDateHandle {
  const windowObject = documentObject.defaultView ?? window;
  const cache = new Map<string, string | null>();
  const inFlight = new WeakSet<Element>();
  const stats: ProcrastinationStats = {
    exactDatesApplied: 0,
    missingTaskId: 0,
    missingFirstScheduled: 0,
    errors: 0,
  };

  const patchElement = async (element: Element): Promise<void> => {
    if (!element.hasAttribute(ATTR) || inFlight.has(element)) return;
    const text = element.getAttribute(ATTR);
    if (!TOOLTIP_PATTERN.test(String(text || ""))) return;
    const itemId = taskIdForElement(element);
    if (!itemId) {
      stats.missingTaskId += 1;
      return;
    }

    inFlight.add(element);
    try {
      let firstScheduled = cache.get(itemId);
      if (firstScheduled === undefined) {
        const doc = await readLocalDoc(windowObject, itemId);
        firstScheduled = DATE_PATTERN.test(String(doc?.firstScheduled || ""))
          ? String(doc?.firstScheduled)
          : null;
        cache.set(itemId, firstScheduled);
      }
      const updated = withSinceDate(text, firstScheduled);
      if (!updated) {
        stats.missingFirstScheduled += 1;
        return;
      }
      if (updated !== text) {
        element.setAttribute(ATTR, updated);
        stats.exactDatesApplied += 1;
      }
    } catch (error) {
      stats.errors += 1;
      console.debug("[MES procrastination date] Could not read task history safely.", error);
    } finally {
      inFlight.delete(element);
    }
  };

  const scan = (root: ParentNode | Element = documentObject): void => {
    if (root instanceof windowObject.Element && root.matches(`[${ATTR}]`)) void patchElement(root);
    root.querySelectorAll(`[${ATTR}]`).forEach((element) => void patchElement(element));
  };

  const handleMouseOver = (event: MouseEvent): void => {
    const target = event.target;
    if (!(target instanceof windowObject.Element)) return;
    const element = target.closest(`[${ATTR}]`);
    if (element) void patchElement(element);
  };
  const observer = new windowObject.MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "attributes" && mutation.target instanceof windowObject.Element) {
        void patchElement(mutation.target);
      } else {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof windowObject.Element) scan(node);
        });
      }
    }
  });

  scan();
  documentObject.addEventListener("mouseover", handleMouseOver, true);
  observer.observe(documentObject.documentElement || documentObject, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: [ATTR],
  });

  return {
    installed: true,
    version: VERSION,
    disconnect: () => {
      observer.disconnect();
      documentObject.removeEventListener("mouseover", handleMouseOver, true);
      cache.clear();
    },
    status: () => ({ installed: true, version: VERSION, cachedTasks: cache.size, ...stats }),
  };
}
