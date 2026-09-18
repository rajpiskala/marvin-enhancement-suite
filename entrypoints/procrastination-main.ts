import { install } from "../src/page/procrastination-date";

export default defineUnlistedScript(() => {
  const target = window as typeof window & { MESProcrastinationDate?: ReturnType<typeof install> };
  target.MESProcrastinationDate ??= install(document);
  window.postMessage({ channel: "marvin-enhancement-suite", type: "feature-ready", feature: "procrastinationDate" }, "*");
});
