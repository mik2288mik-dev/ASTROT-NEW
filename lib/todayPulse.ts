import { fromZonedTime } from 'date-fns-tz';
import { getZodiacSign } from '../constants';
import type {
  Language,
  NatalChartData,
  PlanetPosition,
  TodayPulse,
  TodayPulseLayerKey,
  TodayPulseLayers,
  TodayPulsePhase,
  TodayPulsePoint,
  TodayPulseTone,
  TodayPulseWindow,
} from '../types';
import { getCurrentTransits, type CurrentTransits, type PlanetTransit } from './transits-calculator';
import { logger } from './logger';

export const TODAY_PULSE_CALCULATION_VERSION = 'today-pulse-v1';

const LAYERS: TodayPulseLayerKey[] = ['energy', 'focus', 'emotions', 'money', 'relationships'];
const DEFAULT_TIMEZONE = 'Europe/Moscow';
type TodayPulseMetricSource = TodayPulse['source'] | 'unavailable';

const todayPulseMetrics = {
  swisseph: 0,
  algorithmic: 0,
  mixed: 0,
  unavailable: 0,
};

export class TodayPulseQualityError extends Error {
  code = 'TODAY_PULSE_REQUIRES_SWISSEPH';

  constructor(message: string) {
    super(message);
    this.name = 'TodayPulseQualityError';
  }
}

function recordTodayPulseMetric(source: TodayPulseMetricSource) {
  todayPulseMetrics[source] += 1;
  logger.info({
    scope: 'today-pulse',
    event: 'today_pulse_source_metric',
    source,
    metadata: { counts: { ...todayPulseMetrics } },
  });
}

export function getTodayPulseMetricsSnapshot() {
  return { ...todayPulseMetrics };
}

export function isFullSwissTodayPulse(pulse: TodayPulse | null | undefined): boolean {
  return !!pulse &&
    pulse.source === 'swisseph' &&
    Array.isArray(pulse.points) &&
    pulse.points.length === 24 &&
    pulse.calculationVersion === TODAY_PULSE_CALCULATION_VERSION;
}

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

type BuildTodayPulseOptions = {
  chartData: NatalChartData;
  dateKey: string;
  timezone?: string | null;
  language: Language;
  now?: Date;
};

type PhaseConfig = {
  phase: TodayPulsePhase;
  start: number;
  end: number;
  label: Record<Language, string>;
  summary: Record<Language, string>;
  tone: TodayPulseTone;
};

const PHASES: PhaseConfig[] = [
  {
    phase: 'restore',
    start: 0,
    end: 6,
    label: { ru: 'Восстановление', en: 'Recovery' },
    summary: { ru: 'Тело и нервная система собирают ресурс.', en: 'Body and nervous system rebuild resources.' },
    tone: 'restore',
  },
  {
    phase: 'entry',
    start: 6,
    end: 10,
    label: { ru: 'Вход в день', en: 'Entering the day' },
    summary: { ru: 'Лучше входить мягко: порядок, план, первые решения.', en: 'Ease in: order, planning, first decisions.' },
    tone: 'rise',
  },
  {
    phase: 'focus_peak',
    start: 10,
    end: 14,
    label: { ru: 'Пик фокуса', en: 'Focus peak' },
    summary: { ru: 'Самое сильное окно для задач, письма и концентрации.', en: 'The strongest window for tasks, writing, and focus.' },
    tone: 'peak',
  },
  {
    phase: 'decisions',
    start: 14,
    end: 17,
    label: { ru: 'Общение / решения', en: 'Talks / decisions' },
    summary: { ru: 'Подходят переписки, встречи и аккуратные договоренности.', en: 'Good for messages, meetings, and careful agreements.' },
    tone: 'social',
  },
  {
    phase: 'relationships',
    start: 17,
    end: 21,
    label: { ru: 'Отношения / эмоции', en: 'Relationships / emotions' },
    summary: { ru: 'Чувства звучат громче: важны тон и бережность.', en: 'Feelings speak louder: tone and care matter.' },
    tone: 'social',
  },
  {
    phase: 'reflection',
    start: 21,
    end: 24,
    label: { ru: 'Спад / рефлексия', en: 'Wind-down / reflection' },
    summary: { ru: 'Закрыть день, убрать лишнее, вернуть тишину.', en: 'Close the day, clear excess, return to quiet.' },
    tone: 'calm',
  },
];

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function normalizeDegree(value: number) {
  const next = value % 360;
  return next < 0 ? next + 360 : next;
}

