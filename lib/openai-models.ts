/**
 * OpenAI chat models for Lumia AI interpretations (admin-configurable + env fallback).
 */

export const DEFAULT_INTERPRETATION_MODEL = 'gpt-5.4-mini';
export const DEFAULT_PREMIUM_INTERPRETATION_MODEL = 'gpt-5.4';
export const DEFAULT_WHEEL_INSIGHT_MODEL = 'gpt-5.5';

export const INTERPRETATION_MODEL_SETTING_KEY = 'openai_interpretation_model';

/** Curated list: GPT-4 family through GPT-5.5 variants (exact API ids depend on OpenAI account). */
export const INTERPRETATION_MODEL_OPTIONS: Array<{ id: string; label: string }> = [
  { id: 'gpt-4o', label: 'GPT-4o' },
  { id: 'gpt-4o-mini', label: 'GPT-4o mini' },
  { id: 'gpt-4.1', label: 'GPT-4.1' },
  { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini' },
  { id: 'gpt-4.1-nano', label: 'GPT-4.1 nano' },
  { id: 'gpt-5', label: 'GPT-5' },
  { id: 'gpt-5-mini', label: 'GPT-5 mini' },
  { id: 'gpt-5-nano', label: 'GPT-5 nano' },
  { id: 'gpt-5.1', label: 'GPT-5.1' },
  { id: 'gpt-5.1-mini', label: 'GPT-5.1 mini' },
  { id: 'gpt-5.2', label: 'GPT-5.2' },
  { id: 'gpt-5.2-mini', label: 'GPT-5.2 mini' },
  { id: 'gpt-5.3-chat-latest', label: 'GPT-5.3 chat (latest)' },
  { id: 'gpt-5.4', label: 'GPT-5.4' },
  { id: 'gpt-5.4-mini', label: 'GPT-5.4 mini' },
  { id: 'gpt-5.4-nano', label: 'GPT-5.4 nano' },
  { id: 'gpt-5.5', label: 'GPT-5.5' },
];

const ALLOWED_IDS = new Set(INTERPRETATION_MODEL_OPTIONS.map((m) => m.id));

export function normalizeInterpretationModelId(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const t = raw.trim();
  return t && ALLOWED_IDS.has(t) ? t : null;
}

export function getInterpretationModelFromEnv(): string {
  return normalizeInterpretationModelId(process.env.OPENAI_INTERPRETATION_MODEL) || DEFAULT_INTERPRETATION_MODEL;
}
