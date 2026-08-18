import type { UserProfile } from '../types';
import {
  AI_PERSONAL_HOROSCOPE_CACHE_VERSION,
  AI_PERSONAL_HOROSCOPE_CONTRACT_VERSION,
  AI_PERSONAL_HOROSCOPE_PROMPT_VERSION,
  AI_PERSONAL_HOROSCOPE_VERSION,
  formatAiPersonalHoroscopeDateLabel,
  getAiPersonalHoroscopeCurrentDate,
  type AiPersonalHoroscopeHistoryItem,
  type AiPersonalHoroscopePackage,
  type AiPersonalHoroscopePeriod,
  type AiPersonalHoroscopeWindow,
} from './aiPersonalHoroscope';
import {
  AI_PERSONAL_HOROSCOPE_RESPONSE_SCHEMA,
  AI_PERSONAL_HOROSCOPE_RESPONSE_SCHEMA_NAME,
  buildAiPersonalHoroscopePrompt,
  getAiPersonalHoroscopeSystemPrompt,
  readAiPersonalHoroscopePayload,
  type GeneratedHoroscopePayload,
  type ParsedHoroscope,
} from './aiPersonalHoroscopeVoice';
import { OPENAI_LUNA_MODEL } from './openai-models';
import { createLunaStructuredResponse } from './openaiResponses';

export {
  buildAiPersonalHoroscopePrompt,
  getAiPersonalHoroscopeSystemPrompt,
} from './aiPersonalHoroscopeVoice';

const MAX_PROVIDER_ATTEMPTS = 2;

export type AiPersonalHoroscopeGenerationMetrics = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  validationPassed: boolean;
};

function maxOutputTokens(period: AiPersonalHoroscopePeriod): number {
  if (period === 'day') return 1_200;
  if (period === 'week') return 1_600;
  return 2_000;
}

function buildPackage(input: {
  profile: UserProfile;
  period: AiPersonalHoroscopePeriod;
  window: AiPersonalHoroscopeWindow;
  currentDate: string;
  reading: ParsedHoroscope;
  attempts: 1 | 2;
}): AiPersonalHoroscopePackage {
  return {
    version: AI_PERSONAL_HOROSCOPE_VERSION,
    period: input.period,
    periodKey: input.window.periodKey,
    currentDate: input.currentDate,
    periodStart: input.window.periodStart,
    periodEnd: input.window.periodEnd,
    dateLabel: formatAiPersonalHoroscopeDateLabel(
      input.window,
      input.profile.language === 'en' ? 'en' : 'ru',
    ),
    timezone: input.window.timezone,
    reading: input.reading,
    meta: {
      model: OPENAI_LUNA_MODEL,
      promptVersion: AI_PERSONAL_HOROSCOPE_PROMPT_VERSION,
      contractVersion: AI_PERSONAL_HOROSCOPE_CONTRACT_VERSION,
      cacheVersion: AI_PERSONAL_HOROSCOPE_CACHE_VERSION,
      generationAttempts: input.attempts,
      generatedAt: new Date().toISOString(),
      status: 'ready',
    },
  };
}

export async function generateAiPersonalHoroscopePackage(input: {
  profile: UserProfile;
  period: AiPersonalHoroscopePeriod;
  window: AiPersonalHoroscopeWindow;
  currentDate?: string;
  previousForecasts?: AiPersonalHoroscopeHistoryItem[];
  onMetrics?: (metrics: AiPersonalHoroscopeGenerationMetrics) => void;
}): Promise<AiPersonalHoroscopePackage> {
  const language: 'ru' | 'en' = input.profile.language === 'en' ? 'en' : 'ru';
  const currentDate = input.currentDate || getAiPersonalHoroscopeCurrentDate(input.window);
  let incompleteSeen = false;
  let lastFailure = 'provider_error';

  for (let attempt = 1; attempt <= MAX_PROVIDER_ATTEMPTS; attempt += 1) {
    const startedAt = Date.now();
    try {
      const response = await createLunaStructuredResponse({
        instructions: getAiPersonalHoroscopeSystemPrompt(language, input.period),
        input: buildAiPersonalHoroscopePrompt({
          language,
          period: input.period,
          window: input.window,
          profile: input.profile,
          currentDate,
          previousForecasts: input.previousForecasts,
        }),
        maxOutputTokens: maxOutputTokens(input.period),
        schemaName: AI_PERSONAL_HOROSCOPE_RESPONSE_SCHEMA_NAME,
        schema: AI_PERSONAL_HOROSCOPE_RESPONSE_SCHEMA,
      });

      let parsed: GeneratedHoroscopePayload;
      try {
        parsed = JSON.parse(response.content) as GeneratedHoroscopePayload;
      } catch {
        lastFailure = 'invalid_json';
        input.onMetrics?.({
          model: OPENAI_LUNA_MODEL,
          inputTokens: response.inputTokens,
          outputTokens: response.outputTokens,
          latencyMs: Date.now() - startedAt,
          validationPassed: false,
        });
        continue;
      }

      const reading = readAiPersonalHoroscopePayload(parsed, input.period);
      input.onMetrics?.({
        model: OPENAI_LUNA_MODEL,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        latencyMs: Date.now() - startedAt,
        validationPassed: !!reading,
      });
      if (!reading) {
        lastFailure = 'response_shape_invalid';
        continue;
      }

      return buildPackage({
        profile: input.profile,
        period: input.period,
        window: input.window,
        currentDate,
        reading,
        attempts: attempt as 1 | 2,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('OPENAI_RESPONSE_INCOMPLETE')) incompleteSeen = true;
      lastFailure = message.includes('OPENAI_RESPONSE_REFUSAL')
        ? 'provider_refusal'
        : message.includes('OPENAI_RESPONSE_EMPTY')
          ? 'empty_response'
          : message.includes('OPENAI_RESPONSE_INCOMPLETE')
            ? 'incomplete_response'
            : 'provider_error';
      console.warn('[ai-personal-horoscope] Luna request failed', {
        period: input.period,
        periodKey: input.window.periodKey,
        attempt,
        code: lastFailure,
      });
    }
  }

  if (incompleteSeen) throw new Error('PERSONAL_HOROSCOPE_WRITER_INCOMPLETE');
  throw new Error(`PERSONAL_HOROSCOPE_WRITER_VALIDATION_FAILED:${lastFailure}`);
}

export function getAiPersonalHoroscopeGenerationDiagnosticCode(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('PERSONAL_HOROSCOPE_WRITER_INCOMPLETE')) {
    return 'PERSONAL_HOROSCOPE_WRITER_INCOMPLETE';
  }
  if (message.includes('PERSONAL_HOROSCOPE_WRITER_VALIDATION_FAILED')) {
    return 'PERSONAL_HOROSCOPE_WRITER_VALIDATION_FAILED';
  }
  if (
    message.includes('OPENAI_API_KEY')
    || message.includes('OPENAI_RESPONSE')
    || message.includes('fetch failed')
    || message.includes('ECONN')
  ) {
    return 'PERSONAL_HOROSCOPE_PROVIDER_UNAVAILABLE';
  }
  return 'PERSONAL_HOROSCOPE_GENERATION_FAILED';
}
