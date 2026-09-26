import type { StrictJsonSchema } from '../openaiResponses';
import type { CalculatedCompatibility } from './compatibilityEngine';
import { selectCompatibilityWriterEvidence } from './compatibilityNarrative';
import type { RelationshipContext } from './relationshipContext';
import { COMPATIBILITY_STORY_TOPICS, compatibilityTopicTitle } from './storyTopics';
import { getCompatibilitySystemPrompt } from '../voice/contracts/compatibility';

export const COMPATIBILITY_STORY_SCHEMA: StrictJsonSchema = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
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
  required: ['summary', 'paragraphs'],
  additionalProperties: false,
};

type WriterPerson = { name: string; gender: 'male' | 'female' | 'unspecified'; birthTimeQuality: 'exact' | 'approximate' | 'unknown' };

const RELATIONSHIP_BRIEFS: Record<RelationshipContext, string> = {
  romance: 'Не считай их парой и не приписывай взаимные чувства: речь только о возможном контакте и знакомстве.',
  relationship: 'Это существующие отношения: говори о повседневном контакте, а не о знакомстве с нуля.',
  ex: 'Не подталкивай к примирению и не предсказывай возвращение.',
  friendship: 'Не превращай дружбу в скрытый роман и не ищи романтику там, где её не просили.',
  family: 'Степень родства и возраст неизвестны: не выдумывай иерархию, заботу родителей или детей.',
  work: 'Не добавляй романтику: разбирай только совместную работу, решения и договорённости.',
};

export function buildCompatibilityStoryPrompt(input: {
  language: 'ru' | 'en';
  calculated: CalculatedCompatibility;
  subject: WriterPerson;
  partner: WriterPerson;
  revisionReason?: string;
}): { system: string; user: string } {
  const evidence = selectCompatibilityWriterEvidence(input.calculated);
  const availableIds = new Set(evidence.map((item) => item.id));
  
  const limitedEvidence = evidence.length < 6;
  const readerRules = input.language === 'ru'
    ? 'Пиши по-русски и обращайся к первому человеку на «ты». При unspecified пиши нейтрально: не приписывай человеку мужской или женский род. Пол меняет обращение, но не назначает характер.'
    : 'Write natural, direct English and address the first person as “you”. When gender is unspecified, use neutral wording and do not infer a gender. Gender changes grammar only, not personality.';
  const system = `${getCompatibilitySystemPrompt(input.language)}

${RELATIONSHIP_BRIEFS[input.calculated.relationshipContext]}
${readerRules}
${limitedEvidence
    ? 'Сделай короткий вывод и 3 коротких раздела.'
    : 'Сделай короткий вывод и 4 коротких раздела.'}${input.revisionReason
    ? `\n\nPREVIOUS OUTPUT WAS REJECTED for ${input.revisionReason}. Correct that exact issue before returning JSON; do not repeat it.`
    : ''}`;
  
  return {
    system,
    user: JSON.stringify({
      people: { subject: input.subject, partner: input.partner },
      relationshipContext: input.calculated.relationshipContext,
      chapterGuide: COMPATIBILITY_STORY_TOPICS.map((topic) => ({ topic, title: compatibilityTopicTitle(topic, input.calculated.relationshipContext, input.language) })),
      calculationLevel: input.calculated.calculationLevel,
      requiredSections: limitedEvidence ? '3' : '4',
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
