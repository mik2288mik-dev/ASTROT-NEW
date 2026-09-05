import { fromZonedTime } from 'date-fns-tz';
import {
  PERSONAL_FORECAST_VOICE_VERSION,
  withPersonalForecastVoiceVersion,
} from './appVoice';

export type PersonalForecastPeriod = 'day' | 'week' | 'month';
export type PersonalForecastGenerationTier = 'free' | 'premium';

export function isPersonalForecastPeriodAllowedForTier(
  tier: PersonalForecastGenerationTier,
  period: PersonalForecastPeriod,
): boolean {
  return tier === 'premium' || period === 'day';
}

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

export type ForecastEvidenceView = {
  id: string;
  factor: string;
  orb: number | null;
  status: 'applying' | 'separating' | 'exact' | 'active' | 'unknown';
  period: string | null;
  meaning: string;
};

export type ExplanationAnchor = {
  id: string;
  conclusion: string;
  explanation: string;
  evidenceIds: string[];
};


export type ForecastLockedPreview = {
  lead: string;
  blurred: string;
  teaser: string;
};

export type ForecastContentBlockRole = 'insight' | 'lead' | 'detail' | 'risk' | 'action';

/**
 * A deliberately small set of visual motifs. The writer selects one only
 * when the same calculated evidence supports the forecast's main scene.
 */
export const FORECAST_VISUAL_CUES = [
  'communication',
  'decisions',
  'work_money',
  'home_family',
  'friends',
  'love',
  'mood',
  'opportunities',
] as const;

export type ForecastVisualCue = (typeof FORECAST_VISUAL_CUES)[number];

export const FORECAST_PRESENTATION_STYLES = [
  'prose',
  'pull_quote',
  'paper_note',
] as const;

export type ForecastPresentationStyle = (typeof FORECAST_PRESENTATION_STYLES)[number];

export const TODAY_FORECAST_PRESENTATION_WORD_LIMITS: Record<
  ForecastPresentationStyle,
  { minimum: number; maximum: number }
> = {
  prose: { minimum: 1, maximum: 42 },
  pull_quote: { minimum: 6, maximum: 18 },
  paper_note: { minimum: 4, maximum: 12 },
};

/**
 * A writer may phrase an approved semantic atom, but it may not invent a new
 * claim. Keeping the atom and fact identifiers beside the rendered sentence
 * makes that boundary independently verifiable.
 */
export type ForecastContentBlock = {
  id: string;
  role: ForecastContentBlockRole;
  text: string;
  semanticFactId: string;
  atomId: string;
  /** Calculated evidence cited by this exact piece of copy. */
  evidenceIds?: string[];
  explanationAnchorId?: string | null;
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
  contentBlocks: ForecastContentBlock[];
  semanticFactIds: string[];
  semanticFingerprint: string;
  importance: number;
  visualTag: string;
  visualCue?: ForecastVisualCue | null;
  /** Hidden rendering hint. Missing means prose for packages created before this field existed. */
  presentationStyle?: ForecastPresentationStyle;
  premiumTeaser: string;
  lockedPreview: ForecastLockedPreview;
  explanationAnchors: ExplanationAnchor[];
};

export type CrossPeriodLink = {
  id: string;
  fromSectionId: string;
  targetPeriod: PersonalForecastPeriod;
  targetSectionId: string;
  continuationAt: string;
  label: string;
};

export type PersonalForecastAstrologerBrief = {
  tone: 'favorable' | 'mixed' | 'demanding';
  situation: string;
  turn: string;
  outcome: string;
  observableDetail: string;
  briefSignature: string;
};

