// Renders app/icon.svg into the raster icons Next.js serves.
// Run after changing the logo: `node scripts/build-icons.mjs` (sharp ships with Next.js).
import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const svg = await readFile(new URL("../app/icon.svg", import.meta.url));
const png = (size) => sharp(svg, { density: 72 * (size / 64) * 4 }).resize(size, size).png().toBuffer();

/** Packs PNG images into one .ico file (PNG-in-ICO, supported by every current browser). */
function toIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const entries = [];
  let offset = 6 + 16 * images.length;
  for (const { size, data } of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += data.length;
  }
  return Buffer.concat([header, ...entries, ...images.map((image) => image.data)]);
}

const icoSizes = [16, 32, 48];
const ico = toIco(await Promise.all(icoSizes.map(async (size) => ({ size, data: await png(size) }))));
await writeFile(new URL("../app/favicon.ico", import.meta.url), ico);
await writeFile(new URL("../app/apple-icon.png", import.meta.url), await png(180));
await writeFile(new URL("../public/icon-192.png", import.meta.url), await png(192));
await writeFile(new URL("../public/icon-512.png", import.meta.url), await png(512));
console.log("Wrote app/favicon.ico, app/apple-icon.png, public/icon-192.png, public/icon-512.png");
