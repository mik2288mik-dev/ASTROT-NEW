import { fromZonedTime } from 'date-fns-tz';
import type { NatalChartData } from '../types';
import {
  APP_VOICE_VERSION,
  hasAppVoiceViolation,
  withAppVoiceVersion,
} from './appVoice';

export type PersonalForecastPeriod = 'day' | 'week' | 'month' | 'year';

export type FixedForecastSectionKey =
  | 'love'
  | 'mood'
  | 'home_family'
  | 'friends'
  | 'work_money'
  | 'wishes';

export type DynamicForecastTopicKey =
  | 'professional_path'
  | 'it_direction'
  | 'business'
  | 'income_growth'
  | 'work_change'
  | 'study'
  | 'creativity'
  | 'relocation'
  | 'property_decision'
  | 'self_confidence'
  | 'important_decision'
  | 'future_direction'
  | 'rest_recovery'
  | 'physical_activity'
  | 'documents_agreements';

export type ForecastTopicKey =
  | 'overview'
  | FixedForecastSectionKey
  | DynamicForecastTopicKey;

export type ForecastSectionKind =
  | 'overview'
  | 'fixed'
  | 'dynamic'
  | 'astro_accent'
  | 'wishes';

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

export type ForecastEvidenceView = {
  id: string;
  factor: string;
  orb: number | null;
  status: CalculatedAstroEvidence['status'];
  period: string | null;
  meaning: string;
};

export type ExplanationAnchor = {
  id: string;
  conclusion: string;
  explanation: string;
  evidenceIds: string[];
};

export type ForecastInlineAstroAccent = {
  text: string;
  evidenceIds: string[];
};

export type ForecastLockedPreview = {
  lead: string;
  blurred: string;
  teaser: string;
};

export type ForecastSection = {
  id: string;
  kind: ForecastSectionKind;
  status: 'ready' | 'unavailable';
  diagnosticCode: 'PERSONAL_FORECAST_SECTION_UNAVAILABLE' | null;
  fixedKey?: FixedForecastSectionKey;
  sourceTopicKey?: ForecastTopicKey;
  title?: string;
  text: string;
  importance: number;
  visualTag: string;
  premiumTeaser: string;
  lockedPreview: ForecastLockedPreview;
  explanationAnchors: ExplanationAnchor[];
  inlineAstroAccent?: ForecastInlineAstroAccent | null;
};

export type CrossPeriodLink = {
  id: string;
  fromSectionId: string;
  targetPeriod: PersonalForecastPeriod;
  targetSectionId: string;
  continuationAt: string;
  label: string;
};

export type PersonalForecastPackage = {
  period: PersonalForecastPeriod;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  dateLabel: string;
  timezone: string;
  overview: ForecastSection;
  sections: ForecastSection[];
  suggestedCrossPeriodLinks: CrossPeriodLink[];
  evidence: Record<string, ForecastEvidenceView>;
  visual: {
    sectionAssetIds: Record<string, string | null>;
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
    freeSelection: {
      strongestSectionId: string | null;
      rotatedSectionId: string | null;
      sectionIds: string[];
    };
  };
};

export type PersonalForecastAccessPayload = {
  forecast: PersonalForecastPackage;
  accessTier: 'free' | 'premium';
  lockedSectionIds: string[];
  periodLocked: boolean;
  source: 'cache' | 'generated';
};

export const FIXED_FORECAST_SECTION_KEYS = [
  'mood',
  'love',
  'home_family',
  'friends',
  'work_money',
  'wishes',
] as const satisfies readonly FixedForecastSectionKey[];

export const DYNAMIC_FORECAST_TOPIC_KEYS = [
  'professional_path',
  'it_direction',
  'business',
  'income_growth',
  'work_change',
  'study',
  'creativity',
  'relocation',
  'property_decision',
  'self_confidence',
  'important_decision',
  'future_direction',
  'rest_recovery',
  'physical_activity',
  'documents_agreements',
] as const satisfies readonly DynamicForecastTopicKey[];

export const PERSONAL_FORECAST_PROMPT_VERSION = withAppVoiceVersion(
  'personal-forecast-feed.v4.1.mood-first-feed',
);
export const PERSONAL_FORECAST_CALCULATION_VERSION = 'personal-forecast-evidence-v3';
export const PERSONAL_FORECAST_VISUAL_MANIFEST_VERSION = 'forecast-feed-visual-v3';

export const FORECAST_FIXED_TITLES: Record<
  'ru' | 'en',
  Record<Exclude<FixedForecastSectionKey, 'wishes'>, string>
