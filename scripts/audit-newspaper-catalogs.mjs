import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const CATALOG_ROOT = path.join(ROOT, 'docs', 'design', 'newspaper-stickers');

const readJson = async (name) => JSON.parse(
  await fs.readFile(path.join(CATALOG_ROOT, name), 'utf8'),
);

const [main, humor, synastry, zodiac] = await Promise.all([
  readJson('main-scenes.json'),
  readJson('psychedelic-humor-scenes.json'),
  readJson('synastry-scenes.json'),
  readJson('zodiac-scenes.json'),
]);

const expected = {
  main: 400,
  humor: 388,
  synastry: 200,
  zodiac: 12,
};

for (const [name, count] of Object.entries(expected)) {
  const items = { main, humor, synastry, zodiac }[name];
  if (items.length !== count) {
    throw new Error(`${name}: expected ${count}, received ${items.length}`);
  }
}

const expectedMainMedia = {
  photo: 180,
  associative: 140,
  surreal: 60,
  graphic: 20,
};
for (const [medium, count] of Object.entries(expectedMainMedia)) {
  const actual = main.filter((item) => item.medium === medium).length;
  if (actual !== count) {
    throw new Error(`main ${medium}: expected ${count}, received ${actual}`);
  }
}
if (humor.some((item) => item.medium !== 'psychedelic-humor')) {
  throw new Error('Every humor scene must use medium psychedelic-humor');
}

const animalScenePattern = /\b(?:pigeons?|cats?|dogs?|birds?|seagulls?|gulls?|moths?|cows?|fish|puffins?|yaks?|meerkats?|armadillos?|cranes?|walruses?|gazelles?|porcupines?|lynx|capybaras?|salamanders?|otters?|fox(?:es)?|rabbits?|bears?|horses?|goats?|sheep|ducks?|geese|owls?|penguins?|flamingos?|whales?|seals?|turtles?|frogs?|bees?|butterflies?|deer|moose|raccoons?|squirrels?|hedgehogs?|mice|rats?|octopuses?|lobsters?|crabs?|snails?|sparrows?|ravens?|crows?|antelopes?|animals?)\b/iu;
const animalHumorCount = humor.filter((item) => animalScenePattern.test(
  [item.slug, item.titleRu, item.conceptEn].filter(Boolean).join(' '),
)).length;
if (animalHumorCount < 90) {
  throw new Error(`humor: expected at least 90 playful animal scenes, received ${animalHumorCount}`);
}

const bannedScenePatterns = [
  /\belderly\b/iu,
  /\bsenior citizen(?:s)?\b/iu,
  /\bold (?:man|woman|couple|people|person)\b/iu,
  /\bgrand(?:mother|father|parent)(?:s)?\b/iu,
  /\bwheelchair\b/iu,
  /\bdisab(?:led|ility)\b/iu,
  /\b(?:factory|industrial|warehouse|workshop)\b/iu,
  /\bconstruction site\b/iu,
  /\b(?:worker|laborer|mechanic)(?:s)?\b/iu,
  /\b(?:hard hat|forklift|assembly line|heavy machinery)\b/iu,
  /\b(?:suitcase|luggage)\b/iu,
  /\b(?:flashlight|torchlight)\b/iu,
  /\b(?:hospital|ambulance|medical ward)\b/iu,
  /\b(?:injury|wound|bandage|crutch)(?:s)?\b/iu,
  /\b(?:rescue|emergency|evacuation)\b/iu,
  /\b(?:homelessness|poverty|exhaustion)\b/iu,
  /\bsoaked documents\b/iu,
  /\bsplinter\b/iu,
];

function sceneText(item) {
  return [item.titleRu, item.conceptEn, item.composition]
    .filter(Boolean)
    .join(' ');
}

function assertNoBannedScenes(name, items) {
  const violations = [];
  for (const item of items) {
    const text = sceneText(item);
    for (const pattern of bannedScenePatterns) {
      if (pattern.test(text)) {
        violations.push(`${item.id}: ${pattern}`);
      }
    }
  }
  if (violations.length) {
    throw new Error(`${name}: banned scene concepts\n${violations.join('\n')}`);
  }
}

for (const [name, items] of Object.entries({ main, humor, synastry, zodiac })) {
  assertNoBannedScenes(name, items);
  for (const key of ['id', 'slug', 'conceptEn', 'shape', 'composition', 'print']) {
    const missing = items.filter((item) => !String(item[key] || '').trim());
    if (missing.length) {
      throw new Error(`${name}: ${missing.length} items are missing ${key}`);
    }
  }
}

const all = [...main, ...humor, ...synastry, ...zodiac];
for (const key of ['id', 'slug', 'conceptEn']) {
  const seen = new Map();
  const duplicates = [];
  for (const item of all) {
    const value = String(item[key]).trim().toLowerCase();
    if (seen.has(value)) duplicates.push(`${item.id} duplicates ${seen.get(value)}`);
    else seen.set(value, item.id);
  }
  if (duplicates.length) {
    throw new Error(`Duplicate ${key}\n${duplicates.join('\n')}`);
  }
}

const humorShapeExpected = {
  'wide-panorama': 67,
  'narrow-vertical': 50,
  'irregular-diagonal': 62,
  'oval-round': 50,
  'compact-collage': 50,
  'long-strip': 31,
  starburst: 30,
  'wavy-rectangle': 23,
  'torn-cloud': 16,
  'ticket-tab': 9,
};
for (const [shape, count] of Object.entries(humorShapeExpected)) {
  const actual = humor.filter((item) => item.shape === shape).length;
  if (actual !== count) {
    throw new Error(`humor ${shape}: expected ${count}, received ${actual}`);
  }
}

function assertSheetShapeVariety(name, items, minimumDistinct) {
  for (let start = 0; start < items.length; start += 6) {
    const sheet = items.slice(start, start + 6);
    const distinct = new Set(sheet.map((item) => item.shape)).size;
    if (sheet.length > 1 && distinct < Math.min(minimumDistinct, sheet.length)) {
      throw new Error(
        `${name}: sheet starting at ${sheet[0].id} has only ${distinct} distinct shapes`,
      );
    }
  }
}

assertSheetShapeVariety('main', main, 3);
assertSheetShapeVariety('humor', humor, 4);
assertSheetShapeVariety('synastry', synastry, 4);
assertSheetShapeVariety('zodiac', zodiac, 5);

const result = {
  counts: {
    mainBase: main.length,
    mainHumor: humor.length,
    mainTotal: main.length + humor.length,
    synastry: synastry.length,
    zodiac: zodiac.length,
    totalStickers: all.length,
    playfulAnimalHumor: animalHumorCount,
  },
  shapeCounts: Object.fromEntries(
    Object.entries({ main, humor, synastry, zodiac }).map(([name, items]) => [
      name,
      new Set(items.map((item) => item.shape)).size,
    ]),
  ),
  bannedSceneViolations: 0,
  duplicateIds: 0,
  duplicateSlugs: 0,
  duplicateConcepts: 0,
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
