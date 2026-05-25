import type { NextApiRequest, NextApiResponse } from 'next';
import type { ContentAccessTier, InterpretationSection } from '../../../../types';
import { db } from '../../../../lib/db';
import { getPremiumEntitlementState, unlockContentLayer } from '../../../../lib/contentArchitecture';
import { getMoscowTodayKey } from '../../../../lib/date-utils';
import {
  ensureValidContext,
  getCachedReading,
  saveReading,
} from '../../../../lib/natalReading/apiHelper';
import {
  buildHumanInputHash,
  buildHumanDailyFallback,
  generateHumanDailySection,
} from '../../../../lib/natalHumanInterpretation';
import {
  HUMAN_DAILY_LUMI_COST,
  HUMAN_DAILY_PROMPT_VERSION,
  humanDailyCacheKey,
  isHumanDailySectionKey,
  type HumanDailySectionKey,
} from '../../../../lib/natalHumanShared';

export const config = { maxDuration: 90 };

type ResolvedDailyAccess = {
  accessTier: Extract<ContentAccessTier, 'premium' | 'lumi'>;
  entitlement: Awaited<ReturnType<typeof getPremiumEntitlementState>>['entitlement'];
};

function isFreeDailyOverview(sectionKey: HumanDailySectionKey): boolean {
  return sectionKey === 'daily_overview';
}

function readSectionKey(req: NextApiRequest): HumanDailySectionKey | null {
  const raw = (req.method === 'GET' ? req.query.sectionKey : req.body?.sectionKey) as string | undefined;
  const value = String(raw || '').trim();
  return isHumanDailySectionKey(value) ? value : null;
}

function readDateKey(req: NextApiRequest): string {
  const raw = (req.method === 'GET' ? req.query.date : req.body?.date) as string | undefined;
  const value = String(raw || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : getMoscowTodayKey();
}

function getMoscowDayWindow(dateKey: string) {
  const [yearRaw, monthRaw, dayRaw] = dateKey.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return { validFrom: null, validTo: null };
  }
  return {
    validFrom: new Date(Date.UTC(year, month - 1, day, -3, 0, 0, 0)),
    validTo: new Date(Date.UTC(year, month - 1, day + 1, -3, 0, 0, 0)),
  };
}