> = {
  ru: {
    love: 'Любовь',
    mood: 'Настроение',
    home_family: 'Дом и семья',
    friends: 'Друзья',
    work_money: 'Дела, работа и деньги',
  },
  en: {
    love: 'Love',
    mood: 'Mood',
    home_family: 'Home and family',
    friends: 'Friends',
    work_money: 'Tasks, work and money',
  },
};

export const FORECAST_WISHES_TITLES: Record<
  'ru' | 'en',
  Record<PersonalForecastPeriod, string>
> = {
  ru: {
    day: 'Пожелания на день',
    week: 'Пожелания на неделю',
    month: 'Пожелания на месяц',
    year: 'Пожелания на год',
  },
  en: {
    day: 'Wishes for the day',
    week: 'Wishes for the week',
    month: 'Wishes for the month',
    year: 'Wishes for the year',
  },
};

export const DYNAMIC_FORECAST_FOCUS_LABELS: Record<
  'ru' | 'en',
  Record<DynamicForecastTopicKey, string>
> = {
  ru: {
    professional_path: 'профессия и подходящая рабочая среда',
    it_direction: 'развитие и поиск своего направления в IT',
    business: 'своё дело и бизнес',
    income_growth: 'доход и денежный рост',
    work_change: 'смена работы',
    study: 'учёба и новые навыки',
    creativity: 'творческий проект',
    relocation: 'переезд',
    property_decision: 'крупная покупка или имущество',
    self_confidence: 'уверенность в своих силах',
    important_decision: 'конкретное важное решение',
    future_direction: 'ближайшее направление развития',
    rest_recovery: 'восстановление сил',
    physical_activity: 'физическая нагрузка',
    documents_agreements: 'документы и договорённости',
  },
  en: {
    professional_path: 'profession and a suitable work environment',
    it_direction: 'growth and finding a direction in IT',
    business: 'a personal venture or business',
    income_growth: 'income and financial growth',
    work_change: 'changing jobs',
    study: 'study and new skills',
    creativity: 'a creative project',
    relocation: 'relocation',
    property_decision: 'a major purchase or property',
    self_confidence: 'confidence in personal strengths',
    important_decision: 'a concrete important decision',
    future_direction: 'the nearest direction of development',
    rest_recovery: 'recovery and rest',
    physical_activity: 'physical activity',
    documents_agreements: 'documents and agreements',
  },
};

const OVERVIEW_TEXT_MIN = 450;
const OVERVIEW_TEXT_MAX = 650;
const SECTION_TEXT_MIN = 250;
const SECTION_TEXT_MAX = 400;
const EXPLANATION_TEXT_MIN = 120;
const EXPLANATION_TEXT_MAX = 220;

const SECTION_TEXT_HARD_LIMITS: Record<PersonalForecastPeriod, number> = {
  day: 1_400,
  week: 1_800,
  month: 2_200,
  year: 2_800,
};

const BANNED_DYNAMIC_TITLES = new Set([
  'публичность',
  'важный выбор',
  'поездки и движение',
  'public visibility',
  'important choice',
  'travel and movement',
]);

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

