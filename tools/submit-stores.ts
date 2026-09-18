import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(await readFile(path.join(projectRoot, "package.json"), "utf8")) as {
  name: string;
  version: string;
};
const artifact = (browser: string): string => path.join(
  projectRoot,
  ".output",
  `${packageJson.name}-${packageJson.version}-${browser}.zip`,
);
const sources = path.join(
  projectRoot,
  ".output",
  `${packageJson.name}-${packageJson.version}-sources.zip`,
);

const chromeZip = artifact("chrome");
const firefoxZip = artifact("firefox");
for (const file of [chromeZip, firefoxZip, sources]) await access(file);

const wxtCli = path.join(projectRoot, "node_modules/wxt/bin/wxt.mjs");
const args = [
  wxtCli,
  "submit",
  "--chrome-api-version",
  "v2",
  "--chrome-publish-type",
  "STAGED_PUBLISH",
  "--chrome-zip",
  chromeZip,
  "--firefox-channel",
  "listed",
  "--firefox-compatibility",
  "firefox",
  "--firefox-amo-metadata-file",
  path.join(projectRoot, "amo-metadata.json"),
  "--firefox-zip",
  firefoxZip,
  "--firefox-sources-zip",
  sources,
];

if (process.argv.includes("--dry-run")) args.push("--dry-run");

const result = spawnSync(process.execPath, args, {
  cwd: projectRoot,
  env: process.env,
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
