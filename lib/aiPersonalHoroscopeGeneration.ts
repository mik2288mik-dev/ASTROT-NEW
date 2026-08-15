import type { UserProfile } from '../types';
import type {
  AiPersonalHoroscopePackage,
  AiPersonalHoroscopeRecentReading,
} from './aiPersonalHoroscope';
import type { AiPersonalHoroscopeDialogueMemory } from './aiPersonalHoroscopeMemory';
import { buildAiPersonalHoroscopePackage } from './aiPersonalHoroscopePackage';
import {
  AI_PERSONAL_HOROSCOPE_RESPONSE_SCHEMA,
  AI_PERSONAL_HOROSCOPE_RESPONSE_SCHEMA_NAME,
  buildAiPersonalHoroscopeEditorialBrief,
  buildAiPersonalHoroscopePrompt,
  getAiPersonalHoroscopeAsOfDate,
  getAiPersonalHoroscopeSystemPrompt,
  validateAiPersonalHoroscopePayload,
  type AiPersonalHoroscopeDomain,
  type GeneratedHoroscopePayload,
  type ValidatedHoroscope,
} from './aiPersonalHoroscopeVoice';
import { OPENAI_LUNA_MODEL } from './openai-models';
import { createLunaStructuredResponse } from './openaiResponses';
import type {
  PersonalForecastPeriod,
  PersonalForecastWindow,
} from './personalForecastContract';

export {
  buildAiPersonalHoroscopeEditorialBrief,
  buildAiPersonalHoroscopePrompt,
  getAiPersonalHoroscopeAsOfDate,
  getAiPersonalHoroscopeSystemPrompt,
} from './aiPersonalHoroscopeVoice';

const MAX_ATTEMPTS = 2;

export type AiPersonalHoroscopeGenerationMetrics = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  validationPassed: boolean;
};

function maxOutputTokens(period: PersonalForecastPeriod): number {
  // The Responses API counts hidden reasoning inside the output budget too.
  // The old caps could finish the reasoning budget before the strict JSON was complete.
  if (period === 'day') return 2_000;
  if (period === 'week') return 2_600;
  return 3_200;
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === 'string'
    ? value.trim().replace(/\r\n?/gu, '\n').replace(/[ \t]+/gu, ' ').slice(0, maxLength)
    : '';
}

function oneLine(value: unknown, maxLength: number): string {
  return cleanText(value, maxLength).replace(/\s+/gu, ' ').trim();
}

function wordCount(value: string): number {
  return value.trim().split(/\s+/u).filter(Boolean).length;
}

function sentenceCount(value: string): number {
  return (value.match(/[^.!?]+(?:[.!?]+|$)/gu) || [])
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .length;
}

function normalize(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('ru-RU')
    .replace(/ё/gu, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/gu, ' ');
}

function isRecoverableEditorialError(error: string): boolean {
  return (
    /^opening requires \d+-\d+ (?:sentences|words); received \d+$/u.test(error)
    || /^forecast requires \d+-\d+ (?:sentences|words); received \d+$/u.test(error)
    || /^advice \d+ requires \d+-\d+ words$/u.test(error)
    || error === 'forecast has no visible development and turn'
  );
}

