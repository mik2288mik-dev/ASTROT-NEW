import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const PUBLIC_ROOT = path.join(ROOT, 'public');
const PERSONAL_ROOT = path.join(PUBLIC_ROOT, 'assets', 'personal-editorial');
const PAPER_ROOT = path.join(PUBLIC_ROOT, 'assets', 'personal-paper-templates');
const ZODIAC_ROOT = path.join(PUBLIC_ROOT, 'assets', 'zodiac-legacy-special');
const OLD_NEWSPAPER_ROOT = path.join(PUBLIC_ROOT, 'assets', 'forecast-feed', 'editorial-stickers');
const OLD_FONI_ROOT = path.join(PUBLIC_ROOT, 'foni');
const OLD_FORECAST_FEED_ROOT = path.join(PUBLIC_ROOT, 'assets', 'forecast-feed');
const OLD_STICKER_ROOT = path.join(PUBLIC_ROOT, 'stickers');
const V2_MANIFEST_PATH = path.join(ROOT, 'lib', 'personalForecastVisuals', 'editorial-v2-source.manifest.json');
const LEGACY_ALLOWLIST_PATH = path.join(
  ROOT,
  'lib',
  'zodiacLegacyVisuals',
  'zodiacLegacyAllowlist.ts',
);
const PERSONAL_MANIFEST_PATH = path.join(ROOT, 'lib', 'personalForecastVisuals', 'personal.manifest.json');
const PAPER_MANIFEST_PATH = path.join(ROOT, 'lib', 'personalForecastVisuals', 'paper-templates.manifest.json');
const ZODIAC_MANIFEST_PATH = path.join(
  ROOT,
  'lib',
  'zodiacLegacyVisuals',
  'zodiac-legacy-special.manifest.json',
);
const PERSONAL_SOURCES = new Set(['cat', 'capybara', 'object', 'editorial-v2']);

const readJson = async (file) => JSON.parse(await fs.readFile(file, 'utf8'));

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(directory, extension = null) {
  if (!await exists(directory)) return [];
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return listFiles(absolute, extension);
    if (!entry.isFile()) return [];
    if (extension && path.extname(entry.name).toLowerCase() !== extension) return [];
    return [absolute];
  }));
  return nested.flat();
}

function publicAssetPath(file) {
  return `/${path.relative(PUBLIC_ROOT, file).split(path.sep).join('/')}`;
}

function orientation(width, height) {
  const ratio = width / height;
  if (ratio < 0.85) return 'portrait';
  if (ratio > 1.18) return 'landscape';
  return 'square';
}

async function imageMetadata(file) {
  const buffer = await fs.readFile(file);
  const metadata = await sharp(buffer, { failOn: 'error' }).metadata();
  if (metadata.format !== 'webp' || !metadata.width || !metadata.height) {
    throw new Error(`Expected a readable WebP with dimensions: ${file}`);
  }
  return {
    width: metadata.width,
    height: metadata.height,
    aspectRatio: Number((metadata.width / metadata.height).toFixed(4)),
    orientation: orientation(metadata.width, metadata.height),
    bytes: buffer.byteLength,
    sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
  };
}

function parseLegacyAllowlist(source) {
  const entries = [...source.matchAll(
    /\{ id: '(main-humor-\d{3})', fileName: '([^']+\.webp)', category: '(psychedelic|funny-animal)' \}/gu,
  )].map((match) => ({ id: match[1], fileName: match[2], category: match[3] }));
  if (entries.length !== 48) {
    throw new Error(`Expected 48 explicit Zodiac legacy allowlist entries, received ${entries.length}`);
  }
  return entries;
}

async function buildPersonal(v2Manifest) {
  const files = await listFiles(PERSONAL_ROOT, '.webp');
  const v2ById = new Map(v2Manifest.assets.map((asset) => [asset.id, asset]));
  const items = await Promise.all(files.sort().map(async (file) => {
    const base = path.basename(file, '.webp');
    const relative = path.relative(PERSONAL_ROOT, file).split(path.sep);
    const sourceDirectory = relative[0];
    const source = sourceDirectory === 'cats'
      ? 'cat'
      : sourceDirectory === 'capybaras'
        ? 'capybara'
        : sourceDirectory === 'objects'
          ? 'object'
          : sourceDirectory === 'editorial-v2'
            ? 'editorial-v2'
            : null;
    if (!source) throw new Error(`Unexpected personal asset source: ${file}`);
    const metadata = await imageMetadata(file);
    const raw = source === 'editorial-v2' ? v2ById.get(base) : null;
    if (source === 'editorial-v2' && !raw) {
      throw new Error(`Missing editorial-v2 metadata for personal asset: ${base}`);
    }
    if (source === 'editorial-v2' && raw.category === 'paper_templates') {
      throw new Error(`Paper template escaped into personal editorial assets: ${base}`);
    }
    if (!PERSONAL_SOURCES.has(source)) throw new Error(`Invalid personal source: ${source}`);
    return {
      id: source === 'editorial-v2' ? `editorial-v2:${base}` : `${source}:${base}`,
      sourceId: base,
      collection: 'personal-editorial',
      medium: 'illustrated-sticker',
      source,
      sourceCategory: raw?.category || sourceDirectory,
      path: publicAssetPath(file),
      ...metadata,
      tone: raw?.tone || 'neutral',
      topics: raw?.topics || [],
      displayWeight: raw?.visualWeight || 'medium',
      rarity: raw?.rarity || 'common',
      hasEmbeddedText: raw?.hasEmbeddedText || false,
      productionSelectable: raw?.productionSelectable !== false,
      reviewReason: raw?.reviewReason || null,
    };
  }));
  if (items.length !== 309) {
    throw new Error(`Expected 309 personal editorial assets, received ${items.length}`);
  }
  return items;
}

