import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';

const ROOT = process.cwd();
const ASSET_ROOT = path.join(
  ROOT,
  'public',
  'assets',
  'forecast-feed',
  'editorial-stickers',
);
const REPORT_PATH = path.join(
  ROOT,
  'docs',
  'design',
  'newspaper-stickers',
  'asset-optimization-report.json',
);
const MAX_EDGE = 512;
const MAX_FILE_BYTES = 180 * 1024;

async function listWebps(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return listWebps(absolute);
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.optimizing.webp')) {
      await fs.unlink(absolute);
      return [];
    }
    return entry.isFile()
      && entry.name.toLowerCase().endsWith('.webp')
      ? [absolute]
      : [];
  }));
  return files.flat();
}

async function mapConcurrent(items, limit, mapper) {
  const output = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      output[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return output;
}

async function inspect(file) {
  const [metadata, stat] = await Promise.all([
    sharp(file, { failOn: 'error' }).metadata(),
    fs.stat(file),
  ]);
  if (!metadata.width || !metadata.height || metadata.format !== 'webp' || !metadata.hasAlpha) {
    throw new Error(`Expected an alpha WebP sticker: ${file}`);
  }
  return {
    width: metadata.width,
    height: metadata.height,
    bytes: stat.size,
  };
}

const files = await listWebps(ASSET_ROOT);
const before = await mapConcurrent(files, 8, inspect);

await mapConcurrent(files, 6, async (file, index) => {
  const current = before[index];
  const shouldOptimize = Math.max(current.width, current.height) > MAX_EDGE
    || current.bytes > MAX_FILE_BYTES;
  if (!shouldOptimize) return;

  const temporary = `${file}.optimizing.webp`;
  const source = await fs.readFile(file);
  await sharp(source, { failOn: 'error' })
    .resize({
      width: MAX_EDGE,
      height: MAX_EDGE,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({
      quality: 78,
      alphaQuality: 96,
      effort: 5,
      smartSubsample: true,
    })
    .toFile(temporary);
  await fs.writeFile(file, await fs.readFile(temporary));
  await fs.unlink(temporary);
});

const after = await mapConcurrent(files, 8, inspect);
const items = files.map((file, index) => ({
  file: `/${path.relative(path.join(ROOT, 'public'), file).split(path.sep).join('/')}`,
  width: after[index].width,
  height: after[index].height,
  bytes: after[index].bytes,
}));
const afterBytes = after.reduce((sum, item) => sum + item.bytes, 0);
const report = {
  version: 'editorial-stickers-mobile-v1',
  policy: {
    format: 'webp',
    alpha: true,
    maxEdge: MAX_EDGE,
    quality: 78,
    alphaQuality: 96,
    cssRole: 'small editorial accent',
  },
  totals: {
    files: files.length,
    totalBytes: afterBytes,
    largestFileBytes: Math.max(...after.map((item) => item.bytes)),
  },
  items,
};

await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report.totals)}\n`);
