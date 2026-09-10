import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const PUBLIC_ROOT = path.join(ROOT, 'public');
const manifests = [
  ['personal', path.join(ROOT, 'lib', 'personalForecastVisuals', 'personal.manifest.json')],
  ['paperTemplates', path.join(ROOT, 'lib', 'personalForecastVisuals', 'paper-templates.manifest.json')],
  ['zodiacLegacy', path.join(ROOT, 'lib', 'zodiacLegacyVisuals', 'zodiac-legacy-special.manifest.json')],
];
const editorialV2SourcePath = path.join(
  ROOT,
  'lib',
  'personalForecastVisuals',
  'editorial-v2-source.manifest.json',
);

const oldPaths = [
  'public/assets/forecast-feed/editorial-stickers',
  'public/assets/forecast-feed',
  'public/foni',
  'lib/personalForecastVisuals/main.manifest.json',
  'lib/personalForecastVisuals/synastry.manifest.json',
  'lib/personalForecastVisuals/zodiac.manifest.json',
  'docs/design/newspaper-stickers',
  'scripts/build-newspaper-manifests.mjs',
  'scripts/audit-newspaper-catalogs.mjs',
  'scripts/optimize-editorial-sticker-library.mjs',
  'scripts/optimize-forecast-backgrounds.mjs',
  'public/stickers',
];

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

const errors = [];
for (const retired of oldPaths) {
  if (await exists(path.join(ROOT, retired))) errors.push(`Retired path remains: ${retired}`);
}

const loaded = {};
const all = [];
for (const [name, manifestPath] of manifests) {
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  loaded[name] = manifest.items;
  all.push(...manifest.items);
}

if (loaded.personal.length !== 309) errors.push(`personal count=${loaded.personal.length}, expected 309`);
if (loaded.paperTemplates.length !== 19) errors.push(`paper count=${loaded.paperTemplates.length}, expected 19`);
if (loaded.zodiacLegacy.length !== 48) errors.push(`zodiac count=${loaded.zodiacLegacy.length}, expected 48`);
if (loaded.zodiacLegacy.filter((item) => item.category === 'psychedelic').length !== 24) {
  errors.push('Zodiac psychedelic count must be 24');
}
if (loaded.zodiacLegacy.filter((item) => item.category === 'funny-animal').length !== 24) {
  errors.push('Zodiac funny-animal count must be 24');
}

for (const item of loaded.personal) {
  if (!item.path.startsWith('/assets/personal-editorial/')) errors.push(`Personal path escaped: ${item.path}`);
  if (!['editorial-v2', 'cat', 'capybara', 'object'].includes(item.source)) {
    errors.push(`Invalid personal source: ${item.id}`);
  }
  if (item.collection !== 'personal-editorial') errors.push(`Invalid personal collection: ${item.id}`);
}
for (const item of loaded.paperTemplates) {
  if (!item.path.startsWith('/assets/personal-paper-templates/')) errors.push(`Paper path escaped: ${item.path}`);
  if (item.hasEmbeddedText || item.safeTextArea?.length !== 4) errors.push(`Invalid paper template: ${item.id}`);
}
for (const item of loaded.zodiacLegacy) {
  if (!item.path.startsWith('/assets/zodiac-legacy-special/')) errors.push(`Zodiac path escaped: ${item.path}`);
  if (!['psychedelic', 'funny-animal'].includes(item.category)) errors.push(`Invalid Zodiac category: ${item.id}`);
}

