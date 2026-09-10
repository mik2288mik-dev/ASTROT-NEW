import type { NatalChartData, UserProfile } from '../../types';
import type { NatalChartDataV2 } from '../natalChartV2Types';
import { getAppSystemVoice } from '../appVoice';
import {
  createLunaStructuredResponse,
  type StrictJsonSchema,
} from '../openaiResponses';
import {
  buildNatalModelContext,
  buildNatalPromptContext,
  buildNatalReaderChapterPlan,
  buildPermanentNatalReaderAnchor,
  isNatalPermanentFreeReport,
  materializePermanentFreeReport,
  materializePermanentPremiumReport,
  type BuiltNatalModelContext,
  type NatalPermanentFreeReport,
  type NatalPermanentPremiumReport,
  type NatalReadingLanguage,
  type RawNatalFreePayload,
  type RawNatalPremiumPayload,
} from './permanentReport';

function requestedDomains(
  built: BuiltNatalModelContext,
  access: 'free' | 'premium',
) {
  return built.context.reportPlan.filter((item) => item.access === access);
}

function buildPermanentNatalResponseSchema(
  built: BuiltNatalModelContext,
  access: 'free' | 'premium',
): StrictJsonSchema {
  const domains = requestedDomains(built, access);
  const sectionSchema = {
    type: 'object',
    properties: {
      section_key: { type: 'string', enum: domains.map((item) => item.key) },
      free: { type: 'boolean', enum: [access === 'free'] },
      content: { type: 'string', minLength: 80, maxLength: 1400 },
      evidence_ids: { type: 'array', items: { type: 'string' }, minItems: 1 },
    },
    required: ['section_key', 'free', 'content', 'evidence_ids'],
    additionalProperties: false,
  };
  return {
    type: 'object',
    properties: {
      ...(access === 'free' ? {
        hook: {
          type: 'object',
          properties: {
            text: { type: 'string', minLength: 40, maxLength: 500 },
            evidence_ids: { type: 'array', items: { type: 'string' }, minItems: 1 },
          },
          required: ['text', 'evidence_ids'],
          additionalProperties: false,
        },
      } : {}),
      sections: {
        type: 'array',
        minItems: domains.length,
        maxItems: domains.length,
        items: sectionSchema,
      },
    },
    required: [...(access === 'free' ? ['hook'] : []), 'sections'],
    additionalProperties: false,
  };
}

function parsePayload<T>(value: string): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new Error('NATAL_PERMANENT_INVALID_JSON');
  }
}

export function getPermanentNatalSystemPrompt(language: NatalReadingLanguage): string {
  const task = language === 'ru'
    ? `ЗАДАЧА НАТАЛЬНОГО ПОРТРЕТА
- Преврати сухие астро-факты в живой, точный рассказ о человеке, без эзотерики и психологической воды.
- В пользовательских hook и content не называй планеты, знаки, дома, аспекты, градусы и орбисы. Переводи расчёт в обычный язык характера, решений и поведения; технические факты интерфейс покажет отдельно по evidence_ids.
- Не пиши «Вы склонны» или «Вам свойственно». Говори прямо, естественно и по-человечески, без канцелярита и готовых психологических формул.
- Все разделы — части одного цельного портрета. Вступление называет главную линию карты, а следующие главы продолжают её и не начинают рассказ заново.
- Жизненные главы, их порядок и смысл заданы в READER CHAPTER PLAN. Не придумывай другие рубрики. Если у главы несколько section_key, каждый content добавляет новую часть, а интерфейс соединит их под одним заголовком.
- Пиши через обычные ситуации и действия: выбор, знакомство, ссору с партнёром, просьбу близкого, семейную договорённость, разговор с начальником, дедлайн, клиента, своё дело или решение с деловым партнёром. Не выдумывай событие из биографии; показывай условную узнаваемую ситуацию.
- Показывай две реальные стороны одного способа поведения и условие, при котором человек переключается между ними. Не называй это «противоречием»: опиши конкретно, например человек легко знакомится, но близко подпускает медленно.
- Не используй в пользовательском тексте слова и формулы «проявляется», «напрягается», «опора», «ресурс», «паттерн», «потенциал», «внутренний рисунок», «внутреннее противоречие», «раскрываешься» и похожий язык психологического отчёта.
- Не заканчивай каждый блок советом. Сначала объясни, как человек обычно действует, что ему даётся легче и что реально усложняет ситуацию.
- Каждый блок обязан вернуть только реальные evidence_ids из входного массива. Не печатай эти идентификаторы в пользовательском тексте.
- Ответ — только валидный JSON без Markdown.`
    : `NATAL PORTRAIT TASK
- Turn calculated astrological facts into a vivid, precise story about a person without mysticism or pseudo-psychology.
- Do not name planets, signs, houses, aspects, degrees, or orbs in user-facing hook or content. Translate the calculation into ordinary language about character, decisions, and behaviour; the interface reveals technical facts separately through evidence_ids.
- Write directly, naturally, and in plain human language, without formal or canned psychological formulas.
- Every section belongs to one coherent portrait. The opening names the chart's central thread, and later chapters continue it instead of restarting the story.
- The life chapters, their order, and their purpose are fixed in READER CHAPTER PLAN. Invent no other headings. When a chapter has several section_key values, each content field adds a different part and the interface joins them under one heading.
- Write through ordinary situations and actions: a choice, new acquaintance, disagreement with a partner, request from a relative, family agreement, conversation with a manager, deadline, client, own business, or decision with a business partner. Use conditional examples and never invent biography.
- Show two concrete sides of one behaviour and the condition that switches the person between them. Do not label this an “inner contradiction”; describe the actual difference, such as meeting people easily but allowing closeness slowly.
- Avoid abstract report language such as “manifests”, “inner resource”, “support point”, “pattern”, “potential”, “inner contradiction”, or “unfolds”.
- Do not end every block with advice. Explain first how the person usually acts, what comes more easily, and what concretely makes a situation harder.
- Every block must return only existing evidence_ids from the input. Never print those identifiers in the user-facing text.
- Return valid JSON only, with no Markdown.`;
  return `${getAppSystemVoice(language)}\n\n${task}`;
}

