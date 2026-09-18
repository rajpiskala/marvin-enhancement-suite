// ==UserScript==
// @name         Amazing Marvin - Autocomplete Cleanup Race Fix
// @namespace    https://app.amazingmarvin.com/
// @version      1.0.0
// @description  Prevents accepted task autocompletions such as +T and #health from leaking into task titles when quick-add is submitted immediately.
// @author       Raj Piskala
// @match        https://app.amazingmarvin.com/*
// @match        https://amazingmarvin.com/*
// @grant        none
// ==/UserScript==

(function bootstrap(root, factory) {
  "use strict";

  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (!root?.document) return;
  if (root.AMMarvinAutocompleteCleanupFix?.installed) return;

  root.AMMarvinAutocompleteCleanupFix = api.install(root.document);
})(typeof window === "undefined" ? globalThis : window, function createApi() {
  "use strict";

  const VERSION = "1.0.0";
  const TASK_INPUT_SELECTOR = ".TaskInput__input";
  const PATCH_FLAG = "__amAutocompleteCleanupRaceFixV1";
  const RETRY_DELAYS_MS = [0, 0, 4, 8, 16, 32, 64, 128];

  function hasPendingMention(value) {
    return typeof value === "string" && value.includes("@@@[");
  }

  function createStats() {
    return {
      inputsSeen: 0,
      instancesPatched: 0,
      deletionsImmediate: 0,
      deletionsRetried: 0,
      retriesScheduled: 0,
      skippedNoDeletes: 0,
      abandoned: 0,
      errors: 0,
    };
  }

  function createSafeAddDeleter(stats, schedulers = {}) {
    const scheduleMicrotask = schedulers.queueMicrotask || queueMicrotask;
    const scheduleTimeout = schedulers.setTimeout || setTimeout;

    return function safeAddDeleter(deleter) {
      if (typeof deleter !== "function") return undefined;

      if (this.props?.noDeletes) {
        stats.skippedNoDeletes += 1;
        return undefined;
      }

      const run = (counter) => {
        try {
          const result = deleter();
          stats[counter] += 1;
          return result;
        } catch (error) {
          stats.errors += 1;
          console.error("[Marvin autocomplete cleanup fix] Cleanup failed safely.", error);
          return undefined;
        }
      };

      if (hasPendingMention(this.state?.value)) {
        return run("deletionsImmediate");
      }

      stats.retriesScheduled += 1;
      let attempt = 0;
      let finished = false;

      const retry = () => {
        if (finished) return;

        if (this.unmounted) {
          finished = true;
          stats.abandoned += 1;
          return;
        }

        if (hasPendingMention(this.state?.value)) {
          finished = true;
          run("deletionsRetried");
          return;
        }

        if (attempt >= RETRY_DELAYS_MS.length) {
          finished = true;
          stats.abandoned += 1;
          return;
        }

        const delay = RETRY_DELAYS_MS[attempt];
        attempt += 1;
        scheduleTimeout(retry, delay);
      };

      scheduleMicrotask(retry);
      return undefined;
    };
  }

  function findTaskInputInstance(input) {
    if (!input || typeof input !== "object") return null;

    const fiberKey = Object.keys(input).find(
      (key) => key.startsWith("__reactFiber$") || key.startsWith("__reactInternalInstance$"),
    );
    let fiber = fiberKey ? input[fiberKey] : null;
    let depth = 0;

    while (fiber && depth < 60) {
      const instance = fiber.stateNode;
      if (
        instance &&
        typeof instance === "object" &&
        typeof instance.addDeleter === "function" &&
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

  function patchTaskInput(input, runtime) {
    if (!input?.matches?.(TASK_INPUT_SELECTOR)) return false;

    if (!runtime.seenInputs.has(input)) {
      runtime.seenInputs.add(input);
      runtime.stats.inputsSeen += 1;
    }

    const instance = findTaskInputInstance(input);
    if (!instance) return false;
    if (instance[PATCH_FLAG] || runtime.patchedInstances.has(instance)) return true;

    const originalAddDeleter = instance.addDeleter;
    const safeAddDeleter = createSafeAddDeleter(runtime.stats);

    Object.defineProperty(instance, PATCH_FLAG, {
      configurable: false,
      enumerable: false,
      value: {
        originalAddDeleter,
        patchedAt: Date.now(),
        version: VERSION,
      },
      writable: false,
    });

    instance.addDeleter = safeAddDeleter;
    runtime.patchedInstances.add(instance);
    runtime.stats.instancesPatched += 1;
    return true;
  }

  function install(documentObject) {
    const windowObject = documentObject.defaultView || globalThis;
    const runtime = {
      patchedInstances: new WeakSet(),
      seenInputs: new WeakSet(),
      stats: createStats(),
    };

    const scan = (root = documentObject) => {
      const inputs = [];
      if (root?.matches?.(TASK_INPUT_SELECTOR)) inputs.push(root);
      root?.querySelectorAll?.(TASK_INPUT_SELECTOR).forEach((input) => inputs.push(input));
      inputs.forEach((input) => patchTaskInput(input, runtime));
      return inputs.length;
    };

    const handleFocus = (event) => {
      const input = event.target?.closest?.(TASK_INPUT_SELECTOR);
      if (input) patchTaskInput(input, runtime);
    };

    const MutationObserverClass = windowObject.MutationObserver || MutationObserver;
    const observer = new MutationObserverClass((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node?.nodeType === 1) scan(node);
        }
      }
    });

    scan();
    documentObject.addEventListener("focusin", handleFocus, true);
    observer.observe(documentObject.documentElement || documentObject, {
      childList: true,
      subtree: true,
    });

    return {
      installed: true,
      version: VERSION,
      scan,
      status() {
        return {
          installed: true,
          version: VERSION,
          ...runtime.stats,
        };
      },
      disconnect() {
        observer.disconnect();
        documentObject.removeEventListener("focusin", handleFocus, true);
      },
    };
  }

  return {
    RETRY_DELAYS_MS,
    VERSION,
    createSafeAddDeleter,
    createStats,
    findTaskInputInstance,
    hasPendingMention,
    install,
    patchTaskInput,
  };
});
