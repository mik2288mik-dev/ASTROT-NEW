import {
  isPersonalForecastPromoAnchor,
  resolvePersonalForecastPromotions,
  type PersonalForecastPromoSection,
} from '../lib/personalForecastPromo';

const baseSections: PersonalForecastPromoSection[] = [
  { id: 'overview', kind: 'overview', importance: 100 },
  { id: 'love', kind: 'fixed', fixedKey: 'love', importance: 72 },
  { id: 'mood', kind: 'fixed', fixedKey: 'mood', importance: 68 },
  { id: 'home', kind: 'fixed', fixedKey: 'home_family', importance: 52 },
  { id: 'friends', kind: 'fixed', fixedKey: 'friends', importance: 63 },
  { id: 'work', kind: 'fixed', fixedKey: 'work_money', importance: 81 },
  { id: 'wishes', kind: 'wishes', fixedKey: 'wishes', importance: 40 },
];

const resolve = (sections: PersonalForecastPromoSection[] = baseSections) =>
  resolvePersonalForecastPromotions({
    sections,
    userId: 'user-42',
    period: 'today',
    periodKey: '2026-07-27',
  });

describe('personal forecast promo resolver', () => {
  it('pairs two semantic promos and keeps Zodiac near the end without an astro accent', () => {
    const promotions = resolve();
    const mandatory = promotions.filter(
      (item) => item.placementType === 'mandatory',
    );
    const contextual = promotions.filter(
      (item) => item.placementType === 'contextual',
    );

    expect(promotions).toHaveLength(3);
    expect(mandatory).toHaveLength(2);
    expect(new Set(promotions.map((item) => item.product))).toEqual(
      new Set(['compatibility', 'natal', 'zodiac']),
    );
    expect(new Set(promotions.map((item) => item.format)).size).toBe(3);
    expect(contextual).toEqual([
      expect.objectContaining({
        product: 'zodiac',
        afterSectionId: 'wishes',
      }),
    ]);

    for (const promotion of mandatory) {
      const anchor = baseSections[promotion.afterSectionIndex];
      expect(anchor.id).toBe(promotion.afterSectionId);
      expect(isPersonalForecastPromoAnchor(promotion.product, anchor)).toBe(true);
    }
  });

  it('places the single contextual Zodiac promo after the strongest astro accent', () => {
    const sections = [
      ...baseSections.slice(0, 3),
      {
        id: 'mercury-accent',
        kind: 'astro_accent',
        importance: 76,
        hasStrongAstro: true,
      },
      {
        id: 'moon-accent',
        kind: 'astro_accent',
        importance: 91,
        hasStrongAstro: true,
      },
      ...baseSections.slice(3),
    ];

    const promotions = resolve(sections);
    const contextual = promotions.filter((item) => item.placementType === 'contextual');

    expect(promotions).toHaveLength(3);
    expect(contextual).toEqual([
      expect.objectContaining({
        product: 'zodiac',
        afterSectionId: 'moon-accent',
      }),
    ]);
    expect(new Set(promotions.map((item) => item.product)).size).toBe(3);
    expect(new Set(promotions.map((item) => item.format)).size).toBe(3);
  });

  it('is stable for the same user, period, period key, and ordered sections', () => {
    expect(resolve()).toEqual(resolve());
  });

  it('uses importance before the seeded tie-breaker', () => {
    const promotions = resolve([
      ...baseSections,
      { id: 'love-stronger', kind: 'fixed', fixedKey: 'love', importance: 99 },
      { id: 'mood-stronger', kind: 'fixed', fixedKey: 'mood', importance: 98 },
    ]);

    expect(promotions.find((item) => item.product === 'compatibility')?.afterSectionId)
      .toBe('love-stronger');
    expect(promotions.find((item) => item.product === 'natal')?.afterSectionId)
      .toBe('mood-stronger');
  });

  it('fails instead of placing a mandatory promo after an unrelated section', () => {
    expect(() => resolve([
      { id: 'overview', kind: 'overview', importance: 100 },
      { id: 'work', kind: 'fixed', fixedKey: 'work_money', importance: 80 },
    ])).toThrow('PERSONAL_FORECAST_PROMO_ANCHOR_MISSING:compatibility');
  });

  it('does not treat a weak or non-accent section as a Zodiac anchor', () => {
    expect(isPersonalForecastPromoAnchor('zodiac', {
      id: 'weak-astro',
      kind: 'astro_accent',
      importance: 50,
      hasStrongAstro: false,
    })).toBe(false);
    expect(isPersonalForecastPromoAnchor('zodiac', {
      id: 'unconfirmed-astro',
      kind: 'astro_accent',
      importance: 80,
    })).toBe(false);
    expect(isPersonalForecastPromoAnchor('zodiac', {
      id: 'strong-fixed',
      kind: 'fixed',
      fixedKey: 'mood',
      importance: 90,
      hasStrongAstro: true,
    })).toBe(false);
  });
});
