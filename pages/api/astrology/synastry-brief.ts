import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { createHash } from 'crypto';
import { calculateNatalChart } from '../../../lib/swisseph-calculator';
import { db } from '../../../lib/db';
import { SYSTEM_PROMPT_ASTRA, createBriefSynastryPrompt, addLanguageInstruction, BriefSynastryAIResponse } from '../../../lib/prompts';
import { validateSynastryInput, formatValidationErrors } from '../../../lib/validation';

const log = {
  info: (message: string, data?: any) => {
    console.log(`[API/astrology/synastry-brief] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[API/astrology/synastry-brief] ERROR: ${message}`, error || '');
  },
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

    if (!process.env.OPENAI_API_KEY) {
      const fallbackResult = {
        briefOverview: {
          introduction: lang
            ? `${profile?.name} и ${partnerName} создают интересную динамику. Каждый приносит свои уникальные качества.`
            : `${profile?.name} and ${partnerName} create interesting dynamics. Each brings unique qualities.`,
          harmony: lang
            ? 'В этой связи есть естественное понимание друг друга. Вы оба цените искренность и открытость.'
            : 'There is natural understanding in this connection. You both value honesty and openness.',
          challenges: lang
            ? 'Иногда может возникать недопонимание из-за разных темпераментов. Важно давать друг другу пространство.'
            : 'Sometimes misunderstandings may arise due to different temperaments. It is important to give each other space.',
          tips: lang
            ? ['Слушайте друг друга внимательно', 'Цените различия как возможность для роста', 'Находите компромиссы', 'Поддерживайте открытую коммуникацию']
            : ['Listen to each other attentively', 'Value differences as opportunities for growth', 'Find compromises', 'Keep communication open']
        },
        summary: lang
          ? `Краткий обзор совместимости между ${profile?.name} и ${partnerName}.`
          : `Brief compatibility overview between ${profile?.name} and ${partnerName}.`
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

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
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
