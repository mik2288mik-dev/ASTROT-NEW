import { fromZonedTime } from 'date-fns-tz';
import type { NatalChartData } from '../types';
import {
  APP_VOICE_VERSION,
  hasAppVoiceViolation,
  withAppVoiceVersion,
} from './appVoice';

export type PersonalForecastPeriod = 'day' | 'week' | 'month' | 'year';

export type FixedForecastTopicKey =
  | 'overview'
  | 'love'
  | 'work'
  | 'money'
  | 'mood_energy'
  | 'communication'
  | 'luck';

export type DynamicForecastTopicKey =
  | 'business'
  | 'study'
  | 'home_family'
  | 'friends_social'
  | 'creativity'
  | 'travel_movement'
  | 'documents_deals'
  | 'purchases_property'
  | 'public_visibility'
  | 'rest_recovery'
  | 'physical_activity'
  | 'important_choice';

export type ForecastTopicKey = FixedForecastTopicKey | DynamicForecastTopicKey;

export type CalculatedAstroEvidence = {
  id: string;
  kind:
    | 'transit_to_natal'
    | 'transit_house'
    | 'lunation'
    | 'ingress'
    | 'station'
    | 'period_aggregate';
  transitPlanet?: string | null;
  natalPoint?: string | null;
  aspect?: string | null;
  house?: number | null;
  orb?: number | null;
  status: 'applying' | 'separating' | 'exact' | 'active' | 'unknown';
  exactAt?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  strength: number;
  polarity: 'supporting' | 'challenging' | 'mixed' | 'neutral';
  topicKeys: ForecastTopicKey[];
  calculationSource: string;
};

export type TopicEvidence = {
  primary: CalculatedAstroEvidence[];
  supporting: CalculatedAstroEvidence[];
  conflicting: CalculatedAstroEvidence[];
  confidence: 'high' | 'medium' | 'low';
};

export type ForecastTopicText = {
  card: string;
  reading: string;
  astrology: {
    explanation: string;
    evidence_ids: string[];
  };
};

export type ForecastEvidenceView = {
  id: string;
  factor: string;
  orb: number | null;
  status: CalculatedAstroEvidence['status'];
  period: string | null;
  meaning: string;
};

export type PersonalForecastPackage = {
  period: PersonalForecastPeriod;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  timezone: string;

  overview: ForecastTopicText;
  love: ForecastTopicText;
  work: ForecastTopicText;
  money: ForecastTopicText;
  mood_energy: ForecastTopicText;
  communication: ForecastTopicText;
  luck: ForecastTopicText;

  dynamic: Array<{
    key: DynamicForecastTopicKey;
    title: string;
    text: ForecastTopicText;
  }>;

  evidence: Record<string, ForecastEvidenceView>;

  visual: {
    heroAssetId: string | null;
    topicAssetIds: Record<string, string | null>;
  };

  meta: {
    model: string;
    promptVersion: string;
    voiceVersion: string;
    calculationVersion: string | null;
    generatedAt: string;
    status: 'ready' | 'generating' | 'unavailable';
    diagnosticCode?: string | null;
    visualFallback?: boolean;
  };
};

export type PersonalForecastAccessPayload = {
  forecast: PersonalForecastPackage;
  accessTier: 'free' | 'premium';
  lockedTopicKeys: ForecastTopicKey[];
  source: 'cache' | 'generated';
};

export const FIXED_FORECAST_TOPIC_KEYS = [
  'overview',
  'love',
  'work',
  'money',
  'mood_energy',
  'communication',
  'luck',
] as const satisfies readonly FixedForecastTopicKey[];

export const DYNAMIC_FORECAST_TOPIC_KEYS = [
  'business',
  'study',
  'home_family',
  'friends_social',
  'creativity',
  'travel_movement',
  'documents_deals',
  'purchases_property',
  'public_visibility',
  'rest_recovery',
  'physical_activity',
  'important_choice',
] as const satisfies readonly DynamicForecastTopicKey[];

export const PERSONAL_FORECAST_PROMPT_VERSION = withAppVoiceVersion(
  'personal-forecast.v2.evidence-first',
);
export const PERSONAL_FORECAST_CALCULATION_VERSION = 'personal-forecast-evidence-v2';
export const PERSONAL_FORECAST_VISUAL_MANIFEST_VERSION = 'forecast-visual-v2';
export const PERSONAL_FORECAST_FREE_READING_TOPIC: FixedForecastTopicKey = 'love';

