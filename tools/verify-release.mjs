import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import yauzl from "yauzl";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const version = packageJson.version;
const expectedIcons = {
  16: "icons/icon-16.png",
  32: "icons/icon-32.png",
  48: "icons/icon-48.png",
  128: "icons/icon-128.png",
};

function readZip(filename) {
  return new Promise((resolve, reject) => {
    yauzl.open(filename, { lazyEntries: true, validateEntrySizes: true }, (openError, zipFile) => {
      if (openError) {
        reject(openError);
        return;
      }

      const entries = new Map();
      zipFile.on("error", reject);
      zipFile.on("end", () => resolve(entries));
      zipFile.on("entry", (entry) => {
        const normalized = path.posix.normalize(entry.fileName);
        if (
          path.posix.isAbsolute(entry.fileName)
          || entry.fileName.includes("\\")
          || normalized === ".."
          || normalized.startsWith("../")
        ) {
          reject(new Error(`Unsafe ZIP entry: ${entry.fileName}`));
          return;
        }
        if (entries.has(entry.fileName)) {
          reject(new Error(`Duplicate ZIP entry: ${entry.fileName}`));
          return;
        }
        if (entry.fileName.endsWith("/")) {
          zipFile.readEntry();
          return;
        }

        zipFile.openReadStream(entry, (streamError, stream) => {
          if (streamError) {
            reject(streamError);
            return;
          }
          const chunks = [];
          stream.on("error", reject);
          stream.on("data", (chunk) => chunks.push(chunk));
          stream.on("end", () => {
            entries.set(entry.fileName, Buffer.concat(chunks));
            zipFile.readEntry();
          });
        });
      });
      zipFile.readEntry();
    });
  });
}

async function listFiles(directory, relativeDirectory = "") {
  const entries = await readdir(path.join(directory, relativeDirectory), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relativePath = relativeDirectory
      ? `${relativeDirectory}/${entry.name}`
      : entry.name;
    if (entry.isDirectory()) files.push(...await listFiles(directory, relativePath));
    else files.push(relativePath);
  }
  return files.sort();
}

function pngDimensions(contents) {
  assert.equal(contents.subarray(1, 4).toString("ascii"), "PNG");
  return {
    width: contents.readUInt32BE(16),
    height: contents.readUInt32BE(20),
  };
}