function readerChapterPlan(
  built: BuiltNatalModelContext,
  access: 'free' | 'premium',
  language: NatalReadingLanguage,
) {
  return buildNatalReaderChapterPlan(built.context.reportPlan, access, language).map((chapter) => ({
    chapter_key: chapter.key,
    chapter_title: chapter.title,
    focus: chapter.focus,
    parts: chapter.domainKeys.map((sectionKey, index) => ({
      section_key: sectionKey,
      part: index + 1,
      parts_total: chapter.domainKeys.length,
    })),
  }));
}

function permanentInputRules(built: BuiltNatalModelContext): string {
  const angleRule = built.anglesIncluded
    ? `Only these explicitly present reliable angles may be interpreted: ${[...built.reliableAngleKeys].join(', ')}.`
    : 'The input deliberately contains no angles or MC. Do not mention or infer them.';
  const houseRule = built.housesIncluded
    ? `Only these explicitly present reliable houses may be interpreted: ${[...built.reliableHouseNumbers].sort((a, b) => a - b).join(', ')}.`
    : 'The input deliberately contains no houses, cusps, or house rulers. Do not mention or infer them.';
  return `This is a calculated birth-chart reading.
- Interpret only the supplied calculated facts. Never recalculate a position, aspect, house, orb, or degree.
- Do not invent biography, childhood, trauma, diagnoses, a profession, income, relationship history, guaranteed events, or karmic facts.
- Every section must cite one or more evidence_ids that exist verbatim in the supplied evidence array.
- Use only the section_key values listed in reportPlan. Write exactly one section for every requested item for this tier.
- A section may cite only evidenceIds listed for its reportPlan item. It must cite every requiredEvidenceId.
- For central_contradictions, explain both strong pulls and how they coexist; never erase one by declaring the other the person's real nature.
- Do not return a title. Reader-facing chapter titles are assigned by the server from section_key.
- Evidence identifiers are machine references. Do not print them inside user-facing text.
- No Markdown and no fields outside the requested JSON object.
- ${angleRule}
- ${houseRule}`;
}

export function buildPermanentNatalFreePrompt(
  language: NatalReadingLanguage,
  built: BuiltNatalModelContext,
): string {
  const instructions = language === 'ru'
    ? `Создай hook из двух-трёх предложений. Один раз прямо назови его главной линией натальной карты, затем объясни эту линию простыми словами. Это начало всего портрета, а не рекламный слоган.
Затем напиши content для каждого free-пункта reportPlan. Все части одной читательской главы вместе должны давать 3–5 предложений: прямой ответ по теме, обычную жизненную ситуацию и важную оговорку. Не добавляй темы и не пропускай указанные; section_key возьми из reportPlan, free: true.`
    : `Create a two- or three-sentence hook. Refer once to the central thread of the birth chart, then explain that thread in plain language. This opens the whole portrait and is not an advertising slogan.
Then write content for every free reportPlan item. All parts of one reader chapter together must make 3–5 sentences: a direct answer, an ordinary life situation, and an important qualification. Add no topics and omit none; use the reportPlan section_key and set free to true.`;
  return `${permanentInputRules(built)}

${instructions}

Return JSON only:
{
  "hook":{"text":"concise personal opening","evidence_ids":["existing evidence id"]},
  "sections": [
    {"section_key":"unique_short_key","free":true,"content":"one connected part of the reader chapter","evidence_ids":["existing evidence id"]}
  ]
}

READER CHAPTER PLAN:
${JSON.stringify(readerChapterPlan(built, 'free', language), null, 2)}

AUTHORITATIVE CALCULATED BIRTH CHART:
${JSON.stringify(buildNatalPromptContext(built), null, 2)}`;
}

