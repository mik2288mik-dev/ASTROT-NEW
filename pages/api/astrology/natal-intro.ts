import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../lib/db';
import { withRateLimit, RATE_LIMIT_CONFIGS } from '../../../lib/rateLimit';
import { generateNatalIntroWithOpenAI } from '../../../lib/natal-intro-ai';

// Logging utility
const log = {
  info: (message: string, data?: any) => {
    console.log(`[API/astrology/natal-intro] ${message}`, data || '');
  },
  warn: (message: string, data?: any) => {
    console.warn(`[API/astrology/natal-intro] WARN: ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[API/astrology/natal-intro] ERROR: ${message}`, error || '');
  },
};

/**
 * Main API handler
 */
async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { profile, chartData, chartId } = req.body;

    if (!profile || !chartData) {
      log.error('Missing required fields', { hasProfile: !!profile, hasChartData: !!chartData });
      return res.status(400).json({ 
        error: 'Bad request',
        message: 'Profile and chartData are required'
      });
    }

    const userId = profile.id || profile.name;
    const effectiveChartId = chartId != null ? parseInt(String(chartId), 10) : null;
    const cacheKey = effectiveChartId ?? userId;

    log.info('Natal intro request received', {
      userId,
      chartId: effectiveChartId,
      language: profile.language,
      hasSun: !!chartData.sun,
      hasMoon: !!chartData.moon,
      hasRising: !!chartData.rising
    });

    // Проверяем кэш в interpretations (chart-level или user/primary)
    if (cacheKey) {
      try {
        const cached = await db.interpretations.getByHash(cacheKey, 'natal_intro', 'default');
        if (cached?.content && cached.content.length > 50) {
          log.info('Returning cached natal intro', { chartId: effectiveChartId, userId });
          res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=172800');
          return res.status(200).json({
            intro: cached.content,
            timestamp: Date.now(),
            persisted: true,
            source: 'cache',
          });
        }
      } catch (cacheError: any) {
        log.error('Failed to read natal intro cache', {
          error: cacheError.message,
          chartId: effectiveChartId,
          userId,
        });
        return res.status(500).json({
          error: 'Cache read failed',
          code: 'NATAL_INTRO_CACHE_READ_FAILED',
          message: profile.language === 'ru'
            ? 'Не удалось загрузить сохранённый текст натальной карты.'
            : 'Failed to load the saved chart summary.',
        });
      }
    }

    log.info('Generating natal intro via OpenAI', { userId, chartId: effectiveChartId });
    const intro = await generateNatalIntroWithOpenAI(profile, chartData);

    // Сохраняем в interpretations (Lumia schema) — chart-level или user-level
    if (cacheKey) {
      try {
        await db.interpretations.set(cacheKey, 'natal_intro', 'default', intro);
        log.info('Natal intro saved to interpretations', { chartId: effectiveChartId, userId });
      } catch (dbError: any) {
        log.error('Error saving intro to database', { error: dbError.message, chartId: effectiveChartId, userId });
        return res.status(500).json({
          error: 'Persistence failed',
          code: 'NATAL_INTRO_PERSIST_FAILED',
          message: profile.language === 'ru'
            ? 'Текст натальной карты сгенерирован, но не сохранился. Повторите попытку позже.'
            : 'The chart summary was generated but could not be saved. Please try again later.',
        });
      }
    }

    // Cache header (1 day - вступление может регенерироваться)
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=172800');

    return res.status(200).json({
      intro,
      timestamp: Date.now(),
      persisted: true,
      source: 'generated',
    });
  } catch (error: any) {
    log.error('Unexpected error in handler', {
      error: error.message,
      stack: error.stack
    });
    
    return res.status(500).json({
      error: 'Internal server error',
      code: 'NATAL_INTRO_INTERNAL_ERROR',
      message: error.message 
    });
  }
}

// Rate limiting: AI операции - 5 запросов в минуту для free
export default withRateLimit(handler, RATE_LIMIT_CONFIGS.AI_FREE);
