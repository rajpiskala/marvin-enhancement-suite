import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assetDirectory = path.join(projectRoot, "assets");
const iconDirectory = path.join(projectRoot, "public/icons");
const iconSource = path.join(assetDirectory, "icon-source.png");
const sizes = [16, 32, 48, 128];

await mkdir(iconDirectory, { recursive: true });

async function renderIcon(size: number): Promise<Buffer> {
  const cornerRadius = Math.round(size * (376 / 1254));
  const mask = Buffer.from(
    `<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${cornerRadius}" fill="#fff"/></svg>`,
  );
  return sharp(iconSource)
    .resize(size, size, { fit: "fill" })
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
}

for (const size of sizes) {
  const png = await renderIcon(size);
  await writeFile(path.join(iconDirectory, `icon-${size}.png`), png);
}

console.log(`Generated ${sizes.length} extension icons from assets/icon-source.png.`);

const storeDirectory = path.join(projectRoot, "store-assets");
await mkdir(storeDirectory, { recursive: true });
await copyFile(path.join(iconDirectory, "icon-128.png"), path.join(storeDirectory, "icon-128.png"));

for (const [sourceName, outputName, iconSize, left, top] of [
  ["promo-small.svg", "promo-small-440x280.png", 160, 140, 60],
  ["promo-marquee.svg", "promo-marquee-1400x560.png", 400, 500, 80],
] as const) {
  const artwork = await readFile(path.join(projectRoot, "assets", sourceName));
  const background = new Resvg(artwork).render().asPng();
  const png = await sharp(background)
    .composite([{ input: await renderIcon(iconSize), left, top }])
    .png()
    .toBuffer();
  await writeFile(path.join(storeDirectory, outputName), png);
}

console.log("Generated Chrome Web Store promotional artwork and listing icon.");
