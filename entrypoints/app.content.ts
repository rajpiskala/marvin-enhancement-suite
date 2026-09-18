import { browser } from "wxt/browser";
import { getSettings, publicSettings, type FeatureId } from "../src/settings";

export default defineContentScript({
  matches: ["https://app.amazingmarvin.com/*"],
  runAt: "document_start",
  async main() {
    browser.runtime.onMessage.addListener(async (message: unknown) => {
      if (!isUndoLatestRequest(message)) return undefined;
      const unroller = (globalThis as typeof globalThis & {
        MESTaskUnroller?: { undoLatest?: () => Promise<{ id?: string; createdTaskIds?: unknown[] }> };
      }).MESTaskUnroller;
      if (!unroller?.undoLatest) throw new Error("Task Unroller is not enabled in this Marvin tab.");
      const receipt = await unroller.undoLatest();
      return {
        ok: true,
        receiptId: receipt.id || null,
        createdTaskCount: Array.isArray(receipt.createdTaskIds) ? receipt.createdTaskIds.length : 0,
      };
    });

    const settings = await getSettings();
    const root = document.documentElement || (await waitForDocumentElement());
    root.dataset.mesLoaded = "true";
    root.dataset.mesSettings = JSON.stringify(publicSettings(settings));

    if (!settings.masterEnabled) {
      root.dataset.mesStatus = "paused";
      return;
    }

    const enabled = Object.entries(settings.features).filter(([, value]) => value) as Array<[FeatureId, boolean]>;
    for (const [featureId] of enabled) {
      try {
        await startFeature(featureId);
      } catch (error) {
        console.error(`[MES] Could not start ${featureId}.`, error);
      }
    }

    root.dataset.mesStatus = "active";
    root.dataset.mesFeatures = enabled.map(([featureId]) => featureId).join(",");
  },
});

function isUndoLatestRequest(message: unknown): message is { type: "mes:task-unroller:undo-latest" } {
  return Boolean(message && typeof message === "object" && "type" in message && message.type === "mes:task-unroller:undo-latest");
}

async function startFeature(featureId: FeatureId): Promise<void> {
  // Keep injected paths as literals: WXT discovers these calls at build time
  // and adds the files to web_accessible_resources automatically.
  switch (featureId) {
    case "autocompleteCleanup":
      await injectScript("/autocomplete-main.js", { keepInDom: true });
      return;
    case "procrastinationDate":
      await injectScript("/procrastination-main.js", { keepInDom: true });
      return;
    case "explicitDurations":
      await injectScript("/explicit-duration-main.js", { keepInDom: true });
      return;
    case "subtaskToggle":
      await injectScript("/subtask-toggle-main.js", { keepInDom: true });
      return;
    case "taskUnroller":
      Object.defineProperty(globalThis, "__MES_API_REQUEST__", {
        configurable: true,
        value: (operation: string, payload: unknown) =>
          browser.runtime.sendMessage({ type: "mes:marvin-api", operation, payload }),
      });
      {
        const { install } = await import("../src/page/task-unroller");
        const target = globalThis as typeof globalThis & { MESTaskUnroller?: ReturnType<typeof install> };
        target.MESTaskUnroller ??= install(document);
      }
      return;
  }
}

function waitForDocumentElement(): Promise<HTMLElement> {
  return new Promise((resolve) => {
    const check = () => {
      if (document.documentElement) resolve(document.documentElement);
      else requestAnimationFrame(check);
    };
    check();
  });
}
