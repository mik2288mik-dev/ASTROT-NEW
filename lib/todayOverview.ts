import type {
  ForecastDailyReading,
  HoroscopeReactionSummary,
  Language,
  NatalChartData,
  PlanetPosition,
  TodayMetric,
  TodayMetricKey,
  TodayOverview,
} from '../types';
import { getZodiacSign } from '../constants';
import { formatDisplayDate } from './date-utils';
import { getCurrentTransits, type CurrentTransits, type PlanetTransit } from './transits-calculator';

const ZODIAC_KEYS = [
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
] as const;

type ZodiacKey = (typeof ZODIAC_KEYS)[number];

const REACTION_LABELS: Record<Language, Record<NonNullable<HoroscopeReactionSummary['userReaction']>, string>> = {
  ru: {
    spot_on: 'В точку',
    funny: 'Улыбнуло',
    gentle: 'Бережно',
    not_mine: 'Не мой день',
  },
  en: {
    spot_on: 'Spot on',
    funny: 'Made me smile',
    gentle: 'Gentle',
    not_mine: 'Not mine',
  },
};

const METRIC_LABELS: Record<Language, Record<TodayMetricKey, string>> = {
  ru: {
    resource: 'Ресурс',
    stress: 'Напряжение',
    love: 'Любовь',
    focus: 'Фокус',
  },
  en: {
    resource: 'Resource',
    stress: 'Tension',
    love: 'Love',
    focus: 'Focus',
  },
};

