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

const STORY_CHUNK_SIZE = 6;
const TOPIC_CHUNK_SIZE = 5;
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
type RawSemanticCheck = { id?: unknown; ok?: unknown; issues?: unknown };
type RawSemanticReview = { checks?: RawSemanticCheck[] };

const SEMANTIC_REVIEW_SCHEMA: StrictJsonSchema = {
  type: 'object',
  properties: {
    checks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          ok: { type: 'boolean' },
          issues: { type: 'array', items: { type: 'string' } },
        },
        required: ['id', 'ok', 'issues'],
        additionalProperties: false,
      },
    },
  },
  required: ['checks'],
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
  language: 'ru' | 'en',
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
    story: plan.story.map(hydrate),
    topics: plan.topics.map((topic) => ({
      key: topic.key,
      title: topic.title,
      blocks: topic.blocks.map(hydrate),
    })),
  };

  const rules = language === 'ru'
    ? `ЗАДАЧА:
Перепиши уже готовые смыслы ниже обычным человеческим русским языком для NEBO.

ЖЁСТКИЕ ПРАВИЛА:
- Ты только редактор. allowed_meanings уже содержат весь разрешённый смысл.
- Каждый переданный смысл обязан остаться в тексте. Нельзя добавлять новый смысл.
- Не додумывай характер, причины поведения, прошлое, отношения, страхи, травмы, диагнозы, профессию, деньги, события или мысли других людей.
- Пиши простыми словами. Без психологических ярлыков, терапевтической лексики, коучинга и абстрактной шелухи.
- Не пиши служебным языком вроде «в этой теме», «это проявляется», «динамика», «сфера», «функция», «карта показывает», «астрологическая трактовка».
- Не давай советы и инструкции человеку.
- Не делай обязательный конфликт, проблему, плюс, минус или вдохновляющий финал.
- background — только фоновая поправка. Не превращай её в сильное утверждение о характере.
- structural — описание устройства конкретной области, а не психологический диагноз.
- В основном тексте не должно быть планет, знаков, домов, аспектов, градусов, орбов или ретроградности.
- Заголовки тем уже заданы. Не переименовывай их и не придумывай новые разделы.
- Рассказ и темы используют один и тот же набор смыслов, а не две разные трактовки.
- Сохрани id и meaning_ids ТОЧНО как во входе и в том же порядке.
- Не раздувай текст. Один понятный смысл лучше трёх красивых предложений.
- Верни только JSON.`
    : `TASK:
Rewrite the approved meanings below into plain, everyday NEBO English.

STRICT RULES:
- You are only an editor. allowed_meanings already contain the complete allowed interpretation.
- Every supplied meaning must remain represented. Add no new meaning.
- Do not invent personality claims, causes, biography, relationship history, fears, trauma, diagnosis, profession, income, events, or other people's thoughts.
- Use ordinary language. No therapy jargon, coaching language, pseudo-psychology, or abstract filler.
- Do not use process/report language such as "this theme", "this manifests", "dynamic", "sphere", "function", "the chart shows", or "astrological interpretation".
- Give no advice or instructions.
- Do not force conflict, problems, positivity, negativity, or a motivational ending.
- Keep background meanings as background modifiers. Do not inflate them into strong personality claims.
- Structural meanings describe a life area, not a psychological diagnosis.
- No visible astrology terminology in the main copy.
- Topic titles are fixed. Do not rename them or invent new sections.
- Story and topics are two views of the same approved meanings, not separate interpretations.
- Keep id and meaning_ids EXACTLY as supplied and in the same order.
- Do not pad the copy.
- Return JSON only.`;

  return `${rules}

INPUT:
${JSON.stringify(payload, null, 2)}${errors.length ? `

PREVIOUS OUTPUT WAS REJECTED:
${errors.join('\\n')}
Write a new candidate and fix every listed issue.` : ''}`;
}

const VISIBLE_ASTROLOGY = /(?:солнц\p{L}*|лун\p{L}*|меркур\p{L}*|венер\p{L}*|марс\p{L}*|юпитер\p{L}*|сатурн\p{L}*|уран\p{L}*|нептун\p{L}*|плутон\p{L}*|хирон\p{L}*|узел\p{L}*|асцендент|десцендент|\bMC\b|\bIC\b|аспект\p{L}*|трин\p{L}*|секстил\p{L}*|квадрат\p{L}*|оппозиц\p{L}*|соединени\p{L}*|\d{1,2}\s+дом\p{L}*|орб\p{L}*|ретроград\p{L}*|\b(?:sun|moon|mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto|chiron|ascendant|descendant|aspect|trine|sextile|square|opposition|conjunction|retrograde)\b)/iu;

