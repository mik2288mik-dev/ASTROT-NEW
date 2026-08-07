/** Curated model IDs accepted by the unified content-model setting. */

/** Curated list: GPT-4 family through GPT-5.5 variants (exact API ids depend on OpenAI account). */
export const INTERPRETATION_MODEL_OPTIONS: Array<{ id: string; label: string }> = [
  { id: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash' },
  { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
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
  { id: 'gpt-5.6-luna', label: 'GPT-5.6 Luna' },
];

const ALLOWED_IDS = new Set(INTERPRETATION_MODEL_OPTIONS.map((m) => m.id));

export function normalizeInterpretationModelId(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const t = raw.trim();
  return t && ALLOWED_IDS.has(t) ? t : null;
}
