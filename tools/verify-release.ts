import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import yauzl from "yauzl";

const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
  license: string;
  name: string;
  version: string;
};
const version = packageJson.version;
const expectedIcons = {
  16: "icons/icon-16.png",
  32: "icons/icon-32.png",
  48: "icons/icon-48.png",
  128: "icons/icon-128.png",
};

interface ReleaseManifestAction {
  default_icon: Record<string, string>;
  default_popup: string;
}

interface ReleaseManifest {
  action?: ReleaseManifestAction;
  browser_action?: ReleaseManifestAction;
  browser_specific_settings?: {
    gecko: {
      data_collection_permissions: {
        optional: string[];
        required: string[];
      };
      id: string;
      strict_min_version: string;
    };
    gecko_android: {
      strict_min_version: string;
    };
  };
  content_scripts: Array<{
    matches: string[];
    run_at: string;
  }>;
  homepage_url: string;
  host_permissions?: string[];
  icons: Record<string, string>;
  manifest_version: number;
  name: string;
  optional_host_permissions?: string[];
  optional_permissions?: string[];
  permissions: string[];
  version: string;
}

function readZip(filename: string): Promise<Map<string, Buffer>> {
  return new Promise((resolve, reject) => {
    yauzl.open(filename, { lazyEntries: true, validateEntrySizes: true }, (openError, zipFile) => {
      if (openError) {
        reject(openError);
        return;
      }

      if (!zipFile) {
        reject(new Error(`Could not open ZIP: ${filename}`));
        return;
      }
      const entries = new Map<string, Buffer>();
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
          if (!stream) {
            reject(new Error(`Could not read ZIP entry: ${entry.fileName}`));
            return;
          }
          const chunks: Buffer[] = [];
          stream.on("error", reject);
          stream.on("data", (chunk: Buffer) => chunks.push(chunk));
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

async function listFiles(directory: string, relativeDirectory = ""): Promise<string[]> {
  const entries = await readdir(path.join(directory, relativeDirectory), { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const relativePath = relativeDirectory
      ? `${relativeDirectory}/${entry.name}`
      : entry.name;
    if (entry.isDirectory()) files.push(...await listFiles(directory, relativePath));
    else files.push(relativePath);
  }
  return files.sort();
}

function pngDimensions(contents: Buffer) {
  assert.equal(contents.subarray(1, 4).toString("ascii"), "PNG");
  return {
    width: contents.readUInt32BE(16),
    height: contents.readUInt32BE(20),
  };
}

for (const [browser, outputDirectory] of [
  ["chrome", ".output/chrome-mv3"],
  ["firefox", ".output/firefox-mv2"],
] as const) {
  const manifest = JSON.parse(await readFile(`${outputDirectory}/manifest.json`, "utf8")) as ReleaseManifest;
  const action = manifest.action || manifest.browser_action;
  const [contentScript] = manifest.content_scripts;
  assert.ok(action, `${browser} manifest does not define an extension action`);
  assert.ok(contentScript, `${browser} manifest does not define a content script`);
  assert.equal(manifest.version, version);
  assert.equal(manifest.name, "Marvin Enhancement Suite");
  assert.equal(manifest.homepage_url, "https://github.com/rajpiskala/marvin-enhancement-suite");
  assert.deepEqual(manifest.icons, expectedIcons);
  assert.deepEqual(action.default_icon, expectedIcons);
  assert.equal(action.default_popup, "popup.html");
  assert.deepEqual(contentScript.matches, ["https://app.amazingmarvin.com/*"]);
  assert.equal(contentScript.run_at, "document_start");

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
    assert.ok(manifest.browser_specific_settings, "Firefox manifest is missing browser-specific settings");
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
    assert.equal(archivedFiles.get(file)?.equals(unpacked), true, `${browser}/${file} differs in the ZIP`);
    if (file.endsWith(".js")) {
      const source = unpacked.toString("utf8");
      assert.doesNotMatch(source, /\beval\s*\(/);
      assert.doesNotMatch(source, /\bnew\s+Function\s*\(/);
      assert.doesNotMatch(source, /\bimportScripts\s*\(\s*["']https?:/);
    }
  }

  for (const [size, iconPath] of Object.entries(expectedIcons)) {
    const icon = archivedFiles.get(iconPath);
    assert.ok(icon, `Archive is missing ${iconPath}`);
    assert.deepEqual(pngDimensions(icon), {
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
  "tools/generate-icons.ts",
  "tsconfig.json",
  "wxt.config.ts",
]) {
  assert.equal(sourceArchive.has(required), true, `Source archive is missing ${required}`);
}
for (const filename of sourceNames) {
  assert.doesNotMatch(filename, /(^|\/)(?:\.env|\.git|\.output|\.wxt|dev|node_modules)(?:\/|$)/);
  assert.doesNotMatch(filename, /(?:credential|secret|token)s?\.json$/i);
}
const reviewerInstructionsFile = sourceArchive.get("docs/amo-source-submission.md");
assert.ok(reviewerInstructionsFile, "Source archive is missing AMO reviewer instructions");
const reviewerInstructions = reviewerInstructionsFile.toString("utf8");
assert.match(reviewerInstructions, /npm ci/);
assert.match(reviewerInstructions, /npm run build-for-amo/);
assert.match(reviewerInstructions, /Node\.js 22\.13\.0 or newer/);

const storeAssets = new Map([
  ["store-assets/icon-128.png", { width: 128, height: 128 }],
  ["store-assets/screenshot-popup-1280x800.png", { width: 1280, height: 800 }],
  ["store-assets/promo-small-440x280.png", { width: 440, height: 280 }],
  ["store-assets/promo-marquee-1400x560.png", { width: 1400, height: 560 }],
  ["docs/assets/mes-popup.png", { width: 760, height: 2004 }],
]);
for (const [filename, dimensions] of storeAssets) {
  assert.deepEqual(pngDimensions(await readFile(filename)), dimensions, `${filename} has the wrong dimensions`);
  assert.equal(sourceArchive.has(filename), true, `Source archive is missing ${filename}`);
}

const amoMetadata = JSON.parse(await readFile("amo-metadata.json", "utf8")) as {
  summary: Record<string, string>;
  version: { license: string };
};
assert.equal(amoMetadata.summary["en-US"], "Fix Amazing Marvin browser bugs and add opt-in workflow tools.");
assert.equal(amoMetadata.version.license, packageJson.license);
assert.match(await readFile("CHANGELOG.md", "utf8"), new RegExp(`^## ${version.replaceAll(".", "\\.")}\\b`, "m"));

console.log("Verified Chrome, Firefox, and AMO source archives, manifests, icons, policy fields, and byte parity.");
