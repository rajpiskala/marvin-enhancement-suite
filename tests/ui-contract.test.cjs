const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("popup exposes every module behind an explicit expandable options button", () => {
  const html = read("entrypoints/popup/index.html");
  const expectedIds = [
    "feature-autocomplete",
    "feature-procrastination",
    "feature-duration",
    "feature-subtasks",
    "feature-unroller",
  ];

  assert.match(html, /id="options-toggle"/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /aria-controls="customization-panel"/);
  assert.match(html, /id="customization-panel"[^>]*hidden/);
  for (const id of expectedIds) assert.match(html, new RegExp(`id="${id}"`));
});

test("popup and settings explain that changes do not need a browser restart", () => {
  const popup = read("entrypoints/popup/index.html");
  const options = read("entrypoints/options/index.html");
  assert.match(popup, /No browser restart needed\./);
  assert.match(options, /No browser restart needed\./);
  assert.match(popup, /reloads open Marvin tabs/);
  assert.match(options, /reloads open Marvin tabs/);
});

test("the shared theme uses Marvin-inspired Outfit typography and extension teal", () => {
  const theme = read("src/ui/theme.css");
  assert.match(theme, /@fontsource-variable\/outfit\/wght\.css/);
  assert.match(theme, /--mes-teal:\s*#1cc5cb/i);
  assert.match(theme, /"Outfit Variable"/);
});

test("advanced settings disclosure includes a visible action and chevron", () => {
  const html = read("entrypoints/options/index.html");
  assert.match(html, /id="advanced-summary-action">Show all 5 controls/);
  assert.match(html, /class="chevron"/);
});
