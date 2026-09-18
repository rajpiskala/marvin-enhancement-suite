import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const iconDirectory = path.join(projectRoot, "public/icons");
const source = await readFile(path.join(projectRoot, "assets/icon.svg"));
const sizes = [16, 32, 48, 128];

await mkdir(iconDirectory, { recursive: true });

for (const size of sizes) {
  const renderer = new Resvg(source, {
    fitTo: { mode: "width", value: size },
    background: "rgba(0,0,0,0)",
  });
  const png = renderer.render().asPng();
  await writeFile(path.join(iconDirectory, `icon-${size}.png`), png);
}

console.log(`Generated ${sizes.length} extension icons from assets/icon.svg.`);

const storeDirectory = path.join(projectRoot, "store-assets");
await mkdir(storeDirectory, { recursive: true });
await copyFile(path.join(iconDirectory, "icon-128.png"), path.join(storeDirectory, "icon-128.png"));

for (const [sourceName, outputName] of [
  ["promo-small.svg", "promo-small-440x280.png"],
  ["promo-marquee.svg", "promo-marquee-1400x560.png"],
]) {
  const artwork = await readFile(path.join(projectRoot, "assets", sourceName));
  const png = new Resvg(artwork).render().asPng();
  await writeFile(path.join(storeDirectory, outputName), png);
}

console.log("Generated Chrome Web Store promotional artwork and listing icon.");