export function isCurrentPersonalForecastPeriodKey(
  period: PersonalForecastPeriod,
  periodKey: string,
  timezone = 'Europe/Moscow',
  now = new Date(),
): boolean {
  return periodKey === getPersonalForecastPeriodKey(period, now, timezone);
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

export function formatPersonalForecastDateLabel(
  window: Pick<PersonalForecastWindow, 'period' | 'periodStart' | 'periodEnd'>,
  language: 'ru' | 'en',
): string {
  const locale = language === 'ru' ? 'ru-RU' : 'en-US';
  const start = new Date(`${window.periodStart}T12:00:00Z`);
  const end = new Date(`${window.periodEnd}T12:00:00Z`);
  if (window.period === 'day') {
    const weekday = new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      timeZone: 'UTC',
    }).format(start);
    const date = new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    }).format(start);
    return `${weekday.toLocaleUpperCase(locale)}\n${date.toLocaleUpperCase(locale)}`;
  }
  if (window.period === 'month') {
    return new Intl.DateTimeFormat(locale, {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(start).toLocaleUpperCase(locale);
  }
  if (window.period === 'year') return String(start.getUTCFullYear());
  const fmt = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
  return `${fmt.format(start)} — ${fmt.format(end)}`.toLocaleUpperCase(locale);
}

function normalizePosition(position: NatalChartData[keyof NatalChartData]) {
  if (!position || typeof position !== 'object' || !('sign' in position)) return null;
  const candidate = position as {
    sign?: string;
    longitude?: number;
    degree?: number;
    house?: string | number;
  };
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
  const chartQuality = chart.chartQuality;
  const value = JSON.stringify({
    planets: keys.map((key) => [key, normalizePosition(chart[key])]),
    houses: (chart.houses || []).map((house) => [
      house.house,
      Number(house.longitude).toFixed(5),
    ]),
    birthTimeQuality: chart.birthTimeQuality || null,
    chartQuality: chartQuality
      ? {
          birthTimeQuality: chartQuality.birthTimeQuality,
          ascendantReliable: chartQuality.ascendantReliable,
          housesReliable: chartQuality.housesReliable,
          houseBasedPersonalization: chartQuality.houseBasedPersonalization,
          notes: Array.isArray(chartQuality.notes) ? [...chartQuality.notes] : [],
        }
      : null,
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
    PERSONAL_FORECAST_CALCULATION_VERSION,
    PERSONAL_FORECAST_PROMPT_VERSION,
    APP_VOICE_VERSION,
    input.modelId,
  ].join('|');
  return `personal-forecast-feed-v3:${stableHash(identity).toString(36)}:${input.period}:${input.periodKey}`;
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

function normalizeComparable(value: string): string {
  return value
    .toLocaleLowerCase('ru-RU')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstSentence(value: string): string {
  return normalizeComparable(value.split(/[.!?…]/, 1)[0] || '')
    .split(' ')
    .slice(0, 10)
    .join(' ');
}

export function validateForecastSectionRepetition(
  sections: Array<Pick<ForecastSection, 'id' | 'title' | 'text'>>,
): string[] {
  const errors: string[] = [];
  const titles = new Map<string, string>();
  const openings = new Map<string, string>();
  for (const section of sections) {
    const title = normalizeComparable(section.title || '');
    if (title) {
      const existing = titles.get(title);
      if (existing) errors.push(`duplicate title: ${existing}/${section.id}`);
      titles.set(title, section.id);
    }
    const opening = firstSentence(section.text);
    if (opening.split(' ').length >= 4) {
      const existing = openings.get(opening);
      if (existing) errors.push(`duplicate opening: ${existing}/${section.id}`);
      openings.set(opening, section.id);
    }
  }
  return errors;
}

export function isSimpleDynamicTitle(value: string): boolean {
  const title = value.trim();
  const normalized = normalizeComparable(title);
  const words = normalized.split(' ').filter(Boolean);
  return (
    title.length >= 3
    && title.length <= 64
    && words.length >= 1
    && words.length <= 7
    && !BANNED_DYNAMIC_TITLES.has(normalized)
    && !/[.:;!?]/.test(title)
  );
}

export function buildForecastLockedPreview(
  text: string,
  teaser: string,
): ForecastLockedPreview {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const leadCount = Math.min(10, Math.max(5, Math.ceil(words.length * 0.12)));
  return {
    lead: words.slice(0, leadCount).join(' '),
    blurred: words.slice(leadCount, leadCount + 42).join(' '),
    teaser: teaser.trim(),
  };
}

function anchorValid(
  value: unknown,
  evidenceIds: Set<string>,
  _period: PersonalForecastPeriod,
): value is ExplanationAnchor {
  if (!value || typeof value !== 'object') return false;
  const anchor = value as ExplanationAnchor;
  return (
    typeof anchor.id === 'string'
    && !!anchor.id.trim()
    && typeof anchor.conclusion === 'string'
    && !!anchor.conclusion.trim()
    && anchor.conclusion.length <= 220
    && typeof anchor.explanation === 'string'
    && !!anchor.explanation.trim()
    && anchor.explanation.length >= EXPLANATION_TEXT_MIN
    && anchor.explanation.length <= EXPLANATION_TEXT_MAX
    && Array.isArray(anchor.evidenceIds)
    && anchor.evidenceIds.length >= 1
    && anchor.evidenceIds.length <= 4
    && new Set(anchor.evidenceIds).size === anchor.evidenceIds.length
    && anchor.evidenceIds.every((id) => evidenceIds.has(id))
  );
}

function previewValid(input: {
  preview: ForecastLockedPreview;
  text: string;
  premiumTeaser: string;
  redacted: boolean;
}): boolean {
  const leadWords = input.preview.lead.trim().split(/\s+/).filter(Boolean);
  const blurredWords = input.preview.blurred.trim().split(/\s+/).filter(Boolean);
  if (
    leadWords.length < 5
    || leadWords.length > 10
    || blurredWords.length < 1
    || blurredWords.length > 42
    || input.preview.teaser !== input.premiumTeaser
  ) {
    return false;
  }
  if (input.redacted) return true;
  const expected = buildForecastLockedPreview(input.text, input.premiumTeaser);
  return (
    input.preview.lead === expected.lead
    && input.preview.blurred === expected.blurred
    && input.preview.teaser === expected.teaser
  );
}

function sectionValid(
  value: unknown,
  period: PersonalForecastPeriod,
  evidenceIds: Set<string>,
  redacted = false,
): value is ForecastSection {
  if (!value || typeof value !== 'object') return false;
  const section = value as ForecastSection;
  if (
    typeof section.id !== 'string'
    || !section.id.trim()
    || !(['overview', 'fixed', 'dynamic', 'astro_accent', 'wishes'] as const).includes(section.kind)
    || !(['ready', 'unavailable'] as const).includes(section.status)
    || (
      section.status === 'ready'
        ? section.diagnosticCode !== null
        : section.diagnosticCode !== 'PERSONAL_FORECAST_SECTION_UNAVAILABLE'
    )
    || typeof section.text !== 'string'
    || (redacted ? !!section.text.trim() : !section.text.trim())
    || section.text.length > SECTION_TEXT_HARD_LIMITS[period]
    || !Number.isFinite(section.importance)
    || section.importance < 0
    || section.importance > 100
    || typeof section.visualTag !== 'string'
    || !section.visualTag.trim()
    || typeof section.premiumTeaser !== 'string'
    || !section.premiumTeaser.trim()
    || section.premiumTeaser.length < 40
    || section.premiumTeaser.length > 300
    || !section.lockedPreview
    || typeof section.lockedPreview.lead !== 'string'
    || typeof section.lockedPreview.blurred !== 'string'
    || typeof section.lockedPreview.teaser !== 'string'
    || !previewValid({
      preview: section.lockedPreview,
      text: section.text,
      premiumTeaser: section.premiumTeaser,
      redacted,
    })
    || !Array.isArray(section.explanationAnchors)
    || section.explanationAnchors.length > 2
    || new Set(section.explanationAnchors.map((anchor) => anchor?.id)).size
      !== section.explanationAnchors.length
    || (redacted
      ? section.explanationAnchors.length > 0
      : section.explanationAnchors.some((anchor) => !anchorValid(anchor, evidenceIds, period)))
  ) {
    return false;
  }
  if (
    section.status === 'unavailable'
    && (
      section.explanationAnchors.length > 0
      || section.inlineAstroAccent
    )
  ) {
    return false;
  }
  if (redacted && section.inlineAstroAccent) return false;
  if (section.kind === 'dynamic' && (!section.title || !isSimpleDynamicTitle(section.title))) {
    return false;
  }
  if (section.inlineAstroAccent) {
    if (
      typeof section.inlineAstroAccent.text !== 'string'
      || !section.inlineAstroAccent.text.trim()
      || section.inlineAstroAccent.text.length > 360
      || !Array.isArray(section.inlineAstroAccent.evidenceIds)
      || section.inlineAstroAccent.evidenceIds.length < 1
      || section.inlineAstroAccent.evidenceIds.length > 4
      || new Set(section.inlineAstroAccent.evidenceIds).size
        !== section.inlineAstroAccent.evidenceIds.length
      || section.inlineAstroAccent.evidenceIds.some((id) => !evidenceIds.has(id))
    ) {
      return false;
    }
  }
  const voiceText = [
    section.title || '',
    section.text,
    section.premiumTeaser,
    section.lockedPreview.lead,
    section.lockedPreview.blurred,
    ...section.explanationAnchors.flatMap((anchor) => [
      anchor.conclusion,
      anchor.explanation,
    ]),
    section.inlineAstroAccent?.text || '',
  ].join('\n');
  return !hasAppVoiceViolation(voiceText);
}

function validIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

function evidenceRecordValid(value: unknown): value is Record<string, ForecastEvidenceView> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const statuses = new Set<CalculatedAstroEvidence['status']>([
    'applying',
    'separating',
    'exact',
    'active',
    'unknown',
  ]);
  return Object.entries(value).every(([id, raw]) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
    const evidence = raw as ForecastEvidenceView;
    return (
      !!id.trim()
      && evidence.id === id
      && typeof evidence.factor === 'string'
      && !!evidence.factor.trim()
      && evidence.factor.length <= 180
      && (evidence.orb === null
        || (Number.isFinite(evidence.orb) && Number(evidence.orb) >= 0))
      && statuses.has(evidence.status)
      && (evidence.period === null
        || (
          typeof evidence.period === 'string'
          && !!evidence.period.trim()
          && evidence.period.length <= 80
        ))
      && typeof evidence.meaning === 'string'
      && !!evidence.meaning.trim()
      && evidence.meaning.length <= 420
      && !hasAppVoiceViolation(`${evidence.factor}\n${evidence.meaning}`)
    );
  });
}

function canonicalSectionIdentityValid(
  section: ForecastSection,
  period: PersonalForecastPeriod,
): boolean {
  if (section.kind === 'fixed' || section.kind === 'wishes') {
    if (!section.fixedKey) return false;
    const expectedTitles = section.fixedKey === 'wishes'
      ? [
          FORECAST_WISHES_TITLES.ru[period],
          FORECAST_WISHES_TITLES.en[period],
        ]
      : [
          FORECAST_FIXED_TITLES.ru[section.fixedKey],
          FORECAST_FIXED_TITLES.en[section.fixedKey],
        ];
    return (
      section.id === section.fixedKey
      && section.sourceTopicKey === section.fixedKey
      && section.kind === (section.fixedKey === 'wishes' ? 'wishes' : 'fixed')
      && typeof section.title === 'string'
      && expectedTitles.includes(section.title)
    );
  }
  if (section.kind === 'dynamic') {
    return (
      !!section.sourceTopicKey
      && DYNAMIC_FORECAST_TOPIC_KEYS.includes(
        section.sourceTopicKey as DynamicForecastTopicKey,
      )
      && section.id === `dynamic:${section.sourceTopicKey}`
      && section.fixedKey === undefined
    );
  }
  if (section.kind === 'astro_accent') {
    return (
      section.id.startsWith('astro:')
      && !!section.sourceTopicKey
      && VALID_FORECAST_SECTION_TOPIC_KEYS.has(section.sourceTopicKey)
      && typeof section.title === 'string'
      && !!section.title.trim()
      && section.title.length <= 96
      && section.fixedKey === undefined
    );
  }
  return false;
}

const VALID_FORECAST_SECTION_TOPIC_KEYS = new Set<ForecastTopicKey>([
  'overview',
  ...FIXED_FORECAST_SECTION_KEYS,
  ...DYNAMIC_FORECAST_TOPIC_KEYS,
]);

function crossPeriodLinksValid(
  value: unknown,
  window: PersonalForecastWindow,
  sections: ForecastSection[],
): value is CrossPeriodLink[] {
  if (!Array.isArray(value) || value.length > 2) return false;
  const expectedTarget = nextPersonalForecastPeriod(window.period);
  const stableSections = new Set(
    sections
      .filter((section) => section.kind === 'fixed' && section.fixedKey !== 'wishes')
      .map((section) => section.id),
  );
  const ids = new Set<string>();
  return value.every((raw, index) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
    const link = raw as CrossPeriodLink;
    if (
      typeof link.id !== 'string'
      || !link.id.trim()
      || ids.has(link.id)
      || link.id !== `${window.period}:${link.fromSectionId}:${expectedTarget}:${index}`
      || link.targetPeriod !== expectedTarget
      || typeof link.fromSectionId !== 'string'
      || !stableSections.has(link.fromSectionId)
      || link.targetSectionId !== link.fromSectionId
      || typeof link.label !== 'string'
      || !link.label.trim()
      || ![
        `Продолжение темы — в периоде «${expectedTarget === 'week' ? 'Неделя' : expectedTarget === 'month' ? 'Месяц' : 'Год'}»`,
        `Continue this topic in ${expectedTarget === 'week' ? 'Week' : expectedTarget === 'month' ? 'Month' : 'Year'}`,
      ].includes(link.label)
      || !validIsoTimestamp(link.continuationAt)
      || new Date(link.continuationAt).getTime() <= window.endsAt.getTime()
    ) {
      return false;
    }
    ids.add(link.id);
    return true;
  });
}

function visualValid(
  value: unknown,
  sectionIds: Set<string>,
): value is PersonalForecastPackage['visual'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const assetIds = (value as PersonalForecastPackage['visual']).sectionAssetIds;
  if (!assetIds || typeof assetIds !== 'object' || Array.isArray(assetIds)) return false;
  return Object.entries(assetIds).every(([sectionId, assetId]) => (
    sectionIds.has(sectionId)
    && (assetId === null || (typeof assetId === 'string' && !!assetId.trim()))
  ));
}

export function isPersonalForecastPackage(
  value: unknown,
  options: { redactedSectionIds?: readonly string[] } = {},
): value is PersonalForecastPackage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const forecast = value as PersonalForecastPackage;
  if (
    !(['day', 'week', 'month', 'year'] as const).includes(forecast.period)
    || typeof forecast.periodKey !== 'string'
    || typeof forecast.periodStart !== 'string'
    || typeof forecast.periodEnd !== 'string'
    || typeof forecast.dateLabel !== 'string'
    || !forecast.dateLabel.trim()
    || typeof forecast.timezone !== 'string'
    || !forecast.timezone.trim()
    || forecast.timezone !== normalizeForecastTimezone(forecast.timezone)
    || !forecast.meta
    || typeof forecast.meta !== 'object'
    || typeof forecast.meta.model !== 'string'
    || !forecast.meta.model.trim()
    || forecast.meta?.promptVersion !== PERSONAL_FORECAST_PROMPT_VERSION
    || forecast.meta?.voiceVersion !== APP_VOICE_VERSION
    || forecast.meta?.calculationVersion !== PERSONAL_FORECAST_CALCULATION_VERSION
    || forecast.meta?.status !== 'ready'
    || !validIsoTimestamp(forecast.meta.generatedAt)
    || (
      forecast.meta.diagnosticCode !== undefined
      && forecast.meta.diagnosticCode !== null
      && typeof forecast.meta.diagnosticCode !== 'string'
    )
    || (
      forecast.meta.visualFallback !== undefined
      && typeof forecast.meta.visualFallback !== 'boolean'
    )
    || !evidenceRecordValid(forecast.evidence)
    || !Array.isArray(forecast.sections)
    || !Array.isArray(forecast.suggestedCrossPeriodLinks)
  ) {
    return false;
  }

  let expectedWindow: PersonalForecastWindow;
  try {
    expectedWindow = resolvePersonalForecastWindow(
      forecast.period,
      forecast.periodKey,
      forecast.timezone,
    );
  } catch {
    return false;
  }
  if (
    forecast.periodStart !== expectedWindow.periodStart
    || forecast.periodEnd !== expectedWindow.periodEnd
  ) {
    return false;
  }

  const redactedSectionIds = new Set(options.redactedSectionIds || []);
  const evidenceIds = new Set(Object.keys(forecast.evidence));
  if (!sectionValid(
    forecast.overview,
    forecast.period,
    evidenceIds,
    redactedSectionIds.has('overview'),
  )) return false;
  if (
    forecast.overview.kind !== 'overview'
    || forecast.overview.id !== 'overview'
    || forecast.overview.sourceTopicKey !== 'overview'
    || forecast.overview.fixedKey !== undefined
    || forecast.overview.title !== undefined
  ) {
    return false;
  }
  if (forecast.sections.some((section) => !sectionValid(
    section,
    forecast.period,
    evidenceIds,
    redactedSectionIds.has(
      section && typeof section === 'object' ? String(section.id || '') : '',
    ),
  ))) {
    return false;
  }
  const ids = new Set<string>(['overview']);
  for (const section of forecast.sections) {
    if (ids.has(section.id)) return false;
    ids.add(section.id);
  }
  if (
    [...redactedSectionIds].some((id) => !ids.has(id))
    || forecast.sections.some(
      (section) => !canonicalSectionIdentityValid(section, forecast.period),
    )
    || !visualValid(forecast.visual, ids)
    || !crossPeriodLinksValid(
      forecast.suggestedCrossPeriodLinks,
      expectedWindow,
      forecast.sections,
    )
  ) {
    return false;
  }
  const fixedOrder = forecast.sections
    .filter((section) => section.kind === 'fixed' || section.kind === 'wishes')
    .map((section) => section.fixedKey);
  if (
    fixedOrder.length !== FIXED_FORECAST_SECTION_KEYS.length
    || fixedOrder.some((key, index) => key !== FIXED_FORECAST_SECTION_KEYS[index])
  ) {
    return false;
  }
  const dynamic = forecast.sections.filter((section) => section.kind === 'dynamic');
  const dynamicTopics = dynamic.map((section) => section.sourceTopicKey);
  const astroAccents = forecast.sections.filter(
    (section) => section.kind === 'astro_accent',
  );
  if (
    dynamic.length < 2
    || dynamic.length > 4
    || new Set(dynamicTopics).size !== dynamicTopics.length
    || astroAccents.length > 2
  ) {
    return false;
  }
  if (validateForecastSectionRepetition([forecast.overview, ...forecast.sections]).length) {
    return false;
  }
  const freeSelection = forecast.meta.freeSelection;
  if (!freeSelection || !Array.isArray(freeSelection.sectionIds)) return false;

  if (forecast.period === 'day') {
    const candidates = freeCandidates(forecast.sections);
    const eligibleIds = new Set(candidates.map((section) => section.id));
    const strongestSectionId = freeSelection.strongestSectionId;
    const rotatedSectionId = freeSelection.rotatedSectionId;
    if (
      typeof strongestSectionId !== 'string'
      || typeof rotatedSectionId !== 'string'
      || strongestSectionId === rotatedSectionId
      || freeSelection.sectionIds.length !== 2
      || freeSelection.sectionIds[0] !== strongestSectionId
      || freeSelection.sectionIds[1] !== rotatedSectionId
      || new Set(freeSelection.sectionIds).size !== 2
      || !eligibleIds.has(strongestSectionId)
      || !eligibleIds.has(rotatedSectionId)
      || candidates[0]?.id !== strongestSectionId
    ) {
      return false;
    }
  } else if (
    freeSelection.strongestSectionId !== null
    || freeSelection.rotatedSectionId !== null
    || freeSelection.sectionIds.length !== 0
  ) {
    return false;
  }
  return true;
}

