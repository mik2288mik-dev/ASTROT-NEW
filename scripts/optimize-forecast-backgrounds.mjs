import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const directory = path.join(root, 'public', 'foni');
const extensions = new Set(['.png', '.jpg', '.jpeg', '.webp']);

const themeOverrides = {
  0: 'friends', 1: 'love', 2: 'mood', 3: 'work_money', 4: 'home_family',
  5: 'friends', 6: 'opportunities', 7: 'general', 8: 'decisions', 9: 'work_money',
  10: 'friends', 11: 'love', 12: 'mood', 13: 'work_money', 14: 'friends',
  15: 'friends', 16: 'opportunities', 17: 'mood', 18: 'decisions', 19: 'mood',
  30: 'general', 31: 'love', 32: 'mood', 33: 'questions', 34: 'work_money',
  35: 'opportunities', 36: 'decisions', 37: 'mood', 38: 'decisions', 39: 'general',
  44: 'work_money', 45: 'opportunities', 46: 'decisions', 47: 'opportunities',
  48: 'decisions', 49: 'opportunities', 50: 'general', 51: 'love', 52: 'mood',
  53: 'questions', 54: 'work_money', 55: 'opportunities', 56: 'decisions',
  57: 'mood', 58: 'decisions', 59: 'general', 60: 'questions', 61: 'decisions',
  62: 'mood', 63: 'questions', 64: 'opportunities', 65: 'general', 66: 'decisions',
  67: 'mood', 68: 'questions', 69: 'decisions', 70: 'general', 71: 'love',
  72: 'mood', 73: 'questions', 74: 'work_money', 75: 'opportunities',
  76: 'decisions', 77: 'mood', 78: 'decisions', 79: 'general', 80: 'general',
  81: 'love', 82: 'mood', 83: 'questions', 84: 'work_money', 85: 'opportunities',
  86: 'decisions', 87: 'mood', 88: 'decisions', 89: 'general', 90: 'communication',
  91: 'love', 92: 'mood', 93: 'questions', 94: 'work_money', 95: 'opportunities',
  96: 'decisions', 97: 'mood', 98: 'decisions', 99: 'general', 100: 'general',
  101: 'love', 102: 'mood', 103: 'questions', 104: 'work_money', 105: 'opportunities',
  106: 'decisions', 107: 'mood', 108: 'decisions', 109: 'general', 110: 'communication',
  111: 'love', 112: 'mood', 113: 'questions', 114: 'work_money', 115: 'opportunities',
  116: 'decisions', 117: 'mood', 118: 'decisions', 119: 'general', 120: 'general',
  121: 'love', 122: 'mood', 123: 'questions', 124: 'work_money', 125: 'opportunities',
  126: 'decisions', 127: 'mood', 128: 'decisions', 129: 'general', 130: 'general',
  131: 'love', 132: 'mood', 133: 'questions', 134: 'work_money', 135: 'opportunities',
  136: 'decisions', 137: 'mood', 138: 'decisions', 139: 'general', 140: 'general',
  141: 'love', 142: 'mood', 143: 'questions', 144: 'work_money', 145: 'opportunities',
  146: 'decisions', 147: 'mood', 148: 'decisions', 149: 'general', 150: 'general',
  151: 'love', 152: 'mood', 153: 'questions', 154: 'work_money', 155: 'opportunities',
  156: 'decisions', 157: 'mood', 158: 'decisions', 159: 'general', 160: 'general',
  161: 'love', 162: 'mood', 163: 'questions', 164: 'work_money', 165: 'opportunities',
  166: 'decisions', 167: 'mood', 168: 'general', 169: 'questions', 170: 'mood',
  171: 'love', 172: 'mood', 173: 'questions', 174: 'work_money', 175: 'opportunities',
  176: 'general', 177: 'decisions', 178: 'love', 179: 'mood', 180: 'general',
  181: 'questions', 182: 'opportunities', 183: 'decisions', 184: 'work_money',
  185: 'questions', 186: 'decisions', 187: 'mood', 188: 'general', 189: 'general',
};

function themeFor(index) {
  return themeOverrides[index] || ['general', 'love', 'mood', 'questions', 'work_money', 'opportunities', 'decisions', 'mood', 'decisions', 'general'][index % 10];
}

function filenameFor(index) {
  return `horoscope-${themeFor(index).replace('_', '-')}-${String(index + 1).padStart(3, '0')}.webp`;
}

const sourceFiles = (await fs.readdir(directory, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && extensions.has(path.extname(entry.name).toLowerCase()))
  .map((entry) => entry.name)
  .sort((left, right) => left.localeCompare(right));

if (process.argv.includes('--normalise-current')) {
  const current = sourceFiles.filter((name) => name.startsWith('horoscope-'));
  if (current.length !== 190) throw new Error(`Expected 190 optimized images, found ${current.length}.`);
  for (const sourceName of current) {
    await fs.rename(path.join(directory, sourceName), path.join(directory, `${sourceName}.rename`));
  }
  for (const sourceName of current) {
    const index = Number(sourceName.match(/-(\d{3})\.webp$/)?.[1]) - 1;
    await fs.rename(path.join(directory, `${sourceName}.rename`), path.join(directory, filenameFor(index)));
  }
  process.exit(0);
}

const rawSourceFiles = sourceFiles.filter((name) => !name.startsWith('horoscope-'));
if (rawSourceFiles.length !== 190) {
  throw new Error(`Expected 190 source images, found ${sourceFiles.length}. Refusing to rename.`);
}

const write = process.argv.includes('--write');
for (const [index, sourceName] of rawSourceFiles.entries()) {
  const targetName = filenameFor(index);
  if (!write) {
    console.log(`${sourceName} -> ${targetName}`);
    continue;
  }
  const sourcePath = path.join(directory, sourceName);
  const targetPath = path.join(directory, targetName);
  const temporaryPath = `${targetPath}.tmp.webp`;
  await sharp(sourcePath)
    .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 78, effort: 5 })
    .toFile(temporaryPath);
  await fs.rename(temporaryPath, targetPath);
  await fs.unlink(sourcePath);
  console.log(`${sourceName} -> ${targetName}`);
}
