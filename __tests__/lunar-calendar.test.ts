import * as engine from 'astronomy-engine';
import { LUNAR_CATEGORIES, bestDays, buildLunarDays, operationsFor, phaseName } from '../lib/lunarCalendar';

describe('lunar calendar', () => {
  const days = buildLunarDays(engine, new Date(Date.UTC(2026, 9, 1)), 31);

  it('finds the new and the full Moon of October 2026', () => {
    const exact = days.filter((day) => day.exact).map((day) => `${day.dayKey}:${day.exact!.q}`);
    expect(exact).toEqual(expect.arrayContaining(['2026-10-10:0', '2026-10-26:2']));
    expect(phaseName(days.find((day) => day.dayKey === '2026-10-26')!.phase)).toBe('Полнолуние');
  });

  it('knows whether the Moon grows and gives a sign for every day', () => {
    expect(days.find((day) => day.dayKey === '2026-10-18')!.waxing).toBe(true);
    expect(days.find((day) => day.dayKey === '2026-10-30')!.waxing).toBe(false);
    for (const day of days) expect(day.sign).toBeGreaterThanOrEqual(0);
  });

  it('gives every operation a verdict with a reason on every day', () => {
    for (const category of LUNAR_CATEGORIES) {
      for (const operation of category.operations) {
        for (const day of days) {
          const [score, why] = operation.evaluate(day);
          expect([0, 1, 2]).toContain(score);
          expect(why.length).toBeGreaterThan(5);
        }
      }
    }
  });

  it('shows only seasonal garden work and picks best days in order', () => {
    expect(operationsFor('garden', 10).every((op) => op.months!.includes(10))).toBe(true);
    expect(operationsFor('deals', 10).length).toBe(8);
    const garlic = operationsFor('garden', 10).find((op) => op.id === 'garlic')!;
    const best = bestDays(garlic, days, 3);
    expect(best.length).toBeGreaterThan(0);
    expect(best.every((day) => !day.waxing)).toBe(true);
  });
});