function stableUnit(seed: string) {
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return (hash % 10000) / 10000;
}

function stableNoise(seed: string, spread = 4) {
  return (stableUnit(seed) - 0.5) * spread;
}

function normalizeTimezone(timezone?: string | null) {
  const candidate = String(timezone || '').trim() || DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

function dateKeyForTimezone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value || '1970';
  const month = parts.find((part) => part.type === 'month')?.value || '01';
  const day = parts.find((part) => part.type === 'day')?.value || '01';
  return `${year}-${month}-${day}`;
}

function timeForTimezone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value || 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value || 0);
  return {
    label: `${pad2(hour)}:${pad2(minute)}`,
    hour,
  };
}

function localHourToUtc(dateKey: string, hour: number, timezone: string) {
  return fromZonedTime(`${dateKey}T${pad2(hour)}:00:00`, timezone);
}

function normalizeSign(value?: string | null): ZodiacKey {
  return ZODIAC_KEYS.find((sign) => sign.toLowerCase() === String(value || '').toLowerCase()) || 'Aries';
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

function angularDistance(a: number, b: number) {
  const diff = Math.abs(normalizeDegree(a) - normalizeDegree(b)) % 360;
  return diff > 180 ? 360 - diff : diff;
}

function aspectScore(a: number | null, b: number | null, targets: number[], width = 18) {
  if (a == null || b == null) return null;
  const diff = angularDistance(a, b);
  const nearest = Math.min(...targets.map((target) => Math.abs(diff - target)));
  return Math.max(0, 1 - nearest / width);
}

function average(values: Array<number | null | undefined>, fallback = 0.45) {
  const clean = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (!clean.length) return fallback;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function getHouseNumber(position?: PlanetPosition | null) {
  const raw = position?.house;
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.round(raw);
  const parsed = Number.parseInt(String(raw || ''), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function birthTimeQualityFor(chartData: NatalChartData) {
  return (chartData as any).birthTimeQuality || (chartData as any).chartQuality?.birthTimeQuality || 'exact';
}

function hasReliableAscendant(chartData: NatalChartData) {
  const quality = (chartData as any).chartQuality;
  return birthTimeQualityFor(chartData) === 'exact' && quality?.ascendantReliable !== false;
}

function hasReliableHouses(chartData: NatalChartData) {
  const quality = (chartData as any).chartQuality;
  return birthTimeQualityFor(chartData) === 'exact' &&
    quality?.housesReliable !== false &&
    Array.isArray(chartData.houses) &&
    chartData.houses.length >= 12;
}

function houseScore(positions: Array<PlanetPosition | null | undefined>, targets: number[]) {
  const houses = positions.map(getHouseNumber).filter((value): value is number => value != null);
  if (!houses.length) return null;
  const scores = houses.map((house) => {
    if (targets.includes(house)) return 1;
    const nearest = Math.min(...targets.map((target) => Math.abs(target - house)));
    return nearest === 1 ? 0.62 : nearest === 2 ? 0.38 : 0.18;
  });
  return average(scores, 0.42);
}

function gaussian(hour: number, center: number, width: number) {
  return Math.exp(-Math.pow(hour - center, 2) / (2 * width * width));
}

function circadianLayer(hour: number, layer: TodayPulseLayerKey) {
  if (layer === 'energy') return Math.max(gaussian(hour, 9, 3.2), gaussian(hour, 14, 4.2) * 0.74);
  if (layer === 'focus') return Math.max(gaussian(hour, 12, 2.7), gaussian(hour, 9, 3.4) * 0.58);
  if (layer === 'emotions') return Math.max(gaussian(hour, 19, 3.2), gaussian(hour, 1, 2.8) * 0.42);
  if (layer === 'money') return Math.max(gaussian(hour, 13, 3.2), gaussian(hour, 16, 2.4) * 0.62);
  return Math.max(gaussian(hour, 18.5, 3), gaussian(hour, 15, 3.5) * 0.46);
}

function phaseForHour(hour: number) {
  return PHASES.find((phase) => hour >= phase.start && hour < phase.end) || PHASES[0];
}

function dominantLayer(layers: TodayPulseLayers): TodayPulseLayerKey {
  return LAYERS.reduce((best, key) => (layers[key] > layers[best] ? key : best), 'energy' as TodayPulseLayerKey);
}

function calculateLayers(chartData: NatalChartData, transits: CurrentTransits, hour: number, seed: string): TodayPulseLayers {
  const natal = {
    sun: getPositionLongitude(chartData.sun),
    moon: getPositionLongitude(chartData.moon),
    rising: hasReliableAscendant(chartData) ? getPositionLongitude(chartData.rising) : null,
    mercury: getPositionLongitude(chartData.mercury),
    venus: getPositionLongitude(chartData.venus),
    mars: getPositionLongitude(chartData.mars),
    jupiter: getPositionLongitude(chartData.jupiter),
    saturn: getPositionLongitude(chartData.saturn),
  };
  const current = {
    sun: getTransitLongitude(transits.sun),
    moon: getTransitLongitude(transits.moon),
    mercury: getTransitLongitude(transits.mercury),
    venus: getTransitLongitude(transits.venus),
    mars: getTransitLongitude(transits.mars),
    jupiter: getTransitLongitude(transits.jupiter),
    saturn: getTransitLongitude(transits.saturn),
  };
  const support = (...pairs: Array<[number | null, number | null]>) =>
    average(pairs.map(([a, b]) => aspectScore(a, b, [0, 60, 120], 18)), 0.42);
  const pressure = (...pairs: Array<[number | null, number | null]>) =>
    average(pairs.map(([a, b]) => aspectScore(a, b, [90, 180], 16)), 0.28);
  const housesReliable = hasReliableHouses(chartData);
  const house = housesReliable
    ? {
        energy: houseScore([chartData.sun, chartData.mars, chartData.moon], [1, 6]),
        focus: houseScore([chartData.mercury, chartData.saturn, chartData.sun], [3, 6, 10]),
        emotions: houseScore([chartData.moon, chartData.venus], [4, 7, 12]),
        money: houseScore([chartData.venus, chartData.jupiter, chartData.sun], [2, 8, 10]),
        relationships: houseScore([chartData.venus, chartData.moon], [5, 7]),
      }
    : {
        energy: null,
        focus: null,
        emotions: null,
        money: null,
        relationships: null,
      };
  const score = (
    layer: TodayPulseLayerKey,
    base: number,
    astroSupport: number,
    astroPressure: number,
    houseValue: number | null,
    houseWeight: number
  ) => {
    const housePart = houseValue == null ? 0 : (houseValue - 0.45) * houseWeight;
    return clamp(
      base +
      circadianLayer(hour, layer) * 22 +
      astroSupport * 25 -
      astroPressure * 14 +
      housePart +
      stableNoise(`${seed}:${hour}:${layer}`)
    );
  };

  return {
    energy: score(
      'energy',
      38,
      support([current.sun, natal.sun], [current.mars, natal.mars], [current.moon, natal.rising]),
      pressure([current.mars, natal.moon], [current.moon, natal.mars]),
      house.energy,
      14
    ),
    focus: score(
      'focus',
      37,
      support([current.mercury, natal.mercury], [current.saturn, natal.mercury], [current.sun, natal.mercury]),
      pressure([current.moon, natal.mercury], [current.mars, natal.mercury]),
      house.focus,
      16
    ),
    emotions: score(
      'emotions',
      40,
      support([current.moon, natal.moon], [current.venus, natal.moon], [current.venus, natal.venus]),
      pressure([current.mars, natal.moon], [current.moon, natal.venus], [current.saturn, natal.moon]),
      house.emotions,
      13
    ),
    money: score(
      'money',
      36,
      support([current.venus, natal.venus], [current.jupiter, natal.venus], [current.sun, natal.jupiter]),
      pressure([current.mars, natal.venus], [current.saturn, natal.venus]),
      house.money,
      14
    ),
    relationships: score(
      'relationships',
      39,
      support([current.venus, natal.venus], [current.moon, natal.venus], [current.moon, natal.moon]),
      pressure([current.mars, natal.venus], [current.saturn, natal.moon], [current.moon, natal.mars]),
      house.relationships,
      15
    ),
  };
}

function calculateScore(layers: TodayPulseLayers, phase: TodayPulsePhase) {
  const base =
    layers.energy * 0.24 +
    layers.focus * 0.31 +
    layers.emotions * 0.17 +
    layers.money * 0.13 +
    layers.relationships * 0.15;
  const phaseBias = phase === 'focus_peak' ? 4 : phase === 'restore' ? -3 : phase === 'reflection' ? -2 : 0;
  return clamp(base + phaseBias);
}

function buildPointText(
  language: Language,
  phaseConfig: PhaseConfig,
  layers: TodayPulseLayers,
  transits: CurrentTransits,
  dominant: TodayPulseLayerKey,
  hasHouses: boolean,
  score: number
) {
  const moon = getZodiacSign(language, normalizeSign(transits.moon.sign));
  const mercury = transits.mercury ? getZodiacSign(language, normalizeSign(transits.mercury.sign)) : null;
  const venus = transits.venus ? getZodiacSign(language, normalizeSign(transits.venus.sign)) : null;
  const cautious = phaseConfig.phase === 'relationships' && layers.emotions < 46;
  const titleByPhase: Record<TodayPulsePhase, Record<Language, string>> = {
    restore: { ru: 'Восстановление', en: 'Recovery' },
    entry: { ru: 'Мягкий старт', en: 'Soft start' },
    focus_peak: { ru: score >= 72 ? 'Пик фокуса' : 'Рабочее окно', en: score >= 72 ? 'Focus peak' : 'Work window' },
    decisions: { ru: 'Решения и связи', en: 'Decisions and links' },
    relationships: { ru: cautious ? 'Осторожнее с эмоциями' : 'Контакт и люди', en: cautious ? 'Careful with emotions' : 'People and connection' },
    reflection: { ru: 'Закрыть день', en: 'Close the day' },
  };
  const summaryByPhase: Record<TodayPulsePhase, Record<Language, string>> = {
    restore: {
      ru: score >= 50 ? 'Можно спокойно восстановиться и закрыть простые хвосты.' : 'Не разгоняйся: это окно для сна, тишины и восстановления.',
      en: score >= 50 ? 'A calm recovery window for simple loose ends.' : 'Do not push: this is for sleep, quiet, and recovery.',
    },
    entry: {
      ru: 'Начни с порядка: план, быт, короткие задачи, без резкого старта.',
      en: 'Start with order: plan, basics, short tasks, no hard launch.',
    },
    focus_peak: {
      ru: score >= 72 ? 'Лучшее окно для главной задачи, документов, текста и планирования.' : 'Фокус есть, но лучше держать одну задачу и не распыляться.',
      en: score >= 72 ? 'Best window for the main task, documents, writing, and planning.' : 'Focus is available, but keep it to one task.',
    },
    decisions: {
      ru: 'Подходит для звонков, договоренностей, быстрых решений и рабочих правок.',
      en: 'Good for calls, agreements, quick decisions, and work edits.',
    },
    relationships: {
      ru: cautious ? 'Чувствительность выше обычного: не выясняй отношения на скорости.' : 'Хорошее окно для контакта, поддержки, личных разговоров и командных дел.',
      en: cautious ? 'Sensitivity is higher: avoid rushing emotional talks.' : 'Good for contact, support, personal talks, and teamwork.',
    },
    reflection: {
      ru: 'Закрывай день: итоги, дневник, душ, тишина, без новых тяжелых решений.',
      en: 'Close the day: notes, shower, quiet, no new heavy decisions.',
    },
  };
  const dominantSummary: Record<TodayPulseLayerKey, Record<Language, string>> = {
    energy: {
      ru: 'Есть ресурс на движение, но выиграет не скорость, а ровный темп.',
      en: 'There is energy for movement, but a steady pace wins over speed.',
    },
    focus: {
      ru: 'Фокус есть, но день не любит хаос. Выбери одну задачу и доведи ее до конца.',
      en: 'Focus is available, but the day dislikes chaos. Choose one task and finish it.',
    },
    emotions: {
      ru: 'Эмоции звучат громче обычного: отвечай после паузы, не на импульсе.',
      en: 'Emotions are louder than usual: answer after a pause, not from impulse.',
    },
    money: {
      ru: 'Хорошо идут расчеты, покупки, бюджет и решения, где важна конкретика.',
      en: 'Good for numbers, purchases, budget, and decisions that need specifics.',
    },
    relationships: {
      ru: 'Лучше идут диалоги, поддержка и договоренности без давления.',
      en: 'Dialogue, support, and agreements work better without pressure.',
    },
  };
  const title = titleByPhase[phaseConfig.phase][language];
  const summary = `${summaryByPhase[phaseConfig.phase][language]} ${dominantSummary[dominant][language]}`;
  const reasons = [
    language === 'ru'
      ? `Луна в ${moon} задает эмоциональный фон этого часа.`
      : `Moon in ${moon} sets the emotional tone of this hour.`,
    mercury
      ? language === 'ru'
        ? `Меркурий в ${mercury} влияет на фокус, переписки и скорость решений.`
        : `Mercury in ${mercury} shapes focus, messages, and decision speed.`
      : language === 'ru'
        ? 'Фокус считается по связи текущего Солнца и Луны с личными планетами.'
        : 'Focus is calculated from current Sun/Moon links to personal planets.',
    venus
      ? language === 'ru'
        ? `Венера в ${venus} добавляет слой контакта, денег и личных ценностей.`
        : `Venus in ${venus} adds the layer of contact, money, and values.`
      : language === 'ru'
        ? 'Контакт считается по Луне и личной Венере в карте.'
        : 'Connection is calculated from the Moon and natal Venus.',
  ];
  if (hasHouses) {
    reasons.push(language === 'ru'
      ? 'Дома натальной карты добавляют персональный вес к этому окну.'
      : 'Natal houses add personal weight to this window.');
  }
  return { title, summary, reasons: reasons.slice(0, 4) };
}

function bestFor(language: Language, phase: TodayPulsePhase) {
  const ru: Record<TodayPulsePhase, string[]> = {
    restore: ['сон', 'тишина', 'мягкое восстановление'],
    entry: ['план дня', 'порядок', 'первые простые задачи'],
    focus_peak: ['главная задача', 'переписка', 'планирование'],
    decisions: ['встречи', 'договоренности', 'финальные правки'],
    relationships: ['теплый контакт', 'личные разговоры', 'бережные решения'],
    reflection: ['закрыть день', 'дневник', 'тишина без лишних стимулов'],
  };
  const en: Record<TodayPulsePhase, string[]> = {
    restore: ['sleep', 'quiet', 'soft recovery'],
    entry: ['day plan', 'order', 'first simple tasks'],
    focus_peak: ['main task', 'messages', 'planning'],
    decisions: ['meetings', 'agreements', 'final edits'],
    relationships: ['warm contact', 'personal talks', 'careful decisions'],
    reflection: ['close the day', 'journal', 'quiet without extra stimuli'],
  };
  const list = language === 'ru' ? ru[phase] : en[phase];
  return list.slice(0, 3);
}

function avoidFor(language: Language, phase: TodayPulsePhase, tone: TodayPulseTone) {
  if (language === 'en') {
    if (tone === 'caution') return ['relationship pressure', 'sharp messages', 'rushed conclusions'];
    if (phase === 'restore' || phase === 'reflection') return ['heavy decisions', 'doomscrolling', 'late arguments'];
    if (phase === 'focus_peak') return ['context switching', 'minor distractions', 'unplanned calls'];
    return ['rushing', 'mixed signals', 'extra promises'];
  }
  if (tone === 'caution') return ['давить в отношениях', 'резкие сообщения', 'быстрые выводы'];
  if (phase === 'restore' || phase === 'reflection') return ['тяжелые решения', 'думскроллинг', 'поздние споры'];
  if (phase === 'focus_peak') return ['перескакивать между задачами', 'мелкие отвлечения', 'внезапные созвоны'];
  return ['спешить', 'читать между строк', 'обещать лишнее'];
}

function buildPoint(
  language: Language,
  chartData: NatalChartData,
  dateKey: string,
  hour: number,
  transits: CurrentTransits
): TodayPulsePoint {
  const phaseConfig = phaseForHour(hour);
  const layers = calculateLayers(chartData, transits, hour, dateKey);
  const phase = phaseConfig.phase;
  const dominant = dominantLayer(layers);
  const score = calculateScore(layers, phase);
  const hasHouses = hasReliableHouses(chartData);
  const text = buildPointText(language, phaseConfig, layers, transits, dominant, hasHouses, score);
  const tone: TodayPulseTone = phase === 'relationships' && layers.emotions < 46
    ? 'caution'
    : score >= 72
      ? 'peak'
      : phaseConfig.tone;
  return {
    time: `${pad2(hour)}:00`,
    hour,
    score,
    layers,
    phase,
    title: text.title,
    summary: text.summary,
    reasons: text.reasons,
    bestFor: bestFor(language, phase),
    avoid: avoidFor(language, phase, tone),
    tone,
    isKeyMoment: false,
  };
}

function pointsForWindow(points: TodayPulsePoint[], phase: PhaseConfig) {
  return points.filter((point) => point.hour >= phase.start && point.hour < phase.end);
}

function averageLayers(points: TodayPulsePoint[]): TodayPulseLayers {
  const safe = points.length ? points : [];
  const value = (key: TodayPulseLayerKey) => clamp(average(safe.map((point) => point.layers[key]), 50));
  return {
    energy: value('energy'),
    focus: value('focus'),
    emotions: value('emotions'),
    money: value('money'),
    relationships: value('relationships'),
  };
}

function buildWindows(points: TodayPulsePoint[], language: Language): TodayPulseWindow[] {
  return PHASES.map((phase) => {
    const phasePoints = pointsForWindow(points, phase);
    const layers = averageLayers(phasePoints);
    return {
      start: `${pad2(phase.start)}:00`,
      end: phase.end === 24 ? '00:00' : `${pad2(phase.end)}:00`,
      label: phase.label[language],
      summary: phase.summary[language],
      score: clamp(average(phasePoints.map((point) => point.score), 50)),
      dominantLayer: dominantLayer(layers),
      tone: phase.tone,
    };
  });
}

function maxBy<T>(items: T[], score: (item: T) => number): T {
  return items.reduce((best, item) => (score(item) > score(best) ? item : best), items[0]);
}

function minBy<T>(items: T[], score: (item: T) => number): T {
  return items.reduce((best, item) => (score(item) < score(best) ? item : best), items[0]);
}

function chooseKeyMoments(points: TodayPulsePoint[], current: TodayPulsePoint, peak: TodayPulsePoint) {
  const focusWindow = points.filter((point) => point.hour >= 10 && point.hour < 14);
  const relationWindow = points.filter((point) => point.hour >= 17 && point.hour < 21);
  const recoveryWindow = points.filter((point) => point.hour >= 21 || point.hour < 6);
  const candidates = [
    current,
    peak,
    maxBy(focusWindow.length ? focusWindow : points, (point) => point.layers.focus),
    minBy(relationWindow.length ? relationWindow : points, (point) => point.layers.emotions),
    maxBy(recoveryWindow.length ? recoveryWindow : points, (point) => point.layers.emotions + point.layers.energy * 0.2),
  ];
  const unique = new Map<number, TodayPulsePoint>();
  for (const point of candidates) unique.set(point.hour, point);
  for (const phase of PHASES) {
    if (unique.size >= 5) break;
    unique.set(maxBy(pointsForWindow(points, phase), (point) => point.score).hour, maxBy(pointsForWindow(points, phase), (point) => point.score));
  }
  return Array.from(unique.values()).sort((a, b) => a.hour - b.hour).slice(0, 5);
}

function deriveSource(transits: CurrentTransits[]): TodayPulse['source'] {
  const sources = new Set(transits.map((item) => item.source || 'algorithmic'));
  if (sources.size === 1 && sources.has('swisseph')) return 'swisseph';
  if (sources.size === 1 && sources.has('algorithmic')) return 'algorithmic';
  return 'mixed';
}

export async function buildTodayPulse(options: BuildTodayPulseOptions): Promise<TodayPulse> {
  const startedAt = Date.now();
  const language = options.language === 'en' ? 'en' : 'ru';
  const timezone = normalizeTimezone(options.timezone || options.chartData.timezone);
  const now = options.now || new Date();
  const localNow = timeForTimezone(now, timezone);
  const currentDateKey = dateKeyForTimezone(now, timezone);
  const currentHour = currentDateKey === options.dateKey ? localNow.hour : 12;
  logger.info({
    scope: 'today-pulse',
    event: 'today_pulse_build_start',
    calculationVersion: TODAY_PULSE_CALCULATION_VERSION,
    metadata: { dateKey: options.dateKey, timezone },
  });
  const hourlyDates = Array.from({ length: 24 }, (_, hour) => localHourToUtc(options.dateKey, hour, timezone));
  let transits: CurrentTransits[];
  try {
    transits = await Promise.all(hourlyDates.map((date) => getCurrentTransits(date)));
  } catch (error) {
    recordTodayPulseMetric('unavailable');
    logger.error({
      scope: 'today-pulse',
      event: 'today_pulse_unavailable',
      status: 'error',
      errorCode: 'TODAY_PULSE_UNAVAILABLE',
      durationMs: Date.now() - startedAt,
      metadata: { dateKey: options.dateKey },
    });
    throw error;
  }
  const source = deriveSource(transits);
  recordTodayPulseMetric(source);
  if (transits.length !== 24 || source !== 'swisseph') {
    logger.warn({
      scope: 'today-pulse',
      event: 'today_pulse_strict_validation_failed',
      source,
      status: 'failed',
      errorCode: 'TODAY_PULSE_REQUIRES_SWISSEPH',
      durationMs: Date.now() - startedAt,
      metadata: { dateKey: options.dateKey, pointCount: transits.length },
    });
    throw new TodayPulseQualityError(
      `Today Pulse requires 24 Swiss Ephemeris transit points; received ${transits.length} points with source=${source}`
    );
  }
  logger.info({
    scope: 'today-pulse',
    event: 'today_pulse_swisseph_24_success',
    source: 'swisseph',
    status: 'ok',
    calculationVersion: TODAY_PULSE_CALCULATION_VERSION,
    durationMs: Date.now() - startedAt,
    metadata: { dateKey: options.dateKey, pointCount: transits.length },
  });
  const points = transits.map((item, hour) => buildPoint(language, options.chartData, options.dateKey, hour, item));
  const peakPoint = maxBy(points, (point) => point.score);
  const currentPoint = points[currentHour] || peakPoint;
  const keyMoments = chooseKeyMoments(points, currentPoint, peakPoint);
  const keyHours = new Set(keyMoments.map((point) => point.hour));
  const markedPoints = points.map((point) => ({ ...point, isKeyMoment: keyHours.has(point.hour) }));
  const markedKeyMoments = keyMoments.map((point) => ({ ...markedPoints[point.hour], isKeyMoment: true }));

  return {
    date: options.dateKey,
    timezone,
    generatedAt: now.toISOString(),
    source,
    currentTime: currentDateKey === options.dateKey ? localNow.label : currentPoint.time,
    currentPoint: markedPoints[currentPoint.hour],
    peakPoint: markedPoints[peakPoint.hour],
    layers: markedPoints[currentPoint.hour].layers,
    points: markedPoints,
    windows: buildWindows(markedPoints, language),
    keyMoments: markedKeyMoments,
    calculationVersion: TODAY_PULSE_CALCULATION_VERSION,
  };
}
