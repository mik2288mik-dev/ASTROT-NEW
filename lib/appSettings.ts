import type {
  ContentAccessTier,
  ContentModelTier,
  ContentSurface,
  ContentVariant,
} from '../types';
import { db } from './db';
import type { LumiaModelTier } from './contentMatrix';
import {
  DEFAULT_INTERPRETATION_MODEL,
  DEFAULT_PREMIUM_INTERPRETATION_MODEL,
  getInterpretationModelFromEnv,
  INTERPRETATION_MODEL_SETTING_KEY,
  normalizeInterpretationModelId,
} from './openai-models';

let cachedInterpretationModel: string | null = null;
let cacheLoaded = false;
const tierModelCache = new Map<LumiaModelTier, string>();

export const MODEL_TIER_SETTING_KEYS: Record<LumiaModelTier, string> = {
  fast: 'openai_model_fast',
  main: INTERPRETATION_MODEL_SETTING_KEY,
  deep: 'openai_model_deep',
};

export async function getOpenAIInterpretationModel(): Promise<string> {
  if (cacheLoaded && cachedInterpretationModel) {
    return cachedInterpretationModel;
  }

  try {
    const row = await db.app_settings.get(INTERPRETATION_MODEL_SETTING_KEY);
    const fromDb = normalizeInterpretationModelId(row?.value);
    if (fromDb) {
      cachedInterpretationModel = fromDb;
      cacheLoaded = true;
      return fromDb;
    }
  } catch {
    // DB unavailable — fall through to env
  }

  const fallback = getInterpretationModelFromEnv();
  cachedInterpretationModel = fallback;
  cacheLoaded = true;
  return fallback;
}

export function invalidateInterpretationModelCache(): void {
  cachedInterpretationModel = null;
  cacheLoaded = false;
  tierModelCache.clear();
}



function getTierEnvModel(tier: LumiaModelTier): string | null {
  const envKey = tier === 'fast' ? 'OPENAI_FAST_MODEL' : tier === 'main' ? 'OPENAI_MAIN_MODEL' : 'OPENAI_DEEP_MODEL';
  return normalizeInterpretationModelId(process.env[envKey]);
}

/** Single model resolver for all new content-generation code. */
export async function getModelForTier(tier: LumiaModelTier): Promise<string> {
  const cached = tierModelCache.get(tier);
  if (cached) return cached;

  try {
    const row = await db.app_settings.get(MODEL_TIER_SETTING_KEYS[tier]);
    const configured = normalizeInterpretationModelId(row?.value);
    if (configured) {
      tierModelCache.set(tier, configured);
      return configured;
    }
  } catch {
    // DB unavailable — use safe environment/default fallback.
  }

  const mainModel = getTierEnvModel('main') || await getOpenAIInterpretationModel();
  const model = tier === 'fast'
    ? getTierEnvModel('fast') || getConfiguredEnvModel('OPENAI_FREE_MODEL') || getConfiguredEnvModel('OPENAI_BASE_MODEL') || mainModel
    : tier === 'deep'
      ? getTierEnvModel('deep') || getConfiguredEnvModel('OPENAI_PREMIUM_MODEL') || DEFAULT_PREMIUM_INTERPRETATION_MODEL
      : mainModel;
  tierModelCache.set(tier, model);
  return model;
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

function getConfiguredEnvModel(
  key: 'OPENAI_BASE_MODEL' | 'OPENAI_FREE_MODEL' | 'OPENAI_PREMIUM_MODEL'
): string | null {
  return normalizeInterpretationModelId(process.env[key]);
}

export async function getOpenAIModelForContent(
  options: OpenAIContentModelOptions
): Promise<OpenAIContentModelAssignment> {
  const tier: LumiaModelTier =
    (options.contentSurface === 'natal' || options.contentSurface === 'synastry') && options.contentVariant === 'full'
      ? 'deep'
      : options.accessTier === 'premium'
        ? 'main'
        : 'fast';
  const model = await getModelForTier(tier);
  const premiumModel = await getModelForTier('deep');
  return { model, modelTier: model === premiumModel ? 'premium' : 'base' };
}
