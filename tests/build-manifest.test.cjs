const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const REQUIRED_PAGE_SCRIPTS = [
  "autocomplete-main.js",
  "explicit-duration-main.js",
  "procrastination-main.js",
  "subtask-toggle-main.js",
];

function manifestFor(browserBuild) {
  const manifestPath = path.join(__dirname, "..", ".output", browserBuild, "manifest.json");
  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

for (const browserBuild of ["chrome-mv3", "firefox-mv2"]) {
  test(`${browserBuild} exposes every injected page-world script`, () => {
    const manifest = manifestFor(browserBuild);
    const resources = (manifest.web_accessible_resources || []).flatMap((entry) => {
      if (typeof entry === "string") return [entry];
      if (Array.isArray(entry)) return entry;
      return entry.resources || [];
    });

    for (const script of REQUIRED_PAGE_SCRIPTS) {
      assert.ok(resources.includes(script), `${script} is missing from ${browserBuild} web-accessible resources`);
    }
  });
}

test("both builds keep Marvin API access optional", () => {
  const chrome = manifestFor("chrome-mv3");
  const firefox = manifestFor("firefox-mv2");
  assert.deepEqual(chrome.optional_host_permissions, ["https://serv.amazingmarvin.com/*"]);
  assert.deepEqual(firefox.optional_permissions, ["https://serv.amazingmarvin.com/*"]);
});
