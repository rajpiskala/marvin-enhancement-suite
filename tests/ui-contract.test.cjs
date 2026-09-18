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

test("popup explains that changes do not need a browser restart", () => {
  const popup = read("entrypoints/popup/index.html");
  assert.match(popup, /No browser restart needed\./);
  assert.match(popup, /reloads open Marvin tabs/);
});

test("the shared theme uses Marvin-inspired Outfit typography and extension teal", () => {
  const theme = read("src/ui/theme.css");
  assert.match(theme, /@fontsource-variable\/outfit\/wght\.css/);
  assert.match(theme, /--mes-teal:\s*#1cc5cb/i);
  assert.match(theme, /"Outfit Variable"/);
});

test("Task Unroller setup and recovery live in the popup without global credential gating", () => {
  const html = read("entrypoints/popup/index.html");
  assert.match(html, /id="unroller-setup"/);
  assert.match(html, /id="api-token"/);
  assert.match(html, /id="full-access-token"/);
  assert.match(html, /id="save-credentials"/);
  assert.match(html, /id="undo-unroll"/);
  assert.match(html, /Only Task Unroller needs API credentials\./);
  assert.doesNotMatch(html, /advanced-settings/);
  assert.match(html, /class="chevron"/);
});

test("module descriptions explain the user-visible result", () => {
  const html = read("entrypoints/popup/index.html");
  assert.match(html, /autocomplete markup in a task title/);
  assert.match(html, /exact start date to Marvin’s “days procrastinated” tooltip/);
  assert.match(html, /Override Marvin auto-detected time estimates/);
  assert.match(html, /Watch the 4 Hour Race ~1h/);
  assert.match(html, /Mark all subtasks done or undone/);
  assert.match(html, /Watch lecture \(1\/6\) ~30m/);
  assert.match(html, /offsets any start time/);
});