export const FORECAST_TOPIC_TITLES: Record<
  'ru' | 'en',
  Record<ForecastTopicKey, string>
> = {
  ru: {
    overview: 'Главное',
    love: 'Любовь',
    work: 'Работа и дела',
    money: 'Деньги',
    mood_energy: 'Настроение и силы',
    communication: 'Общение',
    luck: 'Удача',
    business: 'Бизнес',
    study: 'Учёба',
    home_family: 'Дом и семья',
    friends_social: 'Друзья и окружение',
    creativity: 'Творчество',
    travel_movement: 'Поездки и движение',
    documents_deals: 'Документы и договорённости',
    purchases_property: 'Покупки и имущество',
    public_visibility: 'Публичность',
    rest_recovery: 'Отдых и восстановление',
    physical_activity: 'Физическая активность',
    important_choice: 'Важный выбор',
  },
  en: {
    overview: 'Overview',
    love: 'Love',
    work: 'Work and tasks',
    money: 'Money',
    mood_energy: 'Mood and energy',
    communication: 'Communication',
    luck: 'Luck',
    business: 'Business',
    study: 'Study',
    home_family: 'Home and family',
    friends_social: 'Friends and social life',
    creativity: 'Creativity',
    travel_movement: 'Travel and movement',
    documents_deals: 'Documents and agreements',
    purchases_property: 'Purchases and property',
    public_visibility: 'Public visibility',
    rest_recovery: 'Rest and recovery',
    physical_activity: 'Physical activity',
    important_choice: 'Important choice',
  },
};

export const FORECAST_OVERVIEW_TITLES: Record<
  'ru' | 'en',
  Record<PersonalForecastPeriod, string>
> = {
  ru: {
    day: 'Твой день',
    week: 'Твоя неделя',
    month: 'Твой месяц',
    year: 'Твой год',
  },
  en: {
    day: 'Your day',
    week: 'Your week',
    month: 'Your month',
    year: 'Your year',
  },
};

const PERIOD_READING_LIMITS: Record<PersonalForecastPeriod, number> = {
  day: 700,
  week: 900,
  month: 1100,
  year: 1400,
};

const PERIOD_ASTROLOGY_LIMITS: Record<PersonalForecastPeriod, number> = {
  day: 500,
  week: 650,
  month: 750,
  year: 900,
};

export type PersonalForecastWindow = {
  period: PersonalForecastPeriod;
  periodKey: string;
  timezone: string;
  periodStart: string;
  periodEnd: string;
  startsAt: Date;
  endsAt: Date;
  validTo: Date;
};

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function datePartsInTimezone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value || 0);
  return { year: read('year'), month: read('month'), day: read('day') };
}

export function normalizeForecastTimezone(value?: string | null): string {
  const candidate = String(value || '').trim() || 'Europe/Moscow';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return 'Europe/Moscow';
  }
}

function isoWeekFromDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - weekday);
  const weekYear = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(weekYear, 0, 1));
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
  return { weekYear, week };
}

export function getPersonalForecastPeriodKey(
  period: PersonalForecastPeriod,
  date = new Date(),
  timezone = 'Europe/Moscow',
): string {
  const safeTimezone = normalizeForecastTimezone(timezone);
  const { year, month, day } = datePartsInTimezone(date, safeTimezone);
  if (period === 'day') return isoDate(year, month, day);
  if (period === 'month') return `${year}-${pad2(month)}`;
  if (period === 'year') return String(year);
  const iso = isoWeekFromDate(year, month, day);
  return `${iso.weekYear}-W${pad2(iso.week)}`;
}

