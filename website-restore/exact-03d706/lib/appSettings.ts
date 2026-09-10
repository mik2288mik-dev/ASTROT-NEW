import type {
  ContentAccessTier,
  ContentModelTier,
  ContentSurface,
  ContentVariant,
} from '../types';
import type { AiContentModelTier } from './contentMatrix';
import { OPENAI_LUNA_MODEL } from './openai-models';

export { OPENAI_LUNA_MODEL } from './openai-models';

/** Fixed provider contract: Luna for all generated content except Zodiac. */
export const DEFAULT_UNIFIED_CONTENT_MODEL = OPENAI_LUNA_MODEL;

export async function getUnifiedContentModel(): Promise<string> {
  return OPENAI_LUNA_MODEL;
}

export async function getOpenAIInterpretationModel(): Promise<string> {
  return OPENAI_LUNA_MODEL;
}

/** Access tiers remain product-access metadata, not provider/model selectors. */
export async function getModelForTier(_tier: AiContentModelTier): Promise<string> {
  return OPENAI_LUNA_MODEL;
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
  options: OpenAIContentModelOptions,
): Promise<OpenAIContentModelAssignment> {
  return {
    model: OPENAI_LUNA_MODEL,
    modelTier: options.accessTier === 'premium' ? 'premium' : 'base',
  };
}