async function resolveDailyAccess(
  userId: string,
  chartId: number | null,
  cacheKey: string
): Promise<ResolvedDailyAccess | null> {
  const entitlement = await getPremiumEntitlementState(userId);
  if (entitlement.isPremium) {
    return { accessTier: 'premium', entitlement: entitlement.entitlement };
  }

  const unlock = await db.content_unlocks.getLatestActive(userId, {
    accessTier: 'lumi',
    contentSurface: 'natal',
    contentVariant: 'living',
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
  const dateKey = readDateKey(req);

  if (!sectionKey) {
    return res.status(400).json({
      error: 'BAD_REQUEST',
      message: 'sectionKey must be a daily human interpretation section key',
    });
  }

  const cacheKey = humanDailyCacheKey(dateKey, sectionKey);
  const inputHash = buildHumanInputHash({
    profile: ctx.profile,
    chartData: ctx.chartData!,
    sectionKey,
    dateKey,
    promptVersion: HUMAN_DAILY_PROMPT_VERSION,
  });
  const window = getMoscowDayWindow(dateKey);
  let access = await resolveDailyAccess(userId, ctx.chartId, cacheKey);
  const freeDailyOverview = isFreeDailyOverview(sectionKey);

  if (req.method === 'GET' && !access && !freeDailyOverview) {
    return res.status(403).json({
      error: 'HUMAN_DAILY_LOCKED',
      code: 'HUMAN_DAILY_LOCKED',
      message: `Персональный слой дня доступен в Premium или открывается разово за ${HUMAN_DAILY_LUMI_COST} Lumi.`,
      lumiCost: HUMAN_DAILY_LUMI_COST,
      lumiBalance: ctx.user.lumi_balance ?? 0,
      premiumAvailable: true,
    });
  }

  if (!access && !freeDailyOverview) {
    const requestedAccessTier = req.body?.accessTier === 'lumi' ? 'lumi' : 'premium';
    const allowLumiSpend = Boolean(req.body?.allowLumiSpend);

    if (requestedAccessTier !== 'lumi' || !allowLumiSpend) {
      return res.status(409).json({
        error: 'LUMI_REQUIRED',
        code: 'LUMI_REQUIRED',
        message: `Этот персональный слой можно открыть за ${HUMAN_DAILY_LUMI_COST} Lumi. Подтвердите списание.`,
        lumiCost: HUMAN_DAILY_LUMI_COST,
        lumiBalance: ctx.user.lumi_balance ?? 0,
        premiumAvailable: true,
      });
    }

    const balance = await db.lumi_transactions.getBalance(userId);
    if (balance < HUMAN_DAILY_LUMI_COST) {
      return res.status(402).json({
        error: 'INSUFFICIENT_LUMI',
        code: 'INSUFFICIENT_LUMI',
        message: 'Недостаточно Lumi для открытия персонального слоя дня.',
        lumiCost: HUMAN_DAILY_LUMI_COST,
        lumiBalance: balance,
        premiumAvailable: true,
      });
    }

    await unlockContentLayer({
      userId,
      chartId: ctx.chartId,
      accessTier: 'lumi',
      contentSurface: 'natal',
      contentVariant: 'living',
      cacheKey,
      lumiCost: HUMAN_DAILY_LUMI_COST,
    });

    access = await resolveDailyAccess(userId, ctx.chartId, cacheKey);
  }

  if (!access && !freeDailyOverview) {
    return res.status(500).json({
      error: 'HUMAN_DAILY_UNLOCK_FAILED',
      code: 'HUMAN_DAILY_UNLOCK_FAILED',
      message: 'Не удалось открыть персональный слой дня.',
    });
  }

  const responseAccessTier = freeDailyOverview && !access ? 'free_preview' : access!.accessTier;
  const cacheAccessTier: ContentAccessTier = freeDailyOverview ? 'free' : access!.accessTier;

  const cacheOpts = {
    accessTier: cacheAccessTier,
    contentVariant: 'living' as const,
    cacheKey,
    inputHash,
    promptVersion: HUMAN_DAILY_PROMPT_VERSION,
    isPersistent: false,
    validFrom: window.validFrom,
    validTo: window.validTo,
  };

  const cached = await getCachedReading<InterpretationSection>(ctx, cacheOpts);

  if (req.method === 'GET') {
    if (!cached) {
      return res.status(404).json({ error: 'NOT_FOUND', code: 'HUMAN_DAILY_NOT_READY' });
    }
    return res.status(200).json({
      interpretation: cached,
      source: 'human_v2',
      entitlement: access?.entitlement ?? null,
      accessTier: responseAccessTier,
      isPreview: freeDailyOverview,
      lumiBalance: ctx.user.lumi_balance ?? 0,
    });
  }

  if (cached) {
    return res.status(200).json({
      interpretation: cached,
      source: 'human_v2',
      entitlement: access?.entitlement ?? null,
      accessTier: responseAccessTier,
      isPreview: freeDailyOverview,
      lumiBalance: ctx.user.lumi_balance ?? 0,
    });
  }

  try {
    const section = await generateHumanDailySection(ctx.profile, ctx.chartData!, sectionKey, dateKey);
    const saved = await saveReading(ctx, cacheOpts, section);
    const lumiBalance = await db.lumi_transactions.getBalance(userId);
    return res.status(200).json({
      interpretation: saved,
      source: 'generated',
      entitlement: access?.entitlement ?? null,
      accessTier: responseAccessTier,
      isPreview: freeDailyOverview,
      lumiBalance,
    });
  } catch (error) {
    console.error(`[natal/human-daily:${sectionKey}] generation failed:`, error instanceof Error ? error.message : error);
    const fallback = buildHumanDailyFallback(ctx.profile, ctx.chartData!, sectionKey, dateKey);
    const saved = await saveReading(
      ctx,
      { ...cacheOpts, isPersistent: false, validTo: window.validTo ?? new Date(Date.now() + 6 * 60 * 60 * 1000) },
      fallback
    ).catch(() => null);
    const lumiBalance = await db.lumi_transactions.getBalance(userId);
    return res.status(200).json({
      interpretation: saved || { content: fallback, promptVersion: cacheOpts.promptVersion },
      source: saved ? 'fallback' : 'fallback-inline',
      entitlement: access?.entitlement ?? null,
      accessTier: responseAccessTier,
      isPreview: freeDailyOverview,
      lumiBalance,
    });
  }
}