export function buildPermanentNatalPremiumPrompt(
  language: NatalReadingLanguage,
  built: BuiltNatalModelContext,
  readerAnchor: NatalPermanentFreeReport,
): string {
  const instructions = language === 'ru'
    ? `Продолжи уже написанный Free-портрет из READER ANCHOR и напиши content для каждого premium-пункта reportPlan. Сохрани его главную линию, обращение и конкретный способ объяснять поведение; не повторяй вступление и готовые абзацы. Все части одной читательской главы вместе должны давать 3–5 предложений и дополнять друг друга без нового вступления. Сервер включил только достаточно подтверждённые области: не добавляй другие и не пропускай указанные; section_key возьми из reportPlan, free: false. В central_contradictions честно удержи обе сильные реакции, но не используй это техническое название в тексте. Это постоянный портрет: никаких текущих транзитов, календарных дат, будущих событий или timing.`
    : `Continue the existing Free portrait in READER ANCHOR and write content for every premium reportPlan item. Preserve its central thread, form of address, and concrete way of explaining behaviour; do not repeat its opening or existing paragraphs. All parts of one reader chapter together must make 3–5 sentences and add to one another without a new introduction. The server included only sufficiently supported areas: add no others and omit none; use the reportPlan section_key and set free to false. In central_contradictions preserve both strong pulls, but never print that technical name. This is a permanent portrait: no current transits, calendar dates, future events, or timing.`;
  return `${permanentInputRules(built)}

${instructions}

Return JSON only:
{
  "sections": [
    {"section_key":"unique_short_key","free":false,"content":"one connected part of the reader chapter","evidence_ids":["existing evidence id"]}
  ]
}

READER CHAPTER PLAN:
${JSON.stringify(readerChapterPlan(built, 'premium', language), null, 2)}

READER ANCHOR — CONTINUE THIS EXISTING FREE PORTRAIT:
${JSON.stringify(buildPermanentNatalReaderAnchor(readerAnchor), null, 2)}

AUTHORITATIVE CALCULATED BIRTH CHART:
${JSON.stringify(buildNatalPromptContext(built), null, 2)}`;
}

export async function generatePermanentNatalFreeReport(
  profile: UserProfile,
  chart: NatalChartData | NatalChartDataV2,
): Promise<NatalPermanentFreeReport> {
  const language: NatalReadingLanguage = profile.language === 'en' ? 'en' : 'ru';
  const built = buildNatalModelContext(profile, chart);
  if (requestedDomains(built, 'free').length === 0) {
    throw new Error('NATAL_PERMANENT_FREE_PLAN_EMPTY');
  }
  const response = await createLunaStructuredResponse({
    instructions: getPermanentNatalSystemPrompt(language),
    input: buildPermanentNatalFreePrompt(language, built),
    maxOutputTokens: 3200,
    schemaName: 'natal_personality_free',
    schema: buildPermanentNatalResponseSchema(built, 'free'),
  });
  const raw = parsePayload<RawNatalFreePayload>(response.content);
  const report = materializePermanentFreeReport({ raw, profile, built, requireComplete: true });
  if (!report) throw new Error('NATAL_PERMANENT_FREE_VALIDATION_FAILED');
  return report;
}

export async function generatePermanentNatalPremiumReport(
  profile: UserProfile,
  chart: NatalChartData | NatalChartDataV2,
  readerAnchor: NatalPermanentFreeReport,
): Promise<NatalPermanentPremiumReport> {
  const language: NatalReadingLanguage = profile.language === 'en' ? 'en' : 'ru';
  const built = buildNatalModelContext(profile, chart);
  if (!isNatalPermanentFreeReport(readerAnchor)) {
    throw new Error('NATAL_PERMANENT_FREE_ANCHOR_INVALID');
  }
  if (requestedDomains(built, 'premium').length === 0) {
    throw new Error('NATAL_PERMANENT_PREMIUM_PLAN_EMPTY');
  }
  const response = await createLunaStructuredResponse({
    instructions: getPermanentNatalSystemPrompt(language),
    input: buildPermanentNatalPremiumPrompt(language, built, readerAnchor),
    maxOutputTokens: 7000,
    schemaName: 'natal_personality_premium',
    schema: buildPermanentNatalResponseSchema(built, 'premium'),
  });
  const raw = parsePayload<RawNatalPremiumPayload>(response.content);
  const report = materializePermanentPremiumReport({ raw, built, requireComplete: true });
  if (!report) throw new Error('NATAL_PERMANENT_PREMIUM_VALIDATION_FAILED');
  return report;
}
