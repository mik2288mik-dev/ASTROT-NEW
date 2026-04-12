import OpenAI from 'openai';
import type { Language, NatalChartData, PlanetInsight, PlanetInsightTag, UserProfile } from '../types';
import { getOpenAIModelForContent } from './appSettings';
import {
  buildPlanetInsightCacheKey,
  getHouseThemeLabel,
  getLocalizedElement,
  getLocalizedModality,
  getPlanetDisplayName,
  getPlanetPositionFromChart,
  getModalityForSign,
  getZodiacElementStyle,
  normalizePlanetKey,
  type NatalPlanetKey,
} from './natalWheel';
import { getElementForSign, type ZodiacSign } from './zodiac-utils';
import {
  SYSTEM_PROMPT_ASTRA,
  addLanguageInstruction,
  createPlanetInsightPrompt,
  type PlanetInsightAIResponse,
} from './prompts';

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export const PLANET_INSIGHT_PROMPT_VERSION = 'planet_insight.v1';

function trimSentence(value?: string | null): string {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function buildPlanetInsightTags(
  sign: string | null | undefined,
  house: number | null | undefined,
  language: Language
): PlanetInsightTag[] {
  const resolvedElement = sign ? getElementForSign(sign as ZodiacSign) : 'Air';
  const elementTone = getZodiacElementStyle(sign).tagTone;

  return [
    {
      id: 'element',
      label: getLocalizedElement(language, resolvedElement),
      tone: elementTone,
    },
    {
      id: 'modality',
      label: getLocalizedModality(language, getModalityForSign(sign)),
      tone: 'neutral',
    },
    {
      id: 'house',
      label: getHouseThemeLabel(house, language),
      tone: 'neutral',
    },
  ];
}

function buildFallbackBody(
  planetLabel: string,
  sign: string,
  house: number | null,
  language: Language
): string {
  if (language === 'en') {
    return `${planetLabel} in ${sign}${house ? ` in house ${house}` : ''} shows how this part of you naturally moves through life. It tends to speak through recognizable habits, emotional tone, and the situations you return to when something matters.`;
  }

  return `${planetLabel} в знаке ${sign}${house ? ` и ${house} доме` : ''} показывает, как эта часть тебя естественно проявляется в жизни. Обычно она слышна в привычных реакциях, внутреннем тоне и в тех ситуациях, к которым ты возвращаешься, когда для тебя что-то по-настоящему важно.`;
}

function buildFallbackTitle(planetLabel: string, sign: string, language: Language): string {
  if (language === 'en') {
    return `${planetLabel} in ${sign}`;
  }
  return `${planetLabel} в ${sign}`;
}

export function buildPlanetInsight(
  chartData: NatalChartData,
  planetId: NatalPlanetKey,
  language: Language,
  content?: Partial<PlanetInsightAIResponse>
): PlanetInsight {
  const position = getPlanetPositionFromChart(chartData, planetId);
  if (!position) {
    throw new Error(`PLANET_POSITION_MISSING:${planetId}`);
  }

  const sign = String(position.sign || '').trim() || 'Unknown';
  const house = typeof position.house === 'number' ? position.house : Number(position.house) || null;
  const degree = typeof position.degree === 'number' && Number.isFinite(position.degree)
    ? Math.round(position.degree)
    : null;
  const title = trimSentence(content?.title) || buildFallbackTitle(getPlanetDisplayName(planetId, language), sign, language);
  const body =
    trimSentence(content?.body) ||
    buildFallbackBody(getPlanetDisplayName(planetId, language), sign, house, language);

  return {
    planetId,
    title,
    sign,
    degree,
    house,
    body,
    tags: buildPlanetInsightTags(sign, house, language),
  };
}

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
  const degree = typeof position.degree === 'number' && Number.isFinite(position.degree)
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
      accessTier: profile.isPremium ? 'premium' : 'free',
      contentSurface: 'natal',
      contentVariant: 'planet_insight',
    });

    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT_ASTRA },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.8,
      max_tokens: 520,
    });

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