function normalizeSign(value?: string | null): ZodiacKey {
  return ZODIAC_KEYS.find((sign) => sign.toLowerCase() === String(value || '').toLowerCase()) || 'Aries';
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function stableUnit(seed: string) {
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return (hash % 10000) / 10000;
}

function stableNoise(seed: string, spread = 8) {
  return (stableUnit(seed) - 0.5) * spread;
}

function normalizeDegree(value: number) {
  const next = value % 360;
  return next < 0 ? next + 360 : next;
}

function angularDistance(a: number, b: number) {
  const diff = Math.abs(normalizeDegree(a) - normalizeDegree(b)) % 360;
  return diff > 180 ? 360 - diff : diff;
}

function getPositionLongitude(position?: PlanetPosition | null) {
  if (!position) return null;
  if (typeof position.longitude === 'number' && Number.isFinite(position.longitude)) {
    return normalizeDegree(position.longitude);
  }
  const signIndex = ZODIAC_KEYS.findIndex((sign) => sign.toLowerCase() === String(position.sign || '').toLowerCase());
  if (signIndex < 0) return null;
  const degree = typeof position.degree === 'number' && Number.isFinite(position.degree) ? position.degree : 15;
  return normalizeDegree(signIndex * 30 + degree);
}

function getTransitLongitude(transit?: PlanetTransit | null) {
  if (!transit) return null;
  const signIndex = ZODIAC_KEYS.findIndex((sign) => sign.toLowerCase() === String(transit.sign || '').toLowerCase());
  if (signIndex < 0) return null;
  const degree = typeof transit.degree === 'number' && Number.isFinite(transit.degree) ? transit.degree : 15;
  return normalizeDegree(signIndex * 30 + degree);
}

function aspectScore(a: number | null, b: number | null, targets: number[], width = 18) {
  if (a == null || b == null) return null;
  const diff = angularDistance(a, b);
  const nearest = Math.min(...targets.map((target) => Math.abs(diff - target)));
  return Math.max(0, 1 - nearest / width);
}

function average(values: Array<number | null | undefined>, fallback = 0.42) {
  const clean = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (!clean.length) return fallback;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function dateFromKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
}

function dateKeyFromDate(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function addDays(dateKey: string, days: number) {
  const date = dateFromKey(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return dateKeyFromDate(date);
}

function hasReliableAscendant(chartData: NatalChartData) {
  const quality = (chartData as any).chartQuality;
  const birthTimeQuality = (chartData as any).birthTimeQuality || quality?.birthTimeQuality || 'exact';
  return birthTimeQuality === 'exact' && quality?.ascendantReliable !== false;
}

function calculateMetricValues(chartData: NatalChartData, transits: CurrentTransits, dateKey: string) {
  const natal = {
    sun: getPositionLongitude(chartData.sun),
    moon: getPositionLongitude(chartData.moon),
    rising: hasReliableAscendant(chartData) ? getPositionLongitude(chartData.rising) : null,
    mercury: getPositionLongitude(chartData.mercury),
    venus: getPositionLongitude(chartData.venus),
    mars: getPositionLongitude(chartData.mars),
  };
  const current = {
    sun: getTransitLongitude(transits.sun),
    moon: getTransitLongitude(transits.moon),
    mercury: getTransitLongitude(transits.mercury),
    venus: getTransitLongitude(transits.venus),
    mars: getTransitLongitude(transits.mars),
  };

  const support = (...pairs: Array<[number | null, number | null]>) =>
    average(pairs.map(([a, b]) => aspectScore(a, b, [0, 60, 120], 18)));
  const pressure = (...pairs: Array<[number | null, number | null]>) =>
    average(pairs.map(([a, b]) => aspectScore(a, b, [90, 180], 16)), 0.28);

  const emotionalSupport = support([current.moon, natal.moon], [current.sun, natal.sun], [current.venus, natal.moon]);
  const emotionalPressure = pressure([current.moon, natal.moon], [current.mars, natal.moon], [current.mars, natal.mars]);
  const affectionSupport = support([current.venus, natal.venus], [current.moon, natal.venus], [current.venus, natal.moon]);
  const affectionPressure = pressure([current.mars, natal.venus], [current.moon, natal.venus]);
  const focusSupport = support([current.mercury, natal.mercury], [current.sun, natal.mercury], [current.sun, natal.rising]);
  const focusPressure = pressure([current.moon, natal.mercury], [current.mars, natal.mercury]);

  return {
    resource: clamp(50 + emotionalSupport * 28 - emotionalPressure * 12 + stableNoise(`${dateKey}:resource`)),
    stress: clamp(30 + emotionalPressure * 42 - emotionalSupport * 10 + stableNoise(`${dateKey}:stress`)),
    love: clamp(48 + affectionSupport * 30 - affectionPressure * 12 + stableNoise(`${dateKey}:love`)),
    focus: clamp(46 + focusSupport * 32 - focusPressure * 11 + stableNoise(`${dateKey}:focus`)),
  } satisfies Record<TodayMetricKey, number>;
}

function metricDescription(language: Language, key: TodayMetricKey, value: number) {
  if (language === 'en') {
    if (key === 'resource') return value >= 66 ? 'Enough inner charge for one clear move.' : 'Better to spend energy deliberately today.';
    if (key === 'stress') return value >= 66 ? 'Pressure is louder, so pauses matter.' : 'The day is not asking for extra tension.';
    if (key === 'love') return value >= 66 ? 'Warm contact opens more easily.' : 'Gentleness works better than guessing.';
    return value >= 66 ? 'A good day to choose one priority.' : 'Focus grows when the day is simplified.';
  }

  if (key === 'resource') return value >= 66 ? 'Есть заряд на один ясный шаг.' : 'Силы лучше тратить точечно.';
  if (key === 'stress') return value >= 66 ? 'Давление слышнее, паузы важнее.' : 'День не просит лишнего напряжения.';
  if (key === 'love') return value >= 66 ? 'Тепло в контакте открывается легче.' : 'Мягкость полезнее догадок.';
  return value >= 66 ? 'Хороший день для одного приоритета.' : 'Фокус растёт, когда день проще.';
}

export function buildEmptyReactionSummary(language: Language): HoroscopeReactionSummary {
  const labels = REACTION_LABELS[language];
  return {
    userReaction: null,
    counts: (Object.keys(labels) as Array<keyof typeof labels>).map((key) => ({
      key,
      label: labels[key],
      count: 0,
    })),
    total: 0,
  };
}

export function hydrateReactionSummaryLabels(
  summary: HoroscopeReactionSummary | null | undefined,
  language: Language
): HoroscopeReactionSummary {
  const empty = buildEmptyReactionSummary(language);
  const counts = empty.counts.map((item) => ({
    ...item,
    count: summary?.counts.find((count) => count.key === item.key)?.count ?? 0,
  }));
  return {
    userReaction: summary?.userReaction ?? null,
    counts,
    total: counts.reduce((sum, item) => sum + item.count, 0),
  };
}

export async function buildTodayMetrics(
  chartData: NatalChartData,
  dateKey: string,
  language: Language
): Promise<TodayMetric[]> {
  const dates = Array.from({ length: 7 }, (_, index) => addDays(dateKey, index - 6));
  const transitResults = await Promise.all(dates.map((date) => getCurrentTransits(dateFromKey(date))));
  const valuesByDate = dates.map((date, index) => ({
    date,
    values: calculateMetricValues(chartData, transitResults[index], date),
  }));
  const todayValues = valuesByDate[valuesByDate.length - 1].values;

  return (Object.keys(METRIC_LABELS[language]) as TodayMetricKey[]).map((key) => ({
    key,
    label: METRIC_LABELS[language][key],
    value: todayValues[key],
    description: metricDescription(language, key, todayValues[key]),
    history: valuesByDate.map((item) => ({ date: item.date, value: item.values[key] })),
  }));
}

function clipText(text: string, max = 190) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const sentences = clean.match(/[^.!?。！？]+[.!?。！？]+/g) || [];
  let result = '';
  for (const sentence of sentences) {
    const next = `${result}${sentence}`.trim();
    if (next.length > max) break;
    result = `${next} `;
  }
  if (result.trim().length >= 60) return result.trim();
  const boundary = clean.lastIndexOf(' ', max - 1);
  return `${clean.slice(0, boundary > 80 ? boundary : max - 1).trim()}…`;
}

function firstParagraph(text: string) {
  return text.split(/\n{2,}|\r\n{2,}/).map((item) => item.trim()).filter(Boolean)[0] || text;
}

function pickOtherSign(sign: ZodiacKey, seed: string): ZodiacKey {
  const others = ZODIAC_KEYS.filter((item) => item !== sign);
  return others[Math.floor(stableUnit(seed) * others.length)] || 'Cancer';
}

function buildJoke(language: Language, chartData: NatalChartData, stress: number) {
  const moon = getZodiacSign(language, normalizeSign(chartData.moon?.sign));
  const sun = getZodiacSign(language, normalizeSign(chartData.sun?.sign));
  if (language === 'en') {
    return stress >= 64
      ? `Your ${moon} Moon may try to open ten tabs in your head. Close them one by one.`
      : `Your ${sun} Sun looks unusually ready to act grown-up today. Suspicious, but useful.`;
  }

  return stress >= 64
    ? `Твоя Луна в ${moon} может открыть десять вкладок в голове. Закрывай по одной.`
    : `Твоё Солнце в ${sun} сегодня подозрительно готово быть взрослым. Пользуемся моментом.`;
}

function buildComparison(language: Language, ownSign: ZodiacKey, otherSign: ZodiacKey, focusValue: number, dateKey: string) {
  const ownLabel = getZodiacSign(language, ownSign);
  const otherLabel = getZodiacSign(language, otherSign);
  const otherFocus = 42 + Math.round(stableUnit(`${dateKey}:${otherSign}:focus`) * 38);

  if (language === 'en') {
    return focusValue >= otherFocus
      ? `${otherLabel} gets a softer tempo today, but ${ownLabel} has the sharper focus: one clean step can carry a lot.`
      : `${otherLabel} may start a little faster today, while ${ownLabel} wins through calm timing and fewer extra moves.`;
  }

  return focusValue >= otherFocus
    ? `У ${otherLabel} сегодня мягче темп, зато у ${ownLabel} сильнее фокус: один чистый шаг может многое собрать.`
    : `У ${otherLabel} сегодня чуть легче с разгоном, а у ${ownLabel} лучше работает спокойный тайминг без лишних движений.`;
}

export async function buildTodayOverview(options: {
  profileLanguage: Language;
  chartData: NatalChartData;
  dateKey: string;
  personalForecast: ForecastDailyReading;
  signHoroscope: ForecastDailyReading;
  reactions?: HoroscopeReactionSummary | null;
}): Promise<TodayOverview> {
  const { profileLanguage, chartData, dateKey, personalForecast, signHoroscope } = options;
  const language = profileLanguage === 'en' ? 'en' : 'ru';
  const sign = normalizeSign(chartData.sun?.sign);
  const signLabel = getZodiacSign(language, sign);
  const metrics = await buildTodayMetrics(chartData, dateKey, language);
  const focusMetric = metrics.find((metric) => metric.key === 'focus')?.value ?? 50;
  const stressMetric = metrics.find((metric) => metric.key === 'stress')?.value ?? 50;
  const risingSeed = hasReliableAscendant(chartData) ? chartData.rising?.sign || '' : '';
  const otherSign = pickOtherSign(sign, `${dateKey}:${chartData.moon?.sign || ''}:${risingSeed}`);

  return {
    date: dateKey,
    dateLabel: formatDisplayDate(dateKey, language),
    sign,
    signLabel,
    headline: personalForecast.headline,
    summary: personalForecast.summary,
    phrase: personalForecast.headline,
    bestAction: personalForecast.focus || personalForecast.advice[0] || signHoroscope.focus,
    softRisk: personalForecast.risk || signHoroscope.risk,
    horoscopeExcerpt: clipText(signHoroscope.summary || firstParagraph(signHoroscope.reading), 185),
    joke: buildJoke(language, chartData, stressMetric),
    comparison: buildComparison(language, sign, otherSign, focusMetric, dateKey),
    metrics,
    personalForecast,
    signHoroscope,
    reactions: hydrateReactionSummaryLabels(options.reactions, language),
  };
}
