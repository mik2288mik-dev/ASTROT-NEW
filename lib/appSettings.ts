import type {
  ContentAccessTier,
  ContentModelTier,
  ContentSurface,
  ContentVariant,
} from '../types';
import { db } from './db';
import type { AiContentModelTier } from './contentMatrix';
import {
  DAILY_CANVAS_MODEL_SETTING_KEY,
  DEFAULT_PREMIUM_INTERPRETATION_MODEL,
  getDailyCanvasModelFromEnv,
  getInterpretationModelFromEnv,
  INTERPRETATION_MODEL_SETTING_KEY,
  normalizeInterpretationModelId,
} from './openai-models';

let cachedInterpretationModel: string | null = null;
let cacheLoaded = false;
let dailyCanvasModelCache: string | null = null;
const tierModelCache = new Map<AiContentModelTier, string>();

export const MODEL_TIER_SETTING_KEYS: Record<AiContentModelTier, string> = {
  fast: 'openai_model_fast',
  main: INTERPRETATION_MODEL_SETTING_KEY,
  deep: 'openai_model_deep',
};

// Слот полотна (личный разбор дня) не входит в fast/main/deep — у него отдельный ключ.
// Единая карта слот→ключ для админского редактора моделей.
export type ModelSlot = AiContentModelTier | 'daily_canvas';
export const MODEL_SLOT_SETTING_KEYS: Record<ModelSlot, string> = {
  ...MODEL_TIER_SETTING_KEYS,
  daily_canvas: DAILY_CANVAS_MODEL_SETTING_KEY,
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

/**
 * Модель личного дневного полотна. Приоритет: app_settings (БД) → env → дефолт — тот же
 * контракт, что и getModelForTier. Асинхронный (в отличие от старого env-only геттера),
 * поэтому call-site (generateDailyCanvas) должен await'ить.
 */
export async function getDailyCanvasModelResolved(): Promise<string> {
  if (dailyCanvasModelCache) return dailyCanvasModelCache;
  try {
    const row = await db.app_settings.get(DAILY_CANVAS_MODEL_SETTING_KEY);
    const configured = normalizeInterpretationModelId(row?.value);
    if (configured) {
      dailyCanvasModelCache = configured;
      return configured;
    }
  } catch {
    // DB unavailable — env/default fallback.
  }
  const model = getDailyCanvasModelFromEnv();
  dailyCanvasModelCache = model;
  return model;
}

/**
 * Сохраняет модель для слота (fast/main/deep/daily_canvas) в app_settings и сбрасывает кэши,
 * чтобы новое значение подхватилось на лету (без редеплоя). model уже должен быть валидным id.
 */
export async function setModelForSlot(slot: ModelSlot, model: string): Promise<void> {
  await db.app_settings.set(MODEL_SLOT_SETTING_KEYS[slot], model);
  invalidateInterpretationModelCache();
}

export function invalidateInterpretationModelCache(): void {
  cachedInterpretationModel = null;
  cacheLoaded = false;
  dailyCanvasModelCache = null;
  tierModelCache.clear();
}



function getTierEnvModel(tier: AiContentModelTier): string | null {
  const envKey = tier === 'fast' ? 'OPENAI_FAST_MODEL' : tier === 'main' ? 'OPENAI_MAIN_MODEL' : 'OPENAI_DEEP_MODEL';
  return normalizeInterpretationModelId(process.env[envKey]);
}

/** Single model resolver for all new content-generation code. */
export async function getModelForTier(tier: AiContentModelTier): Promise<string> {
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
  const tier: AiContentModelTier =
    (options.contentSurface === 'natal' || options.contentSurface === 'synastry') && options.contentVariant === 'full'
      ? 'deep'
      : options.accessTier === 'premium'
        ? 'main'
        : 'fast';
  const model = await getModelForTier(tier);
  const premiumModel = await getModelForTier('deep');
  return { model, modelTier: model === premiumModel ? 'premium' : 'base' };
}
