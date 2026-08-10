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
- Не пиши «Вы склонны» или «Вам свойственно». Говори прямо: «Ты тот, кто…», «Твоя голова работает так…», «В отношениях тебя бесит…».
- Каждый блок завершён сам по себе: не повторяет соседний, не обещает продолжение в Premium и не делает из человека диагноз.
- Каждый блок обязан вернуть только реальные evidence_ids из входного массива. Не печатай эти идентификаторы в пользовательском тексте.
- Ответ — только валидный JSON без Markdown.`
    : `NATAL PORTRAIT TASK
- Turn calculated astrological facts into a vivid, precise story about a person without mysticism or pseudo-psychology.
- Write directly: “You are the person who…”, “Your mind works like this…”, “In close relationships, what irritates you is…”.
- Every block stands on its own: it does not repeat the adjacent block, tease Premium, or diagnose the reader.
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
  const sections = language === 'ru'
    ? [
        ['personality', 'Ты по натуре'],
        ['thinking', 'Как ты думаешь и говоришь'],
        ['relationships', 'Твои отношения и любовь'],
        ['vulnerabilities', 'Твои слабые места'],
      ]
    : [
        ['personality', 'Who you are'],
        ['thinking', 'How you think and speak'],
        ['relationships', 'Love and relationships'],
        ['vulnerabilities', 'Your vulnerable points'],
      ];
  return `${permanentInputRules(built)}

Create a 22–32 word hook before the sections. It is a blunt, recognisable first observation about this person, grounded in evidence; it is not a slogan. Then create exactly four complete Free sections in the supplied order and use the supplied titles verbatim. Each section must stand on its own, never tease Premium, and use 65–85 words in one or two short paragraphs. Do not repeat the same trait in different sections. Set free to true for every section.

Return JSON only:
{
  "hook":{"text":"short personal opening","evidence_ids":["existing evidence id"]},
  "sections": [
${sections.map(([key, title]) => `    {"section_key":"${key}","title":"${title}","free":true,"content":"complete concise reading","evidence_ids":["existing evidence id"]}`).join(',\n')}
  ]
}

AUTHORITATIVE CALCULATED BIRTH CHART:
${JSON.stringify(built.context, null, 2)}`;
}

export function buildPermanentNatalPremiumPrompt(
  language: NatalReadingLanguage,
  built: BuiltNatalModelContext,
): string {
  const sections = language === 'ru'
    ? [
        ['vocation_money', 'Призвание и деньги'],
        ['career', 'Карьера'],
        ['health', 'Здоровье и энергия'],
        ['shadow', 'Твоя тень'],
        ['life_path', 'Жизненный путь'],
        ['year_advice', 'Стратегия роста'],
      ]
    : [
        ['vocation_money', 'Vocation and money'],
        ['career', 'Career'],
        ['health', 'Health and energy'],
        ['shadow', 'Your shadow'],
        ['life_path', 'Life path'],
        ['year_advice', 'Growth strategy'],
      ];
  return `${permanentInputRules(built)}

Create every Premium section exactly once in the supplied order and use the supplied titles verbatim. Set free to false. Each section must be complete, grounded, distinct from the others, and use 85–105 words in one or two short paragraphs. The year_advice key is a permanent growth strategy derived from the natal chart: do not mention the coming year, current transits, dates, future events, or timing.

premium_sections: vocation_money, career, health, shadow, life_path, year_advice.

Return JSON only:
{
  "sections": [
${sections.map(([key, title]) => `    {"section_key":"${key}","title":"${title}","free":false,"content":"complete concise reading","evidence_ids":["existing evidence id"]}`).join(',\n')}
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