export type PersonalForecastSemanticSignature = {
  situation: string;
  turn: string;
  outcome: string;
  title: string;
  forecast: string;
  closing: string;
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
    semanticVersion: string;
    contractVersion: string;
    generationAttempts: 0 | 1 | 2 | 3 | 4 | 5 | 6;
    validationStatus: 'valid' | 'deterministic_fallback';
    generatedAt: string;
    status: 'ready' | 'generating' | 'unavailable';
    diagnosticCode?: string | null;
    visualFallback?: boolean;
    astrologerBrief: PersonalForecastAstrologerBrief;
    semanticSignature: PersonalForecastSemanticSignature;
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
  source: 'cache' | 'stale' | 'generated';
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

export const PERSONAL_FORECAST_PROMPT_VERSION = withPersonalForecastVoiceVersion(
  'personal-forecast-feed.v46-three-part-human',
);
export const PERSONAL_FORECAST_CACHE_VERSION = 'personal-forecast-cache-v18-three-part-human';
/** Input/cache identity, not an astrological calculation version. */
export const PERSONAL_FORECAST_CALCULATION_VERSION = 'personal-forecast-luna-raw-profile-brief-v11';
export const PERSONAL_FORECAST_CONTRACT_VERSION = 'personal-forecast-feed-v28-three-part-human';
export const PERSONAL_FORECAST_VISUAL_MANIFEST_VERSION = 'forecast-feed-visual-v8-diary-universe';

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
  },
  en: {
    day: 'Wishes for the day',
    week: 'Wishes for the week',
    month: 'Wishes for the month',
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
  return null;
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
  const fmt = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
  return `${fmt.format(start)} — ${fmt.format(end)}`.toLocaleUpperCase(locale);
}

