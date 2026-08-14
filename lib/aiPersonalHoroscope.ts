import type { UserProfile } from '../types';
import {
  PERSONAL_FORECAST_CALCULATION_VERSION,
  PERSONAL_FORECAST_CONTRACT_VERSION,
  PERSONAL_FORECAST_PROMPT_VERSION,
  isPersonalForecastPackage,
  normalizeForecastTimezone,
  stableHash,
  type PersonalForecastPackage,
  type PersonalForecastPeriod,
} from './personalForecastContract';

export const AI_PERSONAL_HOROSCOPE_VERSION = 'ai-personal-horoscope-v1' as const;
export const AI_PERSONAL_HOROSCOPE_EVIDENCE_ID = 'profile:ai-horoscope' as const;
export const AI_PERSONAL_HOROSCOPE_CONTENT_MODE = AI_PERSONAL_HOROSCOPE_VERSION;
export const AI_PERSONAL_HOROSCOPE_TIMEZONE = 'Europe/Moscow' as const;

export type AiPersonalHoroscopeReading = {
  opening: string;
  forecast: string;
  advice: string[];
};

export type AiPersonalHoroscopeRecentFragment = {
  kind: 'opening' | 'forecast' | 'advice';
  text: string;
  semanticFingerprint: string | null;
};

export type AiPersonalHoroscopeRecentReading = {
  periodKey: string;
  fragments: AiPersonalHoroscopeRecentFragment[];
};

export type AiPersonalHoroscopePackage = PersonalForecastPackage & {
  meta: PersonalForecastPackage['meta'] & {
    contentMode: typeof AI_PERSONAL_HOROSCOPE_CONTENT_MODE;
  };
};

function clean(value: unknown, maxLength = 240): string | null {
  const text = typeof value === 'string' ? value.trim().replace(/\s+/gu, ' ') : '';
  if (!text) return null;
  return text.slice(0, maxLength);
}

export function buildAiPersonalHoroscopeProfileSnapshot(profile: UserProfile) {
  return {
    userId: String(profile.id || '').trim(),
    name: clean(profile.name, 80),
    birthDate: clean(profile.birthDate, 10),
    birthTime: clean(profile.birthTime, 8),
    birthPlace: clean(profile.birthPlace, 160),
    gender: profile.gender === 'male' || profile.gender === 'female'
      ? profile.gender
      : 'unspecified',
    language: profile.language === 'en' ? 'en' : 'ru',
  } as const;
}

export function buildAiPersonalHoroscopeProfileFingerprint(profile: UserProfile): string {
  const snapshot = buildAiPersonalHoroscopeProfileSnapshot(profile);
  return stableHash(JSON.stringify(snapshot)).toString(36);
}

export function buildAiPersonalHoroscopeCacheKey(input: {
  profile: UserProfile;
  period: PersonalForecastPeriod;
  periodKey: string;
  timezone: string;
  language: 'ru' | 'en';
  modelId: string;
}): string {
  const identity = [
    AI_PERSONAL_HOROSCOPE_VERSION,
    String(input.profile.id || '').trim(),
    buildAiPersonalHoroscopeProfileFingerprint(input.profile),
    input.period,
    input.periodKey,
    normalizeForecastTimezone(input.timezone),
    input.language,
    input.modelId,
    PERSONAL_FORECAST_PROMPT_VERSION,
    PERSONAL_FORECAST_CALCULATION_VERSION,
    PERSONAL_FORECAST_CONTRACT_VERSION,
  ].join('|');
  return `${AI_PERSONAL_HOROSCOPE_VERSION}:${stableHash(identity).toString(36)}:${input.period}:${input.periodKey}`;
}

