import fs from 'fs';
import path from 'path';
import {
  PROMO_BANNER_CATEGORIES,
  PROMO_BANNER_MANIFEST,
  getPromoBannersByCategory,
  selectPromoBanner,
} from '../lib/promoBannerManifest';

const ROOT = path.resolve(__dirname, '..');

describe('promo banner manifest and rotation', () => {
  it('contains every optimized banner with two existing responsive files', () => {
    expect(PROMO_BANNER_MANIFEST).toHaveLength(106);
    expect(new Set(PROMO_BANNER_MANIFEST.map((asset) => asset.id)).size).toBe(106);

    for (const asset of PROMO_BANNER_MANIFEST) {
      expect(PROMO_BANNER_CATEGORIES).toContain(asset.category);
      expect(asset.targetRoute).toBe({
        compatibility: '/compatibility',
        natal: '/natal-chart',
        zodiac: '/zodiac',
      }[asset.category]);
      for (const version of Object.values(asset.responsiveVersions)) {
        expect(version.width).toBeGreaterThan(0);
        expect(version.height).toBeGreaterThan(0);
        expect(fs.existsSync(path.join(ROOT, 'public', version.filename))).toBe(true);
      }
    }
  });

  it('keeps categories separate and reserves different assets within a session', () => {
    expect(getPromoBannersByCategory('compatibility')).toHaveLength(40);
    expect(getPromoBannersByCategory('natal')).toHaveLength(42);
    expect(getPromoBannersByCategory('zodiac')).toHaveLength(24);

    const first = selectPromoBanner({
      category: 'natal',
      userId: 'user-rotation',
      dayKey: '2026-07-29',
      placementKey: 'day:first',
    });
    const same = selectPromoBanner({
      category: 'natal',
      userId: 'user-rotation',
      dayKey: '2026-07-29',
      placementKey: 'day:first',
    });
    const secondPlacement = selectPromoBanner({
      category: 'natal',
      userId: 'user-rotation',
      dayKey: '2026-07-29',
      placementKey: 'week:second',
    });

    expect(same.id).toBe(first.id);
    expect(secondPlacement.id).not.toBe(first.id);
    expect(first.category).toBe('natal');
    expect(secondPlacement.category).toBe('natal');
  });

  it('advances the category cycle on the next day', () => {
    const today = selectPromoBanner({
      category: 'zodiac',
      userId: 'daily-cycle',
      dayKey: '2026-07-29',
      placementKey: 'same-place',
    });
    const tomorrow = selectPromoBanner({
      category: 'zodiac',
      userId: 'daily-cycle',
      dayKey: '2026-07-30',
      placementKey: 'same-place',
    });

    expect(tomorrow.id).not.toBe(today.id);
  });

  it('uses compact artwork for paired tiles and horizontal artwork for a single banner', () => {
    const tile = selectPromoBanner({
      category: 'natal',
      userId: 'layout-filter',
      dayKey: '2026-07-29',
      placementKey: 'pair:natal',
      layout: 'tile',
    });
    const wide = selectPromoBanner({
      category: 'zodiac',
      userId: 'layout-filter',
      dayKey: '2026-07-29',
      placementKey: 'single:zodiac',
      layout: 'wide',
    });
    const tileRatio = tile.responsiveVersions.mobile.width
      / tile.responsiveVersions.mobile.height;
    const wideRatio = wide.responsiveVersions.mobile.width
      / wide.responsiveVersions.mobile.height;

    expect(tileRatio).toBeLessThanOrEqual(1.55);
    expect(wideRatio).toBeGreaterThanOrEqual(1.55);
  });
});
