import type { StrictJsonSchema } from '../openaiResponses';
import type { CalculatedCompatibility } from './compatibilityEngine';
import { selectCompatibilityWriterEvidence } from './compatibilityNarrative';
import type { RelationshipContext } from './relationshipContext';
import { COMPATIBILITY_STORY_TOPICS, compatibilityTopicTitle } from './storyTopics';
import { getCompatibilitySystemPrompt } from '../voice/contracts/compatibility';

export const COMPATIBILITY_STORY_SCHEMA: StrictJsonSchema = {
  type: 'object',
  properties: {
    paragraphs: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          topic: { type: 'string', enum: [...COMPATIBILITY_STORY_TOPICS] },
          text: { type: 'string' },
          evidenceIds: { type: 'array', items: { type: 'string' } },
          direction: { type: 'string', enum: ['mutual', 'subject_to_partner', 'partner_to_subject'] },
        },
        required: ['topic', 'text', 'evidenceIds', 'direction'],
        additionalProperties: false,
      },
    },
  },
  required: ['paragraphs'],
  additionalProperties: false,
};

type WriterPerson = { name: string; gender: 'male' | 'female' | 'unspecified'; birthTimeQuality: 'exact' | 'approximate' | 'unknown' };

export function buildCompatibilityStoryPrompt(input: {
  language: 'ru' | 'en';
  calculated: CalculatedCompatibility;
  subject: WriterPerson;
  partner: WriterPerson;
  revisionReason?: string;
}): { system: string; user: string } {
  const evidence = selectCompatibilityWriterEvidence(input.calculated);
  const availableIds = new Set(evidence.map((item) => item.id));
  
  const system = getCompatibilitySystemPrompt(input.language);
  
  return {
    system,
    user: JSON.stringify({
      people: { subject: input.subject, partner: input.partner },
      relationshipContext: input.calculated.relationshipContext,
      chapterGuide: COMPATIBILITY_STORY_TOPICS.map((topic) => ({ topic, title: compatibilityTopicTitle(topic, input.calculated.relationshipContext, input.language) })),
      calculationLevel: input.calculated.calculationLevel,
      themes: input.calculated.dimensions.map((item) => ({
        id: item.id, label: item.label,
        supportedBy: item.supportiveEvidenceIds.filter((id) => availableIds.has(id)),
        complicatedBy: item.challengingEvidenceIds.filter((id) => availableIds.has(id)),
      })),
      evidence: evidence.map((item) => ({
        id: item.id, type: item.type, direction: item.direction, label: item.label,
        reliability: item.reliability, technical: item.technical,
      })),
      directionalPatterns: input.calculated.directionalPatterns.filter((pattern) => pattern.evidenceIds.every((id) => availableIds.has(id))),
      limitations: input.calculated.limitations,
    }),
  };
}