async function buildPaper(v2Manifest) {
  const sourceById = new Map(v2Manifest.assets.map((asset) => [asset.id, asset]));
  const files = await listFiles(PAPER_ROOT, '.webp');
  const items = await Promise.all(files.sort().map(async (file) => {
    const sourceId = path.basename(file, '.webp');
    const source = sourceById.get(sourceId);
    if (!source?.paperTemplate || source.hasEmbeddedText) {
      throw new Error(`Missing empty paper-template metadata: ${sourceId}`);
    }
    return {
      id: `editorial-v2-paper:${sourceId}`,
      sourceId,
      collection: 'personal-paper-template',
      path: publicAssetPath(file),
      ...await imageMetadata(file),
      tone: source.tone,
      rarity: source.rarity,
      displayWeight: source.visualWeight,
      hasEmbeddedText: false,
      ...source.paperTemplate,
    };
  }));
  if (items.length !== 19) {
    throw new Error(`Expected 19 personal paper templates, received ${items.length}`);
  }
  return items;
}

async function buildZodiac() {
  const source = await fs.readFile(LEGACY_ALLOWLIST_PATH, 'utf8');
  const allowlist = parseLegacyAllowlist(source);
  const items = await Promise.all(allowlist.map(async (entry) => {
    const categoryDirectory = entry.category === 'funny-animal' ? 'funny-animals' : 'psychedelic';
    const file = path.join(ZODIAC_ROOT, categoryDirectory, entry.fileName);
    if (!await exists(file)) throw new Error(`Missing approved Zodiac legacy asset: ${file}`);
    return {
      ...entry,
      collection: 'zodiac-legacy-special',
      path: publicAssetPath(file),
      ...await imageMetadata(file),
    };
  }));
  const diskFiles = await listFiles(ZODIAC_ROOT, '.webp');
  if (diskFiles.length !== items.length) {
    throw new Error(`Zodiac legacy inventory mismatch: manifest=${items.length}, disk=${diskFiles.length}`);
  }
  return items;
}

function assertUnique(items, key) {
  const values = items.map((item) => item[key]);
  if (new Set(values).size !== values.length) throw new Error(`Duplicate ${key} in visual manifests`);
}

if (
  await exists(OLD_NEWSPAPER_ROOT)
  || await exists(OLD_FONI_ROOT)
  || await exists(OLD_FORECAST_FEED_ROOT)
  || await exists(OLD_STICKER_ROOT)
) {
  throw new Error('Retired visual asset roots must be removed before manifest generation');
}

const v2Manifest = await readJson(V2_MANIFEST_PATH);
const normalizedV2Manifest = {
  ...v2Manifest,
  generatedFrom: 'public/assets/personal-editorial and public/assets/personal-paper-templates',
  assets: v2Manifest.assets.map((asset) => ({
    ...asset,
    path: asset.category === 'paper_templates'
      ? `/assets/personal-paper-templates/${asset.id}.webp`
      : `/assets/personal-editorial/editorial-v2/${asset.id}.webp`,
  })),
};
const [personal, paperTemplates, zodiacLegacy] = await Promise.all([
  buildPersonal(normalizedV2Manifest),
  buildPaper(normalizedV2Manifest),
  buildZodiac(),
]);
const all = [...personal, ...paperTemplates, ...zodiacLegacy];
assertUnique(all, 'id');
assertUnique(all, 'path');
assertUnique(all, 'sha256');

const compiledV2BySourceId = new Map(
  [...personal.filter((item) => item.source === 'editorial-v2'), ...paperTemplates]
    .map((item) => [item.sourceId, item]),
);
for (const source of normalizedV2Manifest.assets) {
  const compiled = compiledV2BySourceId.get(source.id);
  if (!compiled) throw new Error(`Editorial-v2 source is not compiled: ${source.id}`);
  if (
    source.path !== compiled.path
    || source.width !== compiled.width
    || source.height !== compiled.height
    || source.orientation !== compiled.orientation
    || source.aspectRatio !== compiled.aspectRatio
    || source.contentHash !== compiled.sha256
  ) {
    throw new Error(`Editorial-v2 source metadata is stale: ${source.id}`);
  }
}

const serialize = (kind, items) => `${JSON.stringify({
  schemaVersion: 1,
  kind,
  items,
}, null, 2)}\n`;
await Promise.all([
  fs.writeFile(V2_MANIFEST_PATH, `${JSON.stringify(normalizedV2Manifest, null, 2)}\n`),
  fs.writeFile(PERSONAL_MANIFEST_PATH, serialize('personal-editorial', personal)),
  fs.writeFile(PAPER_MANIFEST_PATH, serialize('personal-paper-templates', paperTemplates)),
  fs.writeFile(ZODIAC_MANIFEST_PATH, serialize('zodiac-legacy-special', zodiacLegacy)),
]);

const bytes = (items) => items.reduce((sum, item) => sum + item.bytes, 0);
process.stdout.write(`${JSON.stringify({
  counts: {
    personal: personal.length,
    paperTemplates: paperTemplates.length,
    zodiacLegacy: zodiacLegacy.length,
    psychedelic: zodiacLegacy.filter((item) => item.category === 'psychedelic').length,
    funnyAnimal: zodiacLegacy.filter((item) => item.category === 'funny-animal').length,
  },
  bytes: {
    personal: bytes(personal),
    paperTemplates: bytes(paperTemplates),
    zodiacLegacy: bytes(zodiacLegacy),
    total: bytes(all),
  },
}, null, 2)}\n`);
