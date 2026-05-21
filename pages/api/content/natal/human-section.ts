import type { NextApiRequest, NextApiResponse } from 'next';
import type { ContentAccessTier, InterpretationSection } from '../../../../types';
import { db } from '../../../../lib/db';
import { getPremiumEntitlementState, unlockContentLayer } from '../../../../lib/contentArchitecture';
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
  HUMAN_PAID_LUMI_COST,
  HUMAN_PAID_PROMPT_VERSION,
  humanPaidCacheKey,
  isHumanPaidSectionKey,
  type HumanPaidSectionKey,
} from '../../../../lib/natalHumanShared';

export const config = { maxDuration: 90 };

type ResolvedAccess = {
  accessTier: Extract<ContentAccessTier, 'premium' | 'lumi'>;
  entitlement: Awaited<ReturnType<typeof getPremiumEntitlementState>>['entitlement'];
};

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

  const unlock = await db.content_unlocks.getLatestActive(userId, {
    accessTier: 'lumi',
    contentSurface: 'natal',
    contentVariant: 'full',
    chartId,
    cacheKey,
  });

  if (unlock) {
    return { accessTier: 'lumi', entitlement: entitlement.entitlement };
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
        message: `Раздел открывается в Premium или разово за ${HUMAN_PAID_LUMI_COST} Lumi.`,
        lumiCost: HUMAN_PAID_LUMI_COST,
        lumiBalance: ctx.user.lumi_balance ?? 0,
        premiumAvailable: true,
      });
    }
  }

  if (!access) {
    const requestedAccessTier = req.body?.accessTier === 'lumi' ? 'lumi' : 'premium';
    const allowLumiSpend = Boolean(req.body?.allowLumiSpend);

    if (requestedAccessTier !== 'lumi' || !allowLumiSpend) {
      return res.status(409).json({
        error: 'LUMI_REQUIRED',
        code: 'LUMI_REQUIRED',
        message: `Раздел можно открыть за ${HUMAN_PAID_LUMI_COST} Lumi. Подтвердите списание.`,
        lumiCost: HUMAN_PAID_LUMI_COST,
        lumiBalance: ctx.user.lumi_balance ?? 0,
        premiumAvailable: true,
      });
    }

    const balance = await db.lumi_transactions.getBalance(userId);
    if (balance < HUMAN_PAID_LUMI_COST) {
      return res.status(402).json({
        error: 'INSUFFICIENT_LUMI',
        code: 'INSUFFICIENT_LUMI',
        message: 'Недостаточно Lumi для открытия раздела.',
        lumiCost: HUMAN_PAID_LUMI_COST,
        lumiBalance: balance,
        premiumAvailable: true,
      });
    }

    await unlockContentLayer({
      userId,
      chartId: ctx.chartId,
      accessTier: 'lumi',
      contentSurface: 'natal',
      contentVariant: 'full',
      cacheKey,
      lumiCost: HUMAN_PAID_LUMI_COST,
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
    const lumiBalance = await db.lumi_transactions.getBalance(userId);
    return res.status(200).json({
      interpretation: cached,
      source: 'human_v2',
      accessTier: access.accessTier,
      lumiBalance,
    });
  }

  if (req.method === 'GET') {
    return res.status(404).json({ error: 'NOT_FOUND', code: 'HUMAN_SECTION_NOT_READY' });
  }

  try {
    const section = await generateHumanPaidSection(ctx.profile, ctx.chartData!, sectionKey);
    const saved = await saveReading(ctx, cacheOpts, section);
    const lumiBalance = await db.lumi_transactions.getBalance(userId);
    return res.status(200).json({
      interpretation: saved,
      source: 'generated',
      accessTier: access.accessTier,
      lumiBalance,
    });
  } catch (error) {
    console.error(`[natal/human-section:${sectionKey}] generation failed:`, error instanceof Error ? error.message : error);
    const fallback = buildHumanPaidFallback(ctx.profile, ctx.chartData!, sectionKey);
    const saved = await saveReading(
      ctx,
      { ...cacheOpts, isPersistent: false, validTo: new Date(Date.now() + 6 * 60 * 60 * 1000) },
      fallback
    ).catch(() => null);
    const lumiBalance = await db.lumi_transactions.getBalance(userId);
    return res.status(200).json({
      interpretation: saved || { content: fallback, promptVersion: cacheOpts.promptVersion },
      source: saved ? 'fallback' : 'fallback-inline',
      accessTier: access.accessTier,
      lumiBalance,
    });
  }
}