function freeCandidates(sections: ForecastSection[]): ForecastSection[] {
  return sections
    .filter((section) => section.status === 'ready')
    .filter((section) => section.kind === 'fixed' || section.kind === 'dynamic')
    .filter((section) => section.fixedKey !== 'wishes')
    .sort((a, b) => b.importance - a.importance || a.id.localeCompare(b.id));
}

export function selectTodayFreeSections(input: {
  sections: ForecastSection[];
  userId: string;
  periodKey: string;
  previousSectionIds?: string[];
}): {
  strongestSectionId: string | null;
  rotatedSectionId: string | null;
  sectionIds: string[];
} {
  const candidates = freeCandidates(input.sections);
  const strongest = candidates[0]?.id || null;
  const previous = new Set(input.previousSectionIds || []);
  const fresh = candidates
    .slice(1, 6)
    .filter((section) => !previous.has(section.id));
  const pool = fresh.length ? fresh : candidates.slice(1, 6);
  const rotated = pool.length
    ? pool[stableHash(`${input.userId}|${input.periodKey}|free-rotation-v3`) % pool.length].id
    : null;
  return {
    strongestSectionId: strongest,
    rotatedSectionId: rotated,
    sectionIds: [strongest, rotated].filter((id): id is string => !!id),
  };
}

