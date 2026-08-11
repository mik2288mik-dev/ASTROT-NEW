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

    expect(selected.length / 4000).toBeGreaterThan(0.36);
    expect(selected.length / 4000).toBeLessThan(0.44);
    expect(distinctAssets.size).toBeGreaterThan(90);
    expect(objectAssets.length).toBeGreaterThan(0);
    expect(selected.every((asset) => asset.path.startsWith('/stickers/'))).toBe(true);
    expect(EDITORIAL_PLACEMENT_POLICY.diary.visiblePercent).toBe(40);
    expect(EDITORIAL_PLACEMENT_POLICY.diary.maxPauses).toBe(2);
  });

  it('publishes the complete mascot and object diary libraries and honors exclusions', () => {
    expect(getDiaryEditorialStickerCounts()).toEqual({
      mascot: 83,
      objects: 24,
      total: 107,
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
    expect(new Set(library.map((asset) => asset.id)).size).toBe(107);
    expect(library.every((asset) => fs.existsSync(path.join(
      process.cwd(),
      'public',
      asset.path.replace(/^\/stickers\//, 'stickers/'),
    )))).toBe(true);
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
