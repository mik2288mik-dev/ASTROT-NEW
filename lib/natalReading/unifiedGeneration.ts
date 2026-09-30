import type { NatalChartDataV2 } from '../natalChartV2Types';
import { buildNatalInterpretation, type NatalInterpretation, type NatalMeaning } from '../natalInterpretation';
import { getNatalStorySystemPrompt } from '../voice/contracts/natal';
import { hasCoreVoiceViolation } from '../voice/validators';
import { natalPlainLanguageError } from '../natalInterpretation/plainLanguage';
import { createLunaStructuredResponse, type StrictJsonSchema } from '../openaiResponses';
import {
  NATAL_UNIFIED_READING_CONTRACT_VERSION,
  NATAL_COPY_REVISION,
  type NatalUnifiedReading,
  type NatalUnifiedReadingTier,
  type NatalUnifiedStoryBlock,
  type NatalUnifiedTopicSection,
  type NatalUnifiedWriterPlan,
  type NatalUnifiedWriterPlanBlock,
} from './unifiedReading';

const STORY_CHUNK_SIZE = 4;
const TOPIC_CHUNK_SIZE = 3;
const MAX_BLOCK_REPAIRS = 2;

type RawBlock = { id?: unknown; text?: unknown; meaning_ids?: unknown };
type RawTopic = { key?: unknown; title?: unknown; blocks?: RawBlock[] };
type RawPayload = { story?: RawBlock[]; topics?: RawTopic[] };

export type NatalWriterProgress = {
  writerStarted?: boolean;
  raw?: RawPayload;
  repairs: number;
  reading?: NatalUnifiedReading;
};

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
type RawSemanticCheck = { id?: unknown; issues?: { kind?: unknown; detail?: unknown }[] };
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
          issues: { type: 'array', items: {
            type: 'object', properties: {
              kind: { type: 'string', enum: ['missing_detail', 'unsupported_claim', 'contradiction', 'scope_strengthening', 'advice'] },
              detail: { type: 'string' },
            }, required: ['kind', 'detail'], additionalProperties: false,
          } },
        },
        required: ['id', 'issues'],
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
  const hydrate = (block: NatalUnifiedWriterPlanBlock, surface: string) => ({
    id: block.id,
    surface,
    meaning_ids: block.meaningIds,
    allowed_meanings: block.meaningIds.map((id) => {
      const meaning = byId.get(id)!;
      return {
        id: meaning.id,
        scope: meaning.scope,
        evidence_ids: meaning.evidenceIds,
        meaning: meaning.text,
        ...(meaning.area ? { area: meaning.area } : {}),
      };
    }),
  });
  const payload = {
    tier,
    story: plan.story.map((block) => hydrate(block, 'story')),
    topics: plan.topics.map((topic) => ({
      key: topic.key,
      title: topic.title,
      blocks: topic.blocks.map((block) => hydrate(block, `topic:${topic.key}`)),
    })),
  };

  const rules = language === 'ru'
    ? `ЗАДАЧА:
Перепиши уже готовые смыслы ниже обычным человеческим русским языком для NEBO.

ЖЁСТКИЕ ПРАВИЛА:
- Ты только редактор. allowed_meanings уже содержат весь разрешённый смысл.
- Выбери главное из allowed_meanings. Объединяй близкие наблюдения; необязательно перечислять каждую деталь. Нельзя добавлять новый смысл.
- Не додумывай характер, причины поведения, прошлое, отношения, страхи, травмы, диагнозы, профессию, деньги, события или мысли других людей.
- Пиши простыми словами. Без психологических ярлыков, терапевтической лексики, коучинга и абстрактной шелухи.
- Не пиши служебным языком вроде «в этой теме», «это проявляется», «динамика», «сфера», «функция», «карта показывает», «астрологическая трактовка».
- Не давай советы и инструкции человеку.
- Не делай обязательный конфликт, проблему, плюс, минус или вдохновляющий финал.
- background — только фоновая поправка. Не превращай её в сильное утверждение о характере.
- structural — описание устройства конкретной области, а не психологический диагноз.
- В основном тексте не должно быть планет, знаков, домов, аспектов, градусов, орбов или ретроградности.
- Заголовки тем уже заданы. Не переименовывай их и не придумывай новые разделы.
- Рассказ — связное чтение о человеке, а не перечень трактовок. В темах раскрой только то, что относится к названной теме; не копируй абзацы рассказа.
- area уточняет, где относится наблюдение. Используй её, если это помогает объяснению, без перечисления сфер.
- Сохрани id. В meaning_ids укажи только использованные ID из allowed_meanings; каждый вывод должен иметь основание.
- На блок достаточно 2–4 простых предложений. Это предел, не требование добрать объём. Не более 90 слов в блоке.
- Не раздувай текст. Один понятный смысл лучше трёх красивых предложений.
- Верни только JSON.`
    : `TASK:
Rewrite the approved meanings below into plain, everyday NEBO English.

STRICT RULES:
- You are only an editor. allowed_meanings already contain the complete allowed interpretation.
- Select the relevant observations. Combine related observations and omit minor details. Add no new meaning.
- Do not invent personality claims, causes, biography, relationship history, fears, trauma, diagnosis, profession, income, events, or other people's thoughts.
- Use ordinary language. No therapy jargon, coaching language, pseudo-psychology, or abstract filler.
- Do not use process/report language such as "this theme", "this manifests", "dynamic", "sphere", "function", "the chart shows", or "astrological interpretation".
- Give no advice or instructions.
- Do not force conflict, problems, positivity, negativity, or a motivational ending.
- Keep background meanings as background modifiers. Do not inflate them into strong personality claims.
- Structural meanings describe a life area, not a psychological diagnosis.
- No visible astrology terminology in the main copy.
- Topic titles are fixed. Do not rename them or invent new sections.
- Story is a connected reading about a person, not a list. Topics explain only the named area. Do not copy story paragraphs into topics.
- Use area to explain where an observation belongs when helpful.
- Keep id unchanged. In meaning_ids cite only the supplied IDs actually used. Every claim needs an approved basis.
- Use at most 90 words per block. Two to four simple sentences are enough; do not add sentences just to reach a count.
- Do not pad the copy.
- Return JSON only.`;

  return `${rules}

INPUT:
${JSON.stringify(payload, null, 2)}${errors.length ? `

