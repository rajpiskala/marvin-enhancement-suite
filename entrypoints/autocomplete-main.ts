import "../src/page/autocomplete-cleanup.js";

export default defineUnlistedScript(() => {
  window.postMessage({ channel: "marvin-enhancement-suite", type: "feature-ready", feature: "autocompleteCleanup" }, "*");
});
