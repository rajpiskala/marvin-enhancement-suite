import { install } from "../src/page/subtask-toggle";

export default defineUnlistedScript(() => {
  const target = window as typeof window & { MESSubtaskToggle?: ReturnType<typeof install> };
  target.MESSubtaskToggle ??= install(document);
  window.postMessage({ channel: "marvin-enhancement-suite", type: "feature-ready", feature: "subtaskToggle" }, "*");
});
