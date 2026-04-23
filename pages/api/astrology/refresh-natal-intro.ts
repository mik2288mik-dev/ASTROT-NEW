import type { NextApiRequest, NextApiResponse } from 'next';
import { getOpenAIModelForContent } from '../../../lib/appSettings';
import { getVerifiedTelegramUser } from '../../../lib/adminAuth';
import { db } from '../../../lib/db';
import { spendLumi } from '../../../services/lumiService';
import { generateNatalAnchorReading } from '../../../lib/natalContent';
import {
  mapNatalAnchorToLegacyIntro,
  NATAL_ANCHOR_CACHE_KEY,
  NATAL_ANCHOR_PROMPT_VERSION,
} from '../../../lib/natalReadings';
import { withRateLimit, RATE_LIMIT_CONFIGS } from '../../../lib/rateLimit';

const COST_LUMI = 250;

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, profile, chartData, chartId } = req.body || {};
    if (!userId || !profile || !chartData) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'userId, profile and chartData are required',
      });
    }

    const telegramUser = getVerifiedTelegramUser(req);
    if (String(telegramUser.id) !== String(userId).trim()) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'User mismatch',
      });
    }

    const effectiveChartId = chartId != null ? parseInt(String(chartId), 10) : null;

    let newBalance: number;
    try {
      const spent = await spendLumi(String(userId).trim(), COST_LUMI, 'refresh_natal_intro');
      newBalance = spent.balance;
    } catch (e: any) {
      const msg = e?.message || 'Payment failed';
      const low = msg.toLowerCase();
      return res.status(low.includes('insufficient') ? 402 : 400).json({
        error: 'PAYMENT_FAILED',
        message: msg,
      });
    }

    const reading = await generateNatalAnchorReading(profile, chartData);
    const intro = mapNatalAnchorToLegacyIntro(reading);
    if (!intro || intro.length < 50) {
      await db.lumi_transactions.add(String(userId).trim(), COST_LUMI, 'refund');
      const refunded = await db.lumi_transactions.getBalance(String(userId).trim());
      return res.status(500).json({
        error: 'GENERATION_FAILED',
        message: profile.language === 'ru' ? 'Не удалось сгенерировать текст.' : 'Failed to generate text.',
        newBalance: refunded,
      });
    }

    try {
      const { modelTier } = await getOpenAIModelForContent({
        accessTier: 'free',
        contentSurface: 'natal',
        contentVariant: 'anchor',
      });
      if (effectiveChartId != null) {
        await db.content_interpretations.upsertByChart(effectiveChartId, {
          accessTier: 'free',
          contentSurface: 'natal',
          contentVariant: 'anchor',
          cacheKey: NATAL_ANCHOR_CACHE_KEY,
          inputHash: NATAL_ANCHOR_CACHE_KEY,
          content: reading,
          modelTier,
          promptVersion: NATAL_ANCHOR_PROMPT_VERSION,
          calculationVersion: chartData.calculationVersion || null,
          isPersistent: true,
          canRegenerateForLumi: true,
          regenerationCostLumi: COST_LUMI,
          legacySource: 'natal_content_unified_v3.refresh',
        }, String(userId).trim());
      } else {
        await db.content_interpretations.upsertByUser(String(userId).trim(), {
          accessTier: 'free',
          contentSurface: 'natal',
          contentVariant: 'anchor',
          cacheKey: NATAL_ANCHOR_CACHE_KEY,
          inputHash: NATAL_ANCHOR_CACHE_KEY,
          content: reading,
          modelTier,
          promptVersion: NATAL_ANCHOR_PROMPT_VERSION,
          calculationVersion: chartData.calculationVersion || null,
          isPersistent: true,
          canRegenerateForLumi: true,
          regenerationCostLumi: COST_LUMI,
          legacySource: 'natal_content_unified_v3.refresh',
        });
      }
    } catch (dbErr: any) {
      await db.lumi_transactions.add(String(userId).trim(), COST_LUMI, 'refund');
      const refunded = await db.lumi_transactions.getBalance(String(userId).trim());
      return res.status(500).json({
        error: 'PERSIST_FAILED',
        message: dbErr?.message || 'Save failed',
        newBalance: refunded,
      });
    }

    return res.status(200).json({
      success: true,
      intro,
      reading,
      newBalance,
      costLumi: COST_LUMI,
    });
  } catch (error: any) {
    const status = typeof error?.status === 'number' ? error.status : 500;
    return res.status(status).json({
      error: error?.code || 'INTERNAL_ERROR',
      message: error?.message || 'Request failed',
    });
  }
}

export default withRateLimit(handler, RATE_LIMIT_CONFIGS.AI_FREE);
