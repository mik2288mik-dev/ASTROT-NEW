import type { Language } from '../../types';
import type { RelationshipContext } from './relationshipContext';
import { normalizeZodiacKey } from '../zodiacKeys';

export const COMPATIBILITY_REACTION_VERSION = 'v1';

function normalizeGender(value?: string | null): 'female' | 'male' | 'x' {
  return value === 'female' || value === 'male' ? value : 'x';
}

export function buildSignCompatibilityReactionKey(input: {
  subjectSign: string;
  partnerSign: string;
  subjectGender?: string | null;
  partnerGender?: string | null;
  relationshipContext: RelationshipContext;
  language: Language;
}): string | null {
  const subjectSign = normalizeZodiacKey(input.subjectSign)?.toLowerCase();
  const partnerSign = normalizeZodiacKey(input.partnerSign)?.toLowerCase();
  if (!subjectSign || !partnerSign) return null;
  return [
    'sign',
    COMPATIBILITY_REACTION_VERSION,
    subjectSign,
    normalizeGender(input.subjectGender),
    partnerSign,
    normalizeGender(input.partnerGender),
    input.relationshipContext,
    input.language === 'en' ? 'en' : 'ru',
  ].join(':');
}

export function buildDeepCompatibilityReactionKey(cacheKey: string): string | null {
  const normalized = String(cacheKey || '').trim().toLowerCase();
  return /^[a-f0-9]{64}$/.test(normalized)
    ? `deep:${COMPATIBILITY_REACTION_VERSION}:${normalized}`
    : null;
}
