import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';

function arg(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

const input = arg('input');
const output = arg('output');
const maxEdge = Number(arg('max-edge', '640'));

if (!input || !output) {
  throw new Error('Usage: node scripts/optimize-newspaper-sticker.mjs --input transparent.png --output sticker.webp [--max-edge 640]');
}

const source = sharp(input, { failOn: 'error' });
const { data, info } = await source.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
let minX = info.width;
let minY = info.height;
let maxX = -1;
let maxY = -1;
let opaquePixels = 0;
let transparentPixels = 0;

for (let y = 0; y < info.height; y += 1) {
  for (let x = 0; x < info.width; x += 1) {
    const alpha = data[((y * info.width) + x) * 4 + 3];
    if (alpha <= 8) {
      transparentPixels += 1;
      continue;
    }
    if (alpha >= 245) opaquePixels += 1;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
}

if (maxX < minX || maxY < minY) throw new Error(`No visible sticker pixels in ${input}`);
if (transparentPixels < info.width * info.height * 0.04) {
  throw new Error(`Transparent exterior is missing or too small in ${input}`);
}

const padding = 10;
const left = Math.max(0, minX - padding);
const top = Math.max(0, minY - padding);
const right = Math.min(info.width - 1, maxX + padding);
const bottom = Math.min(info.height - 1, maxY + padding);

await fs.mkdir(path.dirname(output), { recursive: true });
await source
  .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
  .resize({
    width: maxEdge,
    height: maxEdge,
    fit: 'inside',
    withoutEnlargement: true,
  })
  .webp({ quality: 76, alphaQuality: 96, effort: 6, smartSubsample: true })
  .toFile(output);

const final = await sharp(output).metadata();
const stat = await fs.stat(output);
if (!final.hasAlpha) throw new Error(`Final WebP has no alpha channel: ${output}`);

process.stdout.write(`${JSON.stringify({
  output,
  width: final.width,
  height: final.height,
  bytes: stat.size,
  sourceOpaqueRatio: opaquePixels / (info.width * info.height),
})}\n`);