export function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function normalizedBirthProfileField(value: string | null | undefined): string | null {
  const normalized = String(value || '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/gu, ' ');
  return normalized || null;
}

export type PersonalForecastRawProfile = {
  id?: string; name: string; birthDate: string; birthTime: string; birthPlace: string;
  birthTimezone?: string | null; gender?: 'male' | 'female' | 'unspecified' | null;
  language?: 'ru' | 'en';
  birthTimeMode?: 'exact' | 'approximate' | 'unknown' | 'range' | null;
  birthTimeUncertaintyMinutes?: number | null;
};

export function getPersonalForecastRawProfile(
  profile: PersonalForecastRawProfile,
) {
  const rawTime = normalizedBirthProfileField(profile.birthTime);
  const rawMode = profile.birthTimeMode;
  const birthTimeMode = rawMode === 'exact' || rawMode === 'approximate' || rawMode === 'unknown'
    ? rawMode
    : rawTime ? 'exact' : 'unknown';
  return {
    name: normalizedBirthProfileField(profile.name),
    birth_date: normalizedBirthProfileField(profile.birthDate),
    birth_time: birthTimeMode === 'unknown' ? null : rawTime,
    birth_time_mode: birthTimeMode,
    birth_time_uncertainty_minutes: birthTimeMode === 'approximate'
      && Number.isFinite(profile.birthTimeUncertaintyMinutes)
      ? Math.max(0, Math.round(Number(profile.birthTimeUncertaintyMinutes)))
      : null,
    birth_place: normalizedBirthProfileField(profile.birthPlace),
    birth_timezone: normalizedBirthProfileField(profile.birthTimezone),
    gender: profile.gender === 'male' || profile.gender === 'female' ? profile.gender : 'unspecified',
    language: profile.language === 'en' ? 'en' : 'ru',
  } as const;
}

export function buildPersonalForecastBirthProfileFingerprint(
  profile: PersonalForecastRawProfile,
): string {
  const raw = getPersonalForecastRawProfile(profile);
  return stableHash(JSON.stringify({
    ...raw,
  })).toString(36);
}

export function buildPersonalForecastCacheKey(input: {
  userId: string;
  birthProfileFingerprint: string;
  generationTier: PersonalForecastGenerationTier;
  period: PersonalForecastPeriod;
  periodKey: string;
  timezone: string;
  language: 'ru' | 'en';
  modelId: string;
}): string {
  const identity = [
    String(input.userId),
    input.generationTier,
    input.period,
    input.periodKey,
    normalizeForecastTimezone(input.timezone),
    input.language,
    input.birthProfileFingerprint,
    PERSONAL_FORECAST_CALCULATION_VERSION,
    PERSONAL_FORECAST_CONTRACT_VERSION,
    PERSONAL_FORECAST_PROMPT_VERSION,
    PERSONAL_FORECAST_VOICE_VERSION,
    PERSONAL_FORECAST_CACHE_VERSION,
    input.modelId,
  ].join('|');
  return `${PERSONAL_FORECAST_CONTRACT_VERSION}:${stableHash(identity).toString(36)}:${input.period}:${input.periodKey}`;
}

export function buildPersonalForecastInputHash(input: {
  userId: string;
  birthProfileFingerprint: string;
  generationTier: PersonalForecastGenerationTier;
  period: PersonalForecastPeriod;
  periodKey: string;
  timezone: string;
  language: 'ru' | 'en';
  modelId: string;
}, versions: {
  calculationVersion?: string;
  contractVersion?: string;
  promptVersion?: string;
  voiceVersion?: string;
} = {}): string {
  const calculationVersion = versions.calculationVersion
    ?? PERSONAL_FORECAST_CALCULATION_VERSION;
  const contractVersion = versions.contractVersion
    ?? PERSONAL_FORECAST_CONTRACT_VERSION;
  const promptVersion = versions.promptVersion
    ?? PERSONAL_FORECAST_PROMPT_VERSION;
  const voiceVersion = versions.voiceVersion ?? PERSONAL_FORECAST_VOICE_VERSION;
  return stableHash(JSON.stringify({
    userId: input.userId,
    generationTier: input.generationTier,
    birthProfileFingerprint: input.birthProfileFingerprint,
    period: input.period,
    periodKey: input.periodKey,
    timezone: normalizeForecastTimezone(input.timezone),
    language: input.language,
    modelId: input.modelId,
    calculationVersion,
    semanticVersion: contractVersion,
    contractVersion,
    promptVersion,
    voiceVersion,
    cacheVersion: PERSONAL_FORECAST_CACHE_VERSION,
  })).toString(36);
}

export function isSimpleDynamicTitle(value: string): boolean {
  return value.trim().length > 0;
}

export function buildForecastLockedPreview(
  text: string,
  teaser: string,
): ForecastLockedPreview {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const leadCount = words.length <= 5
    ? Math.max(1, Math.ceil(words.length / 2))
    : Math.min(10, Math.max(5, Math.ceil(words.length * 0.12)));
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
    && typeof anchor.explanation === 'string'
    && !!anchor.explanation.trim()
    && Array.isArray(anchor.evidenceIds)
    && anchor.evidenceIds.length >= 1
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
    leadWords.length < 1
    || leadWords.length > 10
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

function contentBlocksValid(
  section: ForecastSection,
  redacted: boolean,
): boolean {
  if (
    !Array.isArray(section.contentBlocks)
    || !Array.isArray(section.semanticFactIds)
    || typeof section.semanticFingerprint !== 'string'
  ) {
    return false;
  }
  if (redacted || section.status === 'unavailable') {
    return (
      section.contentBlocks.length === 0
      && section.semanticFactIds.length === 0
      && section.semanticFingerprint === ''
    );
  }
  if (
    section.contentBlocks.length < 1
    || section.semanticFactIds.length < 1
    || new Set(section.semanticFactIds).size !== section.semanticFactIds.length
    || !section.semanticFingerprint.trim()
  ) {
    return false;
  }
  const blockIds = new Set<string>();
  const anchorIds = new Set(section.explanationAnchors.map((anchor) => anchor.id));
  for (const block of section.contentBlocks) {
    if (
      !block
      || typeof block !== 'object'
      || typeof block.id !== 'string'
      || !block.id.trim()
      || blockIds.has(block.id)
      // A block may use a free semantic label. Generation is no longer limited
      // to the legacy lead/detail/risk/action rubric.
      || typeof block.role !== 'string'
      || !block.role.trim()
      || typeof block.text !== 'string'
      || !block.text.trim()
      || (block.semanticFactId !== undefined && (
        typeof block.semanticFactId !== 'string'
        || (section.semanticFactIds.length > 0 && !section.semanticFactIds.includes(block.semanticFactId))
      ))
      || (block.atomId !== undefined && (typeof block.atomId !== 'string' || !block.atomId.trim()))
      || (block.evidenceIds !== undefined && (
        !Array.isArray(block.evidenceIds)
        || block.evidenceIds.length < 1
        || new Set(block.evidenceIds).size !== block.evidenceIds.length
        || block.evidenceIds.some((id) => typeof id !== 'string' || !section.semanticFactIds.includes(id))
      ))
      || (
        block.explanationAnchorId !== undefined
        && block.explanationAnchorId !== null
        && !anchorIds.has(block.explanationAnchorId)
      )
    ) {
      return false;
    }
    blockIds.add(block.id);
  }
  return section.text === section.contentBlocks.map((block) => block.text.trim()).join('\n\n');
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
    || !(['overview', 'dynamic'] as const).includes(
      section.kind as 'overview' | 'dynamic',
    )
    || !(['ready', 'unavailable'] as const).includes(section.status)
    || (
      section.status === 'ready'
        ? section.diagnosticCode !== null
        : section.diagnosticCode !== 'PERSONAL_FORECAST_SECTION_UNAVAILABLE'
    )
    || typeof section.text !== 'string'
    || (redacted ? !!section.text.trim() : !section.text.trim())
    || !Number.isFinite(section.importance)
    || section.importance < 0
    || section.importance > 100
    || typeof section.visualTag !== 'string'
    || !section.visualTag.trim()
    || (
      section.visualCue !== undefined
      && section.visualCue !== null
      && !FORECAST_VISUAL_CUES.includes(section.visualCue)
    )
    || (
      section.presentationStyle !== undefined
      && !FORECAST_PRESENTATION_STYLES.includes(section.presentationStyle)
    )
    || typeof section.premiumTeaser !== 'string'
    || !section.premiumTeaser.trim()
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
    || new Set(section.explanationAnchors.map((anchor) => anchor?.id)).size
      !== section.explanationAnchors.length
    || (redacted
      ? section.explanationAnchors.length > 0
      : section.explanationAnchors.some((anchor) => !anchorValid(anchor, evidenceIds, period)))
    || !contentBlocksValid(section, redacted)
  ) {
    return false;
  }
  if (
    section.status === 'unavailable'
    && (
      section.explanationAnchors.length > 0
      || section.visualCue
    )
  ) {
    return false;
  }
  if (
    section.kind === 'dynamic'
    && section.title !== undefined
    && !isSimpleDynamicTitle(section.title)
  ) {
    return false;
  }
  return true;
}

function validIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

function evidenceRecordValid(value: unknown): value is Record<string, ForecastEvidenceView> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const statuses = new Set<ForecastEvidenceView['status']>([
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
    );
  });
}

