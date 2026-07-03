import OpenAI from 'openai';
import { getModelForTier } from './appSettings';
import { getContentPolicy } from './contentMatrix';
import { buildOpenAIChatParams } from './openaiChat';
import type { LumiaModelTier } from './contentMatrix';

/**
 * Здоровье генерации КОНТЕНТА (гороскопы, натальные разборы, прогноз, совместимость).
 *
 * Ключевой факт: КАЖДЫЙ генератор гейтится на `OPENAI_API_KEY` (`? new OpenAI() : null`).
 * Нет ключа/модели в проде → генерация молча пропускается и юзер видит КУРИРУЕМЫЙ ФОЛБЭК
 * (человеческий, но НЕ персонализированный AI). Эта диагностика отвечает на вопрос
 * «реально ли контент генерится персонально» одним экраном + живым пингом.
 */

export type AiContentHealth = {
  openaiKeyPresent: boolean;
  models: { fast: string | null; main: string | null; deep: string | null };
  surfaces: Array<{ surface: string; label: string; tier: LumiaModelTier; model: string | null }>;
  problems: string[];
  checkedAt: string;
};

const SURFACES: Array<{ surface: string; label: string }> = [
  { surface: 'personal_daily', label: 'Личный прогноз дня' },
  { surface: 'natal_section', label: 'Натальный разбор (раздел)' },
  { surface: 'sign_daily_horoscope', label: 'Гороскоп по знаку (день)' },
  { surface: 'sign_compatibility', label: 'Совместимость по знакам' },
  { surface: 'blind_spot', label: 'Слепая зона' },
];

export async function getAiContentHealth(): Promise<AiContentHealth> {
  const openaiKeyPresent = !!process.env.OPENAI_API_KEY;
  const [fast, main, deep] = await Promise.all([
    getModelForTier('fast').catch(() => null),
    getModelForTier('main').catch(() => null),
    getModelForTier('deep').catch(() => null),
  ]);
  const models = { fast, main, deep };

  const surfaces = await Promise.all(
    SURFACES.map(async ({ surface, label }) => {
      let tier: LumiaModelTier = 'main';
      try { tier = getContentPolicy(surface as any).modelTier; } catch { /* default */ }
      const model = tier === 'fast' ? fast : tier === 'deep' ? deep : main;
      return { surface, label, tier, model };
    })
  );

  const problems: string[] = [];
  if (!openaiKeyPresent) problems.push('OPENAI_API_KEY не задан — ВЕСЬ AI-контент падает в курируемый фолбэк (не персонализируется моделью).');
  if (!main) problems.push('Не удалось определить основную модель (main).');

  return { openaiKeyPresent, models, surfaces, problems, checkedAt: new Date().toISOString() };
}

export type AiPingResult = {
  ok: boolean;
  tier: LumiaModelTier;
  model: string | null;
  latencyMs: number;
  sample?: string;
  error?: string;
};

/**
 * Живой сквозной пинг генерации: реально дергает OpenAI выбранной моделью (тем же путём, что и
 * контент — через buildOpenAIChatParams). Доказывает, что ключ/модель/сеть рабочие в проде, и
 * отдаёт дословную ошибку (неверный ключ, нет доступа к модели, rate limit). Стоимость — копейки.
 */
export async function pingAiGeneration(tier: LumiaModelTier = 'main'): Promise<AiPingResult> {
  const started = Date.now();
  if (!process.env.OPENAI_API_KEY) {
    return { ok: false, tier, model: null, latencyMs: 0, error: 'OPENAI_API_KEY не задан — генерация отключена (фолбэк)' };
  }
  let model: string | null = null;
  try {
    model = await getModelForTier(tier);
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await client.chat.completions.create(
      buildOpenAIChatParams(model, {
        messages: [
          { role: 'system', content: 'Ты — генератор контента приложения-астрологии. Отвечай кратко и по делу.' },
          { role: 'user', content: 'Ответь ровно одним словом: работает' },
        ],
        maxTokens: 16,
      })
    );
    const sample = String(completion.choices?.[0]?.message?.content || '').trim();
    return {
      ok: !!sample,
      tier,
      model,
      latencyMs: Date.now() - started,
      sample: sample.slice(0, 120),
      error: sample ? undefined : 'модель вернула пустой ответ',
    };
  } catch (error: any) {
    return { ok: false, tier, model, latencyMs: Date.now() - started, error: error?.message || 'ошибка вызова OpenAI' };
  }
}
