import type { UserProfile } from '../types';
import { createLunaStructuredResponse } from './openaiResponses';
import { getPersonalForecastVoiceViolationCodes } from './appVoice';
import type { NatalChartDataV2 } from './natalChartV2Types';
import { buildPersonalForecastDateContext } from './personalForecastDateContext';
import {
  buildForecastLockedPreview, createUnavailablePersonalForecast,
  getPersonalForecastRawProfile, getPersonalForecastPackageValidationError, stableHash,
  type PersonalForecastPackage, type PersonalForecastPeriod, type PersonalForecastWindow,
  type PersonalForecastSemanticSignature,
} from './personalForecastContract';

// History types remain for cache readers. Previous forecasts are never fed to the writer.
export const PERSONAL_FORECAST_CROSS_USER_REPEAT_FRAGMENT_LIMIT = 256;
export type PersonalForecastRepeatFragment = {
  kind?: 'title' | 'forecast' | 'closing' | 'headline' | 'fragment';
  text: string; mainIdeaKey?: string; lifePlotKey?: string; adviceKey?: string;
  comparisonKey?: string; semanticFingerprint?: string | null;
};
export type PersonalForecastRecentReading = {
  period?: PersonalForecastPeriod; periodKey: string;
  fragments: (PersonalForecastRepeatFragment & { semanticFingerprint: string | null })[];
  semanticSignature?: PersonalForecastSemanticSignature; briefSignature?: string;
};

import { getPersonalForecastSystemPrompt } from './voice/contracts/personalForecast';
export { getPersonalForecastSystemPrompt };

export function getDirectHoroscopeVoiceViolationCodes(text: string): string[] {
  // Ordinary words such as 'offer' and 'final answer' are not writing failures.
  // Keep the specific jargon, mysticism and cliche guards, without the former brief's vocabulary bans.
  const legacyVocabularyCodes = new Set(['REPORT_ABSTRACT_NOUN', 'REPORT_BOOKISH_WORD', 'REPORT_MACHINE_LANGUAGE', 'REPORT_VAGUE_PLACEHOLDER']);
  return getPersonalForecastVoiceViolationCodes(text).filter(code => !legacyVocabularyCodes.has(code));
}

/** One provider request. No brief, examples, editorial stages or generated conclusion. */
export async function generatePersonalForecastPackage(input: {
  userId?: string; profile: UserProfile; model: string; period: PersonalForecastPeriod;
  window: PersonalForecastWindow; natal: NatalChartDataV2;
}): Promise<PersonalForecastPackage> {
  const language = input.profile.language === 'en' ? 'en' : 'ru';
  const dateCalculation = buildPersonalForecastDateContext(input.natal, input.window);
  let content: string;
  try {
    const response = await createLunaStructuredResponse({
      instructions: getPersonalForecastSystemPrompt(language),
      input: JSON.stringify({ birth: getPersonalForecastRawProfile(input.profile),
        saved_natal_calculation: { positions: input.natal.positions, houses: input.natal.houses, aspects: input.natal.aspects, quality: input.natal.chartQuality },
        selected_date_calculation: dateCalculation,
        selected_date: { period: input.period, start: input.window.periodStart,
          end: input.window.periodEnd, timezone: input.window.timezone } }),
      maxOutputTokens: 2400, reasoningEffort: 'medium', verbosity: 'low', store: false,
      schemaName: 'nebo_direct_horoscope',
      schema: { type: 'object', additionalProperties: false, required: ['title', 'body', 'action_type', 'action_text'],
        properties: {
          title: { type: 'string' },
          body: { type: 'string' },
          action_type: { type: 'string', enum: ['buy', 'talk', 'move', 'stop'] },
          action_text: { type: 'string' }
        }
      },
    });
    content = response.content;
  } catch (error) {
    throw new Error(`PERSONAL_FORECAST_WRITER_REQUEST_FAILED:${error instanceof Error ? error.message : 'UNKNOWN'}`);
  }
  const raw = JSON.parse(content) as { title?: unknown; body?: unknown; action_type?: unknown; action_text?: unknown };
  if (typeof raw.title !== 'string' || !raw.title.trim() || typeof raw.body !== 'string' || !raw.body.trim()) {
    throw new Error('PERSONAL_FORECAST_GENERATION_INVALID:EMPTY_READING');
  }
  const title = raw.title.trim();
  const text = raw.body.trim();
  const actionType = (raw.action_type === 'buy' || raw.action_type === 'talk' || raw.action_type === 'move' || raw.action_type === 'stop') ? raw.action_type : null;
  const actionText = typeof raw.action_text === 'string' ? raw.action_text.trim() : null;
  if (/(?:гарантирован\p{L}*|точно\s+произойд\p{L}*|диагноз\p{L}*|лечени\p{L}*|лекарств\p{L}*|guaranteed|buy\s+(?:stocks|crypto))/iu.test(`${title} ${text}`)) {
    throw new Error('PERSONAL_FORECAST_GENERATION_INVALID:UNSAFE_CLAIM');
  }
  const result = createUnavailablePersonalForecast(input.period, input.window.periodKey,
    input.window.timezone, language, 'generating', 'DIRECT_GENERATION');
  const fingerprint = `direct:${Math.abs(stableHash(text)).toString(36)}`;
  const teaser = language === 'ru' ? 'Прочитать гороскоп' : 'Read your horoscope';
  result.overview = { ...result.overview, status: 'ready', diagnosticCode: null,
    title, text, actionType, actionText, importance: 100, visualTag: 'personal-story',
    semanticFactIds: ['birth-profile'], semanticFingerprint: fingerprint,
    contentBlocks: [{ id: 'overview:reading', role: 'detail', text, semanticFactId: 'birth-profile', atomId: 'forecast_body' }],
    explanationAnchors: [], premiumTeaser: teaser, lockedPreview: buildForecastLockedPreview(text, teaser) };
  result.visual.sectionAssetIds = { overview: null };
  result.meta = { ...result.meta, model: input.model, generationAttempts: 1,
    validationStatus: 'valid', status: 'ready', diagnosticCode: null,
    // Empty compatibility metadata; no astrologer brief is generated or consumed.
    astrologerBrief: { tone: 'mixed', observations: [], briefSignature: 'direct-v1' },
    semanticSignature: { situation: fingerprint, turn: fingerprint, outcome: fingerprint,
      title, forecast: text, closing: 'none' } };
  const error = getPersonalForecastPackageValidationError(result);
  if (error) throw new Error(`PERSONAL_FORECAST_GENERATION_INVALID:${error}`);
  return result;
}

