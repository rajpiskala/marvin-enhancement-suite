import "../src/page/procrastination-date.js";

export default defineUnlistedScript(() => {
  window.postMessage({ channel: "marvin-enhancement-suite", type: "feature-ready", feature: "procrastinationDate" }, "*");
});
