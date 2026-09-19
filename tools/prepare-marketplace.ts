import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

interface PackageMetadata {
  name: string;
  version: string;
}

const projectRoot = path.resolve(import.meta.dirname, "..");
const outputRoot = path.join(projectRoot, ".output");
const marketplaceRoot = path.join(outputRoot, "marketplace");
const packageMetadata = JSON.parse(
  await readFile(path.join(projectRoot, "package.json"), "utf8"),
) as PackageMetadata;
const basename = `${packageMetadata.name}-${packageMetadata.version}`;

const files = [
  {
    source: path.join(outputRoot, `${basename}-chrome.zip`),
    destination: path.join("chrome", `${basename}-chrome.zip`),
  },
  {
    source: path.join(projectRoot, "store-assets", "icon-128.png"),
    destination: path.join("chrome", "icon-128.png"),
  },
  {
    source: path.join(projectRoot, "store-assets", "screenshot-popup-1280x800.png"),
    destination: path.join("chrome", "screenshot-popup-1280x800.png"),
  },
  {
    source: path.join(projectRoot, "store-assets", "promo-small-440x280.png"),
    destination: path.join("chrome", "promo-small-440x280.png"),
  },
  {
    source: path.join(projectRoot, "store-assets", "promo-marquee-1400x560.png"),
    destination: path.join("chrome", "promo-marquee-1400x560.png"),
  },
  {
    source: path.join(outputRoot, `${basename}-firefox.zip`),
    destination: path.join("firefox", `${basename}-firefox.zip`),
  },
  {
    source: path.join(outputRoot, `${basename}-sources.zip`),
    destination: path.join("firefox", `${basename}-sources.zip`),
  },
  {
    source: path.join(projectRoot, "store-assets", "icon-128.png"),
    destination: path.join("firefox", "icon-128.png"),
  },
  {
    source: path.join(projectRoot, "store-assets", "screenshot-popup-1280x800.png"),
    destination: path.join("firefox", "screenshot-popup-1280x800.png"),
  },
] as const;

await rm(marketplaceRoot, { force: true, recursive: true });
await Promise.all([
  mkdir(path.join(marketplaceRoot, "chrome"), { recursive: true }),
  mkdir(path.join(marketplaceRoot, "firefox"), { recursive: true }),
]);

const checksums: string[] = [];
for (const file of files) {
  const source = await readFile(file.source);
  const destination = path.join(marketplaceRoot, file.destination);
  await copyFile(file.source, destination);
  const copied = await readFile(destination);
  assert.equal(copied.equals(source), true, `${file.destination} changed while it was copied`);
  checksums.push(`${createHash("sha256").update(copied).digest("hex")}  ${file.destination.replaceAll("\\", "/")}`);
}

await copyFile(
  path.join(projectRoot, "docs", "store-listing.md"),
  path.join(marketplaceRoot, "LISTING.md"),
);

const checklist = `# Marketplace upload checklist

Prepared for Marvin Enhancement Suite ${packageMetadata.version}.

## Chrome Web Store

1. Upload \`chrome/${basename}-chrome.zip\` as the extension package.
2. Upload \`chrome/icon-128.png\` as the store icon.
3. Upload \`chrome/screenshot-popup-1280x800.png\` as the main screenshot.
4. Upload \`chrome/promo-small-440x280.png\` as the small promotional tile.
5. Optionally upload \`chrome/promo-marquee-1400x560.png\` as the marquee image.
6. Copy the listing and privacy answers from \`LISTING.md\`.

## Firefox Add-ons

1. Upload \`firefox/${basename}-firefox.zip\` as the add-on package.
2. Upload \`firefox/${basename}-sources.zip\` when AMO asks for source code.
3. Upload \`firefox/icon-128.png\` and \`firefox/screenshot-popup-1280x800.png\` as listing artwork.
4. Copy the listing, data declaration, and reviewer notes from \`LISTING.md\`.

## Before submission

- Compare the package checksums with \`SHA256SUMS.txt\`.
- Confirm the version is new in \`package.json\`, \`package-lock.json\`, and \`CHANGELOG.md\`.
- Smoke-test the packaged extension in both Chrome and Firefox.
- Confirm the listing, permissions, privacy answers, and artwork still match the build.
- Keep Chrome on staged publishing until the approved release date.
`;

await Promise.all([
  writeFile(path.join(marketplaceRoot, "SHA256SUMS.txt"), `${checksums.join("\n")}\n`),
  writeFile(path.join(marketplaceRoot, "UPLOAD-CHECKLIST.md"), checklist),
]);

console.log(`Prepared marketplace uploads in ${path.relative(projectRoot, marketplaceRoot)}.`);
