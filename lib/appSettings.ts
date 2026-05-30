import type {
  ContentAccessTier,
  ContentModelTier,
  ContentSurface,
  ContentVariant,
} from '../types';
import { db } from './db';
import {
  DEFAULT_INTERPRETATION_MODEL,
  DEFAULT_PREMIUM_INTERPRETATION_MODEL,
  getInterpretationModelFromEnv,
  INTERPRETATION_MODEL_SETTING_KEY,
  normalizeInterpretationModelId,
} from './openai-models';

let cachedInterpretationModel: string | null = null;
let cacheLoaded = false;

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
  const sharedModel = await getOpenAIInterpretationModel();
  const isNatalAnchor = options.contentSurface === 'natal' && options.contentVariant === 'anchor';
  const isNatalLiving = options.contentSurface === 'natal' && options.contentVariant === 'living';
  const isNatalFull = options.contentSurface === 'natal' && options.contentVariant === 'full';
  const premiumModel =
    getConfiguredEnvModel('OPENAI_PREMIUM_MODEL') ||
    (isNatalFull || sharedModel === DEFAULT_INTERPRETATION_MODEL
      ? DEFAULT_PREMIUM_INTERPRETATION_MODEL
      : sharedModel);
  const freeHighQualityModel =
    getConfiguredEnvModel('OPENAI_FREE_MODEL') ||
    (isNatalAnchor || isNatalLiving ? DEFAULT_INTERPRETATION_MODEL : null) ||
    sharedModel ||
    getConfiguredEnvModel('OPENAI_BASE_MODEL') ||
    premiumModel;

  if (options.accessTier === 'premium') {
    if (isNatalLiving) {
      return {
        model: freeHighQualityModel,
        modelTier: freeHighQualityModel === premiumModel ? 'premium' : 'base',
      };
    }

    return {
      model: premiumModel,
      modelTier: 'premium',
    };
  }

  return {
    model: freeHighQualityModel,
    modelTier: freeHighQualityModel === premiumModel ? 'premium' : 'base',
  };
}
