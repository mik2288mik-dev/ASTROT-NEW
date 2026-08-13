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
      title: { type: 'string', minLength: 3, maxLength: 90 },
      free: { type: 'boolean', enum: [access === 'free'] },
      content: { type: 'string', minLength: 80, maxLength: 1400 },
      evidence_ids: { type: 'array', items: { type: 'string' }, minItems: 1 },
    },
    required: ['section_key', 'title', 'free', 'content', 'evidence_ids'],
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
- Каждый блок завершён сам по себе: не повторяет соседний, не обещает продолжение в Premium и не делает из человека диагноз.
- Не задавай рассказу заранее эмоциональный тон и не раскладывай человека по готовым сферам. Темы, порядок и заголовки определяй только по фактам конкретной карты.
- Каждый блок обязан вернуть только реальные evidence_ids из входного массива. Не печатай эти идентификаторы в пользовательском тексте.
- Ответ — только валидный JSON без Markdown.`
    : `NATAL PORTRAIT TASK
- Turn calculated astrological facts into a vivid, precise story about a person without mysticism or pseudo-psychology.
- Do not name planets, signs, houses, aspects, degrees, or orbs in user-facing hook or content. Translate the calculation into ordinary language about character, decisions, and behaviour; the interface reveals technical facts separately through evidence_ids.
- Write directly, naturally, and in plain human language, without formal or canned psychological formulas.
- Every block stands on its own: it does not repeat the adjacent block, tease Premium, or diagnose the reader.
- Do not impose a predetermined emotional tone or divide the person into predefined life areas. Choose themes, order, and titles only from the facts of this specific chart.
- Every block must return only existing evidence_ids from the input. Never print those identifiers in the user-facing text.
- Return valid JSON only, with no Markdown.`;
  return `${getAppSystemVoice(language)}\n\n${task}`;
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
    ? `Создай короткий человеческий hook: одно узнаваемое наблюдение о человеке, подтверждённое фактами карты, а не рекламный слоган.
Затем напиши по одному самостоятельному разделу для каждого free-пункта reportPlan. Этот список уже собран сервером только из достаточно подтверждённых областей конкретной карты — не добавляй другие темы и не пропускай указанные. Каждый раздел — один или два коротких абзаца без повторения одной мысли; section_key возьми из reportPlan, free: true.`
    : `Create a concise human hook: one recognisable observation about the person, grounded in chart facts rather than an advertising slogan.
Then write one self-contained section for every free reportPlan item. The server has already included only sufficiently supported areas for this chart: add no other themes and omit none. Each section is one or two short paragraphs without repetition; use the reportPlan section_key and set free to true.`;
  return `${permanentInputRules(built)}

${instructions}

Return JSON only:
{
  "hook":{"text":"concise personal opening","evidence_ids":["existing evidence id"]},
  "sections": [
    {"section_key":"unique_short_key","title":"natural model-written title","free":true,"content":"complete concise reading","evidence_ids":["existing evidence id"]}
  ]
}

AUTHORITATIVE CALCULATED BIRTH CHART:
${JSON.stringify(buildNatalPromptContext(built), null, 2)}`;
}

export function buildPermanentNatalPremiumPrompt(
  language: NatalReadingLanguage,
  built: BuiltNatalModelContext,
): string {
  const instructions = language === 'ru'
    ? `Напиши по одному самостоятельному углублённому разделу для каждого premium-пункта reportPlan. Сервер включил только области, для которых в этой карте достаточно надёжных факторов: не добавляй другие и не пропускай указанные. Каждый раздел — один или два плотных коротких абзаца без повторов; section_key возьми из reportPlan, free: false. В central_contradictions честно удержи обе сильные реакции и объясни их совместную работу. Это постоянный портрет: никаких текущих транзитов, календарных дат, будущих событий или timing.`
    : `Write one self-contained deeper section for every premium reportPlan item. The server included only areas with enough reliable support in this chart: add no others and omit none. Each section is one or two dense short paragraphs without repetition; use the reportPlan section_key and set free to false. In central_contradictions, preserve and explain both strong pulls. This is a permanent portrait: no current transits, calendar dates, future events, or timing.`;
  return `${permanentInputRules(built)}

${instructions}

Return JSON only:
{
  "sections": [
    {"section_key":"unique_short_key","title":"natural model-written title","free":false,"content":"complete deeper reading","evidence_ids":["existing evidence id"]}
  ]
}

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
): Promise<NatalPermanentPremiumReport> {
  const language: NatalReadingLanguage = profile.language === 'en' ? 'en' : 'ru';
  const built = buildNatalModelContext(profile, chart);
  if (requestedDomains(built, 'premium').length === 0) {
    throw new Error('NATAL_PERMANENT_PREMIUM_PLAN_EMPTY');
  }
  const response = await createLunaStructuredResponse({
    instructions: getPermanentNatalSystemPrompt(language),
    input: buildPermanentNatalPremiumPrompt(language, built),
    maxOutputTokens: 7000,
    schemaName: 'natal_personality_premium',
    schema: buildPermanentNatalResponseSchema(built, 'premium'),
  });
  const raw = parsePayload<RawNatalPremiumPayload>(response.content);
  const report = materializePermanentPremiumReport({ raw, built, requireComplete: true });
  if (!report) throw new Error('NATAL_PERMANENT_PREMIUM_VALIDATION_FAILED');
  return report;
}
