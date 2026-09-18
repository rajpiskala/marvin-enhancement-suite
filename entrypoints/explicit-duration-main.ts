import "../src/page/explicit-duration.js";

export default defineUnlistedScript(() => {
  window.postMessage({ channel: "marvin-enhancement-suite", type: "feature-ready", feature: "explicitDurations" }, "*");
});
