import type { NextApiRequest, NextApiResponse } from 'next';
import type { NatalFullReading } from '../../../types';
import { getOpenAIModelForContent } from '../../../lib/appSettings';
import { db } from '../../../lib/db';
import { generateNatalFullReading } from '../../../lib/natalContent';
import {
  coerceNatalFullReading,
  NATAL_FULL_CACHE_KEY,
  NATAL_FULL_PROMPT_VERSION,
} from '../../../lib/natalReadings';
import { withRateLimit, RATE_LIMIT_CONFIGS } from '../../../lib/rateLimit';

const TITLE_TO_KEY: Record<string, string> = {
  personality: 'personality',
  love: 'love',
  career: 'career',
  weakness: 'weakness',
  weaknesses: 'weakness',
  karma: 'karma',
  'личность': 'personality',
  'любовь': 'love',
  'карьера': 'career',
  'слабости': 'weakness',
  'карма': 'karma',
};

const log = {
  info: (message: string, data?: any) => console.log(`[API/astrology/deep-dive] ${message}`, data || ''),
  error: (message: string, error?: any) => console.error(`[API/astrology/deep-dive] ERROR: ${message}`, error || ''),
};

function normalizeTopic(topic: unknown) {
  const raw = String(topic || 'personality').trim().toLowerCase();
  const mapped = TITLE_TO_KEY[raw] || raw;
  return ['personality', 'love', 'career', 'weakness', 'karma'].includes(mapped) ? mapped : 'personality';
}

function sectionText(title: string, body: string) {
  return `${title}\n\n${body}`.trim();
}

function selectDeepDiveText(reading: NatalFullReading, topicKey: string, lang: 'ru' | 'en') {
  if (lang === 'en') {
    switch (topicKey) {
      case 'love':
        return sectionText('How you build closeness', reading.closeness);
      case 'career':
        return sectionText('How you choose and act', `${reading.choices}\n\n${reading.strengths}`);
      case 'weakness':
        return sectionText('Where tension repeats', `${reading.tensionPattern}\n\n${reading.integration}`);
      case 'karma':
        return sectionText('How to work with the repeating pattern', reading.integration);
      default:
        return sectionText('Full personality interpretation', `${reading.mainConfiguration}\n\n${reading.reactions}\n\n${reading.choices}`);
    }
  }

  switch (topicKey) {
    case 'love':
      return sectionText('Как ты строишь близость', reading.closeness);
    case 'career':
      return sectionText('Как ты выбираешь и действуешь', `${reading.choices}\n\n${reading.strengths}`);
    case 'weakness':
      return sectionText('Где повторяется напряжение', `${reading.tensionPattern}\n\n${reading.integration}`);
    case 'karma':
      return sectionText('Как с этим обращаться', reading.integration);
    default:
      return sectionText('Полная интерпретация личности', `${reading.mainConfiguration}\n\n${reading.reactions}\n\n${reading.choices}`);
  }
}

async function readCurrentFull(userId: string, chartId: number | null, lang: 'ru' | 'en', chartData: any) {
  const cached = chartId != null
    ? await db.content_interpretations.getByChart(chartId, 'premium', 'natal', 'full', NATAL_FULL_CACHE_KEY)
    : await db.content_interpretations.getByUser(userId, 'premium', 'natal', 'full', NATAL_FULL_CACHE_KEY);

  if (!cached?.content || cached.promptVersion !== NATAL_FULL_PROMPT_VERSION) return null;
  return coerceNatalFullReading(cached.content, lang, chartData);
}

async function upsertFull(userId: string, chartId: number | null, chartData: any, reading: NatalFullReading) {
  const { modelTier } = await getOpenAIModelForContent({
    accessTier: 'premium',
    contentSurface: 'natal',
    contentVariant: 'full',
  });

  const payload = {
    accessTier: 'premium' as const,
    contentSurface: 'natal' as const,
    contentVariant: 'full' as const,
    cacheKey: NATAL_FULL_CACHE_KEY,
    inputHash: NATAL_FULL_CACHE_KEY,
    content: reading,
    modelTier,
    promptVersion: NATAL_FULL_PROMPT_VERSION,
    calculationVersion: chartData?.calculationVersion || null,
    isPersistent: true,
    canRegenerateForLumi: false,
    legacySource: 'natal_content_unified_v3.legacy_deep_dive',
  };

  if (chartId != null) {
    await db.content_interpretations.upsertByChart(chartId, payload, userId);
  } else {
    await db.content_interpretations.upsertByUser(userId, payload);
  }
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { profile, topic, chartData, chartId } = req.body || {};
    if (!profile || !topic || !chartData) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Profile, topic, and chartData are required',
      });
    }

    const userId = String(profile.id || profile.name || '').trim();
    if (!userId) {
      return res.status(400).json({ error: 'Bad request', message: 'User id is required' });
    }

    const lang = profile.language === 'en' ? 'en' : 'ru';
    const topicKey = normalizeTopic(topic);
    const effectiveChartId = chartId != null ? Number.parseInt(String(chartId), 10) : null;
    const safeChartId = Number.isFinite(effectiveChartId as number) ? effectiveChartId : null;

    log.info('Deep dive request received', {
      userId,
      chartId: safeChartId,
      topic: topicKey,
      language: lang,
    });

    const cached = await readCurrentFull(userId, safeChartId, lang, chartData);
    if (cached) {
      return res.status(200).json({
        analysis: selectDeepDiveText(cached, topicKey, lang),
        reading: cached,
        persisted: true,
        source: 'cache',
      });
    }

    const reading = await generateNatalFullReading(profile, chartData);
    await upsertFull(userId, safeChartId, chartData, reading);

    return res.status(200).json({
      analysis: selectDeepDiveText(reading, topicKey, lang),
      reading,
      persisted: true,
      source: 'generated',
    });
  } catch (error: any) {
    log.error('Error in deep dive handler', {
      error: error.message,
      code: error.code,
      type: error.type,
    });

    return res.status(500).json({
      error: 'Deep dive generation failed',
      code: error?.code || 'DEEP_DIVE_INTERNAL_ERROR',
      message: error?.message || 'Failed to load the natal interpretation.',
    });
  }
}

export default withRateLimit(handler, RATE_LIMIT_CONFIGS.AI_PREMIUM);
