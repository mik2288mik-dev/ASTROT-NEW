import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { createHash } from 'crypto';
import { calculateNatalChart } from '../../../lib/swisseph-calculator';
import { db } from '../../../lib/db';
import { SYSTEM_PROMPT_ASTRA, createFullSynastryPrompt, addLanguageInstruction, FullSynastryAIResponse } from '../../../lib/prompts';
import { getOpenAIInterpretationModel } from '../../../lib/appSettings';

const log = {
  info: (message: string, data?: any) => {
    console.log(`[API/astrology/synastry-full] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[API/astrology/synastry-full] ERROR: ${message}`, error || '');
  },
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const buildCacheKey = (primaryChartId: number, partnerChartId: number, language: string) =>
  createHash('sha256')
    .update(`${primaryChartId}:${partnerChartId}:full:${language}`)
    .digest('hex');

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { profile, partnerName, partnerDate, partnerTime, partnerPlace, language, relationshipType, partnerChartId } = req.body;

    if (!profile || !partnerName || !partnerDate) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Profile, partnerName, and partnerDate are required'
      });
    }

    if (!profile.isPremium) {
      return res.status(403).json({
        error: 'Premium required',
        message: 'Full synastry analysis is available only for premium users'
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
      const cached = await db.synastry.get(primaryChartRecord.id, partnerChartRecord.id, 'full', cacheKey);
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
        fullAnalysis: {
          generalTheme: lang
            ? `Связь между ${profile?.name} и ${partnerName} строится на взаимном росте и внимании друг к другу.`
            : `The connection between ${profile?.name} and ${partnerName} is built on mutual growth and attention to each other.`,
          attraction: lang
            ? `Вас притягивает ощущение, что рядом можно быть собой и при этом открывать новые стороны характера.`
            : `You are drawn by the sense that you can be yourselves and still discover new sides of one another.`,
          difficulties: lang
            ? `Трудности чаще всего возникают из-за разного темпа, ожиданий и способа выражать чувства.`
            : `Difficulties usually arise from different pacing, expectations, and emotional expression.`,
          recommendations: lang
            ? ['Чаще обсуждайте ожидания', 'Не торопите друг друга в сложных разговорах', 'Поддерживайте общие ритуалы близости']
            : ['Discuss expectations more often', 'Do not rush difficult conversations', 'Keep shared rituals of closeness'],
          potential: lang
            ? `При зрелом подходе эта связь может стать сильным пространством для доверия, развития и глубокой близости.`
            : `With a mature approach, this connection can become a strong space for trust, growth, and deep closeness.`
        },
        summary: lang
          ? `Глубокий анализ совместимости между ${profile?.name} и ${partnerName}.`
          : `Deep compatibility analysis between ${profile?.name} and ${partnerName}.`
      };
      return res.status(200).json(fallbackResult);
    }

    const userPrompt = createFullSynastryPrompt(
      userChartData,
      profile,
      partnerChartData,
      partnerName,
      relationshipType || 'романтические отношения'
    );
    const promptWithLang = addLanguageInstruction(userPrompt, currentLanguage);

    const modelId = await getOpenAIInterpretationModel();
    const completion = await openai.chat.completions.create({
      model: modelId,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT_ASTRA },
        { role: 'user', content: promptWithLang }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 2500,
    });

    const content = completion.choices[0]?.message?.content || '{}';
    const result = JSON.parse(content) as FullSynastryAIResponse;

    if (primaryChartRecord?.id && partnerChartRecord?.id) {
      const cacheKey = buildCacheKey(primaryChartRecord.id, partnerChartRecord.id, currentLanguage);
      await db.synastry.set(primaryChartRecord.id, partnerChartRecord.id, 'full', cacheKey, result);
    }

    return res.status(200).json(result);
  } catch (error: any) {
    log.error('Error calculating full synastry', {
      message: error.message,
      stack: error.stack
    });

    return res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'Failed to calculate full synastry'
    });
  }
}
