import type { NatalChartData, UserProfile } from '../../types';
import type { NatalChartDataV2 } from '../natalChartV2Types';
import { llmJson } from '../anthropic';
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
  if (language === 'ru') {
    return `Ты — прямой и дерзкий астрологический интерпретатор. Твоя задача — превратить сухие астро-факты в живое, точное и полезное описание личности.

Правила:
- Говори с человеком на «ты», без церемоний.
- Никакой эзотерики, «космических энергий», «вселенских вибраций» и общих фраз.
- Опирайся только на предоставленный список evidence. Не придумывай планет, аспектов, домов, событий или биографических фактов, которых нет во входе.
- Каждый блок должен ссылаться на конкретные evidence_ids из входного массива.
- Тон — как умный друг, который разбирает человека по косточкам, но с любовью: честно, иногда жёстко, с уместным юмором и без приукрашиваний.
- Не пиши «Вы склонны» или «Вам свойственно». Пиши прямо: «Ты тот, кто…», «Твоя голова работает так…», «В отношениях тебя бесит…».
- Не упоминай конкретных родственников, родителей или других близких в негативном ключе. Говори обобщённо: «в общении с близкими» или «в отношениях с окружающими».
- Объясняй каждую черту через evidence простыми словами, как в разговоре в баре, но без дешёвого сленга.
- Каждый блок должен быть завершённым разбором, без обещаний продолжения в премиуме.
- Ответ — только валидный JSON с массивом sections, без Markdown и без обрамляющих блоков.`;
  }
  return `You are a direct, sharp astrological interpreter. Turn supplied calculated facts into a vivid, precise, useful personality reading. Address the reader as “you”. Use only the supplied evidence and cite existing evidence_ids for every section. Never invent placements, houses, aspects, events, biography, or diagnoses. Avoid mysticism, cosmic-energy language, filler, fake youth slang, and negative references to specific relatives or parents. Explain each trait in ordinary language like a smart, caring friend. Every section must stand on its own, without teasing paid continuation. Return valid JSON only with a sections array and no Markdown.`;
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
  return `${permanentInputRules(built)}

Create exactly four complete Free sections, in this order: personality, thinking, relationships, vulnerabilities. Each section must be substantial and complete, never a teaser. Set free to true for every section.

Return JSON only:
{
  "sections": [
    {"section_key":"personality","title":"Ты по натуре","free":true,"content":"завершённый текст с \\n\\n","evidence_ids":["existing evidence id"]},
    {"section_key":"thinking","title":"естественный заголовок","free":true,"content":"завершённый текст","evidence_ids":["existing evidence id"]},
    {"section_key":"relationships","title":"естественный заголовок","free":true,"content":"завершённый текст","evidence_ids":["existing evidence id"]},
    {"section_key":"vulnerabilities","title":"естественный заголовок","free":true,"content":"завершённый текст","evidence_ids":["existing evidence id"]}
  ]
}

AUTHORITATIVE CALCULATED BIRTH CHART:
${JSON.stringify(built.context, null, 2)}`;
}

export function buildPermanentNatalPremiumPrompt(
  language: NatalReadingLanguage,
  built: BuiltNatalModelContext,
): string {
  return `${permanentInputRules(built)}

Create every Premium section from premium_sections exactly once. Set free to false. Keep every section complete and grounded. The year_advice section may give a practical direction for the coming year, but must not invent dated events or timing absent from evidence.

premium_sections: vocation_money, career, health, shadow, life_path, year_advice.

Return JSON only:
{
  "sections": [
    {"section_key":"vocation_money","title":"естественный заголовок","free":false,"content":"завершённый текст с \\n\\n","evidence_ids":["existing evidence id"]},
    {"section_key":"career","title":"естественный заголовок","free":false,"content":"завершённый текст","evidence_ids":["existing evidence id"]},
    {"section_key":"health","title":"естественный заголовок","free":false,"content":"завершённый текст","evidence_ids":["existing evidence id"]},
    {"section_key":"shadow","title":"естественный заголовок","free":false,"content":"завершённый текст","evidence_ids":["existing evidence id"]},
    {"section_key":"life_path","title":"естественный заголовок","free":false,"content":"завершённый текст","evidence_ids":["existing evidence id"]},
    {"section_key":"year_advice","title":"естественный заголовок","free":false,"content":"завершённый текст","evidence_ids":["existing evidence id"]}
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
