import { normalizeZodiacKey, ZODIAC_KEYS } from '../zodiacKeys';
import { CONFLICT_TEST } from './conflict';
import { LOVE_LANGUAGE_TEST } from './loveLanguage';
import { RECHARGE_TEST } from './recharge';
import { TEMPERAMENT_TEST } from './temperament';
import type { ChartElement, ChartFactor, Localized, SelfTestDefinition, SelfTestResult } from './types';

export type { SelfTestDefinition, SelfTestResult } from './types';

/** Local, authored tests: no AI while the person answers. */
export const SELF_TESTS: readonly SelfTestDefinition[] = [TEMPERAMENT_TEST, CONFLICT_TEST, LOVE_LANGUAGE_TEST, RECHARGE_TEST];

export function findSelfTest(id: string): SelfTestDefinition | null {
  return SELF_TESTS.find((test) => test.id === id) ?? null;
}

export type SelfTestScore = {
  ranking: Array<{ key: string; points: number; percent: number }>;
  top: string;
  /** A close second result worth mentioning (one point or less behind). */
  second: string | null;
};

/** `answers[i]` is the chosen option index of question i. */
export function scoreSelfTest(test: SelfTestDefinition, answers: readonly number[]): SelfTestScore {
  const points = new Map(test.results.map((result) => [result.key, 0]));
  test.questions.forEach((question, index) => {
    const option = question.options[answers[index]];
    option?.to.forEach((key) => points.set(key, (points.get(key) ?? 0) + 1));
  });
  const total = [...points.values()].reduce((sum, value) => sum + value, 0) || 1;
  const order = test.results.map((result) => result.key);
  const ranking = [...points.entries()]
    .map(([key, value]) => ({ key, points: value, percent: Math.round((value / total) * 100) }))
    .sort((a, b) => b.points - a.points || order.indexOf(a.key) - order.indexOf(b.key));
  const second = ranking[1] && ranking[1].points > 0 && ranking[0].points - ranking[1].points <= 1 ? ranking[1].key : null;
  return { ranking, top: ranking[0].key, second };
}

export function resultOf(test: SelfTestDefinition, key: string): SelfTestResult {
  return test.results.find((result) => result.key === key) ?? test.results[0];
}

const ELEMENTS: readonly ChartElement[] = ['fire', 'earth', 'air', 'water'];

type ChartLike = {
  positions?: Partial<Record<string, { longitude?: number }>>;
  angles?: { ascendant?: { longitude?: number } | null };
  chartQuality?: { ascendantReliable?: boolean };
} & Partial<Record<string, { sign?: string; longitude?: number } | null | unknown>>;

function signIndex(chart: ChartLike, planet: string): number | null {
  const longitude = chart.positions?.[planet]?.longitude;
  if (typeof longitude === 'number' && Number.isFinite(longitude)) return Math.floor((((longitude % 360) + 360) % 360) / 30);
  const legacy = chart[planet] as { sign?: string } | null | undefined;
  const key = normalizeZodiacKey(legacy?.sign);
  return key ? ZODIAC_KEYS.indexOf(key) : null;
}

function elementOfSign(index: number): ChartElement {
  return ELEMENTS[index % 4];
}

/** The element the test is compared with: the planet's sign, or the dominant element of the chart. */
export function chartElementFor(factor: ChartFactor, chartData: unknown): ChartElement | null {
  if (!chartData || typeof chartData !== 'object') return null;
  const chart = chartData as ChartLike;
  if (factor !== 'elements') {
    const index = signIndex(chart, factor);
    return index === null ? null : elementOfSign(index);
  }
  const weights: Array<[string, number]> = [['sun', 2], ['moon', 2], ['mercury', 1], ['venus', 1], ['mars', 1]];
  const score = new Map<ChartElement, number>(ELEMENTS.map((element) => [element, 0]));
  let counted = 0;
  for (const [planet, weight] of weights) {
    const index = signIndex(chart, planet);
    if (index === null) continue;
    counted += 1;
    score.set(elementOfSign(index), (score.get(elementOfSign(index)) ?? 0) + weight);
  }
  const ascendant = chart.angles?.ascendant?.longitude;
  if (chart.chartQuality?.ascendantReliable && typeof ascendant === 'number') {
    const element = elementOfSign(Math.floor((((ascendant % 360) + 360) % 360) / 30));
    score.set(element, (score.get(element) ?? 0) + 1.5);
  }
  if (counted < 3) return null;
  return [...score.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

export type ChartInsight = { text: string; agrees: boolean };

/**
 * «А что говорит твоя карта»: the chart part linked to the test, compared with
 * the answer honestly — agreement is said plainly, a mismatch is explained.
 */
export function buildChartInsight(test: SelfTestDefinition, chartData: unknown, topKey: string, language: 'ru' | 'en'): ChartInsight | null {
  const element = chartElementFor(test.chart.factor, chartData);
  if (!element) return null;
  const link = test.chart.byElement[element];
  const said: Localized = link.text;
  const agrees = link.key === topKey;
  const chartResult = link.key ? resultOf(test, link.key) : null;
  if (language === 'en') {
    return {
      agrees,
      text: agrees
        ? `${said.en} The test and the chart agree here.`
        : `${said.en} ${chartResult ? `That is closer to «${chartResult.title.en}». ` : ''}It happens: the test shows how you act now, the chart shows inborn leanings. Life, upbringing and habits often move us away from them.`,
    };
  }
  return {
    agrees,
    text: agrees
      ? `${said.ru} Здесь тест и карта говорят одно и то же.`
      : `${said.ru} ${chartResult ? `Это ближе к результату «${chartResult.title.ru}». ` : ''}Так бывает: тест показывает, как ты ведёшь себя сейчас, а карта, врождённые склонности. Опыт, воспитание и привычки часто уводят нас от них в свою сторону.`,
  };
}
