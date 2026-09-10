import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';

function readArg(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const input = readArg('input');
const outDir = readArg('out-dir');
const names = (readArg('names', '') ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const columns = Number(readArg('columns', '2'));
const rows = Number(readArg('rows', '2'));
const alphaThreshold = Number(readArg('alpha-threshold', '16'));
const padding = Number(readArg('padding', '8'));

if (!input || !outDir || names.length === 0) {
  throw new Error(
    'Usage: node scripts/split-newspaper-contact-sheet.mjs --input alpha-sheet.png --out-dir tmp/split --names first,second,third,fourth',
  );
}

if (
  !Number.isInteger(columns)
  || columns < 1
  || !Number.isInteger(rows)
  || rows < 1
  || names.length > columns * rows
) {
  throw new Error('rows/columns must be positive integers and provide one cell per name');
}

if (!Number.isFinite(alphaThreshold) || alphaThreshold < 0 || alphaThreshold > 254) {
  throw new Error('alpha-threshold must be between 0 and 254');
}

if (!Number.isInteger(padding) || padding < 1) {
  throw new Error('padding must be a positive integer');
}

const metadata = await sharp(input, { failOn: 'error' }).metadata();
if (!metadata.width || !metadata.height || metadata.hasAlpha !== true) {
  throw new Error(`Expected an alpha PNG produced by remove_chroma_key.py: ${input}`);
}

await fs.mkdir(outDir, { recursive: true });

const cellWidth = Math.floor(metadata.width / columns);
const cellHeight = Math.floor(metadata.height / rows);
const outputs = [];

function largestConnectedComponent(data, width, height) {
  const pixelCount = width * height;
  const visited = new Uint8Array(pixelCount);
  const stack = new Int32Array(pixelCount);
  let best = null;

  for (let index = 0; index < pixelCount; index += 1) {
    if (visited[index] || data[(index * 4) + 3] <= alphaThreshold) continue;

    let stackSize = 1;
    stack[0] = index;
    visited[index] = 1;
    let area = 0;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    const members = [];

    while (stackSize > 0) {
      const current = stack[--stackSize];
      const x = current % width;
      const y = Math.floor(current / width);
      members.push(current);
      area += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);

      const neighbors = [
        x > 0 ? current - 1 : -1,
        x + 1 < width ? current + 1 : -1,
        y > 0 ? current - width : -1,
        y + 1 < height ? current + width : -1,
      ];

      for (const neighbor of neighbors) {
        if (
          neighbor >= 0
          && !visited[neighbor]
          && data[(neighbor * 4) + 3] > alphaThreshold
        ) {
          visited[neighbor] = 1;
          stack[stackSize++] = neighbor;
        }
      }
    }

    if (!best || area > best.area) {
      best = { area, minX, minY, maxX, maxY, members };
    }
  }

  return best;
}

for (let cell = 0; cell < names.length; cell += 1) {
  const column = cell % columns;
  const row = Math.floor(cell / columns);
  const left = column * cellWidth;
  const top = row * cellHeight;
  const width = column === columns - 1 ? metadata.width - left : cellWidth;
  const height = row === rows - 1 ? metadata.height - top : cellHeight;
  const { data, info } = await sharp(input)
    .extract({ left, top, width, height })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const component = largestConnectedComponent(data, info.width, info.height);
  if (!component) throw new Error(`No opaque sticker component found in cell ${cell + 1}`);

  const cellArea = info.width * info.height;
  const opaqueRatio = component.area / cellArea;
  if (opaqueRatio < 0.015 || opaqueRatio > 0.92) {
    throw new Error(
      `Implausible sticker coverage in cell ${cell + 1}: ${(opaqueRatio * 100).toFixed(2)}%`,
    );
  }

  const cropLeft = Math.max(0, component.minX - padding);
  const cropTop = Math.max(0, component.minY - padding);
  const cropRight = Math.min(info.width - 1, component.maxX + padding);
  const cropBottom = Math.min(info.height - 1, component.maxY + padding);
  const output = path.join(outDir, `${names[cell]}.png`);

  let keep = new Uint8Array(info.width * info.height);
  for (const index of component.members) keep[index] = 1;
  for (let pass = 0; pass < 2; pass += 1) {
    const expanded = keep.slice();
    for (let index = 0; index < keep.length; index += 1) {
      if (keep[index] || data[(index * 4) + 3] === 0) continue;
      const x = index % info.width;
      const y = Math.floor(index / info.width);
      if (
        (x > 0 && keep[index - 1])
        || (x + 1 < info.width && keep[index + 1])
        || (y > 0 && keep[index - info.width])
        || (y + 1 < info.height && keep[index + info.width])
      ) expanded[index] = 1;
    }
    keep = expanded;
  }
  for (let index = 0; index < keep.length; index += 1) {
    if (keep[index]) continue;
    data[(index * 4)] = 0;
    data[(index * 4) + 1] = 0;
    data[(index * 4) + 2] = 0;
    data[(index * 4) + 3] = 0;
  }

  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .extract({
      left: cropLeft,
      top: cropTop,
      width: cropRight - cropLeft + 1,
      height: cropBottom - cropTop + 1,
    })
    .extend({
      top: padding,
      bottom: padding,
      left: padding,
      right: padding,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(output);

  const { data: outputData, info: outputInfo } = await sharp(output, { failOn: 'error' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const cornerIndices = [
    0,
    outputInfo.width - 1,
    (outputInfo.height - 1) * outputInfo.width,
    (outputInfo.height * outputInfo.width) - 1,
  ];
  const cornerAlpha = cornerIndices.map((index) => outputData[(index * 4) + 3]);
  if (cornerAlpha.some((alpha) => alpha !== 0)) {
    throw new Error(`Expected transparent output corners for ${names[cell]}: ${cornerAlpha.join(',')}`);
  }

  outputs.push({
    name: names[cell],
    output,
    width: outputInfo.width,
    height: outputInfo.height,
    opaqueRatio,
    cell: cell + 1,
  });
}

process.stdout.write(`${JSON.stringify({ input, count: outputs.length, outputs }, null, 2)}\n`);