function recoverEditorialDraft(input: {
  raw: GeneratedHoroscopePayload;
  errors: string[];
  period: PersonalForecastPeriod;
  requiredPrimaryDomain: AiPersonalHoroscopeDomain;
}): ValidatedHoroscope | null {
  // A draft may miss a narrow word-count or transition-marker check while still
  // being safe, specific and in the requested voice. Hard failures — planner
  // language, repeated advice, mysticism, dates, insults, generic checklists —
  // are never recovered here.
  if (!input.errors.length || !input.errors.every(isRecoverableEditorialError)) return null;

  const opening = cleanText(input.raw.opening, 360);
  const forecast = cleanText(input.raw.forecast, 1_800);
  const advice = Array.isArray(input.raw.advice)
    ? input.raw.advice.map((item) => oneLine(item, 220)).filter(Boolean)
    : [];
  const memory = input.raw.memory && typeof input.raw.memory === 'object' && !Array.isArray(input.raw.memory)
    ? input.raw.memory
    : null;
  const primaryDomain = oneLine(memory?.primary_domain, 40) as AiPersonalHoroscopeDomain;
  const mainIdeaKey = oneLine(memory?.main_idea_key, 120);
  const situationKey = oneLine(memory?.situation_key, 120);
  const turnKey = oneLine(memory?.turn_key, 120);
  const ironyKey = oneLine(memory?.irony_key, 120);
  const adviceKeys = Array.isArray(memory?.advice_keys)
    ? memory.advice_keys.map((item) => oneLine(item, 100)).filter(Boolean)
    : [];

  if (!opening || !forecast || advice.length !== 3) return null;
  if (primaryDomain !== input.requiredPrimaryDomain) return null;
  if (!mainIdeaKey || !situationKey || !turnKey || adviceKeys.length !== 3) return null;
  if (new Set(advice.map(normalize)).size !== advice.length) return null;
  if (new Set(adviceKeys.map(normalize)).size !== adviceKeys.length) return null;

  const openingWords = wordCount(opening);
  const openingSentences = sentenceCount(opening);
  if (openingWords < 3 || openingWords > 42 || openingSentences < 1 || openingSentences > 3) {
    return null;
  }

  const broadLimits = input.period === 'day'
    ? { minWords: 35, maxWords: 130, minSentences: 3, maxSentences: 8 }
    : input.period === 'week'
      ? { minWords: 50, maxWords: 170, minSentences: 4, maxSentences: 9 }
      : { minWords: 70, maxWords: 210, minSentences: 5, maxSentences: 10 };
  const forecastWords = wordCount(forecast);
  const forecastSentences = sentenceCount(forecast);
  if (
    forecastWords < broadLimits.minWords
    || forecastWords > broadLimits.maxWords
    || forecastSentences < broadLimits.minSentences
    || forecastSentences > broadLimits.maxSentences
  ) return null;

  if (advice.some((item) => {
    const words = wordCount(item);
    return words < 2 || words > 18 || sentenceCount(item) !== 1;
  })) return null;

  return {
    opening,
    forecast,
    advice,
    memory: {
      primaryDomain,
      mainIdeaKey,
      situationKey,
      turnKey,
      ironyKey,
      adviceKeys,
    },
  };
}

