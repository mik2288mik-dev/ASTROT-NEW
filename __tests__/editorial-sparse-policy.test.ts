import fs from 'fs';
import path from 'path';
import {
  EDITORIAL_PLACEMENT_POLICY,
  getDiaryEditorialStickerCounts,
  getDiaryEditorialStickerLibrary,
  selectCalmSynastryEditorialSticker,
  selectDiaryEditorialSticker,
  selectNatalEditorialSticker,
  selectZodiacEditorialSticker,
} from '../lib/personalForecastVisuals';

describe('sparse editorial placement policy', () => {
  it('is deterministic and leaves most diary readings visually quiet', () => {
    const first = selectDiaryEditorialSticker({
      contentKey: '2026-08-09',
      userId: 'stable-user',
      topics: ['general'],
    });
    expect(selectDiaryEditorialSticker({
      contentKey: '2026-08-09',
      userId: 'stable-user',
      topics: ['general'],
    })).toEqual(first);

    const selected = Array.from({ length: 4000 }, (_, index) => (
      selectDiaryEditorialSticker({ contentKey: `day-${index}`, userId: `user-${index}` })
    )).filter((asset): asset is NonNullable<typeof asset> => !!asset);
    const distinctAssets = new Set(selected.map((asset) => asset.id));
    const objectAssets = selected.filter((asset) => asset.collection === 'diary-object');
    const mainAssets = selected.filter((asset) => asset.collection === 'main');
    const mascotAssets = selected.filter((asset) => asset.collection === 'diary-mascot');

    expect(selected.length / 4000).toBeGreaterThan(0.36);
    expect(selected.length / 4000).toBeLessThan(0.44);
    expect(distinctAssets.size).toBeGreaterThan(300);
    expect(objectAssets.length).toBeGreaterThan(0);
    expect(mainAssets.length).toBeGreaterThan(0);
    expect(mascotAssets.length).toBeGreaterThan(0);
    expect(selected.every((asset) => (
      asset.path.startsWith('/stickers/')
      || asset.path.startsWith('/assets/forecast-feed/editorial-stickers/main/')
    ))).toBe(true);
    expect(EDITORIAL_PLACEMENT_POLICY.diary.visiblePercent).toBe(40);
    expect(EDITORIAL_PLACEMENT_POLICY.diary.maxPauses).toBe(2);
  });

  it('publishes the complete unified Diary library and honors exclusions', () => {
    expect(getDiaryEditorialStickerCounts()).toEqual({
      mascot: 83,
      objects: 24,
      main: 788,
      total: 895,
      byMedium: {
        photo: 180,
        associative: 140,
        surreal: 60,
        graphic: 20,
        'psychedelic-humor': 388,
        'illustrated-sticker': 107,
      },
    });

    const first = Array.from({ length: 100 }, (_, index) => selectDiaryEditorialSticker({
      contentKey: `excluded-${index}`,
      userId: 'same-user',
    })).find((asset): asset is NonNullable<typeof asset> => !!asset)!;
    const replacement = selectDiaryEditorialSticker({
      contentKey: first.id,
      userId: 'same-user',
      forceVisible: true,
      excludeIds: [first.id],
    });

    expect(replacement).not.toBeNull();
    expect(replacement?.id).not.toBe(first.id);

    const library = getDiaryEditorialStickerLibrary();
    expect(new Set(library.map((asset) => asset.id)).size).toBe(895);
    expect(new Set(library.map((asset) => asset.path)).size).toBe(895);
    expect(new Set(library.map((asset) => asset.collection))).toEqual(new Set([
      'diary-mascot',
      'diary-object',
      'main',
    ]));
    expect(new Set(library.map((asset) => asset.medium))).toEqual(new Set([
      'illustrated-sticker',
      'photo',
      'associative',
      'surreal',
      'graphic',
      'psychedelic-humor',
    ]));
    expect(library.every((asset) => (
      asset.topics.length > 0
      && !!asset.tone
      && !!asset.orientation
      && !!asset.composition
      && asset.visualWeight > 0
      && ['common', 'occasional', 'rare'].includes(asset.rarity)
    ))).toBe(true);
    expect(library.every((asset) => fs.existsSync(path.join(
      process.cwd(),
      'public',
      asset.path.replace(/^\//, ''),
    )))).toBe(true);
    expect(library.some((asset) => asset.diaryFamily === 'animal')).toBe(true);
    expect(library.some((asset) => asset.diaryFamily === 'psychedelic-humor')).toBe(true);
    expect(library.every((asset) => !['synastry', 'zodiac'].includes(asset.collection))).toBe(true);
  });

  it('keeps natal accents mostly associative or surreal and psychedelic very rare', () => {
    const selected = Array.from({ length: 4000 }, (_, index) => (
      selectNatalEditorialSticker({ chartKey: `chart-${index}`, userId: `user-${index}` })
    )).filter((asset): asset is NonNullable<typeof asset> => !!asset);
    const psychedelic = selected.filter((asset) => asset.medium === 'psychedelic-humor');
    const editorial = selected.filter((asset) => (
      asset.medium === 'associative' || asset.medium === 'surreal'
    ));

    expect(selected.length / 4000).toBeGreaterThan(0.6);
    expect(selected.length / 4000).toBeLessThan(0.7);
    expect(editorial.length / selected.length).toBeGreaterThan(0.96);
    expect(psychedelic.length / selected.length).toBeLessThanOrEqual(0.03);
  });

  it('shows a zodiac cutout sparsely and never crosses collections in synastry', () => {
    const zodiac = Array.from({ length: 2400 }, (_, index) => (
      selectZodiacEditorialSticker({
        sign: 'aries',
        contentKey: `day-${index}`,
        userId: `user-${index}`,
      })
    )).filter(Boolean);
    expect(zodiac.length / 2400).toBeGreaterThan(0.55);
    expect(zodiac.length / 2400).toBeLessThan(0.65);

    const synastry = Array.from({ length: 400 }, (_, index) => (
      selectCalmSynastryEditorialSticker({
        screenKey: 'compatibility',
        contentKey: `pair-${index}`,
        context: 'love',
        slot: index,
      })
    )).filter((asset): asset is NonNullable<typeof asset> => !!asset);
    expect(synastry.length).toBeGreaterThan(0);
    expect(synastry.every((asset) => asset.collection === 'synastry')).toBe(true);
    expect(synastry.every((asset) => !asset.path.includes('psychedelic'))).toBe(true);
  });
});
