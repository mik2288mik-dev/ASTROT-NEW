import OpenAI from 'openai';
import type { Language, NatalChartData, PlanetInsight, UserProfile } from '../types';
import { getOpenAIModelForContent } from './appSettings';
import { buildOpenAIChatParams } from './openaiChat';
import {
  buildPlanetInsightCacheKey,
  getPlanetDisplayName,
  getPlanetPositionFromChart,
  normalizePlanetKey,
  type NatalPlanetKey,
} from './natalPlanetMeta';
import { buildPlanetInsight } from './planetInsightContent';
import {
  getAstraSystem,
  addLanguageInstruction,
  createPlanetInsightPrompt,
  type PlanetInsightAIResponse,
} from './prompts';
import { hasActivePremium } from './accessMatrix';

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export const PLANET_INSIGHT_PROMPT_VERSION = 'planet_insight.v1';

export async function generatePlanetInsight(
  profile: UserProfile,
  chartData: NatalChartData,
  planetId: NatalPlanetKey
): Promise<PlanetInsight> {
  const language: Language = profile.language === 'en' ? 'en' : 'ru';
  const position = getPlanetPositionFromChart(chartData, planetId);

  if (!position) {
    throw new Error(`PLANET_POSITION_MISSING:${planetId}`);
  }

  if (!openai) {
    return buildPlanetInsight(chartData, planetId, language);
  }

  const planetLabel = getPlanetDisplayName(planetId, language);
  const house = typeof position.house === 'number' ? position.house : Number(position.house) || null;
  const degree =
    typeof position.degree === 'number' && Number.isFinite(position.degree)
      ? Math.round(position.degree)
      : null;
  const anchorSummary = [
    `${getPlanetDisplayName('sun', language)}: ${chartData.sun?.sign || ''}`,
    `${getPlanetDisplayName('moon', language)}: ${chartData.moon?.sign || ''}`,
    `${getPlanetDisplayName('rising', language)}: ${chartData.rising?.sign || ''}`,
  ].join(' • ');

  try {
    const prompt = addLanguageInstruction(
      createPlanetInsightPrompt(chartData, profile, {
        planetLabel,
        planetSign: position.sign,
        planetDegree: degree,
        house,
        anchorSummary,
      }),
      language
    );
    const { model } = await getOpenAIModelForContent({
      accessTier: hasActivePremium(profile) ? 'premium' : 'free',
      contentSurface: 'natal',
      contentVariant: 'planet_insight',
    });

    const completion = await openai.chat.completions.create(buildOpenAIChatParams(model, {
      messages: [
        { role: 'system', content: getAstraSystem(language === 'en' ? 'en' : 'ru') },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
      maxTokens: 520,
      jsonMode: true,
    }));

    const raw = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(raw) as PlanetInsightAIResponse;
    return buildPlanetInsight(chartData, planetId, language, parsed);
  } catch {
    return buildPlanetInsight(chartData, planetId, language);
  }
}

export function resolvePlanetInsightRequest(
  planetIdRaw: string | null | undefined,
  language: Language,
  calculationVersion?: string | null
) {
  const planetId = normalizePlanetKey(String(planetIdRaw || ''));
  if (!planetId) {
    throw new Error(language === 'en' ? 'Invalid planet id' : 'Некорректная планета');
  }

  return {
    planetId,
    cacheKey: buildPlanetInsightCacheKey(planetId, language, calculationVersion),
  };
}

export { buildPlanetInsight } from './planetInsightContent';
