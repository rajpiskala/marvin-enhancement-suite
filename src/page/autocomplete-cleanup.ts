export const VERSION = "1.0.0";
export const RETRY_DELAYS_MS = [0, 0, 4, 8, 16, 32, 64, 128] as const;

const TASK_INPUT_SELECTOR = ".TaskInput__input";
const PATCH_FLAG = "__amAutocompleteCleanupRaceFixV1";

export interface AutocompleteStats {
  inputsSeen: number;
  instancesPatched: number;
  deletionsImmediate: number;
  deletionsRetried: number;
  retriesScheduled: number;
  skippedNoDeletes: number;
  abandoned: number;
  errors: number;
}

interface TaskInputInstance {
  addDeleter: SafeAddDeleter;
  props?: { noDeletes?: boolean };
  state?: { value?: string };
  unmounted?: boolean;
  [PATCH_FLAG]?: PatchMetadata;
}

interface PatchMetadata {
  originalAddDeleter: SafeAddDeleter;
  patchedAt: number;
  version: string;
}

interface ReactFiber {
  return?: ReactFiber | null;
  stateNode?: unknown;
}

interface Schedulers {
  queueMicrotask: (callback: () => void) => void;
  setTimeout: (callback: () => void, delay: number) => unknown;
}

type CleanupCounter = "deletionsImmediate" | "deletionsRetried";
type MarvinDeleter = () => unknown;
type SafeAddDeleter = (deleter: unknown) => unknown;

export interface AutocompleteRuntime {
  patchedInstances: WeakSet<TaskInputInstance>;
  seenInputs: WeakSet<Element>;
  stats: AutocompleteStats;
}

export interface AutocompleteCleanupHandle {
  installed: true;
  version: string;
  scan: (root?: ParentNode | Element) => number;
  status: () => AutocompleteStats & { installed: true; version: string };
  disconnect: () => void;
}

export function hasPendingMention(value: unknown): value is string {
  return typeof value === "string" && value.includes("@@@[");
}

export function createStats(): AutocompleteStats {
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

export function createSafeAddDeleter(
  stats: AutocompleteStats,
  schedulers: Partial<Schedulers> = {},
): SafeAddDeleter {
  const scheduleMicrotask = schedulers.queueMicrotask ?? queueMicrotask;
  const scheduleTimeout = schedulers.setTimeout ?? setTimeout;

  return function safeAddDeleter(this: TaskInputInstance, deleter: unknown): unknown {
    if (typeof deleter !== "function") return undefined;
    const typedDeleter = deleter as MarvinDeleter;

    if (this.props?.noDeletes) {
      stats.skippedNoDeletes += 1;
      return undefined;
    }

    const run = (counter: CleanupCounter): unknown => {
      try {
        const result = typedDeleter();
        stats[counter] += 1;
        return result;
      } catch (error) {
        stats.errors += 1;
        console.error("[Marvin autocomplete cleanup fix] Cleanup failed safely.", error);
        return undefined;
      }
    };

    if (hasPendingMention(this.state?.value)) return run("deletionsImmediate");

    stats.retriesScheduled += 1;
    let attempt = 0;
    let finished = false;

    const retry = (): void => {
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
      scheduleTimeout(retry, delay ?? 0);
    };

    scheduleMicrotask(retry);
    return undefined;
  };
}

function isTaskInputInstance(value: unknown): value is TaskInputInstance {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<TaskInputInstance>;
  return (
    typeof candidate.addDeleter === "function" &&
    typeof candidate.state === "object" &&
    typeof candidate.state?.value === "string"
  );
}

export function findTaskInputInstance(input: unknown): TaskInputInstance | null {
  if (!input || typeof input !== "object") return null;
  const carrier = input as Record<string, unknown>;
  const fiberKey = Object.keys(carrier).find(
    (key) => key.startsWith("__reactFiber$") || key.startsWith("__reactInternalInstance$"),
  );
  let fiber = (fiberKey ? carrier[fiberKey] : null) as ReactFiber | null | undefined;
  let depth = 0;

  while (fiber && depth < 60) {
    if (isTaskInputInstance(fiber.stateNode)) return fiber.stateNode;
    fiber = fiber.return;
    depth += 1;
  }

  return null;
}

export function patchTaskInput(input: Element, runtime: AutocompleteRuntime): boolean {
  if (!input.matches(TASK_INPUT_SELECTOR)) return false;

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
    } satisfies PatchMetadata,
    writable: false,
  });

  instance.addDeleter = safeAddDeleter;
  runtime.patchedInstances.add(instance);
  runtime.stats.instancesPatched += 1;
  return true;
}

export function install(documentObject: Document): AutocompleteCleanupHandle {
  const windowObject = documentObject.defaultView ?? window;
  const runtime: AutocompleteRuntime = {
    patchedInstances: new WeakSet(),
    seenInputs: new WeakSet(),
    stats: createStats(),
  };

  const scan = (root: ParentNode | Element = documentObject): number => {
    const inputs: Element[] = [];
    if (root instanceof windowObject.Element && root.matches(TASK_INPUT_SELECTOR)) inputs.push(root);
    root.querySelectorAll(TASK_INPUT_SELECTOR).forEach((input) => inputs.push(input));
    inputs.forEach((input) => patchTaskInput(input, runtime));
    return inputs.length;
  };

  const handleFocus = (event: FocusEvent): void => {
    const target = event.target;
    if (!(target instanceof windowObject.Element)) return;
    const input = target.closest(TASK_INPUT_SELECTOR);
    if (input) patchTaskInput(input, runtime);
  };

  const observer = new windowObject.MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof windowObject.Element) scan(node);
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
    status: () => ({ installed: true, version: VERSION, ...runtime.stats }),
    disconnect: () => {
      observer.disconnect();
      documentObject.removeEventListener("focusin", handleFocus, true);
    },
  };
}
