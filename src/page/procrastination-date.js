(function bootstrap(root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (!root?.document || root.MESProcrastinationDate?.installed) return;
  root.MESProcrastinationDate = api.install(root.document);
})(typeof window === "undefined" ? globalThis : window, function createApi() {
  "use strict";

  const VERSION = "0.1.0";
  const ATTR = "data-lhover3";
  const TOOLTIP_PATTERN = /(procrastinated\s*:\s*)\d+/i;
  const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
  const TASK_SELECTOR = '[data-item-id], [data-uid]';

  function taskIdForElement(element) {
    const row = element?.closest?.(TASK_SELECTOR);
    return row?.getAttribute("data-item-id") || row?.getAttribute("data-uid") || "";
  }

  function withSinceDate(text, firstScheduled) {
    if (typeof text !== "string" || !TOOLTIP_PATTERN.test(text)) return null;
    if (!DATE_PATTERN.test(String(firstScheduled || ""))) return null;
    const base = text.replace(/\s*\(since\s+\d{4}-\d{2}-\d{2}\)\s*$/i, "");
    return `${base} (since ${firstScheduled})`;
  }

  function indexedDbRequest(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function pouchDatabaseNames(windowObject) {
    if (!windowObject.indexedDB) return [];
    if (typeof windowObject.indexedDB.databases === "function") {
      try {
        const databases = await windowObject.indexedDB.databases();
        return databases.map((database) => database.name).filter((name) => name?.startsWith("_pouch_"));
      } catch (_) {
        // Fall through to localStorage hints.
      }
    }
    return Object.keys(windowObject.localStorage || {}).filter((key) => key.startsWith("_pouch_"));
  }

  function normalizeLocalDoc(doc, itemId) {
    if (!doc || doc._deleted) return null;
    const id = doc._id || String(doc._doc_id_rev || "").split("::")[0] || itemId;
    return id === itemId ? { ...doc, _id: id } : null;
  }

  function readByCursor(db, itemId) {
    return new Promise((resolve, reject) => {
      if (!db.objectStoreNames.contains("by-sequence")) {
        resolve(null);
        return;
      }
      const transaction = db.transaction("by-sequence", "readonly");
      const request = transaction.objectStore("by-sequence").openCursor(null, "prev");
      request.onsuccess = (event) => {
        const cursor = event.target.result;
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

  async function readFromDatabase(db, itemId) {
    if (!db.objectStoreNames.contains("document-store")) return readByCursor(db, itemId);
    const transaction = db.transaction("document-store", "readonly");
    const meta = await indexedDbRequest(transaction.objectStore("document-store").get(itemId));
    let parsed = null;
    if (meta?.data) {
      try {
        parsed = JSON.parse(meta.data);
      } catch (_) {
        parsed = null;
      }
    }
    const sequence = meta?.seq ?? parsed?.seq;
    if (sequence == null || !db.objectStoreNames.contains("by-sequence")) return readByCursor(db, itemId);
    const docTransaction = db.transaction("by-sequence", "readonly");
    return (
      normalizeLocalDoc(await indexedDbRequest(docTransaction.objectStore("by-sequence").get(sequence)), itemId) ||
      readByCursor(db, itemId)
    );
  }

  async function readLocalDoc(windowObject, itemId) {
    const names = await pouchDatabaseNames(windowObject);
    for (const name of names) {
      let db;
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

  function install(documentObject) {
    const windowObject = documentObject.defaultView || globalThis;
    const cache = new Map();
    const inFlight = new WeakSet();
    const stats = { exactDatesApplied: 0, missingTaskId: 0, missingFirstScheduled: 0, errors: 0 };

    const patchElement = async (element) => {
      if (!(element instanceof windowObject.Element) || !element.hasAttribute(ATTR) || inFlight.has(element)) return;
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
          firstScheduled = DATE_PATTERN.test(String(doc?.firstScheduled || "")) ? doc.firstScheduled : null;
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

    const scan = (root = documentObject) => {
      if (root?.matches?.(`[${ATTR}]`)) void patchElement(root);
      root?.querySelectorAll?.(`[${ATTR}]`).forEach((element) => void patchElement(element));
    };

    const handleMouseOver = (event) => {
      const element = event.target?.closest?.(`[${ATTR}]`);
      if (element) void patchElement(element);
    };
    const observer = new windowObject.MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "attributes") void patchElement(mutation.target);
        else mutation.addedNodes.forEach((node) => node?.nodeType === 1 && scan(node));
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
      disconnect() {
        observer.disconnect();
        documentObject.removeEventListener("mouseover", handleMouseOver, true);
        cache.clear();
      },
      status() {
        return { installed: true, version: VERSION, cachedTasks: cache.size, ...stats };
      },
    };
  }

  return { VERSION, install, normalizeLocalDoc, taskIdForElement, withSinceDate };
});