const editorialV2Source = JSON.parse(await fs.readFile(editorialV2SourcePath, 'utf8'));
if (editorialV2Source.assets.length !== 221) {
  errors.push(`editorial-v2 source count=${editorialV2Source.assets.length}, expected 221`);
}
for (const item of editorialV2Source.assets) {
  const expectedPrefix = item.category === 'paper_templates'
    ? '/assets/personal-paper-templates/'
    : '/assets/personal-editorial/editorial-v2/';
  if (!item.path.startsWith(expectedPrefix)) errors.push(`Editorial-v2 source path escaped: ${item.path}`);
  if (!await exists(path.join(PUBLIC_ROOT, item.path.replace(/^\//u, '')))) {
    errors.push(`Missing editorial-v2 source file: ${item.path}`);
  }
  const compiled = [...loaded.personal, ...loaded.paperTemplates]
    .find((candidate) => candidate.sourceId === item.id);
  if (
    !compiled
    || item.path !== compiled.path
    || item.width !== compiled.width
    || item.height !== compiled.height
    || item.orientation !== compiled.orientation
    || item.aspectRatio !== compiled.aspectRatio
    || item.contentHash !== compiled.sha256
  ) {
    errors.push(`Stale editorial-v2 source metadata: ${item.id}`);
  }
}

const budgets = {
  personal: { maxItemBytes: 400_000, maxEdge: 1_300, maxTotalBytes: 28_500_000 },
  paperTemplates: { maxItemBytes: 30_000, maxEdge: 600, maxTotalBytes: 400_000 },
  zodiacLegacy: { maxItemBytes: 70_000, maxEdge: 600, maxTotalBytes: 2_100_000 },
};
for (const [name, items] of Object.entries(loaded)) {
  const budget = budgets[name];
  const totalBytes = items.reduce((sum, item) => sum + item.bytes, 0);
  if (totalBytes > budget.maxTotalBytes) errors.push(`${name} byte budget exceeded: ${totalBytes}`);
  for (const item of items) {
    if (item.bytes > budget.maxItemBytes) errors.push(`${name} item byte budget exceeded: ${item.id}`);
    if (Math.max(item.width, item.height) > budget.maxEdge) {
      errors.push(`${name} edge budget exceeded: ${item.id}`);
    }
  }
}

const seenIds = new Set();
const seenPaths = new Set();
const seenHashes = new Set();
let bytes = 0;
for (const item of all) {
  const file = path.join(PUBLIC_ROOT, item.path.replace(/^\//u, ''));
  if (!await exists(file)) {
    errors.push(`Missing manifest file: ${item.path}`);
    continue;
  }
  const buffer = await fs.readFile(file);
  const metadata = await sharp(buffer, { failOn: 'error' }).metadata();
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  bytes += buffer.byteLength;
  if (metadata.format !== 'webp' || metadata.width !== item.width || metadata.height !== item.height) {
    errors.push(`Image metadata mismatch: ${item.path}`);
  }
  if (buffer.byteLength !== item.bytes || sha256 !== item.sha256) {
    errors.push(`Byte/hash mismatch: ${item.path}`);
  }
  if (seenIds.has(item.id)) errors.push(`Duplicate id: ${item.id}`);
  if (seenPaths.has(item.path)) errors.push(`Duplicate path: ${item.path}`);
  if (seenHashes.has(item.sha256)) errors.push(`Duplicate content: ${item.path}`);
  seenIds.add(item.id);
  seenPaths.add(item.path);
  seenHashes.add(item.sha256);
}

const expectedRoots = [
  path.join(PUBLIC_ROOT, 'assets', 'personal-editorial'),
  path.join(PUBLIC_ROOT, 'assets', 'personal-paper-templates'),
  path.join(PUBLIC_ROOT, 'assets', 'zodiac-legacy-special'),
];
const diskPaths = [];
async function visit(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) await visit(absolute);
    else if (entry.isFile() && entry.name.endsWith('.webp')) {
      diskPaths.push(`/${path.relative(PUBLIC_ROOT, absolute).split(path.sep).join('/')}`);
    }
  }
}
for (const root of expectedRoots) await visit(root);
const manifestPaths = new Set(all.map((item) => item.path));
for (const diskPath of diskPaths) {
  if (!manifestPaths.has(diskPath)) errors.push(`Unmanifested asset: ${diskPath}`);
}
if (diskPaths.length !== all.length) errors.push(`Disk/manifest count mismatch: disk=${diskPaths.length}, manifest=${all.length}`);

const result = {
  counts: {
    personal: loaded.personal.length,
    paperTemplates: loaded.paperTemplates.length,
    zodiacLegacy: loaded.zodiacLegacy.length,
    total: all.length,
  },
  bytes,
  errors,
};
if (errors.length) throw new Error(JSON.stringify(result, null, 2));
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
