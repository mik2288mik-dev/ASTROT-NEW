import type { NatalAnchorReading, NatalFullReading, NatalLivingReading, NatalHumanSection } from '../types';
import { getMoscowTodayKey } from './date-utils';
import { withAppVoiceCacheKey, withAppVoiceVersion } from './appVoice';

export const NATAL_ANCHOR_PROMPT_VERSION = withAppVoiceVersion('natal_anchor.planet_human_v4');
export const NATAL_FULL_PROMPT_VERSION = withAppVoiceVersion('natal_full.planet_human_v4');
export const NATAL_LIVING_PROMPT_VERSION = withAppVoiceVersion('natal_daily.editorial_v3');

export const NATAL_ANCHOR_CACHE_KEY = withAppVoiceCacheKey('base');
export const NATAL_FULL_CACHE_KEY = withAppVoiceCacheKey('personality');

export const NATAL_CONTENT_ACTIVE_PROMPT_VERSIONS = [
  NATAL_ANCHOR_PROMPT_VERSION,
  NATAL_FULL_PROMPT_VERSION,
  NATAL_LIVING_PROMPT_VERSION,
] as const;


// Legacy names are retained for wire compatibility. They do not select a writer.
export function buildNatalLivingCacheKey(periodKey: string) { return withAppVoiceCacheKey(periodKey); }
export function getCurrentNatalPeriodKey() { return getMoscowTodayKey(); }

function sections(value: unknown): value is NatalHumanSection[] {
  return Array.isArray(value) && value.every(section => section && typeof section.id === 'string'
    && typeof section.body === 'string' && section.body.trim() && Array.isArray(section.examples));
}
function unavailable(): never { throw new Error('NATAL_SAVED_READING_REQUIRED'); }
export function coerceNatalAnchorReading(content: unknown, _language: 'ru' | 'en', _chart?: unknown): NatalAnchorReading {
  const raw = content as Partial<NatalAnchorReading> | null;
  if (!raw || typeof raw.headline !== 'string' || typeof raw.lead !== 'string' || !sections(raw.sections)
    || !Array.isArray(raw.astroEvidence) || !Array.isArray(raw.dictionaryTerms)) return unavailable();
  return raw as NatalAnchorReading;
}
export function coerceNatalFullReading(content: unknown, _language: 'ru' | 'en', _chart?: unknown): NatalFullReading {
  const raw = content as Partial<NatalFullReading> | null;
  if (!raw || typeof raw.headline !== 'string' || typeof raw.lead !== 'string' || typeof raw.synthesis !== 'string'
    || !sections(raw.sections) || !Array.isArray(raw.astroEvidence)) return unavailable();
  return raw as NatalFullReading;
}
export function coerceNatalLivingReading(content: unknown, _language: 'ru' | 'en', _periodKey?: string, _chart?: unknown): NatalLivingReading {
  const raw = content as Partial<NatalLivingReading> | null;
  if (!raw || typeof raw.periodKey !== 'string' || typeof raw.headline !== 'string' || typeof raw.summary !== 'string'
    || !Array.isArray(raw.situations) || !Array.isArray(raw.astroEvidence)) return unavailable();
  return raw as NatalLivingReading;
}
export function mapNatalAnchorToLegacyIntro(reading: NatalAnchorReading) {
  return [reading.lead, ...reading.sections.map(section => section.body)].filter(Boolean).join('\n\n');
}