export function buildAiPersonalHoroscopeInputHash(input: {
  profile: UserProfile;
  period: PersonalForecastPeriod;
  periodKey: string;
  timezone: string;
  language: 'ru' | 'en';
  modelId: string;
}): string {
  return stableHash(JSON.stringify({
    version: AI_PERSONAL_HOROSCOPE_VERSION,
    profile: buildAiPersonalHoroscopeProfileSnapshot(input.profile),
    period: input.period,
    periodKey: input.periodKey,
    timezone: normalizeForecastTimezone(input.timezone),
    language: input.language,
    modelId: input.modelId,
    promptVersion: PERSONAL_FORECAST_PROMPT_VERSION,
    calculationVersion: PERSONAL_FORECAST_CALCULATION_VERSION,
    contractVersion: PERSONAL_FORECAST_CONTRACT_VERSION,
  })).toString(36);
}

function metaContentMode(value: PersonalForecastPackage): unknown {
  return (value.meta as PersonalForecastPackage['meta'] & { contentMode?: unknown }).contentMode;
}

export function isAiPersonalHoroscopePackage(
  value: unknown,
  options: { redactedSectionIds?: readonly string[]; promptVersion?: string } = {},
): value is AiPersonalHoroscopePackage {
  if (!isPersonalForecastPackage(value, options)) return false;
  const forecast = value as PersonalForecastPackage;
  if (metaContentMode(forecast) !== AI_PERSONAL_HOROSCOPE_CONTENT_MODE) return false;

  if (forecast.period === 'day') {
    const ids = new Set(forecast.sections.map((section) => section.id));
    return ids.has('semantic:forecast')
      && [...ids].filter((id) => id.startsWith('semantic:advice-')).length >= 2;
  }

  return forecast.sections.length === 0;
}

export function readAiPersonalHoroscopeReading(
  forecast: PersonalForecastPackage,
): AiPersonalHoroscopeReading {
  if (forecast.period === 'day') {
    const forecastSection = forecast.sections.find((section) => section.id === 'semantic:forecast');
    const advice = forecast.sections
      .filter((section) => section.id.startsWith('semantic:advice-'))
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((section) => section.text.trim())
      .filter(Boolean);
    return {
      opening: forecast.overview.text.trim(),
      forecast: forecastSection?.text.trim() || '',
      advice,
    };
  }

  const blocks = forecast.overview.contentBlocks || [];
  const opening = blocks.find((block) => block.role === 'lead')?.text.trim()
    || blocks[0]?.text.trim()
    || '';
  const forecastText = blocks.find((block) => block.role === 'detail')?.text.trim()
    || blocks[1]?.text.trim()
    || '';
  const advice = blocks
    .filter((block) => block.role === 'action')
    .map((block) => block.text.trim())
    .filter(Boolean);
  return { opening, forecast: forecastText, advice };
}

export function personalHoroscopeReadingToRecent(
  forecast: PersonalForecastPackage,
): AiPersonalHoroscopeRecentReading | null {
  if (metaContentMode(forecast) !== AI_PERSONAL_HOROSCOPE_CONTENT_MODE) return null;
  const reading = readAiPersonalHoroscopeReading(forecast);
  const fragments: AiPersonalHoroscopeRecentFragment[] = [];
  if (reading.opening) {
    fragments.push({
      kind: 'opening',
      text: reading.opening.slice(0, 700),
      semanticFingerprint: forecast.overview.semanticFingerprint || null,
    });
  }
  if (reading.forecast) {
    const section = forecast.period === 'day'
      ? forecast.sections.find((candidate) => candidate.id === 'semantic:forecast')
      : forecast.overview;
    fragments.push({
      kind: 'forecast',
      text: reading.forecast.slice(0, 1_200),
      semanticFingerprint: section?.semanticFingerprint || null,
    });
  }
  reading.advice.forEach((text, index) => {
    const section = forecast.period === 'day'
      ? forecast.sections.find((candidate) => candidate.id === `semantic:advice-${index + 1}`)
      : forecast.overview;
    fragments.push({
      kind: 'advice',
      text: text.slice(0, 320),
      semanticFingerprint: section?.semanticFingerprint || null,
    });
  });
  return fragments.length ? { periodKey: forecast.periodKey, fragments } : null;
}
