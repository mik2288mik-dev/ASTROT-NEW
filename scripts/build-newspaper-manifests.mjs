import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const PUBLIC_ROOT = path.join(ROOT, 'public');
const ASSET_ROOT = path.join(PUBLIC_ROOT, 'assets', 'forecast-feed', 'editorial-stickers');
const SOURCE_ROOT = path.join(ROOT, 'docs', 'design', 'newspaper-stickers');
const MANIFEST_ROOT = path.join(ROOT, 'lib', 'personalForecastVisuals');
// Keep the complete 1000-sticker library mobile-sized. The total budget remains
// deliberately tight while the per-file p95 guard prevents isolated outliers.
const MAX_STICKER_EDGE = 512;
const MAX_TOTAL_BYTES = 45 * 1024 * 1024;

const readJson = async (file) => JSON.parse(await fs.readFile(file, 'utf8'));

function orientation(width, height) {
  if (Math.abs(width - height) / Math.max(width, height) < 0.08) return 'square';
  return width > height ? 'landscape' : 'portrait';
}

async function mapConcurrent(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

async function inspectAsset(relativePath, maxEdge) {
  const absolute = path.join(PUBLIC_ROOT, relativePath.replace(/^\//u, ''));
  const buffer = await fs.readFile(absolute);
  const image = sharp(buffer, { failOn: 'error' });
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height || !metadata.hasAlpha || metadata.format !== 'webp') {
    throw new Error(`Expected alpha WebP with dimensions: ${relativePath}`);
  }
  if (Math.max(metadata.width, metadata.height) > maxEdge) {
    throw new Error(`Asset exceeds ${maxEdge}px max edge: ${relativePath}`);
  }
  if (Math.min(metadata.width, metadata.height) < 120) {
    throw new Error(`Asset is too small for mobile display: ${relativePath}`);
  }
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const corners = [
    3,
    ((info.width - 1) * 4) + 3,
    (((info.height - 1) * info.width) * 4) + 3,
    ((((info.height - 1) * info.width) + info.width - 1) * 4) + 3,
  ].map((index) => data[index]);
  if (corners.some((alpha) => alpha > 8)) {
    throw new Error(`Transparent exterior failed corner check: ${relativePath}`);
  }
  let transparentPixels = 0;
  let visiblePixels = 0;
  let opaqueGreenPixels = 0;
  for (let offset = 0; offset < data.length; offset += 4) {
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const alpha = data[offset + 3];
    if (alpha <= 8) transparentPixels += 1;
    if (alpha > 16) {
      visiblePixels += 1;
      if (green >= 220 && green - red >= 110 && green - blue >= 110) {
        opaqueGreenPixels += 1;
      }
    }
  }
  const pixels = info.width * info.height;
  if (transparentPixels / pixels < 0.02) {
    throw new Error(`Transparent exterior is too small: ${relativePath}`);
  }
  if (visiblePixels / pixels < 0.12) {
    throw new Error(`Visible sticker coverage is implausibly small: ${relativePath}`);
  }
  if (opaqueGreenPixels > Math.max(2, pixels * 0.0001)) {
    throw new Error(`Chroma-key residue detected: ${relativePath}`);
  }
  return {
    width: metadata.width,
    height: metadata.height,
    bytes: buffer.byteLength,
    sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
  };
}

async function buildMain() {
  const baseSource = await readJson(path.join(SOURCE_ROOT, 'main-scenes.json'));
  const humorSource = await readJson(path.join(SOURCE_ROOT, 'psychedelic-humor-scenes.json'));
  const expected = { photo: 180, associative: 140, surreal: 60, graphic: 20 };
  for (const [medium, count] of Object.entries(expected)) {
    const actual = baseSource.filter((item) => item.medium === medium).length;
    if (actual !== count) throw new Error(`main ${medium}: expected ${count}, received ${actual}`);
  }
  if (baseSource.length !== 400) {
    throw new Error(`main base: expected 400, received ${baseSource.length}`);
  }
  if (humorSource.length !== 388) {
    throw new Error(`main psychedelic-humor: expected 388, received ${humorSource.length}`);
  }
  if (humorSource.some((item) => item.medium !== 'psychedelic-humor')) {
    throw new Error('Every psychedelic-humor catalog item must use medium psychedelic-humor');
  }
  const source = [...baseSource, ...humorSource];
  return mapConcurrent(source, 8, async (item) => {
    const relative = `/assets/forecast-feed/editorial-stickers/main/${item.medium}/${item.id}-${item.slug}.webp`;
    const file = await inspectAsset(relative, MAX_STICKER_EDGE);
    return {
      id: item.id,
      collection: 'main',
      medium: item.medium,
      slug: item.slug,
      titleRu: item.titleRu,
      topics: item.topics,
      tone: item.tone,
      shape: item.shape,
      print: item.print,
      composition: item.composition,
      path: relative,
      width: file.width,
      height: file.height,
      orientation: orientation(file.width, file.height),
      bytes: file.bytes,
      sha256: file.sha256,
    };
  });
}

async function buildSynastry() {
  const source = await readJson(path.join(SOURCE_ROOT, 'synastry-scenes.json'));
  if (source.length !== 200) throw new Error(`synastry: expected 200, received ${source.length}`);
  return mapConcurrent(source, 8, async (item) => {
    const relative = `/assets/forecast-feed/editorial-stickers/synastry/${item.id}-${item.slug}.webp`;
    const file = await inspectAsset(relative, MAX_STICKER_EDGE);
    return {
      id: item.id,
      collection: 'synastry',
      slug: item.slug,
      titleRu: item.titleRu,
      contexts: item.contexts,
      dynamics: item.dynamics,
      tone: item.tone,
      shape: item.shape,
      print: item.print,
      composition: item.composition,
      path: relative,
      width: file.width,
      height: file.height,
      orientation: orientation(file.width, file.height),
      bytes: file.bytes,
      sha256: file.sha256,
    };
  });
}

async function buildZodiac() {
  const source = await readJson(path.join(SOURCE_ROOT, 'zodiac-scenes.json'));
  if (source.length !== 12) throw new Error(`zodiac: expected 12, received ${source.length}`);
  return mapConcurrent(source, 6, async (item) => {
    const relative = `/assets/forecast-feed/editorial-stickers/zodiac/${item.id}-${item.slug}.webp`;
    const file = await inspectAsset(relative, MAX_STICKER_EDGE);
    return {
      id: item.id,
      collection: 'zodiac',
      sign: item.key,
      slug: item.slug,
      titleRu: item.titleRu,
      character: item.character,
      tone: item.tone,
      shape: item.shape,
      print: item.print,
      composition: item.composition,
      path: relative,
      width: file.width,
      height: file.height,
      orientation: orientation(file.width, file.height),
      bytes: file.bytes,
      sha256: file.sha256,
    };
  });
}

async function listWebps(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return listWebps(absolute);
    return entry.isFile() && entry.name.toLowerCase().endsWith('.webp') ? [absolute] : [];
  }));
  return nested.flat();
}

