import OpenAI from 'openai';
import type {
  NatalAnchorReading,
  NatalChartData,
  NatalFullReading,
  NatalLivingReading,
  UserProfile,
} from '../types';
import {
  getAppSystemPrompt,
  addLanguageInstruction,
  createNatalAnchorPromptV3,
  createNatalFullPrompt,
  createNatalLivingPromptV3,
  NatalAnchorAIResponse,
  NatalFullAIResponse,
  NatalLivingAIResponse,
} from './prompts';
import { getModelForTier } from './appSettings';
import { buildOpenAIChatParams } from './openaiChat';
import { getContentPolicy } from './contentMatrix';
import { getCurrentTransits } from './transits-calculator';
import {
  buildDailyAstroEvidence,
  buildNatalAnchorFallback,
  buildNatalAstroEvidence,
  buildNatalFullFallback,
  buildNatalLivingFallback,
  coerceNatalAnchorReading,
  coerceNatalFullReading,
  coerceNatalLivingReading,
  containsNatalBannedPhrase,
  getCurrentNatalPeriodKey,
  validateNatalHumanSections,
} from './natalReadings';

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

async function getNatalModel(kind: 'anchor' | 'full' | 'living') {
  const policy = getContentPolicy(kind === 'full' ? 'deep_report' : kind === 'living' ? 'personal_daily' : 'natal_section');
  return { model: await getModelForTier(policy.modelTier) };
}

async function isFlaggedByModeration(content: unknown): Promise<boolean> {
  if (!openai) return false;

  try {
    const moderation = await openai.moderations.create({
      model: 'omni-moderation-latest',
      input: JSON.stringify(content).slice(0, 12000),
    });
    return moderation.results.some((result) => result.flagged);
  } catch {
    return false;
  }
}

async function createJsonCompletion<T>({
  model,
  prompt,
  maxTokens,
  temperature,
  language,
}: {
  model: string;
  prompt: string;
  maxTokens: number;
  temperature: number;
  language: 'ru' | 'en';
}): Promise<T> {
  if (!openai) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const completion = await openai.chat.completions.create(buildOpenAIChatParams(model, {
    messages: [
      { role: 'system', content: getAppSystemPrompt(language) },
      { role: 'user', content: prompt },
    ],
    temperature,
    maxTokens,
    jsonMode: true,
  }));

  const content = completion.choices[0]?.message?.content || '{}';
  return JSON.parse(content) as T;
}

export async function generateNatalAnchorReading(
  profile: UserProfile,
  chartData: NatalChartData
): Promise<NatalAnchorReading> {
  const lang: 'ru' | 'en' = profile.language === 'en' ? 'en' : 'ru';
  const evidence = buildNatalAstroEvidence(chartData, lang).slice(0, 8);

  if (!openai) {
    return buildNatalAnchorFallback(lang, chartData);
  }

  try {
    const prompt = addLanguageInstruction(createNatalAnchorPromptV3(chartData, profile, evidence), lang);
    const { model } = await getNatalModel('anchor');
    const parsed = await createJsonCompletion<NatalAnchorAIResponse>({
      model,
      prompt,
      maxTokens: 3400,
      temperature: 0.55,
      language: lang,
    });
    const reading = coerceNatalAnchorReading({ ...parsed, astroEvidence: parsed.astroEvidence || evidence }, lang, chartData);
    if (
      !validateNatalHumanSections(reading.sections, ['character', 'emotions', 'first-impression', 'thoughts', 'love', 'action']) ||
      containsNatalBannedPhrase(reading) ||
      await isFlaggedByModeration(reading)
    ) {
      return buildNatalAnchorFallback(lang, chartData);
    }
    return reading;
  } catch (error) {
    console.error('[NatalContent] Anchor generation failed', error);
    return buildNatalAnchorFallback(lang, chartData);
  }
}

export async function generateNatalFullReading(
  profile: UserProfile,
  chartData: NatalChartData
): Promise<NatalFullReading> {
  const lang: 'ru' | 'en' = profile.language === 'en' ? 'en' : 'ru';
  const evidence = buildNatalAstroEvidence(chartData, lang).slice(0, 8);

  if (!openai) {
    return buildNatalFullFallback(lang, chartData);
  }

  try {
    const prompt = addLanguageInstruction(createNatalFullPrompt(chartData, profile, evidence), lang);
    const { model } = await getNatalModel('full');
    const parsed = await createJsonCompletion<NatalFullAIResponse>({
      model,
      prompt,
      maxTokens: 5200,
      temperature: 0.5,
      language: lang,
    });
    const reading = coerceNatalFullReading({ ...parsed, astroEvidence: parsed.astroEvidence || evidence }, lang, chartData);
    if (
      !validateNatalHumanSections(
        reading.sections,
        ['character', 'emotions', 'first-impression', 'thoughts-speech', 'love', 'action', 'money-stability', 'intimacy', 'when-hard']
      ) ||
      containsNatalBannedPhrase(reading) ||
      await isFlaggedByModeration(reading)
    ) {
      return buildNatalFullFallback(lang, chartData);
    }
    return reading;
  } catch (error) {
    console.error('[NatalContent] Full reading generation failed', error);
    return buildNatalFullFallback(lang, chartData);
  }
}

export async function generateNatalLivingReading(
  profile: UserProfile,
  chartData: NatalChartData,
  periodKey = getCurrentNatalPeriodKey()
): Promise<NatalLivingReading> {
  const lang: 'ru' | 'en' = profile.language === 'en' ? 'en' : 'ru';
  let transits = null;

  try {
    transits = await getCurrentTransits(new Date());
  } catch (error) {
    console.error('[NatalContent] Transit calculation failed', error);
  }

  const evidence = buildDailyAstroEvidence(chartData, transits, lang).slice(0, 5);

  if (!openai) {
    return buildNatalLivingFallback(lang, periodKey, chartData, evidence);
  }

  try {
    const prompt = addLanguageInstruction(createNatalLivingPromptV3(chartData, profile, periodKey, transits, evidence), lang);
    const { model } = await getNatalModel('living');
    const parsed = await createJsonCompletion<NatalLivingAIResponse>({
      model,
      prompt,
      maxTokens: 3600,
      temperature: 0.55,
      language: lang,
    });
    const reading = coerceNatalLivingReading(
      { ...parsed, periodKey, astroEvidence: parsed.astroEvidence || evidence },
      lang,
      periodKey,
      chartData
    );
    if (containsNatalBannedPhrase(reading) || await isFlaggedByModeration(reading)) {
      return buildNatalLivingFallback(lang, periodKey, chartData, evidence);
    }
    return reading;
  } catch (error) {
    console.error('[NatalContent] Daily reading generation failed', error);
    return buildNatalLivingFallback(lang, periodKey, chartData, evidence);
  }
}