const NATAL_PSEUDO_PSYCHOLOGY = /(?:осознанн\p{L}*|ресурс\p{L}*|потенциал\p{L}*|трансформац\p{L}*|проработ\p{L}*|точк\p{L}*\s+рост\p{L}*|личн\p{L}*\s+границ\p{L}*|паттерн\p{L}*|сценари\p{L}*|триггер\p{L}*|травм\p{L}*|субличност\p{L}*|внутренн\p{L}*\s+(?:опор\p{L}*|реб[её]н\p{L}*|мир\p{L}*|ресурс\p{L}*)|глубинн\p{L}*\s+(?:страх\p{L}*|потребност\p{L}*|мотив\p{L}*)|эмоциональн\p{L}*\s+зрел\p{L}*|\b(?:inner\s+child|growth\s+point|personal\s+boundar\w*|trauma|trigger|healing|transformation|potential)\b)/iu;
const NATAL_META_LANGUAGE = /(?:карта\s+(?:показывает|говорит|подсказывает)|астрологическ\p{L}*\s+трактовк\p{L}*|в\s+этой\s+тем\p{L}*|эта\s+тем\p{L}*|может\s+проявляться|проявля\p{L}*\s+как|внутренн\p{L}*\s+динамик\p{L}*|психологическ\p{L}*\s+портрет\p{L}*|\b(?:the\s+chart\s+shows|this\s+theme|may\s+manifest|inner\s+dynamic|astrological\s+interpretation)\b)/iu;
const NATAL_ADVICE_LANGUAGE = /(?:тебе\s+(?:нужно|стоит|следует|важно)|(?:попробуй|старайся|помни|сохраняй|держи|не\s+бойся|позволь\s+себе)\b|\b(?:you\s+should|you\s+need\s+to|try\s+to|remember\s+to|make\s+sure\s+to)\b)/iu;
const NATAL_ABSOLUTE_LANGUAGE = /(?:ты\s+(?:всегда|никогда|точно)\b|у\s+тебя\s+точно\b|на\s+самом\s+деле\s+ты\b|\byou\s+(?:always|never|definitely)\b)/iu;

function sameIds(raw: unknown, expected: readonly string[]): boolean {
  return Array.isArray(raw)
    && raw.length === expected.length
    && raw.every((value, index) => value === expected[index]);
}

function wordCount(value: string): number {
  return value.match(/[\p{L}\p{N}]+/gu)?.length || 0;
}

function validateCopy(
  value: string,
  meaningIds: readonly string[],
  byId: Map<string, NatalMeaning>,
): string | null {
  const text = value.trim();
  if (text.length < 24) return 'copy is too short';
  if (text.length > 2200) return 'copy is too long';
  if (VISIBLE_ASTROLOGY.test(text)) return 'visible astrology leaked into main copy';
  if (hasCoreVoiceViolation(text)) return 'core NEBO voice violation';
  if (NATAL_PSEUDO_PSYCHOLOGY.test(text)) return 'pseudo-psychology/coaching language';
  if (NATAL_META_LANGUAGE.test(text)) return 'meta/report language';
  if (NATAL_ADVICE_LANGUAGE.test(text)) return 'advice/instruction language';
  if (NATAL_ABSOLUTE_LANGUAGE.test(text)) return 'unsupported absolute claim';

  const sourceWords = meaningIds.reduce((total, id) => {
    const meaning = byId.get(id);
    return total + (meaning ? wordCount(meaning.text) : 0);
  }, 0);
  const maxWords = Math.max(60, Math.ceil(sourceWords * 1.55));
  if (wordCount(text) > maxWords) return 'copy padded beyond approved material';

  return null;
}

