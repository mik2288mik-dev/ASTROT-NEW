import type { NatalChartDataV2 } from '../natalChartV2Types';
import { buildNatalInterpretation, type NatalInterpretation, type NatalMeaning } from '../natalInterpretation';
import { getNatalStorySystemPrompt } from '../voice/contracts/natal';
import { hasCoreVoiceViolation } from '../voice/validators';
import { createLunaStructuredResponse, type StrictJsonSchema } from '../openaiResponses';
import {
  NATAL_UNIFIED_READING_CONTRACT_VERSION,
  type NatalUnifiedReading,
  type NatalUnifiedReadingTier,
  type NatalUnifiedStoryBlock,
  type NatalUnifiedTopicSection,
  type NatalUnifiedWriterPlan,
  type NatalUnifiedWriterPlanBlock,
} from './unifiedReading';

const STORY_CHUNK_SIZE = 7;
const TOPIC_CHUNK_SIZE = 6;
const MAX_WRITER_ATTEMPTS = 2;

type RawBlock = { id?: unknown; text?: unknown; meaning_ids?: unknown };
type RawTopic = { key?: unknown; title?: unknown; blocks?: RawBlock[] };
type RawPayload = { story?: RawBlock[]; topics?: RawTopic[] };

const WRITER_SCHEMA: StrictJsonSchema = {
  type: 'object',
  properties: {
    story: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          text: { type: 'string' },
          meaning_ids: { type: 'array', items: { type: 'string' } },
        },
        required: ['id', 'text', 'meaning_ids'],
        additionalProperties: false,
      },
    },
    topics: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          title: { type: 'string' },
          blocks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                text: { type: 'string' },
                meaning_ids: { type: 'array', items: { type: 'string' } },
              },
              required: ['id', 'text', 'meaning_ids'],
              additionalProperties: false,
            },
          },
        },
        required: ['key', 'title', 'blocks'],
        additionalProperties: false,
      },
    },
  },
  required: ['story', 'topics'],
  additionalProperties: false,
};

function chunks(values: readonly string[], size: number): string[][] {
  const out: string[][] = [];
  for (let index = 0; index < values.length; index += size) {
    out.push(values.slice(index, index + size));
  }
  return out;
}

export function buildNatalUnifiedWriterPlan(
  interpretation: NatalInterpretation,
  tier: NatalUnifiedReadingTier,
): NatalUnifiedWriterPlan {
  const story = chunks(interpretation.storyMeaningIds, STORY_CHUNK_SIZE).map(
    (meaningIds, index): NatalUnifiedWriterPlanBlock => ({
      id: `story:${index + 1}`,
      meaningIds,
    }),
  );
  const topics = tier === 'premium'
    ? interpretation.topics.map((topic) => ({
        key: topic.key,
        title: topic.title,
        blocks: chunks(topic.meaningIds, TOPIC_CHUNK_SIZE).map((meaningIds, index) => ({
          id: `topic:${topic.key}:${index + 1}`,
          meaningIds,
        })),
      }))
    : [];
  return { story, topics };
}

function meaningMap(interpretation: NatalInterpretation): Map<string, NatalMeaning> {
  return new Map(interpretation.meanings.map((meaning) => [meaning.id, meaning]));
}