function emptySection(
  id: string,
  kind: ForecastSectionKind,
  fixedKey?: FixedForecastSectionKey,
): ForecastSection {
  return {
    id,
    kind,
    status: 'unavailable',
    diagnosticCode: 'PERSONAL_FORECAST_SECTION_UNAVAILABLE',
    fixedKey,
    sourceTopicKey: fixedKey || 'overview',
    text: '',
    importance: 0,
    visualTag: fixedKey || 'overview',
    premiumTeaser: '',
    lockedPreview: { lead: '', blurred: '', teaser: '' },
    explanationAnchors: [],
    inlineAstroAccent: null,
  };
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
  return {
    period,
    periodKey,
    periodStart: window.periodStart,
    periodEnd: window.periodEnd,
    dateLabel: formatPersonalForecastDateLabel(window, language),
    timezone: window.timezone,
    overview: emptySection('overview', 'overview'),
    sections: FIXED_FORECAST_SECTION_KEYS.map((key) => ({
      ...emptySection(key, key === 'wishes' ? 'wishes' : 'fixed', key),
      title: key === 'wishes'
        ? FORECAST_WISHES_TITLES[language][period]
        : FORECAST_FIXED_TITLES[language][key],
    })),
    suggestedCrossPeriodLinks: [],
    evidence: {},
    visual: { sectionAssetIds: {} },
    meta: {
      model: '',
      promptVersion: PERSONAL_FORECAST_PROMPT_VERSION,
      voiceVersion: APP_VOICE_VERSION,
      calculationVersion: PERSONAL_FORECAST_CALCULATION_VERSION,
      generatedAt: new Date().toISOString(),
      status,
      diagnosticCode,
      freeSelection: {
        strongestSectionId: null,
        rotatedSectionId: null,
        sectionIds: [],
      },
    },
  };
}

