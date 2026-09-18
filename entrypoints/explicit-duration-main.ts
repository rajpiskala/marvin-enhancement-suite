import { install } from "../src/page/explicit-duration";

export default defineUnlistedScript(() => {
  const target = window as typeof window & { AMMarvinExplicitDurationFix?: ReturnType<typeof install> };
  target.AMMarvinExplicitDurationFix ??= install(document);
  window.postMessage({ channel: "marvin-enhancement-suite", type: "feature-ready", feature: "explicitDurations" }, "*");
});
