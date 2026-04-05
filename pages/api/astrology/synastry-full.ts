import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { createHash } from 'crypto';
import { calculateNatalChart } from '../../../lib/swisseph-calculator';
import { db } from '../../../lib/db';
import { SYSTEM_PROMPT_ASTRA, createFullSynastryPrompt, addLanguageInstruction, FullSynastryAIResponse } from '../../../lib/prompts';
import { getOpenAIModelForContent } from '../../../lib/appSettings';
import { getPremiumEntitlementState } from '../../../lib/contentArchitecture';

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

    const currentLanguage = language === 'en' ? 'en' : 'ru';
    const langRu = currentLanguage === 'ru';

    const userId = String(profile?.id || '').trim();
    if (!userId) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'User id is required for full synastry',
      });
    }

    const { isPremium } = await getPremiumEntitlementState(userId);
    if (!isPremium) {
      return res.status(403).json({
        code: 'PREMIUM_REQUIRED',
        error: 'Premium required',
        message: langRu
          ? 'Полный разбор совместимости доступен по Lumia Premium. Тот же полный разбор можно открыть разово за Lumi на экране синастрии.'
          : 'Full compatibility analysis is available with Lumia Premium. The same full reading can be unlocked one-off with Lumi on the Synastry screen.',
      });
    }

    const lang = langRu;

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
            ? `Связь между ${profile?.name} и ${partnerName} ощущается как пространство, где многое строится не на лёгкости самой по себе, а на взаимном росте, внимании и умении замечать друг друга по-настоящему. В такой паре особенно важно не просто нравиться друг другу, а учиться выдерживать разницу в темпе, чувствах и способах сближения.`
            : `The connection between ${profile?.name} and ${partnerName} feels like a space built not only on ease, but on mutual growth, attention, and the ability to truly notice one another. In a bond like this, it matters not just to enjoy each other, but to handle differences in pace, emotion, and closeness with maturity.`,
          attraction: lang
            ? `Вас притягивает ощущение, что рядом можно быть собой и одновременно раскрываться шире, чем в одиночку. Часто именно такие пары особенно чувствуют живой интерес друг к другу в разговорах, в личной уязвимости и в моментах, где один помогает другому увидеть новую сторону себя.`
            : `You are drawn by the sense that you can be yourselves and still open into more of who you are together. Bonds like this often feel especially alive in conversation, vulnerability, and in moments where one person helps the other see a new side of themselves.`,
          difficulties: lang
            ? `Трудности чаще всего возникают не из отсутствия чувства, а из разного темпа, ожиданий и способа выражать эмоции. Один может хотеть больше ясности и прямоты, другой — больше времени, мягкости или внутренней безопасности; если это не проговаривать, напряжение легко уходит в обиды, дистанцию или попытку всё сгладить.`
            : `Difficulties here usually come not from a lack of feeling, but from different pacing, expectations, and ways of expressing emotion. One person may want more clarity and directness while the other needs more time, softness, or inner safety; without naming that difference, tension can easily become distance, hurt, or overcompensation.`,
          recommendations: lang
            ? [
                'Чаще проговаривайте ожидания до того, как они превращаются в обиду или молчаливое напряжение.',
                'В сложных разговорах не торопите друг друга: сначала дайте смыслу проявиться, потом ищите решение.',
                'Поддерживайте свои ритуалы близости, которые возвращают ощущение “мы на одной стороне”.',
              ]
            : [
                'Talk about expectations before they harden into resentment or silent tension.',
                'Do not rush difficult conversations; let the real meaning surface before trying to fix it.',
                'Keep shared rituals of closeness that remind you that you are on the same side.',
              ],
          potential: lang
            ? `При зрелом подходе эта связь может стать сильным пространством для доверия, глубокой близости и внутреннего развития обоих. У неё есть потенциал не просто дать яркие чувства, а научить вас более честной, устойчивой и бережной форме близости.`
            : `With a mature approach, this connection can become a strong space for trust, deep closeness, and inner growth for both people. Its potential is not only to create strong feelings, but to teach a more honest, steady, and caring form of intimacy.`,
        },
        summary: lang
          ? `Глубокий разбор совместимости между ${profile?.name} и ${partnerName} с акцентом на динамику, напряжение и потенциал связи.`
          : `A deep compatibility reading for ${profile?.name} and ${partnerName}, focused on dynamic, tension, and relational potential.`
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

    const { model: modelId } = await getOpenAIModelForContent({
      accessTier: 'premium',
      contentSurface: 'synastry',
      contentVariant: 'full',
    });
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
