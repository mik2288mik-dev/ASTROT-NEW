import { buildChartInsight, chartElementFor, findSelfTest, scoreSelfTest, SELF_TESTS } from '../lib/selfTests/engine';
import { buildForYouOffers } from '../lib/forYou';

const STYLE_BANS = /\p{Extended_Pictographic}|энерги|вселенн|космос|судьб|магич|вибрац|психолог|травм|паттерн|триггер|глубже|следует|\(а\)/iu;

/** Sign longitudes: Aries 0°, Taurus 30°, … — the middle of each sign. */
const mid = (signIndex: number) => signIndex * 30 + 15;

describe('self tests', () => {
  it('ships four authored tests with consistent content', () => {
    expect(SELF_TESTS.map((test) => test.id)).toEqual(['temperament', 'conflict', 'love_language', 'recharge']);
    for (const test of SELF_TESTS) {
      const keys = new Set(test.results.map((result) => result.key));
      expect(test.questions.length).toBeGreaterThanOrEqual(10);
      const reachable = new Set<string>();
      for (const question of test.questions) {
        expect(question.options.length).toBeGreaterThanOrEqual(4);
        for (const option of question.options) {
          option.to.forEach((key) => { expect(keys.has(key)).toBe(true); reachable.add(key); });
          expect(option.text.ru.trim()).not.toBe('');
          expect(option.text.en.trim()).not.toBe('');
        }
      }
      expect(reachable).toEqual(keys);
      for (const element of ['fire', 'earth', 'air', 'water'] as const) {
        const link = test.chart.byElement[element];
        if (link.key) expect(keys.has(link.key)).toBe(true);
      }
    }
  });

  it('keeps the copy plain: no emoji, no esoteric or therapy words, no «(а)» forms', () => {
    const texts = SELF_TESTS.flatMap((test) => [
      test.title.ru, test.subtitle.ru,
      ...test.questions.flatMap((question) => [question.text.ru, ...question.options.map((option) => option.text.ru)]),
      ...test.results.flatMap((result) => [result.title.ru, result.lead.ru, result.tip.ru, ...result.strengths.map((item) => item.ru), ...result.watch.map((item) => item.ru)]),
      ...Object.values(test.chart.byElement).map((link) => link.text.ru),
    ]);
    const offending = texts.filter((text) => STYLE_BANS.test(text));
    expect(offending).toEqual([]);
  });

  it('scores answers and mentions a close second result', () => {
    const test = findSelfTest('temperament')!;
    const answers = [0, 0, 0, 0, 0, 1, 1, 1, 1, 2];
    const score = scoreSelfTest(test, answers);
    expect(score.top).toBe('choleric');
    expect(score.second).toBe('sanguine');
    expect(score.ranking[0]).toEqual({ key: 'choleric', points: 5, percent: 50 });
    expect(scoreSelfTest(test, Array(10).fill(3)).second).toBeNull();
  });

  it('reads the chart: dominant element for temperament, planet signs for the others', () => {
    const fireChart = { positions: { sun: { longitude: mid(0) }, moon: { longitude: mid(4) }, mercury: { longitude: mid(8) }, venus: { longitude: mid(1) }, mars: { longitude: mid(3) } } };
    expect(chartElementFor('elements', fireChart)).toBe('fire');
    expect(chartElementFor('venus', fireChart)).toBe('earth');
    expect(chartElementFor('mars', fireChart)).toBe('water');
    expect(chartElementFor('moon', { moon: { sign: 'Gemini' } })).toBe('air');
    expect(chartElementFor('elements', { positions: { sun: { longitude: 10 } } })).toBeNull();
    expect(chartElementFor('moon', null)).toBeNull();
  });

  it('says honestly whether the test and the chart agree', () => {
    const test = findSelfTest('love_language')!;
    const chart = { positions: { venus: { longitude: mid(2) } } };
    const agree = buildChartInsight(test, chart, 'words', 'ru')!;
    expect(agree.agrees).toBe(true);
    expect(agree.text).toContain('тест и карта говорят одно и то же');
    const differ = buildChartInsight(test, chart, 'gifts', 'ru')!;
    expect(differ.agrees).toBe(false);
    expect(differ.text).toContain('ближе к результату «Слова»');
    expect(buildChartInsight(test, null, 'words', 'ru')).toBeNull();
  });

  it('offers to continue an unfinished test on home', () => {
    const offers = buildForYouOffers({
      language: 'ru', todayKey: '2026-10-14', weekKey: '2026-W42', birthDate: '1990-03-01', birthTimeKnown: true,
      premium: false, premiumEndsAt: null, premiumAutoRenew: null,
      signals: { compatibilityOpens: 0, loveReads: 0, openedPairs: [] }, savedPeople: [],
      newMoonKey: null, mercuryRetroKey: null, wishKeys: new Set(), reviewedMonths: new Set(), dismissed: new Set(),
      unfinishedTest: { id: 'conflict', title: 'Как ты ведёшь себя в ссоре', answered: 6, total: 10, updatedAt: '2026-10-13T10:00:00Z' },
    });
    expect(offers[0]).toMatchObject({ id: 'test_unfinished', action: { type: 'test', testId: 'conflict' } });
    expect(offers[0].body).toContain('отвечено 6 из 10');
  });
});
