import fs from 'fs';
import path from 'path';
import {
  EDITORIAL_PLACEMENT_POLICY,
  getPersonalEditorialAssetLibrary,
  selectNatalEditorialSticker,
  selectPersonalEditorialAsset,
  selectSynastryEditorialSticker,
} from '../lib/personalForecastVisuals';
import {
  getZodiacLegacyAssetLibrary,
  selectZodiacLegacyAsset,
} from '../lib/zodiacLegacyVisuals';

const PERSONAL_PREFIX = '/assets/personal-editorial/';
const ZODIAC_LEGACY_PREFIX = '/assets/zodiac-legacy-special/';

describe('sparse editorial placement policy', () => {
  it('is deterministic and leaves most diary readings visually quiet', () => {
    const input = {
      period: 'day' as const,
      periodKey: '2026-08-09',
      userId: 'stable-user',
      topics: ['general'] as const,
    };
    const first = selectPersonalEditorialAsset(input);
    expect(selectPersonalEditorialAsset(input)).toEqual(first);

    const selected = Array.from({ length: 4000 }, (_, index) => (
      selectPersonalEditorialAsset({
        period: 'day',
        periodKey: `day-${index}`,
        userId: `user-${index}`,
      })
    )).filter((asset): asset is NonNullable<typeof asset> => Boolean(asset));
    const distinctAssets = new Set(selected.map((asset) => asset.id));

    expect(selected.length / 4000).toBeGreaterThan(0.36);
    expect(selected.length / 4000).toBeLessThan(0.44);
    expect(distinctAssets.size).toBeGreaterThan(150);
    expect(new Set(selected.map((asset) => asset.source))).toEqual(new Set([
      'editorial-v2',
      'cat',
      'capybara',
      'object',
    ]));
    expect(selected.every((asset) => (
      asset.path.startsWith(PERSONAL_PREFIX)
      && asset.hasEmbeddedText === false
      && asset.productionSelectable === true
    ))).toBe(true);
    expect(EDITORIAL_PLACEMENT_POLICY.diary.visiblePercent).toBe(40);
    expect(EDITORIAL_PLACEMENT_POLICY.diary.maxPauses).toBe(2);
  });

  it('publishes the complete personal library and honors exclusions', () => {
    const library = getPersonalEditorialAssetLibrary();
    expect(library).toHaveLength(309);
    expect(library.filter((asset) => asset.source === 'cat')).toHaveLength(45);
    expect(library.filter((asset) => asset.source === 'capybara')).toHaveLength(38);
    expect(library.filter((asset) => asset.source === 'object')).toHaveLength(24);
    expect(library.filter((asset) => asset.source === 'editorial-v2')).toHaveLength(202);

    const first = Array.from({ length: 100 }, (_, index) => selectPersonalEditorialAsset({
      period: 'day',
      periodKey: `excluded-${index}`,
      userId: 'same-user',
      forceVisible: true,
    })).find((asset): asset is NonNullable<typeof asset> => Boolean(asset))!;
    const replacement = selectPersonalEditorialAsset({
      period: 'day',
      periodKey: first.id,
      userId: 'same-user',
      forceVisible: true,
      excludeIds: [first.id],
    });

    expect(replacement).not.toBeNull();
    expect(replacement?.id).not.toBe(first.id);
    expect(new Set(library.map((asset) => asset.id)).size).toBe(309);
    expect(new Set(library.map((asset) => asset.path)).size).toBe(309);
    expect(new Set(library.map((asset) => asset.collection))).toEqual(new Set([
      'personal-editorial',
    ]));
    expect(library.every((asset) => (
      !!asset.tone
      && !!asset.orientation
      && asset.path.startsWith(PERSONAL_PREFIX)
      && !asset.path.startsWith(ZODIAC_LEGACY_PREFIX)
    ))).toBe(true);
    expect(library.every((asset) => fs.existsSync(path.join(
      process.cwd(),
      'public',
      asset.path.replace(/^\//, ''),
    )))).toBe(true);
  });

  it('keeps natal accents inside the personal pool and filters embedded copy', () => {
    const selected = Array.from({ length: 4000 }, (_, index) => (
      selectNatalEditorialSticker({ chartKey: `chart-${index}`, userId: `user-${index}` })
    )).filter((asset): asset is NonNullable<typeof asset> => Boolean(asset));

    expect(selected.length / 4000).toBeGreaterThan(0.6);
    expect(selected.length / 4000).toBeLessThan(0.7);
    expect(selected.every((asset) => (
      asset.collection === 'personal-editorial'
      && asset.path.startsWith(PERSONAL_PREFIX)
      && !asset.path.startsWith(ZODIAC_LEGACY_PREFIX)
      && asset.source === 'editorial-v2'
      && ['animals', 'graphic', 'mascots', 'objects', 'surreal'].includes(asset.sourceCategory)
      && asset.hasEmbeddedText === false
      && asset.productionSelectable === true
    ))).toBe(true);
  });

  it('keeps Zodiac in its approved legacy source and synastry in the personal source', () => {
    const zodiacLibrary = getZodiacLegacyAssetLibrary();
    const zodiac = Array.from({ length: 2400 }, (_, index) => (
      selectZodiacLegacyAsset({
        sign: 'aries',
        contentKey: `day-${index}`,
        userId: `user-${index}`,
      })
    )).filter((asset): asset is NonNullable<typeof asset> => Boolean(asset));
    expect(zodiac.length / 2400).toBeGreaterThan(0.55);
    expect(zodiac.length / 2400).toBeLessThan(0.65);
    expect(zodiac.every((asset) => (
      asset.path.startsWith(ZODIAC_LEGACY_PREFIX)
      && zodiacLibrary.some((approved) => approved.id === asset.id)
      && (asset.category === 'psychedelic' || asset.category === 'funny-animal')
    ))).toBe(true);

    const synastry = Array.from({ length: 400 }, (_, index) => (
      selectSynastryEditorialSticker({
        screenKey: 'compatibility',
        contentKey: `pair-${index}`,
        context: 'love',
        slot: index,
      })
    )).filter((asset): asset is NonNullable<typeof asset> => Boolean(asset));
    expect(synastry.length).toBeGreaterThan(0);
    expect(synastry.every((asset) => (
      asset.collection === 'personal-editorial'
      && asset.path.startsWith(PERSONAL_PREFIX)
      && !asset.path.startsWith(ZODIAC_LEGACY_PREFIX)
      && asset.hasEmbeddedText === false
    ))).toBe(true);
  });
});
