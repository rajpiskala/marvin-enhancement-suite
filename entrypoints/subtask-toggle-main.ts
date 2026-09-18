import "../src/page/subtask-toggle.js";

export default defineUnlistedScript(() => {
  window.postMessage({ channel: "marvin-enhancement-suite", type: "feature-ready", feature: "subtaskToggle" }, "*");
});
