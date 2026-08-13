import fs from 'fs';
import path from 'path';
import {
  DIARY_LAYOUTS,
  DIARY_VISUAL_FAMILY_WEIGHTS,
  getPersonalEditorialAssetLibrary,
  resolveDiaryTodayVisualPlan,
} from '../lib/personalForecastVisuals';

function dateKey(dayOffset: number): string {
  const date = new Date(Date.UTC(2026, 0, 1 + dayOffset));
  return date.toISOString().slice(0, 10);
}

describe('Today deterministic editorial visual plan', () => {
  it('keeps the same complete plan for the same stable seed', () => {
    const input = {
      userId: 'same-reader',
      periodKey: '2026-08-11',
      contractVersion: 'contract-a',
    };
    const first = resolveDiaryTodayVisualPlan(input);
    for (let index = 0; index < 100; index += 1) {
      expect(resolveDiaryTodayVisualPlan(input)).toEqual(first);
    }
  });

  it('cycles through all five layouts without repeating on adjacent days', () => {
    for (let reader = 0; reader < 30; reader += 1) {
      const plans = Array.from({ length: 365 }, (_, day) => resolveDiaryTodayVisualPlan({
        userId: `layout-reader-${reader}`,
        periodKey: dateKey(day),
        contractVersion: 'contract-a',
      }));
      expect(new Set(plans.map((plan) => plan.layout))).toEqual(new Set(DIARY_LAYOUTS));
      for (let day = 1; day < plans.length; day += 1) {
        expect(plans[day].layout).not.toBe(plans[day - 1].layout);
      }
      for (let day = 0; day <= plans.length - DIARY_LAYOUTS.length; day += 1) {
        expect(new Set(plans.slice(day, day + DIARY_LAYOUTS.length).map((plan) => plan.layout)).size)
          .toBe(DIARY_LAYOUTS.length);
      }
    }
  });

  it('never repeats the single allowlisted asset on adjacent days, including clean layouts', () => {
    for (let reader = 0; reader < 30; reader += 1) {
      const plans = Array.from({ length: 365 }, (_, day) => resolveDiaryTodayVisualPlan({
        userId: `asset-reader-${reader}`,
        periodKey: dateKey(day),
        contractVersion: 'contract-a',
      }));
      for (let day = 0; day < plans.length; day += 1) {
        const plan = plans[day];
        expect(plan.asset).not.toBeNull();
        if (day > 0 && plan.asset && plans[day - 1].asset) {
          expect(plan.asset.id).not.toBe(plans[day - 1].asset?.id);
        }
      }
    }
  });

  it('fits side-column layouts with compact assets while flexible layouts may use landscapes', () => {
    const plans = Array.from({ length: 1_000 }, (_, day) => resolveDiaryTodayVisualPlan({
      userId: `composition-reader-${day % 23}`,
      periodKey: dateKey(day),
      contractVersion: 'contract-a',
    }));
    const sidePlans = plans.filter((plan) => (
      plan.layout === 'editorial_left' || plan.layout === 'editorial_right'
    ));
    expect(sidePlans.length).toBeGreaterThan(0);
    for (const plan of sidePlans) {
      expect(plan.asset?.orientation).not.toBe('landscape');
      expect(['wide', 'strip']).not.toContain(plan.asset?.composition);
    }
    expect(plans.some((plan) => (
      (plan.layout === 'quote_first' || plan.layout === 'visual_overlap')
      && plan.asset?.orientation === 'landscape'
    ))).toBe(true);
  });

  it('uses every family with ordinary visuals dominant and psychedelic visuals rare', () => {
    const plans = Array.from({ length: 20_000 }, (_, index) => resolveDiaryTodayVisualPlan({
      userId: `distribution-reader-${index % 127}`,
      periodKey: dateKey(index),
      contractVersion: 'contract-a',
    })).filter((plan) => !!plan.asset);
    const counts = new Map<string, number>();
    for (const plan of plans) {
      counts.set(plan.asset!.diaryFamily, (counts.get(plan.asset!.diaryFamily) || 0) + 1);
    }
    expect(plans.every((plan) => (
      plan.asset!.path.startsWith('/assets/personal-editorial/')
      && !plan.asset!.path.startsWith('/assets/zodiac-legacy-special/')
      && plan.asset!.hasEmbeddedText === false
      && plan.asset!.productionSelectable === true
    ))).toBe(true);
    const activeFamilies = new Set(getPersonalEditorialAssetLibrary()
      .filter((asset) => asset.hasEmbeddedText === false && asset.productionSelectable === true)
      .map((asset) => asset.diaryFamily));
    expect(new Set(counts.keys())).toEqual(activeFamilies);
    expect([...activeFamilies].every((family) => family in DIARY_VISUAL_FAMILY_WEIGHTS))
      .toBe(true);
    const share = (families: string[]) => families.reduce(
      (sum, family) => sum + (counts.get(family) || 0),
      0,
    ) / plans.length;
    expect(share(['mascot', 'object', 'animal', 'graphic'])).toBeGreaterThan(0.8);
    expect(share(['surreal'])).toBeGreaterThan(0.07);
    expect(share(['surreal'])).toBeLessThan(0.13);
    expect(share(['psychedelic'])).toBeGreaterThan(0.02);
    expect(share(['psychedelic'])).toBeLessThan(0.07);
  });

  it('includes the contract version in the plan seed and never uses Math.random', () => {
    const changed = Array.from({ length: 60 }, (_, day) => {
      const base = { userId: 'versioned-reader', periodKey: dateKey(day) };
      return [
        resolveDiaryTodayVisualPlan({ ...base, contractVersion: 'contract-a' }),
        resolveDiaryTodayVisualPlan({ ...base, contractVersion: 'contract-b' }),
      ] as const;
    });
    expect(changed.some(([left, right]) => (
      left.layout !== right.layout || left.asset?.id !== right.asset?.id
    ))).toBe(true);

    const source = fs.readFileSync(path.join(
      process.cwd(),
      'lib',
      'personalForecastVisuals',
      'diaryVisualEngine.ts',
    ), 'utf8');
    expect(source).not.toContain('Math.random');
  });

  it('keeps every eligible asset UI-ready without design instructions from Luna', () => {
    const library = getPersonalEditorialAssetLibrary()
      .filter((asset) => asset.hasEmbeddedText === false && asset.productionSelectable === true);
    expect(library.length).toBeGreaterThan(0);
    for (const asset of library) {
      expect(asset).toMatchObject({
        id: expect.any(String),
        path: expect.stringMatching(/^\/assets\/personal-editorial\//),
        collection: 'personal-editorial',
        medium: expect.any(String),
        topics: expect.any(Array),
        tone: expect.any(String),
        orientation: expect.any(String),
        composition: expect.any(String),
        diaryFamily: expect.any(String),
        rarity: expect.any(String),
        visualWeight: expect.any(Number),
        hasEmbeddedText: false,
        productionSelectable: true,
      });
    }
  });
});