for (const [browser, outputDirectory] of [
  ["chrome", ".output/chrome-mv3"],
  ["firefox", ".output/firefox-mv2"],
]) {
  const manifest = JSON.parse(await readFile(`${outputDirectory}/manifest.json`, "utf8"));
  const action = manifest.action || manifest.browser_action;
  assert.equal(manifest.version, version);
  assert.equal(manifest.name, "Marvin Enhancement Suite");
  assert.equal(manifest.homepage_url, "https://github.com/rajpiskala/marvin-enhancement-suite");
  assert.deepEqual(manifest.icons, expectedIcons);
  assert.deepEqual(action.default_icon, expectedIcons);
  assert.equal(action.default_popup, "popup.html");
  assert.deepEqual(manifest.content_scripts[0].matches, ["https://app.amazingmarvin.com/*"]);
  assert.equal(manifest.content_scripts[0].run_at, "document_start");

  if (browser === "chrome") {
    assert.equal(manifest.manifest_version, 3);
    assert.deepEqual(manifest.permissions, ["storage"]);
    assert.deepEqual(manifest.host_permissions, ["https://app.amazingmarvin.com/*"]);
    assert.deepEqual(manifest.optional_host_permissions, ["https://serv.amazingmarvin.com/*"]);
    assert.equal("browser_specific_settings" in manifest, false);
  } else {
    assert.equal(manifest.manifest_version, 2);
    assert.deepEqual(manifest.permissions, ["storage", "https://app.amazingmarvin.com/*"]);
    assert.deepEqual(manifest.optional_permissions, ["https://serv.amazingmarvin.com/*"]);
    assert.equal(manifest.browser_specific_settings.gecko.id, "marvin-enhancement-suite@rajpiskala");
    assert.equal(manifest.browser_specific_settings.gecko.strict_min_version, "140.0");
    assert.equal(manifest.browser_specific_settings.gecko_android.strict_min_version, "142.0");
    assert.deepEqual(manifest.browser_specific_settings.gecko.data_collection_permissions, {
      required: ["none"],
      optional: ["authenticationInfo", "websiteContent"],
    });
  }

  const outputFiles = await listFiles(outputDirectory);
  const archivePath = `.output/${packageJson.name}-${version}-${browser}.zip`;
  const archivedFiles = await readZip(archivePath);
  assert.deepEqual([...archivedFiles.keys()].sort(), outputFiles);
  for (const file of outputFiles) {
    const unpacked = await readFile(path.join(outputDirectory, file));
    assert.equal(archivedFiles.get(file).equals(unpacked), true, `${browser}/${file} differs in the ZIP`);
    if (file.endsWith(".js")) {
      const source = unpacked.toString("utf8");
      assert.doesNotMatch(source, /\beval\s*\(/);
      assert.doesNotMatch(source, /\bnew\s+Function\s*\(/);
      assert.doesNotMatch(source, /\bimportScripts\s*\(\s*["']https?:/);
    }
  }

  for (const [size, iconPath] of Object.entries(expectedIcons)) {
    assert.deepEqual(pngDimensions(archivedFiles.get(iconPath)), {
      width: Number(size),
      height: Number(size),
    });
  }
}

const sourceArchive = await readZip(`.output/${packageJson.name}-${version}-sources.zip`);
const sourceNames = [...sourceArchive.keys()].sort();
for (const required of [
  "docs/amo-source-submission.md",
  "entrypoints/app.content.ts",
  "package-lock.json",
  "package.json",
  "src/settings.ts",
  "tools/generate-icons.mjs",
  "tsconfig.json",
  "wxt.config.ts",
]) {
  assert.equal(sourceArchive.has(required), true, `Source archive is missing ${required}`);
}
for (const filename of sourceNames) {
  assert.doesNotMatch(filename, /(^|\/)(?:\.env|\.git|\.output|\.wxt|dev|node_modules)(?:\/|$)/);
  assert.doesNotMatch(filename, /(?:credential|secret|token)s?\.json$/i);
}
const reviewerInstructions = sourceArchive.get("docs/amo-source-submission.md").toString("utf8");
assert.match(reviewerInstructions, /npm ci/);
assert.match(reviewerInstructions, /npm run build-for-amo/);
assert.match(reviewerInstructions, /Node\.js 22\.13\.0 or newer/);

const storeAssets = new Map([
  ["store-assets/icon-128.png", { width: 128, height: 128 }],
  ["store-assets/screenshot-popup-1280x800.png", { width: 1280, height: 800 }],
  ["store-assets/promo-small-440x280.png", { width: 440, height: 280 }],
  ["store-assets/promo-marquee-1400x560.png", { width: 1400, height: 560 }],
  ["docs/assets/mes-popup.png", { width: 380, height: 948 }],
]);
for (const [filename, dimensions] of storeAssets) {
  assert.deepEqual(pngDimensions(await readFile(filename)), dimensions, `${filename} has the wrong dimensions`);
  assert.equal(sourceArchive.has(filename), true, `Source archive is missing ${filename}`);
}

const amoMetadata = JSON.parse(await readFile("amo-metadata.json", "utf8"));
assert.equal(amoMetadata.summary["en-US"], "Fix Amazing Marvin browser bugs and add opt-in workflow tools.");
assert.equal(amoMetadata.version.license, packageJson.license);
assert.match(await readFile("CHANGELOG.md", "utf8"), new RegExp(`^## ${version.replaceAll(".", "\\.")}\\b`, "m"));

console.log("Verified Chrome, Firefox, and AMO source archives, manifests, icons, policy fields, and byte parity.");