function parsePeriodKey(period: PersonalForecastPeriod, periodKey: string) {
  if (period === 'day') {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(periodKey);
    if (!match) return null;
    return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  }
  if (period === 'week') {
    const match = /^(\d{4})-W(\d{2})$/.exec(periodKey);
    if (!match) return null;
    const year = Number(match[1]);
    const week = Number(match[2]);
    if (week < 1 || week > 53) return null;
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const jan4Weekday = jan4.getUTCDay() || 7;
    const monday = new Date(jan4);
    monday.setUTCDate(jan4.getUTCDate() - jan4Weekday + 1 + (week - 1) * 7);
    return {
      year: monday.getUTCFullYear(),
      month: monday.getUTCMonth() + 1,
      day: monday.getUTCDate(),
    };
  }
  if (period === 'month') {
    const match = /^(\d{4})-(\d{2})$/.exec(periodKey);
    if (!match) return null;
    return { year: Number(match[1]), month: Number(match[2]), day: 1 };
  }
  const match = /^(\d{4})$/.exec(periodKey);
  if (!match) return null;
  return { year: Number(match[1]), month: 1, day: 1 };
}

export function resolvePersonalForecastWindow(
  period: PersonalForecastPeriod,
  periodKey: string,
  timezone?: string | null,
): PersonalForecastWindow {
  const safeTimezone = normalizeForecastTimezone(timezone);
  const parsed = parsePeriodKey(period, periodKey);
  if (!parsed) throw new Error('INVALID_PERSONAL_FORECAST_PERIOD_KEY');

  const startDay = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
  const endExclusive = new Date(startDay);
  if (period === 'day') endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
  if (period === 'week') endExclusive.setUTCDate(endExclusive.getUTCDate() + 7);
  if (period === 'month') endExclusive.setUTCMonth(endExclusive.getUTCMonth() + 1);
  if (period === 'year') endExclusive.setUTCFullYear(endExclusive.getUTCFullYear() + 1);

  const endDay = new Date(endExclusive);
  endDay.setUTCDate(endDay.getUTCDate() - 1);
  const periodStart = isoDate(
    startDay.getUTCFullYear(),
    startDay.getUTCMonth() + 1,
    startDay.getUTCDate(),
  );
  const periodEnd = isoDate(
    endDay.getUTCFullYear(),
    endDay.getUTCMonth() + 1,
    endDay.getUTCDate(),
  );
  const endExclusiveKey = isoDate(
    endExclusive.getUTCFullYear(),
    endExclusive.getUTCMonth() + 1,
    endExclusive.getUTCDate(),
  );

  return {
    period,
    periodKey,
    timezone: safeTimezone,
    periodStart,
    periodEnd,
    startsAt: fromZonedTime(`${periodStart}T00:00:00`, safeTimezone),
    endsAt: fromZonedTime(`${periodEnd}T23:59:59`, safeTimezone),
    validTo: fromZonedTime(`${endExclusiveKey}T00:00:00`, safeTimezone),
  };
}

export function getNextPersonalForecastPeriodKey(
  period: PersonalForecastPeriod,
  periodKey: string,
  timezone?: string | null,
): string {
  const window = resolvePersonalForecastWindow(period, periodKey, timezone);
  return getPersonalForecastPeriodKey(
    period,
    new Date(window.validTo.getTime() + 60_000),
    window.timezone,
  );
}

export function getPreviousPersonalForecastPeriodKey(
  period: PersonalForecastPeriod,
  periodKey: string,
  timezone?: string | null,
): string {
  const window = resolvePersonalForecastWindow(period, periodKey, timezone);
  return getPersonalForecastPeriodKey(
    period,
    new Date(window.startsAt.getTime() - 60_000),
    window.timezone,
  );
}

function normalizePosition(position: NatalChartData[keyof NatalChartData]) {
  if (!position || typeof position !== 'object' || !('sign' in position)) return null;
  const candidate = position as { sign?: string; longitude?: number; degree?: number; house?: string | number };
  return {
    sign: String(candidate.sign || ''),
    longitude: Number.isFinite(candidate.longitude) ? Number(candidate.longitude).toFixed(5) : null,
    degree: Number.isFinite(candidate.degree) ? Number(candidate.degree).toFixed(3) : null,
    house: candidate.house == null ? null : String(candidate.house),
  };
}

export function buildPersonalForecastChartFingerprint(chart: NatalChartData): string {
  const keys = [
    'sun',
    'moon',
    'rising',
    'mercury',
    'venus',
    'mars',
    'jupiter',
    'saturn',
    'uranus',
    'neptune',
    'pluto',
  ] as const;
  const value = JSON.stringify({
    planets: keys.map((key) => [key, normalizePosition(chart[key])]),
    houses: (chart.houses || []).map((house) => [
      house.house,
      Number(house.longitude).toFixed(5),
    ]),
    calculationVersion: chart.calculationVersion || null,
  });
  return stableHash(value).toString(36);
}

