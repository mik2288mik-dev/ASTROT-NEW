import type {
  ContentAccessTier,
  ContentModelTier,
  ContentSurface,
  ContentVariant,
} from '../types';
import { db } from './db';
import type { AiContentModelTier } from './contentMatrix';
import { normalizeInterpretationModelId } from './openai-models';

/**
 * One model writes every user-facing generated text in the application.
 *
 * Astrology calculations remain deterministic code. This setting controls only
 * the model that explains those calculations: personal forecasts, natal chart,
 * synastry, and sign horoscopes.
 *
 * Resolution order: app_settings -> OPENAI_CONTENT_MODEL -> fixed default.
 * Legacy per-slot DB/env values are intentionally ignored so different product
 * surfaces cannot silently drift to different voices again.
 */
export const UNIFIED_CONTENT_MODEL_SETTING_KEY = 'ai_content_model';
export const DEFAULT_UNIFIED_CONTENT_MODEL = 'gpt-4.1';

let cachedContentModel: string | null = null;

export const MODEL_TIER_SETTING_KEYS: Record<AiContentModelTier, string> = {
  fast: UNIFIED_CONTENT_MODEL_SETTING_KEY,
  main: UNIFIED_CONTENT_MODEL_SETTING_KEY,
  deep: UNIFIED_CONTENT_MODEL_SETTING_KEY,
};

export type ModelSlot = AiContentModelTier;
export const MODEL_SLOT_SETTING_KEYS: Record<ModelSlot, string> = {
  fast: UNIFIED_CONTENT_MODEL_SETTING_KEY,
  main: UNIFIED_CONTENT_MODEL_SETTING_KEY,
  deep: UNIFIED_CONTENT_MODEL_SETTING_KEY,
};

function getUnifiedContentModelFromEnv(): string {
  return normalizeInterpretationModelId(process.env.AI_CONTENT_MODEL)
    || normalizeInterpretationModelId(process.env.OPENAI_CONTENT_MODEL)
    || (process.env.DEEPSEEK_API_KEY ? 'deepseek-v4-flash' : null)
    || DEFAULT_UNIFIED_CONTENT_MODEL;
}

export async function getUnifiedContentModel(): Promise<string> {
  if (cachedContentModel) return cachedContentModel;

  try {
    const row = await db.app_settings.get(UNIFIED_CONTENT_MODEL_SETTING_KEY)
      || await db.app_settings.get('openai_content_model');
    const configured = normalizeInterpretationModelId(row?.value);
    if (configured) {
      cachedContentModel = configured;
      return configured;
    }
  } catch {
    // DB unavailable — use environment/default fallback.
  }

  cachedContentModel = getUnifiedContentModelFromEnv();
  return cachedContentModel;
}

/** Backward-compatible resolver used by older generation code. */
export async function getOpenAIInterpretationModel(): Promise<string> {
  return getUnifiedContentModel();
}

/**
 * Any admin slot update changes the one global model and immediately clears
 * the in-process cache. The slot argument is intentionally ignored because
 * every user-facing surface shares the same author model.
 */
export async function setModelForSlot(_slot: ModelSlot, model: string): Promise<void> {
  await db.app_settings.set(UNIFIED_CONTENT_MODEL_SETTING_KEY, model);
  invalidateInterpretationModelCache();
}

export function invalidateInterpretationModelCache(): void {
  cachedContentModel = null;
}

/** All content tiers resolve to one model. Tiers still describe product access. */
export async function getModelForTier(_tier: AiContentModelTier): Promise<string> {
  return getUnifiedContentModel();
}

type OpenAIContentModelOptions = {
  accessTier: ContentAccessTier;
  contentSurface?: ContentSurface;
  contentVariant?: ContentVariant;
};

export type OpenAIContentModelAssignment = {
  model: string;
  modelTier: ContentModelTier;
};

export async function getOpenAIModelForContent(
  options: OpenAIContentModelOptions
): Promise<OpenAIContentModelAssignment> {
  const model = await getUnifiedContentModel();

  // Preserve the access/cache classification even though the author model is
  // the same. Free and Premium content must not collapse into one cache tier.
  const modelTier: ContentModelTier = options.accessTier === 'premium' ? 'premium' : 'base';
  return { model, modelTier };
}
