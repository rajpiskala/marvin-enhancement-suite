import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const version = process.argv[2];

if (!version || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error("Usage: npm run version:set -- <semver>");
}

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const result = spawnSync(npmCommand, ["version", "--no-git-tag-version", version], {
  cwd: projectRoot,
  stdio: "inherit",
});

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

const packageJson = JSON.parse(await readFile(path.join(projectRoot, "package.json"), "utf8"));
const packageLock = JSON.parse(await readFile(path.join(projectRoot, "package-lock.json"), "utf8"));
assert.equal(packageJson.version, version);
assert.equal(packageLock.version, version);
assert.equal(packageLock.packages[""].version, version);

console.log(`Set package and lockfile version to ${version}.`);
