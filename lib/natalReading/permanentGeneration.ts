import type { NatalChartData, UserProfile } from '../../types';
import type { NatalChartDataV2 } from '../natalChartV2Types';
import { llmJson } from '../anthropic';
import { getAppSystemVoice } from '../appVoice';
import {
  buildNatalModelContext,
  materializePermanentFreeReport,
  materializePermanentPremiumReport,
  type BuiltNatalModelContext,
  type NatalPermanentFreeReport,
  type NatalPermanentPremiumReport,
  type NatalReadingLanguage,
  type RawNatalFreePayload,
  type RawNatalPremiumPayload,
} from './permanentReport';

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
Затем создай только те самостоятельные смысловые разделы, которые действительно нужны для цельного базового портрета этой карты. Сам выбери их количество, темы, порядок и естественные короткие заголовки. Не пытайся механически охватить заданный набор сфер и не добавляй раздел ради заполнения структуры. Каждый раздел — один или два коротких абзаца без повторения одной мысли. Для каждого раздела задай уникальный короткий section_key в snake_case и free: true.`
    : `Create a concise human hook: one recognisable observation about the person, grounded in chart facts rather than an advertising slogan.
Then create only the self-contained narrative sections genuinely needed for a coherent base portrait of this chart. Choose their count, themes, order, and natural short titles yourself. Do not mechanically cover a predefined set of life areas or add a section merely to fill the structure. Each section is one or two short paragraphs and does not repeat the same point. Give every section a unique short snake_case section_key and set free to true.`;
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
${JSON.stringify(built.context, null, 2)}`;
}

export function buildPermanentNatalPremiumPrompt(
  language: NatalReadingLanguage,
  built: BuiltNatalModelContext,
): string {
  const instructions = language === 'ru'
    ? `Создай только те самостоятельные углублённые разделы постоянного портрета, которые действительно добавляют новый смысл. Сам выбери их количество, темы, порядок и естественные короткие заголовки по наиболее содержательным сочетаниям фактов этой карты. Не используй обязательный список сфер и не добавляй раздел ради заполнения структуры. Каждый раздел — один или два плотных абзаца, раскрывающих отдельную мысль без повторов. Для каждого раздела задай уникальный короткий section_key в snake_case и free: false. Это постоянный портрет: никаких текущих транзитов, календарных дат, будущих событий или timing.`
    : `Create only the self-contained deeper sections of a permanent portrait that genuinely add a new insight. Choose their count, themes, order, and natural short titles from the most substantial combinations of facts in this chart. Do not use a mandatory list of life areas or add a section merely to fill the structure. Each section is one or two dense paragraphs that develops a distinct point without repetition. Give every section a unique short snake_case section_key and set free to false. This is a permanent portrait: no current transits, calendar dates, future events, or timing.`;
  return `${permanentInputRules(built)}

${instructions}

Return JSON only:
{
  "sections": [
    {"section_key":"unique_short_key","title":"natural model-written title","free":false,"content":"complete deeper reading","evidence_ids":["existing evidence id"]}
  ]
}

AUTHORITATIVE CALCULATED BIRTH CHART:
${JSON.stringify(built.context, null, 2)}`;
}

export async function generatePermanentNatalFreeReport(
  profile: UserProfile,
  chart: NatalChartData | NatalChartDataV2,
): Promise<NatalPermanentFreeReport> {
  const language: NatalReadingLanguage = profile.language === 'en' ? 'en' : 'ru';
  const built = buildNatalModelContext(profile, chart);
  const raw = await llmJson<RawNatalFreePayload>({
    system: getPermanentNatalSystemPrompt(language),
    user: buildPermanentNatalFreePrompt(language, built),
    model: {
      accessTier: 'free',
      contentSurface: 'natal',
      contentVariant: 'brief',
    },
    maxTokens: 3200,
    temperature: 0.25,
  });
  const report = materializePermanentFreeReport({ raw, profile, built });
  if (!report) throw new Error('NATAL_PERMANENT_FREE_VALIDATION_FAILED');
  return report;
}

export async function generatePermanentNatalPremiumReport(
  profile: UserProfile,
  chart: NatalChartData | NatalChartDataV2,
): Promise<NatalPermanentPremiumReport> {
  const language: NatalReadingLanguage = profile.language === 'en' ? 'en' : 'ru';
  const built = buildNatalModelContext(profile, chart);
  const raw = await llmJson<RawNatalPremiumPayload>({
    system: getPermanentNatalSystemPrompt(language),
    user: buildPermanentNatalPremiumPrompt(language, built),
    model: {
      accessTier: 'premium',
      contentSurface: 'natal',
      contentVariant: 'full',
    },
    maxTokens: 7000,
    temperature: 0.25,
  });
  const report = materializePermanentPremiumReport({ raw, built });
  if (!report) throw new Error('NATAL_PERMANENT_PREMIUM_VALIDATION_FAILED');
  return report;
}
