import * as Astronomy from 'astronomy-engine';
import { buildFutureMonth, futureHorizonDays } from '../lib/futureCalendar';

// Natal points of the 22.12.2010 Dmitrov chart.
const NATAL = { sun: 270.5856, moon: 106.2408, venus: 224.9361, mars: 281.1003, ascendant: 99.1125 };

describe('future calendar', () => {
  it('lays out October 2026 with Moon quarters and Mercury retrograde', () => {
    const month = buildFutureMonth(Astronomy, 2026, 10, null, 'Europe/Moscow');
    expect(month.days).toHaveLength(31);
    expect(month.days[0].weekday).toBe(3); // 1 October 2026 is a Thursday.
    const quarter = (day: number) => month.days[day - 1].moonQuarter;
    expect(quarter(10)).toBe('new');
    expect(quarter(26)).toBe('full');
    expect(month.days[24].mercuryRetrograde).toBe(true);
    expect(month.days[20].mercuryRetrograde).toBe(false);
    expect(month.skyEvents.some((event) => event.kind === 'mercury-start' && event.dayKey === '2026-10-24')).toBe(true);
    expect(month.personalEvents).toHaveLength(0);
  });

  it('marks personal days from real transits', () => {
    const month = buildFutureMonth(Astronomy, 2026, 10, NATAL, 'Europe/Moscow');
    const find = (planet: string, point: string, aspect: number) => month.personalEvents.find((event) => (
      event.planet === planet && event.point === point && event.aspect === aspect
    ));
    expect(find('Saturn', 'mars', 90)?.dayKey).toBe('2026-10-07');
    expect(find('Saturn', 'mars', 90)?.headline).toBe('Сатурн давит на твой Марс');
    expect(find('Sun', 'moon', 90)?.dayKey).toBe('2026-10-09');
    expect(find('Venus', 'sun', 60)?.tone).toBe('good');
    expect(month.days[6].tone).toBe('hard');
    expect(month.summary.headline).toBe('Напряжённый месяц');
  });

  it('opens the future by the bought plan', () => {
    expect(futureHorizonDays({ productId: 'premium_year' })).toBe(365);
    expect(futureHorizonDays({ productId: 'premium_quarter' })).toBe(90);
    expect(futureHorizonDays({ productId: 'premium_month' })).toBe(30);
    expect(futureHorizonDays({ startsAt: '2026-01-01', endsAt: '2027-01-01' })).toBe(365);
    expect(futureHorizonDays(null)).toBe(30);
  });
});
