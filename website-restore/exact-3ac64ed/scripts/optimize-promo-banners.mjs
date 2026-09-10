import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const sourceDirectory = path.join(root, 'public', 'banners');
const outputDirectory = path.join(sourceDirectory, 'optimized');
const manifestPath = path.join(root, 'lib', 'promoBannerManifest.json');

const compatibilityIndexes = new Set([
  ...Array.from({ length: 32 }, (_, index) => index),
  33, 34, 37, 39, 42, 46, 49, 59,
]);
const natalIndexes = new Set([
  32, 35, 36, 38, 40, 41, 43, 44, 50,
  ...Array.from({ length: 7 }, (_, index) => 52 + index),
  ...Array.from({ length: 6 }, (_, index) => 60 + index),
  71, 84,
  ...Array.from({ length: 18 }, (_, index) => 88 + index),
]);
const zodiacIndexes = new Set([
  45, 47, 48, 51,
  ...Array.from({ length: 5 }, (_, index) => 66 + index),
  ...Array.from({ length: 12 }, (_, index) => 72 + index),
  ...Array.from({ length: 3 }, (_, index) => 85 + index),
]);

const categoryConfig = {
  compatibility: { route: '/compatibility', prefix: 'compatibility-banner' },
  natal: { route: '/natal-chart', prefix: 'natal-chart-banner' },
  zodiac: { route: '/zodiac', prefix: 'zodiac-banner' },
};

function categoryFor(index) {
  if (compatibilityIndexes.has(index)) return 'compatibility';
  if (natalIndexes.has(index)) return 'natal';
  if (zodiacIndexes.has(index)) return 'zodiac';
  throw new Error(`Unclassified banner index: ${index}`);
}

function scaledHeight(width, sourceWidth, sourceHeight) {
  return Math.max(1, Math.round((width / sourceWidth) * sourceHeight));
}

const sourceFiles = (await fs.readdir(sourceDirectory, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && /\.png$/i.test(entry.name))
  .map((entry) => entry.name)
  .sort((left, right) => left.localeCompare(right, 'ru-RU'));

if (sourceFiles.length !== 106) {
  throw new Error(`Expected 106 PNG banners, found ${sourceFiles.length}.`);
}

await fs.mkdir(outputDirectory, { recursive: true });
const counters = { compatibility: 0, natal: 0, zodiac: 0 };
const assets = [];

for (const [sourceIndex, sourceName] of sourceFiles.entries()) {
  const category = categoryFor(sourceIndex);
  const config = categoryConfig[category];
  counters[category] += 1;
  const sequence = String(counters[category]).padStart(3, '0');
  const baseName = `${config.prefix}-${sequence}`;
  const sourcePath = path.join(sourceDirectory, sourceName);
  const metadata = await sharp(sourcePath).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error(`Missing dimensions for ${sourceName}`);
  }

  const desktopWidth = Math.min(960, metadata.width);
  const mobileWidth = Math.min(640, metadata.width);
  const desktopFilename = `${baseName}-960.webp`;
  const mobileFilename = `${baseName}-640.webp`;
  const desktopPath = path.join(outputDirectory, desktopFilename);
  const mobilePath = path.join(outputDirectory, mobileFilename);

  await sharp(sourcePath)
    .resize({ width: desktopWidth, withoutEnlargement: true })
    .webp({ quality: 80, effort: 5 })
    .toFile(desktopPath);
  await sharp(sourcePath)
    .resize({ width: mobileWidth, withoutEnlargement: true })
    .webp({ quality: 78, effort: 5 })
    .toFile(mobilePath);

  assets.push({
    id: `${config.prefix}-${sequence}`,
    filename: `/banners/optimized/${desktopFilename}`,
    category,
    targetRoute: config.route,
    width: metadata.width,
    height: metadata.height,
    responsiveVersions: {
      mobile: {
        filename: `/banners/optimized/${mobileFilename}`,
        width: mobileWidth,
        height: scaledHeight(mobileWidth, metadata.width, metadata.height),
      },
      desktop: {
        filename: `/banners/optimized/${desktopFilename}`,
        width: desktopWidth,
        height: scaledHeight(desktopWidth, metadata.width, metadata.height),
      },
    },
  });

  await fs.unlink(sourcePath);
}

await fs.writeFile(
  manifestPath,
  `${JSON.stringify({ version: 1, assets }, null, 2)}\n`,
  'utf8',
);

console.log(`Optimized ${assets.length} banners: ${JSON.stringify(counters)}`);
