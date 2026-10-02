import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

/**
 * Shrinks the images copied into the static mobile build (the APK), never the
 * sources in public/: same file names and formats, phone-sized dimensions,
 * palette PNGs, re-encoded WebP and progressive JPEGs. A file is replaced only when it gets smaller.
 */
const MIN_BYTES = 150 * 1024;
const MAX_WIDTH = 1440;

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

export async function optimizeMobileImages(outputDirectory) {
  let before = 0;
  let after = 0;
  let changed = 0;
  for (const file of walk(outputDirectory)) {
    const extension = path.extname(file).toLowerCase();
    if (!['.png', '.jpg', '.jpeg', '.webp'].includes(extension)) continue;
    const original = fs.readFileSync(file);
    if (original.length < MIN_BYTES) continue;
    try {
      const metadata = await sharp(original).metadata();
      let image = sharp(original, { failOn: 'none' });
      if ((metadata.width || 0) > MAX_WIDTH) image = image.resize({ width: MAX_WIDTH, withoutEnlargement: true });
      const optimized = extension === '.png'
        ? await image.png({ palette: true, quality: 85, effort: 8, compressionLevel: 9 }).toBuffer()
        : extension === '.webp'
          ? await image.webp({ quality: 80, effort: 5 }).toBuffer()
          : await image.jpeg({ quality: 82, mozjpeg: true, progressive: true }).toBuffer();
      before += original.length;
      if (optimized.length < original.length) {
        fs.writeFileSync(file, optimized);
        after += optimized.length;
        changed += 1;
      } else {
        after += original.length;
      }
    } catch {
      // An unreadable image is shipped untouched rather than failing the release.
    }
  }
  const mb = (bytes) => (bytes / 1024 / 1024).toFixed(1);
  console.log(`[build:mobile] Optimized ${changed} images: ${mb(before)} MB -> ${mb(after)} MB.`);
  return { before, after, changed };
}
