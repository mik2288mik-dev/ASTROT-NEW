import type { NextApiRequest, NextApiResponse } from 'next';
import type { ContentAccessTier, InterpretationSection } from '../../../../types';
import { db } from '../../../../lib/db';
import { getPremiumEntitlementState } from '../../../../lib/contentArchitecture';
import { unlockContentAfterStarsPayment } from '../../../../lib/starsContentUnlock';
import { normalizeAskLumiaTier } from '../../../../lib/contentAccessTier';
import {
  ensureValidContext,
  getCachedReading,
  saveReading,
} from '../../../../lib/natalReading/apiHelper';
import {
  buildHumanInputHash,
  buildHumanPaidFallback,
  generateHumanPaidSection,
} from '../../../../lib/natalHumanInterpretation';
import {
  HUMAN_PAID_STARS_COST,
  HUMAN_PAID_LUMI_COST,
  HUMAN_PAID_PROMPT_VERSION,
  humanPaidCacheKey,
  isHumanPaidSectionKey,
  type HumanPaidSectionKey,
} from '../../../../lib/natalHumanShared';

export const config = { maxDuration: 90 };

type ResolvedAccess = {
  accessTier: Extract<ContentAccessTier, 'premium' | 'stars' | 'lumi'>;
  entitlement: Awaited<ReturnType<typeof getPremiumEntitlementState>>['entitlement'];
};

async function findOneOffUnlock(
  userId: string,
  chartId: number | null,
  cacheKey: string
) {
  const starsUnlock = await db.content_unlocks.getLatestActive(userId, {
    accessTier: 'stars',
    contentSurface: 'natal',
    contentVariant: 'full',
    chartId,
    cacheKey,
  });
  if (starsUnlock) return starsUnlock;

  return db.content_unlocks.getLatestActive(userId, {
    accessTier: 'lumi',
    contentSurface: 'natal',
    contentVariant: 'full',
    chartId,
    cacheKey,
  });
}

function readSectionKey(req: NextApiRequest): HumanPaidSectionKey | null {
  const raw = (req.method === 'GET' ? req.query.sectionKey : req.body?.sectionKey) as string | undefined;
  const value = String(raw || '').trim();
  return isHumanPaidSectionKey(value) ? value : null;
}

async function resolvePaidAccess(
  userId: string,
  chartId: number | null,
  cacheKey: string
): Promise<ResolvedAccess | null> {
  const entitlement = await getPremiumEntitlementState(userId);
  if (entitlement.isPremium) {
    return { accessTier: 'premium', entitlement: entitlement.entitlement };
  }

  const unlock = await findOneOffUnlock(userId, chartId, cacheKey);

  if (unlock) {
    return {
      accessTier: unlock.accessTier === 'lumi' ? 'stars' : unlock.accessTier,
      entitlement: entitlement.entitlement,
    };
  }

  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ready = await ensureValidContext(req, res);
  if (!ready) return;
  const { userId, ctx } = ready;
  const sectionKey = readSectionKey(req);

  if (!sectionKey) {
    return res.status(400).json({
      error: 'BAD_REQUEST',
      message: 'sectionKey must be a paid human interpretation section key',
    });
  }

  const cacheKey = humanPaidCacheKey(sectionKey);
  const inputHash = buildHumanInputHash({
    profile: ctx.profile,
    chartData: ctx.chartData!,
    sectionKey,
    promptVersion: HUMAN_PAID_PROMPT_VERSION,
  });

  let access = await resolvePaidAccess(userId, ctx.chartId, cacheKey);

  if (req.method === 'GET') {
    if (!access) {
      return res.status(403).json({
        error: 'HUMAN_SECTION_LOCKED',
        code: 'HUMAN_SECTION_LOCKED',
        message: `Раздел открывается в Premium или разово за ${HUMAN_PAID_STARS_COST} Stars.`,
        starsCost: HUMAN_PAID_STARS_COST,
        starsPaymentRequired: true,
        premiumAvailable: true,
      });
    }
  }

  if (!access) {
    const requestedAccessTier = normalizeAskLumiaTier(req.body?.accessTier) || 'premium';
    const starsPaymentChargeId = String(
      req.body?.starsPaymentChargeId || req.body?.telegramPaymentChargeId || ''
    ).trim();

    if (requestedAccessTier !== 'stars' || !starsPaymentChargeId) {
      return res.status(409).json({
        error: 'Stars payment required',
        code: 'STARS_PAYMENT_REQUIRED',
        message: `Раздел можно открыть разово за ${HUMAN_PAID_STARS_COST} Stars через Telegram payment.`,
        starsCost: HUMAN_PAID_STARS_COST,
        starsPaymentRequired: true,
        premiumAvailable: true,
      });
    }

    await unlockContentAfterStarsPayment({
      userId,
      chartId: ctx.chartId,
      contentSurface: 'natal',
      contentVariant: 'full',
      cacheKey,
      starsAmount: HUMAN_PAID_STARS_COST,
      starsPaymentChargeId,
    });

    access = await resolvePaidAccess(userId, ctx.chartId, cacheKey);
  }

  if (!access) {
    return res.status(500).json({
      error: 'HUMAN_SECTION_UNLOCK_FAILED',
      code: 'HUMAN_SECTION_UNLOCK_FAILED',
      message: 'Не удалось открыть раздел.',
    });
  }

  const cacheOpts = {
    accessTier: access.accessTier,
    contentVariant: 'full' as const,
    cacheKey,
    inputHash,
    promptVersion: HUMAN_PAID_PROMPT_VERSION,
    isPersistent: true,
  };
  const cached = await getCachedReading<InterpretationSection>(ctx, cacheOpts);

  if (cached) {
    return res.status(200).json({
      interpretation: cached,
      source: 'human_v2',
      accessTier: access.accessTier,
    });
  }

  if (req.method === 'GET') {
    return res.status(404).json({ error: 'NOT_FOUND', code: 'HUMAN_SECTION_NOT_READY' });
  }

  try {
    const section = await generateHumanPaidSection(ctx.profile, ctx.chartData!, sectionKey);
    const saved = await saveReading(ctx, cacheOpts, section);
    return res.status(200).json({
      interpretation: saved,
      source: 'generated',
      accessTier: access.accessTier,
    });
  } catch (error) {
    console.error(`[natal/human-section:${sectionKey}] generation failed:`, error instanceof Error ? error.message : error);
    const fallback = buildHumanPaidFallback(ctx.profile, ctx.chartData!, sectionKey);
    const saved = await saveReading(
      ctx,
      { ...cacheOpts, isPersistent: false, validTo: new Date(Date.now() + 6 * 60 * 60 * 1000) },
      fallback
    ).catch(() => null);
    return res.status(200).json({
      interpretation: saved || { content: fallback, promptVersion: cacheOpts.promptVersion },
      source: saved ? 'fallback' : 'fallback-inline',
      accessTier: access.accessTier,
    });
  }
}