export function materializeNatalUnifiedReading(input: {
  raw: RawPayload;
  interpretation: NatalInterpretation;
  tier: NatalUnifiedReadingTier;
  plan: NatalUnifiedWriterPlan;
}): { reading: NatalUnifiedReading | null; errors: string[] } {
  const errors: string[] = [];
  const byId = meaningMap(input.interpretation);
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
    const copyError = validateCopy(text, expected.meaningIds, byId);
    if (copyError) errors.push(`${expected.id}: ${copyError}`);
    if (
      raw?.id === expected.id
      && sameIds(raw?.meaning_ids, expected.meaningIds)
      && !copyError
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
      const copyError = validateCopy(text, expected.meaningIds, byId);
      if (copyError) errors.push(`${expected.id}: ${copyError}`);
      if (
        raw?.id === expected.id
        && sameIds(raw?.meaning_ids, expected.meaningIds)
        && !copyError
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
      interpretationVersion: input.interpretation.schemaVersion,
      tier: input.tier,
      story,
      topics,
      meaningIds: [...input.interpretation.storyMeaningIds],
      evidenceIds: input.interpretation.evidence.map((fact) => fact.id),
    },
  };
}

async function validateSemanticFidelity(
  reading: NatalUnifiedReading,
  interpretation: NatalInterpretation,
  language: 'ru' | 'en',
): Promise<string[]> {
  const byId = meaningMap(interpretation);
  const candidates = [
    ...reading.story.map((block) => ({ surface: 'story', block })),
    ...reading.topics.flatMap((topic) => topic.blocks.map((block) => ({
      surface: `topic:${topic.key}`,
      block,
    }))),
  ];
  const payload = candidates.map(({ surface, block }) => ({
    id: block.id,
    surface,
    allowed_meanings: block.meaningIds.map((id) => {
      const meaning = byId.get(id)!;
      return { id, scope: meaning.scope, meaning: meaning.text };
    }),
    candidate: block.text,
  }));

  const instructions = language === 'ru'
    ? `Ты проверяешь только соответствие готового текста уже утверждённым смыслам.
Не трактуй астрологию и не добавляй собственных выводов.
Для каждого блока ok=true только если:
1) все allowed_meanings действительно переданы;
2) нет нового утверждения, причины, мотива, биографии, события или психологического ярлыка;
3) background не усилен до твёрдого личного свойства;
4) structural не превращён в диагноз характера;
5) описание не превращено в совет.
Стиль и красоту не оценивай. Верни проверку для каждого id.`
    : `Check only whether each candidate is semantically faithful to its approved meanings.
Do not interpret astrology and do not add your own conclusions.
ok=true only when every allowed meaning is represented, no unsupported claim/cause/motive/biography/event/psychological label is added, background and structural scope are not strengthened, and description is not turned into advice.
Do not judge style. Return one check for every id.`;

  const response = await createLunaStructuredResponse({
    instructions,
    input: JSON.stringify({ blocks: payload }),
    maxOutputTokens: Math.min(3200, Math.max(1000, candidates.length * 110)),
    reasoningEffort: 'low',
    verbosity: 'low',
    store: false,
    schemaName: 'natal_unified_semantic_review',
    schema: SEMANTIC_REVIEW_SCHEMA,
  });

  let raw: RawSemanticReview;
  try {
    raw = JSON.parse(response.content) as RawSemanticReview;
  } catch {
    return ['semantic review returned invalid JSON'];
  }
  const checks = Array.isArray(raw.checks) ? raw.checks : [];
  const expectedIds = candidates.map(({ block }) => block.id);
  const actualIds = checks.map((check) => typeof check.id === 'string' ? check.id : '');
  if (!sameIds(actualIds, expectedIds)) return ['semantic review changed block ids'];

  return checks.flatMap((check) => {
    if (check.ok === true) return [];
    const issues = Array.isArray(check.issues)
      ? check.issues.filter((issue): issue is string => typeof issue === 'string' && issue.trim().length > 0)
      : [];
    return [`${String(check.id)}: ${issues.join('; ') || 'semantic mismatch'}`];
  });
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
      input: promptPlan(interpretation, plan, input.tier, language, errors),
      maxOutputTokens: input.tier === 'premium' ? 6500 : 3500,
      reasoningEffort: 'medium',
      verbosity: 'medium',
      store: false,
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
    if (materialized.reading) {
      const semanticErrors = await validateSemanticFidelity(materialized.reading, interpretation, language);
      if (!semanticErrors.length) return materialized.reading;
      errors = semanticErrors;
      continue;
    }
    errors = materialized.errors;
  }

  throw Object.assign(
    new Error(`Natal writer rejected after ${MAX_WRITER_ATTEMPTS} attempts: ${errors.join('; ')}`),
    { code: 'NATAL_WRITER_REJECTED' },
  );
}