function canonicalSectionIdentityValid(
  section: ForecastSection,
  _period: PersonalForecastPeriod,
): boolean {
  if (section.kind === 'dynamic') {
    return (
      section.id.startsWith('semantic:')
      && (section.title === undefined || isSimpleDynamicTitle(section.title))
      && section.fixedKey === undefined
      && section.sourceTopicKey === undefined
    );
  }
  return false;
}

function crossPeriodLinksValid(
  value: unknown,
  _window: PersonalForecastWindow,
  _sections: ForecastSection[],
): value is CrossPeriodLink[] {
  return Array.isArray(value) && value.length === 0;
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

function presentationValid(
  forecast: Pick<PersonalForecastPackage, 'period' | 'overview' | 'sections'>,
  redactedSectionIds: ReadonlySet<string>,
): boolean {
  const sections = [forecast.overview, ...forecast.sections];
  if (!sections.some((section) => section.presentationStyle !== undefined)) {
    return true;
  }
  if (forecast.period !== 'day') {
    return sections.every((section) => (
      section.presentationStyle === undefined || section.presentationStyle === 'prose'
    ));
  }

  const styles = sections.map((section) => section.presentationStyle ?? 'prose');
  if (styles[0] !== 'prose') return false;
  if (styles.filter((style) => style === 'prose').length < 2) return false;
  if (styles.filter((style) => style === 'pull_quote').length > 1) return false;
  if (styles.filter((style) => style === 'paper_note').length > 1) return false;

  return sections.every((section, index) => {
    if (redactedSectionIds.has(section.id)) return true;
    const limits = TODAY_FORECAST_PRESENTATION_WORD_LIMITS[styles[index]];
    const words = section.text.trim().split(/\s+/u).filter(Boolean).length;
    return words >= limits.minimum && words <= limits.maximum;
  });
}

function personalForecastAstrologerBriefValid(value: unknown): value is PersonalForecastAstrologerBrief {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const basis = value as PersonalForecastAstrologerBrief;
  return (basis.tone === 'favorable' || basis.tone === 'mixed' || basis.tone === 'demanding')
    && typeof basis.situation === 'string' && Boolean(basis.situation.trim())
    && typeof basis.turn === 'string' && Boolean(basis.turn.trim())
    && typeof basis.outcome === 'string' && Boolean(basis.outcome.trim())
    && typeof basis.observableDetail === 'string' && Boolean(basis.observableDetail.trim())
    && typeof basis.briefSignature === 'string' && Boolean(basis.briefSignature.trim());
}

function personalForecastSemanticSignatureValid(
  value: unknown,
): value is PersonalForecastSemanticSignature {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const signature = value as PersonalForecastSemanticSignature;
  return typeof signature.situation === 'string' && Boolean(signature.situation)
    && typeof signature.turn === 'string' && Boolean(signature.turn)
    && typeof signature.outcome === 'string' && Boolean(signature.outcome)
    && typeof signature.title === 'string' && Boolean(signature.title)
    && typeof signature.forecast === 'string' && Boolean(signature.forecast)
    && typeof signature.closing === 'string' && Boolean(signature.closing);
}

export function getPersonalForecastPackageValidationError(
  value: unknown,
  options: {
    redactedSectionIds?: readonly string[];
    promptVersion?: string;
  } = {},
): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return 'PACKAGE_NOT_OBJECT';
  }
  const forecast = value as PersonalForecastPackage;
  if (
    !(['day', 'week', 'month'] as const).includes(forecast.period)
    || typeof forecast.periodKey !== 'string'
    || typeof forecast.periodStart !== 'string'
    || typeof forecast.periodEnd !== 'string'
    || typeof forecast.dateLabel !== 'string'
    || !forecast.dateLabel.trim()
    || typeof forecast.timezone !== 'string'
    || !forecast.timezone.trim()
    || forecast.timezone !== normalizeForecastTimezone(forecast.timezone)
  ) {
    return 'PACKAGE_IDENTITY_INVALID';
  }
  if (
    !forecast.meta
    || typeof forecast.meta !== 'object'
    || typeof forecast.meta.model !== 'string'
    || !forecast.meta.model.trim()
    || forecast.meta?.promptVersion !== (
      options.promptVersion ?? PERSONAL_FORECAST_PROMPT_VERSION
    )
    || forecast.meta?.voiceVersion !== PERSONAL_FORECAST_VOICE_VERSION
    || forecast.meta?.calculationVersion !== PERSONAL_FORECAST_CALCULATION_VERSION
    || forecast.meta?.semanticVersion !== PERSONAL_FORECAST_CONTRACT_VERSION
    || forecast.meta?.contractVersion !== PERSONAL_FORECAST_CONTRACT_VERSION
    || !personalForecastAstrologerBriefValid(forecast.meta?.astrologerBrief)
    || !personalForecastSemanticSignatureValid(forecast.meta?.semanticSignature)
    || !([0, 1, 2, 3, 4, 5, 6] as const).includes(forecast.meta?.generationAttempts)
    || !(['valid', 'deterministic_fallback'] as const).includes(
      forecast.meta?.validationStatus,
    )
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
  ) {
    return 'PACKAGE_META_INVALID';
  }
  if (!evidenceRecordValid(forecast.evidence)) {
    return 'PACKAGE_EVIDENCE_INVALID';
  }
  if (
    !Array.isArray(forecast.sections)
    || !Array.isArray(forecast.suggestedCrossPeriodLinks)
  ) {
    return 'PACKAGE_COLLECTIONS_INVALID';
  }
  const expectedSectionCount = forecast.sections.length === 1;
  if (!expectedSectionCount) {
    return 'PACKAGE_PERIOD_STRUCTURE_INVALID';
  }

  let expectedWindow: PersonalForecastWindow;
  try {
    expectedWindow = resolvePersonalForecastWindow(
      forecast.period,
      forecast.periodKey,
      forecast.timezone,
    );
  } catch {
    return 'PACKAGE_WINDOW_INVALID';
  }
  if (
    forecast.periodStart !== expectedWindow.periodStart
    || forecast.periodEnd !== expectedWindow.periodEnd
  ) {
    return 'PACKAGE_WINDOW_MISMATCH';
  }

  const redactedSectionIds = new Set(options.redactedSectionIds || []);
  const evidenceIds = new Set(Object.keys(forecast.evidence));
  if (!sectionValid(
    forecast.overview,
    forecast.period,
    evidenceIds,
    redactedSectionIds.has('overview'),
  )) return 'PACKAGE_OVERVIEW_INVALID';
  if (
    forecast.overview.kind !== 'overview'
    || forecast.overview.id !== 'overview'
    || forecast.overview.sourceTopicKey !== 'overview'
    || forecast.overview.fixedKey !== undefined
    || (
      forecast.overview.title !== undefined
      && !isSimpleDynamicTitle(forecast.overview.title)
    )
  ) {
    return 'PACKAGE_OVERVIEW_IDENTITY_INVALID';
  }
  if (!redactedSectionIds.has('overview') && (
    typeof forecast.overview.title !== 'string'
    || !forecast.overview.title.trim()
    || forecast.overview.contentBlocks.length !== 1
    || forecast.overview.contentBlocks[0]?.role !== 'detail'
  )) {
    return 'PACKAGE_OVERVIEW_READING_INVALID';
  }
  for (const section of forecast.sections) {
    const sectionDiagnosticId = section && typeof section === 'object'
      ? String(section.id || 'unknown')
      : 'unknown';
    if (!sectionValid(
      section,
      forecast.period,
      evidenceIds,
      redactedSectionIds.has(
        sectionDiagnosticId,
      ),
    )) {
      return `PACKAGE_SECTION_INVALID:${sectionDiagnosticId}`;
    }
  }
  const [closingSection] = forecast.sections;
  if (!closingSection) {
    return 'PACKAGE_CLOSING_MISSING';
  }
  if (!redactedSectionIds.has(closingSection.id) && (
    closingSection.title !== undefined
    || closingSection.contentBlocks.length !== 1
    || closingSection.contentBlocks[0]?.role !== 'action'
  )) {
    return 'PACKAGE_CLOSING_INVALID';
  }
  const ids = new Set<string>(['overview']);
  for (const section of forecast.sections) {
    if (ids.has(section.id)) return `PACKAGE_SECTION_ID_DUPLICATE:${section.id}`;
    ids.add(section.id);
  }
  if ([...redactedSectionIds].some((id) => !ids.has(id))) {
    return 'PACKAGE_REDACTED_SECTION_UNKNOWN';
  }
  if (!presentationValid(forecast, redactedSectionIds)) {
    return 'PACKAGE_PRESENTATION_INVALID';
  }
  if (forecast.sections.some(
    (section) => !canonicalSectionIdentityValid(section, forecast.period),
  )) {
    return 'PACKAGE_SECTION_IDENTITY_INVALID';
  }
  if (!visualValid(forecast.visual, ids)) {
    return 'PACKAGE_VISUAL_INVALID';
  }
  if (!crossPeriodLinksValid(
    forecast.suggestedCrossPeriodLinks,
    expectedWindow,
    forecast.sections,
  )) {
    return 'PACKAGE_CROSS_PERIOD_LINKS_INVALID';
  }
  if (
    forecast.sections.some((section) => section.status !== 'ready')
    || new Set(
      [forecast.overview, ...forecast.sections]
        .filter((section) => !redactedSectionIds.has(section.id))
        .map((section) => section.semanticFingerprint),
    ).size !== [forecast.overview, ...forecast.sections]
      .filter((section) => !redactedSectionIds.has(section.id)).length
  ) {
    return 'PACKAGE_SECTION_STATUS_OR_FINGERPRINT_INVALID';
  }
  const freeSelection = forecast.meta.freeSelection;
  if (!freeSelection || !Array.isArray(freeSelection.sectionIds)) {
    return 'PACKAGE_FREE_SELECTION_MISSING';
  }

  if (forecast.period === 'day') {
    const candidates = freeCandidates(forecast.sections);
    const eligibleIds = new Set(candidates.map((section) => section.id));
    const strongestSectionId = freeSelection.strongestSectionId;
    const rotatedSectionId = freeSelection.rotatedSectionId;
    if (!candidates.length) {
      if (
        strongestSectionId !== null
        || rotatedSectionId !== null
        || freeSelection.sectionIds.length !== 0
      ) {
        return 'PACKAGE_FREE_SELECTION_INVALID';
      }
    } else if (
      typeof strongestSectionId !== 'string'
      || freeSelection.sectionIds.length < 1
      || freeSelection.sectionIds.length > 2
      || freeSelection.sectionIds[0] !== strongestSectionId
      || (freeSelection.sectionIds.length === 2
        ? (
          typeof rotatedSectionId !== 'string'
          || strongestSectionId === rotatedSectionId
          || freeSelection.sectionIds[1] !== rotatedSectionId
        )
        : rotatedSectionId !== null)
      || new Set(freeSelection.sectionIds).size !== freeSelection.sectionIds.length
      || !eligibleIds.has(strongestSectionId)
      || (rotatedSectionId !== null && !eligibleIds.has(rotatedSectionId))
      || candidates[0]?.id !== strongestSectionId
    ) {
      return 'PACKAGE_FREE_SELECTION_INVALID';
    }
  } else if (
    freeSelection.strongestSectionId !== null
    || freeSelection.rotatedSectionId !== null
    || freeSelection.sectionIds.length !== 0
  ) {
    return 'PACKAGE_NON_DAY_FREE_SELECTION_INVALID';
  }
  return null;
}

