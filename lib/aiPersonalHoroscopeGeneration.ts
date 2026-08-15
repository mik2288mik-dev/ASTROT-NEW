import type { UserProfile } from '../types';
import {
  AI_PERSONAL_HOROSCOPE_CACHE_VERSION,
  AI_PERSONAL_HOROSCOPE_CONTRACT_VERSION,
  AI_PERSONAL_HOROSCOPE_PROMPT_VERSION,
  AI_PERSONAL_HOROSCOPE_VERSION,
  buildAiPersonalHoroscopeContinuity,
  formatAiPersonalHoroscopeDateLabel,
  type AiPersonalHoroscopePackage,
  type AiPersonalHoroscopePeriod,
  type AiPersonalHoroscopeRecentMemory,
  type AiPersonalHoroscopeWindow,
} from './aiPersonalHoroscope';
import {
  AI_PERSONAL_HOROSCOPE_RESPONSE_SCHEMA,
  AI_PERSONAL_HOROSCOPE_RESPONSE_SCHEMA_NAME,
  buildAiPersonalHoroscopePrompt,
  getAiPersonalHoroscopeSystemPrompt,
  validateAiPersonalHoroscopePayload,
  type GeneratedHoroscopePayload,
  type ValidatedHoroscope,
} from './aiPersonalHoroscopeVoice';
import { OPENAI_LUNA_MODEL } from './openai-models';
import { createLunaStructuredResponse } from './openaiResponses';

export {
  buildAiPersonalHoroscopePrompt,
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

function maxOutputTokens(period: AiPersonalHoroscopePeriod): number {
  if (period === 'day') return 2_000;
  if (period === 'week') return 2_600;
  return 3_200;
}

function buildPackage(input: {
  profile: UserProfile;
  period: AiPersonalHoroscopePeriod;
  window: AiPersonalHoroscopeWindow;
  reading: ValidatedHoroscope;
  attempts: 1 | 2;
}): AiPersonalHoroscopePackage {
  return {
    version: AI_PERSONAL_HOROSCOPE_VERSION,
    period: input.period,
    periodKey: input.window.periodKey,
    periodStart: input.window.periodStart,
    periodEnd: input.window.periodEnd,
    dateLabel: formatAiPersonalHoroscopeDateLabel(
      input.window,
      input.profile.language === 'en' ? 'en' : 'ru',
    ),
    timezone: input.window.timezone,
    reading: input.reading,
    continuity: buildAiPersonalHoroscopeContinuity(input.reading, input.profile),
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
  recentMemory?: AiPersonalHoroscopeRecentMemory[];
  onMetrics?: (metrics: AiPersonalHoroscopeGenerationMetrics) => void;
}): Promise<AiPersonalHoroscopePackage> {
  const language: 'ru' | 'en' = input.profile.language === 'en' ? 'en' : 'ru';
  let repairHints: string[] = [];
  let incompleteSeen = false;

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
          recentMemory: input.recentMemory,
          repairHints,
        }),
        maxOutputTokens: maxOutputTokens(input.period),
        schemaName: AI_PERSONAL_HOROSCOPE_RESPONSE_SCHEMA_NAME,
        schema: AI_PERSONAL_HOROSCOPE_RESPONSE_SCHEMA,
      });

      let parsed: GeneratedHoroscopePayload;
      try {
        parsed = JSON.parse(response.content) as GeneratedHoroscopePayload;
      } catch {
        repairHints = ['invalid_json'];
        input.onMetrics?.({
          model: OPENAI_LUNA_MODEL,
          inputTokens: response.inputTokens,
          outputTokens: response.outputTokens,
          latencyMs: Date.now() - startedAt,
          validationPassed: false,
        });
        continue;
      }

      const validated = validateAiPersonalHoroscopePayload(parsed, { language });
      input.onMetrics?.({
        model: OPENAI_LUNA_MODEL,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        latencyMs: Date.now() - startedAt,
        validationPassed: !!validated.value,
      });
      if (!validated.value) {
        repairHints = validated.errors;
        console.warn('[ai-personal-horoscope] Luna response rejected by basic safety checks', {
          period: input.period,
          periodKey: input.window.periodKey,
          attempt,
          errors: repairHints,
        });
        continue;
      }

      return buildPackage({
        profile: input.profile,
        period: input.period,
        window: input.window,
        reading: validated.value,
        attempts: attempt as 1 | 2,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('OPENAI_RESPONSE_INCOMPLETE')) incompleteSeen = true;
      repairHints = [message.includes('OPENAI_RESPONSE_REFUSAL')
        ? 'provider_refusal'
        : message.includes('OPENAI_RESPONSE_EMPTY')
          ? 'empty_response'
          : 'provider_error'];
      console.warn('[ai-personal-horoscope] Luna request failed', {
        period: input.period,
        periodKey: input.window.periodKey,
        attempt,
        code: repairHints[0],
      });
    }
  }

  if (incompleteSeen) throw new Error('PERSONAL_HOROSCOPE_WRITER_INCOMPLETE');
  throw new Error(`PERSONAL_HOROSCOPE_WRITER_VALIDATION_FAILED:${repairHints.join('|')}`);
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
