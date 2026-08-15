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
  type GeneratedHoroscopePayload,
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
  if (period === 'day') return 850;
  if (period === 'week') return 1_050;
  return 1_250;
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
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('OPENAI_RESPONSE_INCOMPLETE')) incompleteSeen = true;
      repairErrors = [message.slice(0, 240)];
      if (attempt === MAX_ATTEMPTS) break;
    }
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
