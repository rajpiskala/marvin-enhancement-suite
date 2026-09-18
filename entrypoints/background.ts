import { browser } from "wxt/browser";
import { executeMarvinRequest } from "../src/unroller-api";
import { getSettings } from "../src/settings";
import { canUseTaskUnroller, isAllowedMarvinUrl } from "../src/security";

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: unknown, sender) => {
    if (!message || typeof message !== "object") return undefined;
    const candidate = message as { type?: unknown; operation?: unknown; payload?: unknown };
    if (candidate.type !== "mes:marvin-api") return undefined;
    if (!isAllowedMarvinUrl(sender.url)) {
      return Promise.reject(new Error("MES rejected a Marvin API request from an unexpected page."));
    }
    if (!["readDoc", "updateDoc", "addTask"].includes(String(candidate.operation))) {
      return Promise.reject(new Error("Unsupported Marvin operation."));
    }

    return getSettings().then((settings) => {
      if (!canUseTaskUnroller(settings)) {
        throw new Error("Task Unroller is disabled in MES settings.");
      }

      return executeMarvinRequest(
        {
          operation: candidate.operation as "readDoc" | "updateDoc" | "addTask",
          payload: candidate.payload,
        },
        settings,
      );
    });
  });
});