function promptPlan(
  interpretation: NatalInterpretation,
  plan: NatalUnifiedWriterPlan,
  tier: NatalUnifiedReadingTier,
  errors: readonly string[] = [],
): string {
  const byId = meaningMap(interpretation);
  const hydrate = (block: NatalUnifiedWriterPlanBlock) => ({
    id: block.id,
    meaning_ids: block.meaningIds,
    allowed_meanings: block.meaningIds.map((id) => {
      const meaning = byId.get(id)!;
      return { id: meaning.id, scope: meaning.scope, meaning: meaning.text };
    }),
  });
  const payload = {
    tier,
    rule: 'Every supplied meaning must be represented. Do not add new meaning.',
    story: plan.story.map(hydrate),
    topics: plan.topics.map((topic) => ({
      key: topic.key,
      title: topic.title,
      blocks: topic.blocks.map(hydrate),
    })),
  };
  return `TASK:
Rewrite the approved meanings below into normal NEBO copy.

STRICT RULES:
- You are a writer, not an astrologer. The allowed_meanings already contain the interpretation.
- Do not infer any new trait, cause, motive, biography, event, problem, fear, relationship history, profession, income, or diagnosis.
- Respect each meaning scope. "background" still must be included, but it must stay a background modifier rather than be inflated into a strong personal claim. "structural" describes how a chart area is organised, not a standalone personality diagnosis.
- Do not omit meaning IDs and do not move IDs between blocks.
- Each output block must keep exactly the supplied id and meaning_ids.
- The story is one coherent portrait. Connect ideas naturally, but preserve every supplied meaning.
- Topics are the same meanings grouped for navigation, not a second interpretation.
- Main text contains no astrology terminology.
- Do not force conflict, negativity, positivity, advice, or a motivational ending.
- Do not pad to a target word count. Write as much as needed to express every supplied meaning without repetition.
- Return JSON only.

INPUT:
${JSON.stringify(payload, null, 2)}${errors.length ? `

PREVIOUS OUTPUT WAS REJECTED:
${errors.join('\n')}
Write a new candidate and fix every issue.` : ''}`;
}

const VISIBLE_ASTROLOGY = /(?:солнц\p{L}*|лун\p{L}*|меркур\p{L}*|венер\p{L}*|марс\p{L}*|юпитер\p{L}*|сатурн\p{L}*|уран\p{L}*|нептун\p{L}*|плутон\p{L}*|хирон\p{L}*|узел\p{L}*|асцендент|десцендент|\bMC\b|\bIC\b|аспект\p{L}*|трин\p{L}*|секстил\p{L}*|квадрат\p{L}*|оппозиц\p{L}*|соединени\p{L}*|\d{1,2}\s+дом\p{L}*|орб\p{L}*|ретроград\p{L}*)/iu;

function sameIds(raw: unknown, expected: readonly string[]): boolean {
  return Array.isArray(raw)
    && raw.length === expected.length
    && raw.every((value, index) => value === expected[index]);
}

function validateCopy(value: string): boolean {
  const text = value.trim();
  return text.length >= 30
    && text.length <= 2200
    && !VISIBLE_ASTROLOGY.test(text)
    && !hasCoreVoiceViolation(text);
}

export function materializeNatalUnifiedReading(input: {
  raw: RawPayload;
  interpretation: NatalInterpretation;
  tier: NatalUnifiedReadingTier;
  plan: NatalUnifiedWriterPlan;
}): { reading: NatalUnifiedReading | null; errors: string[] } {
  const errors: string[] = [];
  const storyRaw = Array.isArray(input.raw.story) ? input.raw.story : [];
  if (storyRaw.length !== input.plan.story.length) {
    errors.push('story block count changed');
  }

  const story: NatalUnifiedStoryBlock[] = [];
  for (const [index, expected] of input.plan.story.entries()) {
    const raw = storyRaw[index];
    const text = typeof raw?.text === 'string' ? raw.text.trim() : '';
    if (raw?.id !== expected.id) errors.push(`${expected.id}: id changed`);
    if (!sameIds(raw?.meaning_ids, expected.meaningIds)) {
      errors.push(`${expected.id}: meaning ids changed`);
    }
    if (!validateCopy(text)) errors.push(`${expected.id}: copy failed validation`);
    if (
      raw?.id === expected.id
      && sameIds(raw?.meaning_ids, expected.meaningIds)
      && validateCopy(text)
    ) {
      story.push({ id: expected.id, text, meaningIds: [...expected.meaningIds] });
    }
  }

  const rawTopics = Array.isArray(input.raw.topics) ? input.raw.topics : [];
  if (rawTopics.length !== input.plan.topics.length) {
    errors.push('topic count changed');
  }
  const topics: NatalUnifiedTopicSection[] = [];
  for (const [topicIndex, expectedTopic] of input.plan.topics.entries()) {
    const rawTopic = rawTopics[topicIndex];
    if (rawTopic?.key !== expectedTopic.key) errors.push(`${expectedTopic.key}: topic key changed`);
    if (rawTopic?.title !== expectedTopic.title) errors.push(`${expectedTopic.key}: topic title changed`);
    const rawBlocks = Array.isArray(rawTopic?.blocks) ? rawTopic!.blocks! : [];
    if (rawBlocks.length !== expectedTopic.blocks.length) {
      errors.push(`${expectedTopic.key}: block count changed`);
    }
    const blocks: NatalUnifiedStoryBlock[] = [];
    for (const [blockIndex, expected] of expectedTopic.blocks.entries()) {
      const raw = rawBlocks[blockIndex];
      const text = typeof raw?.text === 'string' ? raw.text.trim() : '';
      if (raw?.id !== expected.id) errors.push(`${expected.id}: id changed`);
      if (!sameIds(raw?.meaning_ids, expected.meaningIds)) errors.push(`${expected.id}: meaning ids changed`);
      if (!validateCopy(text)) errors.push(`${expected.id}: copy failed validation`);
      if (
        raw?.id === expected.id
        && sameIds(raw?.meaning_ids, expected.meaningIds)
        && validateCopy(text)
      ) {
        blocks.push({ id: expected.id, text, meaningIds: [...expected.meaningIds] });
      }
    }
    if (
      rawTopic?.key === expectedTopic.key
      && rawTopic?.title === expectedTopic.title
      && blocks.length === expectedTopic.blocks.length
    ) {
      topics.push({ key: expectedTopic.key, title: expectedTopic.title, blocks });
    }
  }

  if (errors.length) return { reading: null, errors };

  return {
    errors: [],
    reading: {
      schemaVersion: 'natal-unified-reading-v1',
      contractVersion: NATAL_UNIFIED_READING_CONTRACT_VERSION,
      interpretationVersion: interpretation.schemaVersion,
      tier: input.tier,
      story,
      topics,
      meaningIds: [...input.interpretation.storyMeaningIds],
      evidenceIds: input.interpretation.evidence.map((fact) => fact.id),
    },
  };
}

