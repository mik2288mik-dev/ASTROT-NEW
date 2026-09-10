/** The one OpenAI model used by all generated content except Zodiac. */
export const OPENAI_LUNA_MODEL = 'gpt-5.6-luna' as const;

/**
 * Legacy per-surface model selection has been removed. Zodiac has its own
 * dedicated DeepSeek route and never appears in this OpenAI-only list.
 */
export const INTERPRETATION_MODEL_OPTIONS: Array<{ id: string; label: string }> = [
  { id: OPENAI_LUNA_MODEL, label: 'OpenAI Luna' },
];

const ALLOWED_IDS = new Set(INTERPRETATION_MODEL_OPTIONS.map((model) => model.id));

export function normalizeInterpretationModelId(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const model = raw.trim();
  return model && ALLOWED_IDS.has(model) ? model : null;
}
