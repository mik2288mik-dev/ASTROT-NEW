import fs from 'fs';
import path from 'path';
import mainScenes from '../docs/design/newspaper-stickers/main-scenes.json';
import humorScenes from '../docs/design/newspaper-stickers/psychedelic-humor-scenes.json';
import synastryScenes from '../docs/design/newspaper-stickers/synastry-scenes.json';
import zodiacScenes from '../docs/design/newspaper-stickers/zodiac-scenes.json';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('newspaper editorial asset system', () => {
  it('keeps the requested 1000-scene inventory with exact collection quotas', () => {
    expect(mainScenes).toHaveLength(400);
    expect(humorScenes).toHaveLength(388);
    expect(synastryScenes).toHaveLength(200);
    expect(zodiacScenes).toHaveLength(12);
    expect(mainScenes.filter((item) => item.medium === 'photo')).toHaveLength(180);
    expect(mainScenes.filter((item) => item.medium === 'associative')).toHaveLength(140);
    expect(mainScenes.filter((item) => item.medium === 'surreal')).toHaveLength(60);
    expect(mainScenes.filter((item) => item.medium === 'graphic')).toHaveLength(20);
    expect(humorScenes.every((item) => item.medium === 'psychedelic-humor')).toBe(true);
  });

  it('does not duplicate IDs, slugs, or scene concepts', () => {
    const all = [...mainScenes, ...humorScenes, ...synastryScenes, ...zodiacScenes];
    for (const key of ['id', 'slug', 'conceptEn'] as const) {
      const values = all.map((item) => String(item[key]).trim().toLowerCase());
      expect(new Set(values).size).toBe(values.length);
    }
  });

  it('preserves varied silhouettes instead of one repeated rectangular frame', () => {
    expect(new Set(mainScenes.map((item) => item.shape)).size).toBeGreaterThanOrEqual(8);
    expect(new Set(humorScenes.map((item) => item.shape)).size).toBeGreaterThanOrEqual(6);
    expect(new Set(synastryScenes.map((item) => item.shape)).size).toBeGreaterThanOrEqual(6);
    expect(new Set(zodiacScenes.map((item) => item.shape)).size).toBeGreaterThanOrEqual(6);
  });

  it('keeps a substantial playful-animal psychedelic collection', () => {
    const animalScenePattern = /\b(?:pigeons?|cats?|dogs?|birds?|seagulls?|gulls?|moths?|cows?|fish|puffins?|yaks?|meerkats?|armadillos?|cranes?|walruses?|gazelles?|porcupines?|lynx|capybaras?|salamanders?|otters?|fox(?:es)?|rabbits?|bears?|horses?|goats?|sheep|ducks?|geese|owls?|penguins?|flamingos?|whales?|seals?|turtles?|frogs?|bees?|butterflies?|deer|moose|raccoons?|squirrels?|hedgehogs?|mice|rats?|octopuses?|lobsters?|crabs?|snails?|sparrows?|ravens?|crows?|antelopes?|animals?)\b/i;
    const animalScenes = humorScenes.filter((item) => animalScenePattern.test(
      [item.slug, item.titleRu, item.conceptEn].join(' '),
    ));

    expect(animalScenes.length).toBeGreaterThanOrEqual(90);
  });

  it('keeps selection deterministic and context-led', () => {
    const selectors = read('lib/personalForecastVisuals/editorialSelectors.ts');
    expect(selectors).toContain('stableHash');
    expect(selectors).not.toContain('Math.random');
    expect(selectors).toContain('asset.contexts.includes(input.context)');
    expect(selectors).toContain('asset.dynamics.some');
  });

  it('masks detached sheet artifacts and guarantees transparent output corners', () => {
    const splitter = read('scripts/split-newspaper-contact-sheet.mjs');
    expect(splitter).toContain('component.members');
    expect(splitter).toContain('data[(index * 4) + 3] = 0');
    expect(splitter).toContain("background: { r: 0, g: 0, b: 0, alpha: 0 }");
    expect(splitter).toContain('cornerAlpha.some');
  });

  it('wires editorial assets only into the intended active reading screens', () => {
    const horoscope = read('views/v2/HoroscopeReader.tsx');
    const natal = read('views/v2/NatalMagazine.tsx');
    const compatibility = read('views/v2/UnionRoom.tsx');
    const matrix = read('views/v2/MatrixRoom.tsx');
    const onboarding = read('views/Onboarding.tsx');

    expect(horoscope).toContain('getZodiacEditorialSticker');
    expect(natal).toContain('getZodiacEditorialSticker');
    expect(compatibility).toContain('selectSynastryEditorialSticker');
    expect(matrix).toContain('selectMainEditorialSticker');
    expect(onboarding).toContain('selectMainEditorialSticker');
    for (const source of [horoscope, natal, compatibility, matrix, onboarding]) {
      expect(source).toContain('EditorialSticker');
    }
  });
});