PREVIOUS OUTPUT WAS REJECTED:
${errors.join('\n')}
Write a new candidate and fix every listed issue.` : ''}`;
}

const VISIBLE_ASTROLOGY = /(?:солнц\p{L}*|лун\p{L}*|меркур\p{L}*|венер\p{L}*|марс\p{L}*|юпитер\p{L}*|сатурн\p{L}*|уран\p{L}*|нептун\p{L}*|плутон\p{L}*|хирон\p{L}*|узел\p{L}*|асцендент|десцендент|\bMC\b|\bIC\b|аспект\p{L}*|трин\p{L}*|секстил\p{L}*|квадрат\p{L}*|оппозиц\p{L}*|соединени\p{L}*|\d{1,2}\s+дом\p{L}*|орб\p{L}*|ретроград\p{L}*|\b(?:sun|moon|mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto|chiron|ascendant|descendant|aspect|trine|sextile|square|opposition|conjunction|retrograde)\b)/iu;

const NATAL_PSEUDO_PSYCHOLOGY = /(?:осознанн\p{L}*|ресурс\p{L}*|потенциал\p{L}*|трансформац\p{L}*|проработ\p{L}*|точк\p{L}*\s+рост\p{L}*|личн\p{L}*\s+границ\p{L}*|паттерн\p{L}*|сценари\p{L}*|триггер\p{L}*|травм\p{L}*|субличност\p{L}*|архетип\p{L}*|подсозн\p{L}*|самооценк\p{L}*|самосаботаж\p{L}*|тенев\p{L}*\s+сторон\p{L}*|защитн\p{L}*\s+механизм\p{L}*|внутренн\p{L}*\s+(?:опор\p{L}*|реб[её]н\p{L}*|мир\p{L}*|ресурс\p{L}*|конфликт\p{L}*)|глубинн\p{L}*\s+(?:страх\p{L}*|потребност\p{L}*|мотив\p{L}*)|эмоциональн\p{L}*\s+зрел\p{L}*|\b(?:inner\s+child|growth\s+point|personal\s+boundar\w*|trauma|trigger|healing|transformation|potential|archetype|shadow\s+self|self[- ]sabotage)\b)/iu;
const NATAL_META_LANGUAGE = /(?:карта\s+(?:показывает|говорит|подсказывает)|астрологическ\p{L}*\s+трактовк\p{L}*|в\s+этой\s+тем\p{L}*|эта\s+тем\p{L}*|может\s+проявляться|проявля\p{L}*\s+как|внутренн\p{L}*\s+динамик\p{L}*|психологическ\p{L}*\s+портрет\p{L}*|\b(?:the\s+chart\s+shows|this\s+theme|may\s+manifest|inner\s+dynamic|astrological\s+interpretation)\b)/iu;
const NATAL_ADVICE_LANGUAGE = /(?:тебе\s+(?:нужно|стоит|следует)|(?:попробуй|старайся|помни|сохраняй|держи|не\s+бойся|позволь\s+себе)(?!\p{L})|\b(?:you\s+should|you\s+need\s+to|try\s+to|remember\s+to|make\s+sure\s+to)\b)/iu;
const NATAL_ABSOLUTE_LANGUAGE = /(?:ты\s+(?:всегда|никогда|точно)\b|у\s+тебя\s+точно\b|на\s+самом\s+деле\s+ты\b|\byou\s+(?:always|never|definitely)\b)/iu;

