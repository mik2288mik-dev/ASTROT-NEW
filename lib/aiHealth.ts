import { getNeboCoreVoice } from './voice/core';
import { createLunaTextResponse, getLunaContentProvider } from './openaiResponses';

/** Runtime health for the Luna content route (DeepSeek while OpenAI is off). Zodiac is intentionally separate. */
export type AiContentHealth = {
  /** Whether the active content provider's key is set; the name predates the DeepSeek route. */
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
  const provider = getLunaContentProvider();
  const problems = provider.keyPresent
    ? []
    : [`${provider.keyName} не задан, генерация недоступна, остаются только безопасные фолбэки.`];

  return {
    openaiKeyPresent: provider.keyPresent,
    model: provider.model,
    surfaces: SURFACES.map(({ surface, label }) => ({ surface, label, model: provider.model })),
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

import { recordAiRequest } from './aiLogger';
import { randomUUID } from 'crypto';

/** Calls the same route as the production content writers. */
export async function pingAiGeneration(): Promise<AiPingResult> {
  const started = Date.now();
  const traceId = randomUUID();
  const { provider, model, keyName, keyPresent } = getLunaContentProvider();
  if (!keyPresent) {
    await recordAiRequest({
      traceId,
      scenario: 'content_diagnostic',
      model,
      provider,
      status: 'error',
      durationMs: 0,
      errorCode: `${keyName}_MISSING`,
      rejectionReason: `${keyName} не задан, генерация недоступна.`,
    });
    return {
      ok: false,
      model,
      latencyMs: 0,
      error: `${keyName} не задан, генерация недоступна.`,
    };
  }

  try {
    const response = await createLunaTextResponse({
      instructions: getNeboCoreVoice('ru'),
      input: 'Ответь ровно одним словом: работает',
      maxOutputTokens: 16,
    });
    const sample = response.content;
    const durationMs = Date.now() - started;
    await recordAiRequest({
      traceId,
      scenario: 'content_diagnostic',
      model,
      provider,
      status: sample ? 'success' : 'error',
      durationMs,
      outputText: sample,
      errorCode: sample ? undefined : 'EMPTY_RESPONSE',
    });
    return {
      ok: Boolean(sample),
      model,
      latencyMs: durationMs,
      sample: sample.slice(0, 120),
      error: sample ? undefined : 'Модель вернула пустой ответ.',
    };
  } catch (error: unknown) {
    const durationMs = Date.now() - started;
    const errorMsg = error instanceof Error ? error.message : 'Ошибка вызова модели.';
    await recordAiRequest({
      traceId,
      scenario: 'content_diagnostic',
      model,
      provider,
      status: 'error',
      durationMs,
      errorCode: 'OPENAI_PING_ERROR',
      rejectionReason: errorMsg,
    });
    return {
      ok: false,
      model,
      latencyMs: durationMs,
      error: errorMsg,
    };
  }
}