export type PersonalForecastGenerationDiagnosticCode =
  | 'PERSONAL_FORECAST_CACHE_WRITE_FAILED'
  | 'PERSONAL_FORECAST_EVIDENCE_EMPTY'
  | 'PERSONAL_FORECAST_WRITER_VALIDATION_FAILED'
  | 'PERSONAL_FORECAST_WRITER_OUTPUT_LIMIT'
  | 'PERSONAL_FORECAST_WRITER_INCOMPLETE'
  | 'PERSONAL_FORECAST_WRITER_REFUSED'
  | 'PERSONAL_FORECAST_WRITER_UNAVAILABLE'
  | 'PERSONAL_FORECAST_GENERATION_FAILED';

/** Do not expose provider errors to clients; map them to stable UI states. */
export function getPersonalForecastGenerationDiagnosticCode(
  error: unknown,
): PersonalForecastGenerationDiagnosticCode {
  const message = error instanceof Error ? error.message : String(error);
  if (message.startsWith('PERSONAL_FORECAST_CACHE_WRITE_FAILED')) {
    return 'PERSONAL_FORECAST_CACHE_WRITE_FAILED';
  }
  if (message.startsWith('PERSONAL_FORECAST_EVIDENCE_EMPTY')) {
    return 'PERSONAL_FORECAST_EVIDENCE_EMPTY';
  }
  if (message.startsWith('PERSONAL_FORECAST_GENERATION_INVALID')) {
    return 'PERSONAL_FORECAST_WRITER_VALIDATION_FAILED';
  }
  if (message.startsWith('PERSONAL_FORECAST_WRITER_REQUEST_FAILED')) {
    if (message.includes('OPENAI_RESPONSE_REFUSAL')) {
      return 'PERSONAL_FORECAST_WRITER_REFUSED';
    }
    if (message.includes('OPENAI_RESPONSE_INCOMPLETE:max_output_tokens')) {
      return 'PERSONAL_FORECAST_WRITER_OUTPUT_LIMIT';
    }
    return message.includes('OPENAI_RESPONSE_INCOMPLETE')
      ? 'PERSONAL_FORECAST_WRITER_INCOMPLETE'
      : 'PERSONAL_FORECAST_WRITER_UNAVAILABLE';
  }
  return 'PERSONAL_FORECAST_GENERATION_FAILED';
}
