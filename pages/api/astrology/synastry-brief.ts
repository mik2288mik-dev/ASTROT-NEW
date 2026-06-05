import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { createHash } from 'crypto';
import { calculateNatalChart } from '../../../lib/swisseph-calculator';
import { db } from '../../../lib/db';
import { AdminAuthError, handleAdminError, requireTelegramUserId } from '../../../lib/adminAuth';
import { SYSTEM_PROMPT_ASTRA, createBriefSynastryPrompt, addLanguageInstruction, BriefSynastryAIResponse } from '../../../lib/prompts';
import { getOpenAIModelForContent } from '../../../lib/appSettings';
import { validateSynastryInput, formatValidationErrors } from '../../../lib/validation';

const log = {
  info: (message: string, data?: any) => {
    console.log(`[API/astrology/synastry-brief] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[API/astrology/synastry-brief] ERROR: ${message}`, error || '');
  },
};

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const buildCacheKey = (primaryChartId: number, partnerChartId: number, language: string) =>
  createHash('sha256')
    .update(`${primaryChartId}:${partnerChartId}:brief:${language}`)
    .digest('hex');

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  log.info('Request received', {
    method: req.method,
    path: req.url
  });

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { profile, partnerName, partnerDate, partnerTime, partnerPlace, language, relationshipType, partnerChartId } = req.body;

    const validation = validateSynastryInput({
      profile,
      partnerName,
      partnerDate,
      partnerTime,
      partnerPlace,
      language: language || profile?.language || 'ru'
    });

    if (!validation.isValid) {
      const userLanguage = (language || profile?.language || 'ru') === 'en' ? 'en' : 'ru';
      const errorMessage = formatValidationErrors(validation.errors, userLanguage);
      return res.status(400).json({
        error: 'Validation failed',
        message: errorMessage,
        errors: validation.errors
      });
    }

    const currentLanguage = language === 'en' ? 'en' : 'ru';
    const lang = currentLanguage === 'ru';
    const userId = String(profile?.id || '').trim();
    requireTelegramUserId(req, userId);

    let primaryChartRecord: any = null;
    let partnerChartRecord: any = null;
    let userChartData: any = null;
    let partnerChartData: any = null;

    if (profile?.id) {
      primaryChartRecord = await db.natal_charts.getPrimary(String(profile.id));
      userChartData = primaryChartRecord?.chart_data || null;
    }

    if (partnerChartId && profile?.id) {
      partnerChartRecord = await db.natal_charts.getById(Number(partnerChartId));
      if (!partnerChartRecord || String(partnerChartRecord.user_id) !== String(profile.id)) {
        return res.status(404).json({
          error: 'Partner chart not found',
          message: 'Saved partner chart not found'
        });
      }
      partnerChartData = partnerChartRecord.chart_data || null;
    }

    if (primaryChartRecord?.id && partnerChartRecord?.id) {
      const cacheKey = buildCacheKey(primaryChartRecord.id, partnerChartRecord.id, currentLanguage);
      const cached = await db.synastry.get(primaryChartRecord.id, partnerChartRecord.id, 'brief', cacheKey);
      if (cached) {
        const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
        return res.status(200).json(parsed);
      }
    }

    if (!userChartData) {
      userChartData = await calculateNatalChart(
        profile.name,
        profile.birthDate,
        profile.birthTime || '12:00',
        profile.birthPlace
      );
    }

    if (!partnerChartData) {
      partnerChartData = await calculateNatalChart(
        partnerName,
        partnerDate,
        partnerTime || '12:00',
        partnerPlace || profile.birthPlace
      );
    }

    if (!openai) {
      const fallbackResult = {
        briefOverview: {
          introduction: lang
            ? `${profile?.name} и ${partnerName} быстро считывают друг друга, но эта связь особенно чувствительна к тону общения и темпу сближения.`
            : `${profile?.name} and ${partnerName} tend to read each other quickly, but this bond is especially sensitive to tone and pace.`,
          harmony: lang
            ? 'Здесь есть потенциал к живому обмену и ощущению, что рядом можно быть чуть честнее, чем обычно. Эта связь может давать чувство включённости и взаимного интереса.'
            : 'There is potential here for lively exchange and the feeling that both people can be more honest than usual. This connection can create real engagement and curiosity.',
          challenges: lang
            ? 'Трение чаще появляется не из-за отсутствия симпатии, а из-за разных ожиданий и скорости реакции. Если главное не проговаривать сразу, оба могут додумывать лишнее.'
            : 'Friction here is more likely to come from different expectations and response speeds than from lack of care. If the important part is not said clearly, both people may start filling in the blanks.',
          tips: lang
            ? [
                'Сразу проговаривать, что для тебя действительно важно',
                'Не требовать одинаковой скорости реакции',
                'Оставлять место и для близости, и для личного пространства',
                'Возвращаться к разговору до того, как накопится напряжение'
              ]
            : [
                'Say clearly what actually matters to you',
                'Do not expect the same reaction speed from each other',
                'Make room for both closeness and personal space',
                'Return to the conversation before tension piles up'
              ]
        },
        summary: lang
          ? `Краткий, но уже полезный взгляд на динамику между ${profile?.name} и ${partnerName}.`
          : `A brief but already useful look at the dynamic between ${profile?.name} and ${partnerName}.`
      };
      return res.status(200).json(fallbackResult);
    }

    const userPrompt = createBriefSynastryPrompt(
      userChartData,
      profile,
      partnerChartData,
      partnerName,
      relationshipType || 'романтика'
    );
    const promptWithLang = addLanguageInstruction(userPrompt, currentLanguage);

    const { model: modelId } = await getOpenAIModelForContent({
      accessTier: 'free',
      contentSurface: 'synastry',
      contentVariant: 'brief',
    });
    const completion = await openai.chat.completions.create({
      model: modelId,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT_ASTRA },
        { role: 'user', content: promptWithLang }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 1500,
    });

    const content = completion.choices[0]?.message?.content || '{}';
    const result = JSON.parse(content) as BriefSynastryAIResponse;

    if (primaryChartRecord?.id && partnerChartRecord?.id) {
      const cacheKey = buildCacheKey(primaryChartRecord.id, partnerChartRecord.id, currentLanguage);
      await db.synastry.set(primaryChartRecord.id, partnerChartRecord.id, 'brief', cacheKey, result);
    }

    return res.status(200).json(result);
  } catch (error: any) {
    if (error instanceof AdminAuthError) {
      return handleAdminError(res, error);
    }

    log.error('Error calculating brief synastry', {
      message: error.message,
      stack: error.stack
    });

    return res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'Failed to calculate synastry'
    });
  }
}
