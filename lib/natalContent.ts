import OpenAI from 'openai';
import type { NatalAnchorReading, NatalLivingReading, NatalChartData, UserProfile } from '../types';
import {
  SYSTEM_PROMPT_ASTRA,
  addLanguageInstruction,
  createNatalAnchorPrompt,
  createNatalLivingPrompt,
  NatalAnchorAIResponse,
  NatalLivingAIResponse,
} from './prompts';
import { getOpenAIModelForContent } from './appSettings';
import { getCurrentTransits } from './transits-calculator';
import {
  buildNatalAnchorFallback,
  buildNatalLivingFallback,
  coerceNatalAnchorReading,
  coerceNatalLivingReading,
  getCurrentNatalPeriodKey,
} from './natalReadings';

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

async function getNatalModel(modelTier: 'base' | 'premium') {
  return getOpenAIModelForContent({
    accessTier: modelTier === 'premium' ? 'premium' : 'free',
    contentSurface: 'natal',
    contentVariant: modelTier === 'premium' ? 'living' : 'anchor',
  });
}

export async function generateNatalAnchorReading(
  profile: UserProfile,
  chartData: NatalChartData
): Promise<NatalAnchorReading> {
  const lang: 'ru' | 'en' = profile.language === 'en' ? 'en' : 'ru';

  if (!openai) {
    return buildNatalAnchorFallback(lang);
  }

  try {
    const prompt = addLanguageInstruction(createNatalAnchorPrompt(chartData, profile), lang);
    const { model } = await getNatalModel('base');
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT_ASTRA },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.75,
      max_tokens: 1800,
    });

    const content = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content) as NatalAnchorAIResponse;
    return coerceNatalAnchorReading(parsed, lang);
  } catch {
    return buildNatalAnchorFallback(lang);
  }
}

export async function generateNatalLivingReading(
  profile: UserProfile,
  chartData: NatalChartData,
  periodKey = getCurrentNatalPeriodKey()
): Promise<NatalLivingReading> {
  const lang: 'ru' | 'en' = profile.language === 'en' ? 'en' : 'ru';
  const transits = await getCurrentTransits(new Date());

  if (!openai) {
    return buildNatalLivingFallback(lang, periodKey);
  }

  try {
    const prompt = addLanguageInstruction(createNatalLivingPrompt(chartData, profile, periodKey, transits), lang);
    const { model } = await getNatalModel('premium');
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT_ASTRA },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.85,
      max_tokens: 1600,
    });

    const content = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content) as NatalLivingAIResponse;
    return coerceNatalLivingReading(parsed, lang, periodKey);
  } catch {
    return buildNatalLivingFallback(lang, periodKey);
  }
}
