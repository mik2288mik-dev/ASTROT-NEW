import { NATAL_INTERPRETATION_VERSION, type NatalMeaningTopic } from '../natalInterpretation';

export const NATAL_UNIFIED_READING_CONTRACT_VERSION = 'natal-unified-reading-v2';
// Provenance for new writing, never an expiry rule for a saved reading.
export const NATAL_UNIFIED_READING_PROMPT_VERSION = `${NATAL_UNIFIED_READING_CONTRACT_VERSION}.writer.v4`;
export const NATAL_UNIFIED_READING_CACHE_KEY = 'natal.unified-reading.v3';

export type NatalUnifiedReadingTier = 'free' | 'premium';

export const NATAL_UNIFIED_FREE_STORY_RATIO = 0.45;

export function natalUnifiedFreeStoryBlockCount(total: number): number {
  if (total <= 1) return Math.max(0, total);
  return Math.max(1, Math.min(total - 1, Math.ceil(total * NATAL_UNIFIED_FREE_STORY_RATIO)));
}

export type NatalUnifiedStoryBlock = {
  id: string;
  text: string;
  meaningIds: string[];
};

export type NatalUnifiedTopicSection = {
  key: NatalMeaningTopic;
  title: string;
  blocks: NatalUnifiedStoryBlock[];
};

export type NatalUnifiedReading = {
  schemaVersion: 'natal-unified-reading-v1';
  contractVersion: typeof NATAL_UNIFIED_READING_CONTRACT_VERSION;
  interpretationVersion: typeof NATAL_INTERPRETATION_VERSION;
  tier: NatalUnifiedReadingTier;
  story: NatalUnifiedStoryBlock[];
  topics: NatalUnifiedTopicSection[];
  meaningIds: string[];
  evidenceIds: string[];
};

export function projectNatalUnifiedReadingForTier(
  reading: NatalUnifiedReading,
  tier: NatalUnifiedReadingTier,
): NatalUnifiedReading {
  if (tier === 'premium') {
    return reading.tier === 'premium' ? reading : { ...reading, tier: 'premium' };
  }

  const story = reading.story.slice(0, natalUnifiedFreeStoryBlockCount(reading.story.length));
  const meaningIds = [...new Set(story.flatMap((block) => block.meaningIds))];
  return {
    ...reading,
    tier: 'free',
    story,
    topics: [],
    meaningIds,
  };
}

export type NatalUnifiedWriterPlanBlock = {
  id: string;
  meaningIds: string[];
};

export type NatalUnifiedWriterPlanTopic = {
  key: NatalMeaningTopic;
  title: string;
  blocks: NatalUnifiedWriterPlanBlock[];
};

export type NatalUnifiedWriterPlan = {
  story: NatalUnifiedWriterPlanBlock[];
  topics: NatalUnifiedWriterPlanTopic[];
};

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function validBlock(value: unknown): value is NatalUnifiedStoryBlock {
  if (!value || typeof value !== 'object') return false;
  const block = value as Partial<NatalUnifiedStoryBlock>;
  return typeof block.id === 'string'
    && block.id.length > 0
    && typeof block.text === 'string'
    && block.text.trim().length > 0
    && Array.isArray(block.meaningIds)
    && block.meaningIds.length > 0
    && block.meaningIds.every((id) => typeof id === 'string' && id.length > 0);
}

export function isNatalUnifiedReading(value: unknown): value is NatalUnifiedReading {
  if (!value || typeof value !== 'object') return false;
  const reading = value as Partial<NatalUnifiedReading>;
  return reading.schemaVersion === 'natal-unified-reading-v1'
    && reading.contractVersion === NATAL_UNIFIED_READING_CONTRACT_VERSION
    && reading.interpretationVersion === NATAL_INTERPRETATION_VERSION
    && (reading.tier === 'free' || reading.tier === 'premium')
    && Array.isArray(reading.story)
    && reading.story.length > 0
    && reading.story.every(validBlock)
    && Array.isArray(reading.topics)
    && reading.topics.every((topic) => (
      !!topic
      && typeof topic === 'object'
      && typeof topic.key === 'string'
      && text(topic.title).length > 0
      && Array.isArray(topic.blocks)
      && topic.blocks.length > 0
      && topic.blocks.every(validBlock)
    ))
    && Array.isArray(reading.meaningIds)
    && reading.meaningIds.length > 0
    && reading.meaningIds.every((id) => typeof id === 'string' && id.length > 0)
    && Array.isArray(reading.evidenceIds)
    && reading.evidenceIds.length > 0
    && reading.evidenceIds.every((id) => typeof id === 'string' && id.length > 0);
}
