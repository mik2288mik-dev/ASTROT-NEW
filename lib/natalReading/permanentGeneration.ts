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

function languageRule(language: NatalReadingLanguage): string {
  return language === 'ru'
    ? 'Write every user-facing field in Russian. Address the reader as «ты».'
    : 'Write every user-facing field in English. Address the reader as “you”.';
}

function permanentRules(built: BuiltNatalModelContext): string {
  const angleRule = built.anglesIncluded
    ? `Only these explicitly present reliable angles may be interpreted: ${[...built.reliableAngleKeys].join(', ')}.`
    : 'The input deliberately contains no angles or MC. Do not mention or infer them.';
  const houseRule = built.housesIncluded
    ? `Only these explicitly present reliable houses may be interpreted: ${[...built.reliableHouseNumbers].sort((a, b) => a - b).join(', ')}.`
    : 'The input deliberately contains no houses, cusps, or house rulers. Do not mention or infer them.';
  return `This is a permanent birth-chart reading, not a forecast.
- Interpret only the supplied calculated facts. Never recalculate a position, aspect, house, orb, or degree.
- Do not discuss changing sky conditions, calendar windows, dated events, or when something will happen.
- Do not invent biography, childhood, trauma, diagnoses, a profession, income, relationship history, guaranteed events, or karmic facts.
- Every headline, paragraph, strength, conflict, strategy, pitfall, and conclusion must cite one or more evidence_ids that exist verbatim in the supplied evidence array.
- Evidence identifiers are machine references. Do not print them inside user-facing text.
- No Markdown and no fields outside the requested JSON object.
- ${angleRule}
- ${houseRule}`;
}

export function buildPermanentNatalFreePrompt(
  language: NatalReadingLanguage,
  built: BuiltNatalModelContext,
): string {
  return `${languageRule(language)}

${permanentRules(built)}

Create the complete Free birth-chart reading. Keep it concise but specific. The hook must feel personal without claiming facts about the reader's biography. Give two or three distinct strengths, one central inner contradiction grounded in an aspect or a clear combination of placements, and one practical non-generic direction that remains useful over time.

Return JSON only in exactly this shape:
{
  "headline": "2-8 direct words",
  "headline_evidence_ids": ["existing evidence id"],
  "hook": {"text": "...", "evidence_ids": ["..."]},
  "core": {
    "sun": {"text": "...", "evidence_ids": ["..."]},
    "moon": {"text": "...", "evidence_ids": ["..."]},
    "ascendant": ${built.ascendantIncluded ? '{"text": "...", "evidence_ids": ["..."]}' : 'null'}
  },
  "strengths": [
    {"text": "...", "evidence_ids": ["..."]},
    {"text": "...", "evidence_ids": ["..."]}
  ],
  "conflict": {"text": "...", "evidence_ids": ["..."]},
  "advice": {"text": "...", "evidence_ids": ["..."]}
}

AUTHORITATIVE CALCULATED BIRTH CHART:
${JSON.stringify(built.context, null, 2)}`;
}

export function buildPermanentNatalPremiumPrompt(
  language: NatalReadingLanguage,
  built: BuiltNatalModelContext,
): string {
  return `${languageRule(language)}

${permanentRules(built)}

Create one cohesive Premium birth-chart report. It must remain valid as a portrait of the person. Choose six to ten natural sections and their order yourself from the strongest supported links in the complete calculation. Across the report, where supported, cover personality, decisions and motivation, emotional responses, closeness and vulnerability, work and money style, abilities, recurring inner contradictions, and the lunar nodes as enduring life themes. Do not force a topic that the supplied facts do not support.

After the main sections, give exactly three enduring strategies for using the chart's potential, two to five recognisable pitfalls, and a short conclusion. Strategies are stable ways of working with natal tendencies, never date-based instructions. Avoid repeating the same interpretation under different headings.

Return JSON only in exactly this shape:
{
  "headline": "2-8 direct words",
  "headline_evidence_ids": ["existing evidence id"],
  "lead": {"text": "...", "evidence_ids": ["..."]},
  "sections": [
    {
      "id": "short-stable-id",
      "title": "meaningful heading",
      "paragraphs": [
        {"text": "1-3 concise sentences", "evidence_ids": ["existing evidence id"]}
      ]
    }
  ],
  "strategies": [
    {"title": "short title", "text": "...", "evidence_ids": ["..."]},
    {"title": "short title", "text": "...", "evidence_ids": ["..."]},
    {"title": "short title", "text": "...", "evidence_ids": ["..."]}
  ],
  "pitfalls": [
    {"text": "...", "evidence_ids": ["..."]},
    {"text": "...", "evidence_ids": ["..."]}
  ],
  "conclusion": {"text": "...", "evidence_ids": ["..."]}
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
    system: getAppSystemVoice(language),
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
    system: getAppSystemVoice(language),
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