export function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function buildPersonalForecastCacheKey(input: {
  userId: string;
  chartId?: number | null;
  chartData: NatalChartData;
  period: PersonalForecastPeriod;
  periodKey: string;
  timezone: string;
  language: 'ru' | 'en';
  modelId: string;
}): string {
  const identity = [
    String(input.userId),
    input.chartId ?? 'primary',
    input.period,
    input.periodKey,
    normalizeForecastTimezone(input.timezone),
    input.language,
    input.chartData.calculationVersion || 'unknown',
    buildPersonalForecastChartFingerprint(input.chartData),
    PERSONAL_FORECAST_PROMPT_VERSION,
    APP_VOICE_VERSION,
    input.modelId,
  ].join('|');
  return `personal-forecast-v2:${stableHash(identity).toString(36)}:${input.period}:${input.periodKey}`;
}

export function buildPersonalForecastInputHash(input: {
  userId: string;
  chartId?: number | null;
  chartData: NatalChartData;
  period: PersonalForecastPeriod;
  periodKey: string;
  timezone: string;
  language: 'ru' | 'en';
  modelId: string;
}): string {
  return stableHash(JSON.stringify({
    ...input,
    chartData: buildPersonalForecastChartFingerprint(input.chartData),
    calculationVersion: PERSONAL_FORECAST_CALCULATION_VERSION,
    promptVersion: PERSONAL_FORECAST_PROMPT_VERSION,
    voiceVersion: APP_VOICE_VERSION,
  })).toString(36);
}

function topicTextValid(
  value: unknown,
  period: PersonalForecastPeriod,
  evidenceIds: Set<string>,
): value is ForecastTopicText {
  if (!value || typeof value !== 'object') return false;
  const topic = value as ForecastTopicText;
  if (
    typeof topic.card !== 'string'
    || !topic.card.trim()
    || topic.card.length > 280
    || typeof topic.reading !== 'string'
    || !topic.reading.trim()
    || topic.reading.length > PERIOD_READING_LIMITS[period]
    || typeof topic.astrology?.explanation !== 'string'
    || !topic.astrology.explanation.trim()
    || topic.astrology.explanation.length > PERIOD_ASTROLOGY_LIMITS[period]
    || !Array.isArray(topic.astrology.evidence_ids)
    || topic.astrology.evidence_ids.length < 1
    || topic.astrology.evidence_ids.length > 4
    || topic.astrology.evidence_ids.some((id) => !evidenceIds.has(id))
  ) {
    return false;
  }
  return !hasAppVoiceViolation(`${topic.card}\n${topic.reading}\n${topic.astrology.explanation}`);
}

export function isPersonalForecastPackage(value: unknown): value is PersonalForecastPackage {
  if (!value || typeof value !== 'object') return false;
  const forecast = value as PersonalForecastPackage;
  if (
    !(['day', 'week', 'month', 'year'] as const).includes(forecast.period)
    || typeof forecast.periodKey !== 'string'
    || typeof forecast.periodStart !== 'string'
    || typeof forecast.periodEnd !== 'string'
    || typeof forecast.timezone !== 'string'
    || forecast.meta?.promptVersion !== PERSONAL_FORECAST_PROMPT_VERSION
    || forecast.meta?.voiceVersion !== APP_VOICE_VERSION
    || forecast.meta?.status !== 'ready'
    || !forecast.evidence
    || typeof forecast.evidence !== 'object'
  ) {
    return false;
  }
  const ids = new Set(Object.keys(forecast.evidence));
  if (!FIXED_FORECAST_TOPIC_KEYS.every((key) => topicTextValid(forecast[key], forecast.period, ids))) {
    return false;
  }
  if (!Array.isArray(forecast.dynamic) || forecast.dynamic.length < 2 || forecast.dynamic.length > 3) {
    return false;
  }
  const dynamicKeys = new Set<DynamicForecastTopicKey>();
  for (const topic of forecast.dynamic) {
    if (
      !DYNAMIC_FORECAST_TOPIC_KEYS.includes(topic.key)
      || dynamicKeys.has(topic.key)
      || typeof topic.title !== 'string'
      || !topic.title.trim()
      || !topicTextValid(topic.text, forecast.period, ids)
    ) {
      return false;
    }
    dynamicKeys.add(topic.key);
  }
  return true;
}