function deterministicFallback(
  interpretation: NatalInterpretation,
  tier: NatalUnifiedReadingTier,
  plan: NatalUnifiedWriterPlan,
): NatalUnifiedReading {
  const byId = meaningMap(interpretation);
  const render = (block: NatalUnifiedWriterPlanBlock): NatalUnifiedStoryBlock => ({
    id: block.id,
    text: block.meaningIds.map((id) => byId.get(id)!.text).join(' '),
    meaningIds: [...block.meaningIds],
  });
  return {
    schemaVersion: 'natal-unified-reading-v1',
    contractVersion: NATAL_UNIFIED_READING_CONTRACT_VERSION,
    interpretationVersion: interpretation.schemaVersion,
    tier,
    story: plan.story.map(render),
    topics: plan.topics.map((topic) => ({
      key: topic.key,
      title: topic.title,
      blocks: topic.blocks.map(render),
    })),
    meaningIds: [...interpretation.storyMeaningIds],
    evidenceIds: interpretation.evidence.map((fact) => fact.id),
  };
}

export async function generateNatalUnifiedReading(input: {
  chart: NatalChartDataV2;
  language?: 'ru' | 'en';
  tier: NatalUnifiedReadingTier;
}): Promise<NatalUnifiedReading> {
  const language = input.language === 'en' ? 'en' : 'ru';
  const interpretation = buildNatalInterpretation(input.chart, language);
  const plan = buildNatalUnifiedWriterPlan(interpretation, input.tier);
  let errors: string[] = [];

  for (let attempt = 0; attempt < MAX_WRITER_ATTEMPTS; attempt += 1) {
    const response = await createLunaStructuredResponse({
      instructions: getNatalStorySystemPrompt(language),
      input: promptPlan(interpretation, plan, input.tier, errors),
      maxOutputTokens: input.tier === 'premium' ? 6500 : 3500,
      reasoningEffort: 'medium',
      verbosity: 'medium',
      schemaName: 'natal_unified_reading',
      schema: WRITER_SCHEMA,
    });
    let raw: RawPayload;
    try {
      raw = JSON.parse(response.content) as RawPayload;
    } catch {
      errors = ['invalid JSON'];
      continue;
    }
    const materialized = materializeNatalUnifiedReading({
      raw,
      interpretation,
      tier: input.tier,
      plan,
    });
    if (materialized.reading) return materialized.reading;
    errors = materialized.errors;
  }

  return deterministicFallback(interpretation, input.tier, plan);
}
