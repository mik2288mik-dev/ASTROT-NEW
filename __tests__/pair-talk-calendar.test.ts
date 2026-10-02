import { buildPairTalkCalendar } from '../lib/synastry/pairTalkCalendar';
import { canonicalNatalChart } from './fixtures/canonicalNatalChart';

describe('pair talk calendar', () => {
  const first = canonicalNatalChart();
  const second = canonicalNatalChart({ birthDate: '1990-08-22' });

  it('returns consecutive days with a plain reason only for marked days', () => {
    const days = buildPairTalkCalendar(first, second, { from: new Date('2026-10-03T09:00:00Z') });
    expect(days).toHaveLength(14);
    expect(days[0].date).toBe('2026-10-03');
    expect(days[13].date).toBe('2026-10-16');
    for (const day of days) {
      if (day.tone === 'neutral') expect(day.reason).toBeNull();
      else expect(day.reason).toMatch(/\p{L}/u);
      expect(day.reason || '').not.toMatch(/Меркур|Марс|Венер|Луна|аспект|\d/iu);
    }
  });

  it('is stable for the same pair and dates', () => {
    const from = new Date('2026-10-03T09:00:00Z');
    expect(buildPairTalkCalendar(first, second, { from })).toEqual(buildPairTalkCalendar(first, second, { from }));
  });

  it('ignores points known only as a whole-day range', () => {
    const ranged = { positions: { moon: { longitude: 190, reliability: 'stable_in_range', range: { startLongitude: 184, endLongitude: 196 } } } } as any;
    const days = buildPairTalkCalendar(ranged, ranged, { from: new Date('2026-10-03T09:00:00Z') });
    expect(days.every((day) => day.tone === 'neutral')).toBe(true);
  });
});
