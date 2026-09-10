import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';

function arg(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const inputDir = arg('input-dir');
const outputDir = arg('output-dir', 'tmp/newspaper-review');
const prefix = arg('prefix', 'review');
const columns = Number(arg('columns', '4'));
const rows = Number(arg('rows', '6'));

if (!inputDir) {
  throw new Error(
    'Usage: node scripts/build-newspaper-review-sheets.mjs --input-dir public/assets/... --output-dir tmp/review --prefix synastry',
  );
}
if (!Number.isInteger(columns) || columns < 1 || !Number.isInteger(rows) || rows < 1) {
  throw new Error('columns and rows must be positive integers');
}

async function listWebp(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) return listWebp(absolute);
    return entry.isFile() && entry.name.toLowerCase().endsWith('.webp') ? [absolute] : [];
  }));
  return nested.flat();
}

function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

const cellWidth = 330;
const cellHeight = 278;
const imageWidth = 286;
const imageHeight = 224;
const labelHeight = 30;
const pageSize = columns * rows;
const files = (await listWebp(path.resolve(inputDir))).sort((left, right) => (
  path.basename(left).localeCompare(path.basename(right), 'en', { numeric: true })
));

await fs.mkdir(path.resolve(outputDir), { recursive: true });
const outputs = [];

for (let start = 0; start < files.length; start += pageSize) {
  const pageFiles = files.slice(start, start + pageSize);
  const width = columns * cellWidth;
  const height = rows * cellHeight;
  const composites = [];

  for (let index = 0; index < pageFiles.length; index += 1) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const left = column * cellWidth;
    const top = row * cellHeight;
    const image = await sharp(pageFiles[index], { failOn: 'error' })
      .resize({
        width: imageWidth,
        height: imageHeight,
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
    const metadata = await sharp(image).metadata();
    const imageLeft = left + Math.floor((cellWidth - (metadata.width || imageWidth)) / 2);
    const imageTop = top + 12 + Math.floor((imageHeight - (metadata.height || imageHeight)) / 2);
    composites.push({ input: image, left: imageLeft, top: imageTop });

    const label = escapeXml(path.basename(pageFiles[index], '.webp'));
    const labelSvg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${cellWidth}" height="${labelHeight}">`
      + `<rect width="100%" height="100%" fill="#f7f6f2"/>`
      + `<text x="${cellWidth / 2}" y="19" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" fill="#151515">${label}</text>`
      + '</svg>',
    );
    composites.push({ input: labelSvg, left, top: top + imageHeight + 18 });
  }

  const page = String(Math.floor(start / pageSize) + 1).padStart(3, '0');
  const output = path.resolve(outputDir, `${prefix}-${page}.jpg`);
  await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: '#d8d6cf',
    },
  })
    .composite(composites)
    .jpeg({ quality: 86, chromaSubsampling: '4:4:4' })
    .toFile(output);
  outputs.push(output);
}

process.stdout.write(`${JSON.stringify({
  inputDir: path.resolve(inputDir),
  count: files.length,
  pages: outputs.length,
  outputs,
}, null, 2)}\n`);