export function createUnavailablePersonalForecast(
  period: PersonalForecastPeriod,
  periodKey: string,
  timezone: string,
  language: 'ru' | 'en',
  status: 'generating' | 'unavailable',
  diagnosticCode: string,
): PersonalForecastPackage {
  const window = resolvePersonalForecastWindow(period, periodKey, timezone);
  const emptyTopic: ForecastTopicText = {
    card: '',
    reading: '',
    astrology: { explanation: '', evidence_ids: [] },
  };
  return {
    period,
    periodKey,
    periodStart: window.periodStart,
    periodEnd: window.periodEnd,
    timezone: window.timezone,
    overview: { ...emptyTopic, astrology: { ...emptyTopic.astrology } },
    love: { ...emptyTopic, astrology: { ...emptyTopic.astrology } },
    work: { ...emptyTopic, astrology: { ...emptyTopic.astrology } },
    money: { ...emptyTopic, astrology: { ...emptyTopic.astrology } },
    mood_energy: { ...emptyTopic, astrology: { ...emptyTopic.astrology } },
    communication: { ...emptyTopic, astrology: { ...emptyTopic.astrology } },
    luck: { ...emptyTopic, astrology: { ...emptyTopic.astrology } },
    dynamic: [],
    evidence: {},
    visual: { heroAssetId: null, topicAssetIds: {} },
    meta: {
      model: '',
      promptVersion: PERSONAL_FORECAST_PROMPT_VERSION,
      voiceVersion: APP_VOICE_VERSION,
      calculationVersion: PERSONAL_FORECAST_CALCULATION_VERSION,
      generatedAt: new Date().toISOString(),
      status,
      diagnosticCode: language === 'en' ? diagnosticCode : diagnosticCode,
    },
  };
}

export function slicePersonalForecastForAccess(
  forecast: PersonalForecastPackage,
  isPremium: boolean,
): { forecast: PersonalForecastPackage; lockedTopicKeys: ForecastTopicKey[] } {
  if (isPremium) return { forecast, lockedTopicKeys: [] };
  const lockedTopicKeys: ForecastTopicKey[] = [
    ...FIXED_FORECAST_TOPIC_KEYS.filter(
      (key) => key !== 'overview' && key !== PERSONAL_FORECAST_FREE_READING_TOPIC,
    ),
    ...forecast.dynamic.map((topic) => topic.key),
  ];
  const locked = new Set<ForecastTopicKey>(lockedTopicKeys);
  const strip = (key: ForecastTopicKey, text: ForecastTopicText): ForecastTopicText =>
    locked.has(key)
      ? {
          card: text.card,
          reading: '',
          astrology: { explanation: '', evidence_ids: [] },
        }
      : text;
  const next = {
    ...forecast,
    overview: strip('overview', forecast.overview),
    love: strip('love', forecast.love),
    work: strip('work', forecast.work),
    money: strip('money', forecast.money),
    mood_energy: strip('mood_energy', forecast.mood_energy),
    communication: strip('communication', forecast.communication),
    luck: strip('luck', forecast.luck),
    dynamic: forecast.dynamic.map((topic) => ({
      ...topic,
      text: strip(topic.key, topic.text),
    })),
  };
  const visibleEvidenceIds = new Set<string>();
  for (const key of FIXED_FORECAST_TOPIC_KEYS) {
    next[key].astrology.evidence_ids.forEach((id) => visibleEvidenceIds.add(id));
  }
  next.dynamic.forEach((topic) => {
    topic.text.astrology.evidence_ids.forEach((id) => visibleEvidenceIds.add(id));
  });
  next.evidence = Object.fromEntries(
    Object.entries(forecast.evidence).filter(([id]) => visibleEvidenceIds.has(id)),
  );
  return { forecast: next, lockedTopicKeys };
}

export function personalForecastReadingLimit(period: PersonalForecastPeriod): number {
  return PERIOD_READING_LIMITS[period];
}

export function personalForecastAstrologyLimit(period: PersonalForecastPeriod): number {
  return PERIOD_ASTROLOGY_LIMITS[period];
}