await fs.mkdir(MANIFEST_ROOT, { recursive: true });
const [main, synastry, zodiac] = await Promise.all([buildMain(), buildSynastry(), buildZodiac()]);
const all = [...main, ...synastry, ...zodiac];
const uniqueIds = new Set(all.map((item) => item.id));
const uniqueHashes = new Set(all.map((item) => item.sha256));
if (uniqueIds.size !== all.length) throw new Error('Duplicate asset id in newspaper manifests');
if (uniqueHashes.size !== all.length) throw new Error('Duplicate image bytes in newspaper manifests');
const expectedPaths = new Set(all.map((item) => path.normalize(path.join(PUBLIC_ROOT, item.path.replace(/^\//u, '')))));
const diskPaths = new Set((await listWebps(ASSET_ROOT)).map((file) => path.normalize(file)));
const missingPaths = [...expectedPaths].filter((file) => !diskPaths.has(file));
const orphanPaths = [...diskPaths].filter((file) => !expectedPaths.has(file));
if (missingPaths.length || orphanPaths.length) {
  throw new Error([
    `Newspaper asset inventory mismatch: missing=${missingPaths.length}, orphan=${orphanPaths.length}`,
    ...missingPaths.slice(0, 12).map((file) => `missing: ${file}`),
    ...orphanPaths.slice(0, 12).map((file) => `orphan: ${file}`),
  ].join('\n'));
}
const totalBytes = all.reduce((sum, item) => sum + item.bytes, 0);
if (totalBytes > MAX_TOTAL_BYTES) {
  throw new Error(`Newspaper assets exceed 45 MiB: ${(totalBytes / 1024 / 1024).toFixed(2)} MiB`);
}
const sizes = main.concat(synastry).map((item) => item.bytes).sort((a, b) => a - b);
const p95 = sizes[Math.floor((sizes.length - 1) * 0.95)];
if (p95 > 130 * 1024) throw new Error(`Main/synastry p95 exceeds 130 KiB: ${(p95 / 1024).toFixed(1)} KiB`);

const serialise = (items) => `${JSON.stringify({ version: 'newspaper-v2', items }, null, 2)}\n`;
await Promise.all([
  fs.writeFile(path.join(MANIFEST_ROOT, 'main.manifest.json'), serialise(main)),
  fs.writeFile(path.join(MANIFEST_ROOT, 'synastry.manifest.json'), serialise(synastry)),
  fs.writeFile(path.join(MANIFEST_ROOT, 'zodiac.manifest.json'), serialise(zodiac)),
]);

process.stdout.write(`${JSON.stringify({
  counts: { main: main.length, synastry: synastry.length, zodiac: zodiac.length },
  orientations: Object.fromEntries(['landscape', 'portrait', 'square'].map((value) => [
    value,
    all.filter((item) => item.orientation === value).length,
  ])),
  totalMiB: Number((totalBytes / 1024 / 1024).toFixed(2)),
  p95KiB: Number((p95 / 1024).toFixed(1)),
  assetRoot: ASSET_ROOT,
})}\n`);