export function isPersonalForecastPackage(
  value: unknown,
  options: {
    redactedSectionIds?: readonly string[];
    promptVersion?: string;
  } = {},
): value is PersonalForecastPackage {
  return getPersonalForecastPackageValidationError(value, options) === null;
}

function freeCandidates(sections: ForecastSection[]): ForecastSection[] {
  return sections
    .filter((section) => section.status === 'ready')
    .filter((section) => section.kind !== 'astro_accent')
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
  const closing = candidates.find((section) => (
    section.contentBlocks.some((block) => block.role === 'action')
  ));
  const previous = new Set(input.previousSectionIds || []);
  const fresh = candidates
    .slice(1, 6)
    .filter((section) => section.id !== closing?.id)
    .filter((section) => !previous.has(section.id));
  const fallbackPool = candidates
    .slice(1, 6)
    .filter((section) => section.id !== closing?.id);
  const pool = fresh.length ? fresh : fallbackPool;
  const rotated = closing && closing.id !== strongest
    ? closing.id
    : pool.length
      ? pool[stableHash(`${input.userId}|${input.periodKey}|free-rotation-v5`) % pool.length].id
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
    contentBlocks: [],
    semanticFactIds: [],
    semanticFingerprint: '',
    importance: 0,
    visualTag: fixedKey || 'overview',
    visualCue: null,
    premiumTeaser: '',
    lockedPreview: { lead: '', blurred: '', teaser: '' },
    explanationAnchors: [],
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
    sections: [],
    suggestedCrossPeriodLinks: [],
    evidence: {},
    visual: { sectionAssetIds: {} },
    meta: {
      model: '',
      promptVersion: PERSONAL_FORECAST_PROMPT_VERSION,
      voiceVersion: PERSONAL_FORECAST_VOICE_VERSION,
      calculationVersion: PERSONAL_FORECAST_CALCULATION_VERSION,
      semanticVersion: PERSONAL_FORECAST_CONTRACT_VERSION,
      contractVersion: PERSONAL_FORECAST_CONTRACT_VERSION,
      generationAttempts: 0,
      validationStatus: 'deterministic_fallback',
      generatedAt: new Date().toISOString(),
      status,
      diagnosticCode,
      astrologerBrief: {
        tone: 'mixed',
        situation: 'unavailable',
        turn: 'unavailable',
        outcome: 'unavailable',
        observableDetail: 'unavailable',
        briefSignature: 'unavailable',
      },
      semanticSignature: {
        situation: 'unavailable',
        turn: 'unavailable',
        outcome: 'unavailable',
        title: 'unavailable',
        forecast: 'unavailable',
        closing: 'unavailable',
      },
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
    contentBlocks: [],
    semanticFactIds: [],
    semanticFingerprint: '',
    premiumTeaser: preserveTodayPreview ? section.premiumTeaser : '',
    lockedPreview: preserveTodayPreview
      ? section.lockedPreview
      : { lead: '', blurred: '', teaser: '' },
    explanationAnchors: [],
  };
}

function nextPersonalForecastPeriod(
  period: PersonalForecastPeriod,
): PersonalForecastPeriod | null {
  if (period === 'day') return 'week';
  if (period === 'week') return 'month';
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
  }
  next.evidence = Object.fromEntries(
    Object.entries(navigableForecast.evidence)
      .filter(([id]) => visibleEvidenceIds.has(id)),
  );
  return { forecast: next, lockedSectionIds, periodLocked };
}