function stripLockedSection(
  section: ForecastSection,
  preserveTodayPreview = true,
): ForecastSection {
  return {
    ...section,
    title: preserveTodayPreview ? section.title : undefined,
    text: '',
    premiumTeaser: preserveTodayPreview ? section.premiumTeaser : '',
    lockedPreview: preserveTodayPreview
      ? section.lockedPreview
      : { lead: '', blurred: '', teaser: '' },
    explanationAnchors: [],
    inlineAstroAccent: null,
  };
}

function nextPersonalForecastPeriod(
  period: PersonalForecastPeriod,
): PersonalForecastPeriod | null {
  if (period === 'day') return 'week';
  if (period === 'week') return 'month';
  if (period === 'month') return 'year';
  return null;
}

export function filterPersonalForecastCrossPeriodLinksForCurrentTargets(
  forecast: PersonalForecastPackage,
  now = new Date(),
): PersonalForecastPackage {
  if (!forecast.suggestedCrossPeriodLinks.length) return forecast;
  const expectedTarget = nextPersonalForecastPeriod(forecast.period);
  if (!expectedTarget) {
    return { ...forecast, suggestedCrossPeriodLinks: [] };
  }
  const currentTargetKey = getPersonalForecastPeriodKey(
    expectedTarget,
    now,
    forecast.timezone,
  );
  const targetWindow = resolvePersonalForecastWindow(
    expectedTarget,
    currentTargetKey,
    forecast.timezone,
  );
  const filtered = forecast.suggestedCrossPeriodLinks.filter((link) => {
    if (link.targetPeriod !== expectedTarget) return false;
    const continuationTime = new Date(link.continuationAt).getTime();
    return (
      Number.isFinite(continuationTime)
      && continuationTime >= targetWindow.startsAt.getTime()
      && continuationTime <= targetWindow.endsAt.getTime()
    );
  });
  return filtered.length === forecast.suggestedCrossPeriodLinks.length
    ? forecast
    : { ...forecast, suggestedCrossPeriodLinks: filtered };
}