export async function generateAiPersonalHoroscopePackage(input: {
  profile: UserProfile;
  /** Kept for source compatibility; Luna is always authoritative here. */
  model?: string;
  period: PersonalForecastPeriod;
  window: PersonalForecastWindow;
  recentForecasts?: AiPersonalHoroscopeRecentReading[];
  conversationMemory?: AiPersonalHoroscopeDialogueMemory[];
  onMetrics?: (metrics: AiPersonalHoroscopeGenerationMetrics) => void;
}): Promise<AiPersonalHoroscopePackage> {
  const language: 'ru' | 'en' = input.profile.language === 'en' ? 'en' : 'ru';
  const asOfDate = getAiPersonalHoroscopeAsOfDate(input.window);
  const editorialBrief = buildAiPersonalHoroscopeEditorialBrief({
    language,
    period: input.period,
    window: input.window,
    profile: input.profile,
    asOfDate,
  });
  let rejectedDraft: GeneratedHoroscopePayload | null = null;
  let repairErrors: string[] = [];
  let incompleteSeen = false;
  let recoverableDraft: { value: ValidatedHoroscope; attempts: 1 | 2 } | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const startedAt = Date.now();
    try {
      const response = await createLunaStructuredResponse({
        instructions: getAiPersonalHoroscopeSystemPrompt(language, input.period),
        input: buildAiPersonalHoroscopePrompt({
          language,
          period: input.period,
          window: input.window,
          profile: input.profile,
          asOfDate,
          recentForecasts: input.recentForecasts,
          conversationMemory: input.conversationMemory,
          rejectedDraft,
          repairErrors,
        }),
        maxOutputTokens: maxOutputTokens(input.period),
        schemaName: AI_PERSONAL_HOROSCOPE_RESPONSE_SCHEMA_NAME,
        schema: AI_PERSONAL_HOROSCOPE_RESPONSE_SCHEMA,
      });

      let parsed: GeneratedHoroscopePayload;
      try {
        parsed = JSON.parse(response.content) as GeneratedHoroscopePayload;
      } catch {
        repairErrors = ['response is not valid JSON'];
        input.onMetrics?.({
          model: OPENAI_LUNA_MODEL,
          inputTokens: response.inputTokens,
          outputTokens: response.outputTokens,
          latencyMs: Date.now() - startedAt,
          validationPassed: false,
        });
        continue;
      }

      const validated = validateAiPersonalHoroscopePayload(parsed, {
        language,
        period: input.period,
        window: input.window,
        profile: input.profile,
        asOfDate,
        requiredPrimaryDomain: editorialBrief.primaryDomain,
        recentForecasts: input.recentForecasts,
      });
      input.onMetrics?.({
        model: OPENAI_LUNA_MODEL,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        latencyMs: Date.now() - startedAt,
        validationPassed: !!validated.value,
      });
      if (!validated.value) {
        console.warn('[ai-personal-horoscope] Luna draft rejected', {
          period: input.period,
          periodKey: input.window.periodKey,
          attempt,
          errors: validated.errors,
        });
        const recovered = recoverEditorialDraft({
          raw: parsed,
          errors: validated.errors,
          period: input.period,
          requiredPrimaryDomain: editorialBrief.primaryDomain,
        });
        if (recovered) {
          recoverableDraft = {
            value: recovered,
            attempts: attempt as 1 | 2,
          };
        }
        rejectedDraft = parsed;
        repairErrors = validated.errors;
        continue;
      }

      return buildAiPersonalHoroscopePackage({
        profile: input.profile,
        language,
        period: input.period,
        window: input.window,
        model: OPENAI_LUNA_MODEL,
        value: validated.value,
        attempts: attempt as 1 | 2,
        validationStatus: 'valid',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('OPENAI_RESPONSE_INCOMPLETE')) incompleteSeen = true;
      repairErrors = [message.slice(0, 240)];
      console.warn('[ai-personal-horoscope] Luna request failed', {
        period: input.period,
        periodKey: input.window.periodKey,
        attempt,
        message: repairErrors[0],
      });
      if (attempt === MAX_ATTEMPTS) break;
    }
  }

  if (recoverableDraft) {
    return buildAiPersonalHoroscopePackage({
      profile: input.profile,
      language,
      period: input.period,
      window: input.window,
      model: OPENAI_LUNA_MODEL,
      value: recoverableDraft.value,
      attempts: recoverableDraft.attempts,
      validationStatus: 'deterministic_fallback',
    });
  }

  if (incompleteSeen) throw new Error('PERSONAL_FORECAST_WRITER_INCOMPLETE');
  throw new Error(`PERSONAL_FORECAST_WRITER_VALIDATION_FAILED:${repairErrors.join('|')}`);
}

export function getAiPersonalHoroscopeGenerationDiagnosticCode(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('PERSONAL_FORECAST_WRITER_INCOMPLETE')) {
    return 'PERSONAL_FORECAST_WRITER_INCOMPLETE';
  }
  if (message.includes('PERSONAL_FORECAST_WRITER_VALIDATION_FAILED')) {
    return 'PERSONAL_FORECAST_WRITER_VALIDATION_FAILED';
  }
  if (
    message.includes('OPENAI_API_KEY')
    || message.includes('OPENAI_RESPONSE')
    || message.includes('fetch failed')
    || message.includes('ECONN')
  ) {
    return 'PERSONAL_FORECAST_PROVIDER_UNAVAILABLE';
  }
  return 'PERSONAL_FORECAST_GENERATION_FAILED';
}
