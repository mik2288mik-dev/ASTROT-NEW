import * as engine from 'astronomy-engine';
import { buildLunarDays } from '../lib/lunarCalendar';
import { DATE_TOPICS, DATE_TOPIC_GROUPS, findTopic, rankDays, scoreDays, whyBad, whyGood } from '../lib/goodDates';

describe('good dates', () => {
  const days = buildLunarDays(engine, new Date(Date.UTC(2026, 9, 19)), 35);

  it('has every activity of the canvas, each with a real calendar rule', () => {
    expect(DATE_TOPIC_GROUPS.map((group) => group.title)).toEqual(['Любовь', 'Работа и деньги', 'Покупки и дом', 'Для себя', 'Удача']);
    expect(DATE_TOPICS).toHaveLength(37);
    for (const topic of DATE_TOPICS) expect(topic.op.evaluate(days[0])[1].length).toBeGreaterThan(3);
  });

  it('knows Venus and Mercury going backwards in autumn 2026', () => {
    expect(days.find((day) => day.dayKey === '2026-10-30')!.mercuryRetrograde).toBe(true);
    expect(days.find((day) => day.dayKey === '2026-10-30')!.venusRetrograde).toBe(true);
  });

  it('keeps wedding dates away from backwards Venus and explains the best day in plain words', () => {
    const wedding = findTopic('Свадьба')!;
    const ranked = rankDays(scoreDays(wedding, days, 11), '2026-10-21');
    expect(ranked.every((item) => !item.day.venusRetrograde)).toBe(true);
    const purchase = findTopic('Крупная покупка')!;
    const scored = scoreDays(purchase, days, 11);
    const best = rankDays(scored, '2026-10-21')[0];
    expect(best.category).toBe('best');
    expect(whyGood(purchase, best).length).toBeGreaterThan(0);
    const bad = scored.find((item) => item.category === 'avoid')!;
    expect(whyBad(purchase, bad).length).toBeGreaterThan(5);
  });
});
