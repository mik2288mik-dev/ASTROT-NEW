import type { CalendarDay } from '../lib/futureCalendar';
import { buildMonthTeaser, buildWeekTeaser, readingOpeningLines } from '../lib/futurePeriodTeaser';

function day(dayKey: string, extra: Partial<CalendarDay> = {}): CalendarDay {
  return {
    dayKey,
    day: Number(dayKey.slice(8)),
    weekday: 0,
    moonQuarter: null,
    eclipse: false,
    mercuryRetrograde: false,
    moonSignIn: 'Овне',
    tone: null,
    personal: [],
    sky: [],
    ...extra,
  };
}

const venus = {
  dayKey: '2026-10-07', planet: 'Venus' as const, point: 'sun' as const, aspect: 120 as const, tone: 'good' as const,
  headline: 'Венера к твоему Солнцу', body: 'Приятный день для встреч',
};
const fullMoon = { dayKey: '2026-10-09', kind: 'moon' as const, quarter: 'full' as const, headline: 'Полнолуние', body: 'Эмоции громче обычного — не спеши с выводами' };

describe('future period teasers', () => {
  const days = [
    day('2026-10-05'),
    day('2026-10-06'),
    day('2026-10-07', { tone: 'good', personal: [venus] }),
    day('2026-10-08', { tone: 'hard' }),
    day('2026-10-09', { sky: [fullMoon] }),
    day('2026-10-12', { tone: 'good' }),
  ];

  it('builds week lines from the person’s own days that are still ahead', () => {
    const lines = buildWeekTeaser({ days, fromKey: '2026-10-06', toKey: '2026-10-11', hasNatal: true, language: 'ru' });
    expect(lines[0]).toBe('По твоей карте на этой неделе 1 лёгкий день и 1 напряжённый.');
    expect(lines[1]).toBe('Ближайший личный день — 7 октября: Венера к твоему Солнцу.');
    expect(lines[2]).toBe('9 октября — полнолуние: эмоции громче обычного — не спеши с выводами.');
  });

  it('does not invent personal days without a saved chart', () => {
    const lines = buildWeekTeaser({ days: days.map((item) => ({ ...item, tone: null, personal: [] })), fromKey: '2026-10-06', toKey: '2026-10-11', hasNatal: false, language: 'ru' });
    expect(lines.join(' ')).not.toMatch(/карт|личн/u);
    expect(lines).toHaveLength(1);
  });

  it('counts important days of the month ahead', () => {
    const lines = buildMonthTeaser({ days, fromKey: '2026-10-06', toKey: '2026-10-31', hasNatal: true, language: 'ru', month: 10 });
    expect(lines[0]).toContain('В октябре у тебя 1 важный день по карте');
  });

  it('cuts a ready reading on sentence boundaries', () => {
    const text = 'Первое предложение. Второе предложение! Третье? Четвёртое не попадёт.';
    expect(readingOpeningLines(text)).toBe('Первое предложение. Второе предложение! Третье?');
    expect(readingOpeningLines('')).toBe('');
  });
});
