import OpenAI from 'openai';
import type { Language, NatalChartData, UserProfile, WheelInsight } from '../types';
import { getOpenAIModelForContent } from './appSettings';
import {
  buildWheelInsight,
  resolveWheelInsightRequest,
  type WheelInsightEntityType,
  type WheelInsightRequest,
} from './wheelInsightContent';
import {
  SYSTEM_PROMPT_ASTRA,
  addLanguageInstruction,
  createWheelInsightPrompt,
  type WheelInsightAIResponse,
} from './prompts';
import { getPlanetDisplayName } from './natalWheel';
import { getZodiacSign } from '../constants';

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export const WHEEL_INSIGHT_PROMPT_VERSION = 'wheel_insight.v1';

function buildEntitySummary(
  chartData: NatalChartData,
  request: WheelInsightRequest,
  language: Language
) {
  if (request.entityType === 'planet') {
    const preview = buildWheelInsight(chartData, request, language);
    return {
      entityLabel: preview.title,
      entitySubtitle: preview.subtitle,
      entitySummary: `${preview.title} — ${preview.subtitle}`,
    };
  }

  if (request.entityType === 'zodiac') {
    const signLabel = getZodiacSign(language, request.entityId);
    const preview = buildWheelInsight(chartData, request, language);
    return {
      entityLabel: signLabel,
      entitySubtitle: preview.subtitle,
      entitySummary: `${signLabel} in the natal wheel — ${preview.subtitle}`,
    };
  }

  if (request.entityType === 'house') {
    const preview = buildWheelInsight(chartData, request, language);
    return {
      entityLabel: preview.title,
      entitySubtitle: preview.subtitle,
      entitySummary: `${preview.title} — ${preview.subtitle}`,
    };
  }

  const preview = buildWheelInsight(chartData, request, language);
  return {
    entityLabel: preview.title,
    entitySubtitle: preview.subtitle,
    entitySummary: `${preview.title} — ${preview.subtitle}`,
  };
}

function buildCoreAnchors(chartData: NatalChartData, language: Language) {
  return [
    `${getPlanetDisplayName('sun', language)}: ${chartData.sun?.sign || ''}`,
    `${getPlanetDisplayName('moon', language)}: ${chartData.moon?.sign || ''}`,
    `${getPlanetDisplayName('rising', language)}: ${chartData.rising?.sign || ''}`,
  ].join(' • ');
}

export async function generateWheelInsight(
  profile: UserProfile,
  chartData: NatalChartData,
  request: WheelInsightRequest
): Promise<WheelInsight> {
  const language: Language = profile.language === 'en' ? 'en' : 'ru';

  if (!openai) {
    return buildWheelInsight(chartData, request, language);
  }

  const { entityLabel, entitySubtitle, entitySummary } = buildEntitySummary(chartData, request, language);
  const coreAnchors = buildCoreAnchors(chartData, language);

  try {
    const prompt = addLanguageInstruction(
      createWheelInsightPrompt(chartData, profile, {
        entityType: request.entityType,
        entityLabel,
        entitySubtitle,
        entitySummary,
        coreAnchors,
      }),
      language
    );
    const { model } = await getOpenAIModelForContent({
      accessTier: 'free',
      contentSurface: 'natal',
      contentVariant: 'wheel_insight',
    });

    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT_ASTRA },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.82,
      max_tokens: 560,
    });

    const raw = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(raw) as WheelInsightAIResponse;
    return buildWheelInsight(chartData, request, language, parsed);
  } catch {
    return buildWheelInsight(chartData, request, language);
  }
}

export function resolveWheelInsightEntityRequest(
  chartData: NatalChartData,
  entityTypeRaw: string | null | undefined,
  entityIdRaw: string | null | undefined,
  language: Language
) {
  return resolveWheelInsightRequest(chartData, entityTypeRaw, entityIdRaw, language);
}

export type { WheelInsightEntityType };
export { buildWheelInsight } from './wheelInsightContent';
