import { install } from "../src/page/autocomplete-cleanup";

export default defineUnlistedScript(() => {
  const target = window as typeof window & { AMMarvinAutocompleteCleanupFix?: ReturnType<typeof install> };
  target.AMMarvinAutocompleteCleanupFix ??= install(document);
  window.postMessage({ channel: "marvin-enhancement-suite", type: "feature-ready", feature: "autocompleteCleanup" }, "*");
});
