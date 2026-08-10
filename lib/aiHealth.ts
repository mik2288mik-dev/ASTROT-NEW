import { getAppSystemVoice } from './appVoice';
import { createLunaTextResponse, OPENAI_LUNA_MODEL } from './openaiResponses';

/** Runtime health for the fixed OpenAI Luna route. Zodiac is intentionally separate. */
export type AiContentHealth = {
  openaiKeyPresent: boolean;
  model: string;
  surfaces: Array<{ surface: string; label: string; model: string }>;
  problems: string[];
  checkedAt: string;
};

const SURFACES: Array<{ surface: string; label: string }> = [
  { surface: 'personal_daily', label: 'Личный прогноз' },
  { surface: 'natal_section', label: 'Натальный разбор' },
  { surface: 'sign_compatibility', label: 'Совместимость по знакам' },
  { surface: 'blind_spot', label: 'Слепая зона' },
];

export async function getAiContentHealth(): Promise<AiContentHealth> {
  const openaiKeyPresent = Boolean(process.env.OPENAI_API_KEY);
  const problems = openaiKeyPresent
    ? []
    : ['OPENAI_API_KEY не задан — генерация Luna недоступна, остаются только безопасные фолбэки.'];

  return {
    openaiKeyPresent,
    model: OPENAI_LUNA_MODEL,
    surfaces: SURFACES.map(({ surface, label }) => ({ surface, label, model: OPENAI_LUNA_MODEL })),
    problems,
    checkedAt: new Date().toISOString(),
  };
}

export type AiPingResult = {
  ok: boolean;
  model: string;
  latencyMs: number;
  sample?: string;
  error?: string;
};

/** Calls the same OpenAI Responses API route as the production content writers. */
export async function pingAiGeneration(): Promise<AiPingResult> {
  const started = Date.now();
  if (!process.env.OPENAI_API_KEY) {
    return {
      ok: false,
      model: OPENAI_LUNA_MODEL,
      latencyMs: 0,
      error: 'OPENAI_API_KEY не задан — генерация недоступна.',
    };
  }

  try {
    const response = await createLunaTextResponse({
      instructions: getAppSystemVoice('ru'),
      input: 'Ответь ровно одним словом: работает',
      maxOutputTokens: 16,
    });
    const sample = response.content;
    return {
      ok: Boolean(sample),
      model: OPENAI_LUNA_MODEL,
      latencyMs: Date.now() - started,
      sample: sample.slice(0, 120),
      error: sample ? undefined : 'Модель вернула пустой ответ.',
    };
  } catch (error: unknown) {
    return {
      ok: false,
      model: OPENAI_LUNA_MODEL,
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.message : 'Ошибка вызова OpenAI.',
    };
  }
}