function approvedIds(raw: unknown, expected: readonly string[]): raw is string[] {
  return Array.isArray(raw)
    && raw.length > 0
    && new Set(raw).size === raw.length
    && raw.every(value => typeof value === 'string' && expected.includes(value));
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
  const plainError = natalPlainLanguageError(text);
  if (plainError) return plainError;

  const sourceWords = meaningIds.reduce((total, id) => {
    const meaning = byId.get(id);
    return total + (meaning ? wordCount(meaning.text) : 0);
  }, 0);
  const maxWords = Math.min(90, Math.max(40, Math.ceil(sourceWords * 1.35)));
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
    if (!approvedIds(raw?.meaning_ids, expected.meaningIds)) {
      errors.push(`${expected.id}: meaning ids changed`);
    }
    const copyError = validateCopy(text, approvedIds(raw?.meaning_ids, expected.meaningIds) ? raw.meaning_ids : [], byId);
    if (copyError) errors.push(`${expected.id}: ${copyError}`);
    if (
      raw?.id === expected.id
      && approvedIds(raw?.meaning_ids, expected.meaningIds)
      && !copyError
    ) {
      story.push({ id: expected.id, text, meaningIds: [...raw.meaning_ids] });
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
      if (!approvedIds(raw?.meaning_ids, expected.meaningIds)) errors.push(`${expected.id}: meaning ids changed`);
      const copyError = validateCopy(text, approvedIds(raw?.meaning_ids, expected.meaningIds) ? raw.meaning_ids : [], byId);
      if (copyError) errors.push(`${expected.id}: ${copyError}`);
      if (
        raw?.id === expected.id
        && approvedIds(raw?.meaning_ids, expected.meaningIds)
        && !copyError
      ) {
        blocks.push({ id: expected.id, text, meaningIds: [...raw.meaning_ids] });
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

  for (const surface of [story, topics.flatMap(topic => topic.blocks)]) {
    const seen = new Set<string>();
    for (const block of surface) {
      const normalized = block.text.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
      if (seen.has(normalized)) errors.push(`${block.id}: repeated paragraph`);
      seen.add(normalized);
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
      copyRevision: NATAL_COPY_REVISION,
      story,
      topics,
      meaningIds: [...new Set([...story, ...topics.flatMap(topic => topic.blocks)].flatMap(block => block.meaningIds))],
      evidenceIds: [...new Set([...story, ...topics.flatMap(topic => topic.blocks)].flatMap(block => block.meaningIds.flatMap(id => byId.get(id)!.evidenceIds)))],
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
      return { id, scope: meaning.scope, meaning: meaning.text, ...(meaning.area ? { area: meaning.area } : {}) };
    }),
    candidate: block.text,
  }));

  const instructions = language === 'ru'
    ? `Ты проверяешь только соответствие готового текста уже утверждённым смыслам.
Не трактуй астрологию и не добавляй собственных выводов.
Для каждого блока проверь:
1) текст сохраняет смысл allowed_meanings; сжатие, перефразирование и неполное перечисление деталей допустимы;
2) нет нового утверждения, причины, мотива, биографии, события или психологического ярлыка;
3) background не усилен до твёрдого личного свойства;
4) structural не превращён в диагноз характера;
5) описание не превращено в совет.
Не отклоняй текст за отсутствующую деталь или другое словоупотребление.
Замечания о полноте перечисляй только с kind=missing_detail.
kind=unsupported_claim — конкретное новое утверждение; contradiction — противоречие;
scope_strengthening — усиление фонового смысла; advice — совет вместо описания.
Стиль и красоту не оценивай. Верни проверку для каждого id.`
    : `Check only whether each candidate is semantically faithful to its approved meanings.
Do not interpret astrology and do not add your own conclusions.
Condensing, paraphrasing and omitting details are acceptable. Completeness notes must use kind=missing_detail.
Other kinds: unsupported_claim for a specific new assertion, contradiction, scope_strengthening, and advice.
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
  if (actualIds.length !== expectedIds.length || actualIds.some((id, index) => id !== expectedIds[index])) return ['semantic review changed block ids'];

  const blockingKinds = ['unsupported_claim', 'contradiction', 'scope_strengthening', 'advice'];
  const errors: string[] = [];
  for (const check of checks) {
    if (!Array.isArray(check.issues)) return ['semantic review returned invalid issues'];
    for (const issue of check.issues) {
      if (issue.kind === 'missing_detail') continue;
      if (!blockingKinds.includes(String(issue.kind)) || typeof issue.detail !== 'string') {
        return ['semantic review returned invalid issue kind'];
      }
      errors.push(`${String(check.id)}: ${issue.detail}`);
    }
  }
  return errors;
}

function alignRaw(raw: RawPayload, plan: NatalUnifiedWriterPlan): RawPayload {
  const find = (blocks: RawBlock[] | undefined, expected: NatalUnifiedWriterPlanBlock): RawBlock => {
    const matches = (blocks || []).filter((block) => block.id === expected.id);
    return matches.length === 1 ? matches[0] : { id: expected.id };
  };
  return {
    story: plan.story.map((block) => find(raw.story, block)),
    topics: plan.topics.map((topic) => ({
      key: topic.key,
      title: topic.title,
      blocks: topic.blocks.map((block) => find(
        raw.topics?.find((candidate) => candidate.key === topic.key)?.blocks, block,
      )),
    })),
  };
}

function repairPlan(plan: NatalUnifiedWriterPlan, errors: string[]): NatalUnifiedWriterPlan {
  const rejected = (block: NatalUnifiedWriterPlanBlock) => errors.some((error) => error.startsWith(`${block.id}:`));
  return {
    story: plan.story.filter(rejected),
    topics: plan.topics.map((topic) => ({ ...topic, blocks: topic.blocks.filter(rejected) }))
      .filter((topic) => topic.blocks.length > 0),
  };
}

function mergeRepairs(raw: RawPayload, replacement: RawPayload): RawPayload {
  const replace = (blocks: RawBlock[] = [], next: RawBlock[] = []) => blocks.map(
    (block) => next.find((candidate) => candidate.id === block.id) || block,
  );
  return {
    story: replace(raw.story, replacement.story),
    topics: raw.topics?.map((topic) => ({
      ...topic,
      blocks: replace(topic.blocks, replacement.topics?.find((next) => next.key === topic.key)?.blocks),
    })),
  };
}

export async function generateNatalUnifiedReading(input: {
  chart: NatalChartDataV2;
  language?: 'ru' | 'en';
  tier: NatalUnifiedReadingTier;
  progress?: NatalWriterProgress;
  onProgress?: (progress: NatalWriterProgress) => Promise<void>;
}): Promise<NatalUnifiedReading> {
  const language = input.language === 'en' ? 'en' : 'ru';
  const interpretation = buildNatalInterpretation(input.chart, language);
  const plan = buildNatalUnifiedWriterPlan(interpretation, input.tier);
  const progress: NatalWriterProgress = { ...input.progress, repairs: input.progress?.repairs || 0 };
  if (progress.reading) return progress.reading;
  const checkpoint = async () => { await input.onProgress?.(progress); };
  if (!progress.raw) {
    if (progress.writerStarted) {
      throw Object.assign(new Error('Natal draft was not returned; full writing will not be repeated automatically'), { code: 'NATAL_WRITER_REJECTED' });
    }
    progress.writerStarted = true;
    await checkpoint();
    const response = await createLunaStructuredResponse({
      instructions: getNatalStorySystemPrompt(language),
      input: promptPlan(interpretation, plan, input.tier, language),
      maxOutputTokens: input.tier === 'premium' ? 6500 : 3500,
      reasoningEffort: 'medium',
      verbosity: 'low',
      store: false,
      schemaName: 'natal_unified_reading',
      schema: WRITER_SCHEMA,
    });
    try {
      progress.raw = alignRaw(JSON.parse(response.content) as RawPayload, plan);
    } catch {
      throw Object.assign(new Error('Natal writer returned invalid JSON'), { code: 'NATAL_WRITER_REJECTED' });
    }
    // Keep the expensive draft across a review failure, DB failure or restart.
    await checkpoint();
  }
  const repair = async (errors: string[]) => {
    const partial = repairPlan(plan, errors);
    if (progress.repairs >= MAX_BLOCK_REPAIRS || (!partial.story.length && !partial.topics.length)) {
      throw Object.assign(new Error(`Natal writer rejected blocks: ${errors.join('; ')}`), { code: 'NATAL_WRITER_REJECTED' });
    }
    progress.repairs += 1;
    await checkpoint();
    const response = await createLunaStructuredResponse({
      instructions: getNatalStorySystemPrompt(language),
      input: promptPlan(interpretation, partial, input.tier, language, errors),
      maxOutputTokens: Math.min(6500, Math.max(1000,
        (partial.story.length + partial.topics.reduce((sum, topic) => sum + topic.blocks.length, 0)) * 240)),
      reasoningEffort: 'low', verbosity: 'low', store: false,
      schemaName: 'natal_unified_block_repair', schema: WRITER_SCHEMA,
    });
    progress.raw = mergeRepairs(progress.raw!, JSON.parse(response.content) as RawPayload);
    await checkpoint();
  };
  let materialized = materializeNatalUnifiedReading({
    raw: progress.raw!, interpretation, tier: input.tier, plan,
  });
  if (!materialized.reading) {
    await repair(materialized.errors);
    materialized = materializeNatalUnifiedReading({ raw: progress.raw!, interpretation, tier: input.tier, plan });
  }
  if (!materialized.reading) throw Object.assign(new Error(materialized.errors.join('; ')), { code: 'NATAL_WRITER_REJECTED' });
  const semanticErrors = await validateSemanticFidelity(materialized.reading, interpretation, language);
  if (semanticErrors.length) {
    await repair(semanticErrors);
    materialized = materializeNatalUnifiedReading({ raw: progress.raw!, interpretation, tier: input.tier, plan });
    if (!materialized.reading) throw Object.assign(new Error(materialized.errors.join('; ')), { code: 'NATAL_WRITER_REJECTED' });
    // Review just the changed blocks, preserving approved blocks and their text.
    const partial = repairPlan(plan, semanticErrors);
    const repairedReading = {
      ...materialized.reading,
      story: materialized.reading.story.filter((block) => partial.story.some((item) => item.id === block.id)),
      topics: materialized.reading.topics.map((topic) => ({ ...topic,
        blocks: topic.blocks.filter((block) => partial.topics.some((item) => item.blocks.some((entry) => entry.id === block.id))),
      })).filter((topic) => topic.blocks.length > 0),
    };
    const errors = await validateSemanticFidelity(repairedReading, interpretation, language);
    if (errors.length) throw Object.assign(new Error(errors.join('; ')), { code: 'NATAL_WRITER_REJECTED' });
  }
  progress.reading = materialized.reading;
  await checkpoint();
  return materialized.reading;
}
