import { withCoreVoiceCacheKey, withCoreVoiceVersion } from '../voice/core';
import { NATAL_INTERPRETATION_VERSION, type NatalMeaningTopic } from '../natalInterpretation';

export const NATAL_UNIFIED_READING_CONTRACT_VERSION = 'natal-unified-reading-v1';
export const NATAL_UNIFIED_READING_PROMPT_VERSION = withCoreVoiceVersion(
  `${NATAL_UNIFIED_READING_CONTRACT_VERSION}.writer.v1`,
);
export const NATAL_UNIFIED_READING_CACHE_KEY = withCoreVoiceCacheKey(
  'natal.unified-reading.v1',
);

export type NatalUnifiedReadingTier = 'free' | 'premium';

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