export function slicePersonalForecastForAccess(
  forecast: PersonalForecastPackage,
  isPremium: boolean,
): {
  forecast: PersonalForecastPackage;
  lockedSectionIds: string[];
  periodLocked: boolean;
} {
  const navigableForecast =
    filterPersonalForecastCrossPeriodLinksForCurrentTargets(forecast);
  if (isPremium) {
    return {
      forecast: navigableForecast,
      lockedSectionIds: [],
      periodLocked: false,
    };
  }
  const allSections = [navigableForecast.overview, ...navigableForecast.sections];
  const periodLocked = navigableForecast.period !== 'day';
  const openIds = periodLocked
    ? new Set<string>()
    : new Set<string>([
        'overview',
        'wishes',
        ...navigableForecast.meta.freeSelection.sectionIds,
      ]);
  const lockedSectionIds = allSections
    .filter((section) => !openIds.has(section.id))
    .map((section) => section.id);
  const locked = new Set(lockedSectionIds);
  const next: PersonalForecastPackage = {
    ...navigableForecast,
    overview: locked.has('overview')
      ? stripLockedSection(navigableForecast.overview)
      : navigableForecast.overview,
    sections: navigableForecast.sections.map((section) => (
      locked.has(section.id)
        ? stripLockedSection(section)
        : section
    )),
  };
  if (periodLocked) next.suggestedCrossPeriodLinks = [];
  const visibleEvidenceIds = new Set<string>();
  for (const section of [next.overview, ...next.sections]) {
    section.explanationAnchors.forEach((anchor) => {
      anchor.evidenceIds.forEach((id) => visibleEvidenceIds.add(id));
    });
    section.inlineAstroAccent?.evidenceIds.forEach((id) => visibleEvidenceIds.add(id));
  }
  next.evidence = Object.fromEntries(
    Object.entries(navigableForecast.evidence)
      .filter(([id]) => visibleEvidenceIds.has(id)),
  );
  return { forecast: next, lockedSectionIds, periodLocked };
}

export function personalForecastSectionTextLimit(period: PersonalForecastPeriod): number {
  return SECTION_TEXT_HARD_LIMITS[period];
}

export function personalForecastExplanationLimit(period: PersonalForecastPeriod): number {
  void period;
  return EXPLANATION_TEXT_MAX;
}

export function personalForecastOverviewTextRange(): Readonly<{
  min: number;
  max: number;
}> {
  return { min: OVERVIEW_TEXT_MIN, max: OVERVIEW_TEXT_MAX };
}

export function personalForecastSectionTextRange(): Readonly<{
  min: number;
  max: number;
}> {
  return { min: SECTION_TEXT_MIN, max: SECTION_TEXT_MAX };
}

export function personalForecastExplanationTextRange(): Readonly<{
  min: number;
  max: number;
}> {
  return { min: EXPLANATION_TEXT_MIN, max: EXPLANATION_TEXT_MAX };
}
