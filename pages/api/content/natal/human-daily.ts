import type { NextApiRequest, NextApiResponse } from 'next';
import type { ContentAccessTier, InterpretationSection } from '../../../../types';
import { db } from '../../../../lib/db';
import { getPremiumEntitlementState } from '../../../../lib/contentArchitecture';
import { unlockContentAfterStarsPayment } from '../../../../lib/starsContentUnlock';
import { normalizeAskLumiaTier } from '../../../../lib/contentAccessTier';
import { getMoscowTodayKey } from '../../../../lib/date-utils';
import {
  ensureValidContext,
  getCachedReading,
  saveReading,
} from '../../../../lib/natalReading/apiHelper';
import {
  buildHumanInputHash,
  generateHumanDailySection,
} from '../../../../lib/natalHumanInterpretation';
import {
  HUMAN_DAILY_STARS_COST,
  HUMAN_DAILY_LUMI_COST,
  HUMAN_DAILY_PROMPT_VERSION,
  humanDailyCacheKey,
  isHumanDailySectionKey,
  type HumanDailySectionKey,
} from '../../../../lib/natalHumanShared';
import { logContentApi, warnContentApi } from '../../../../lib/contentApiLogging';

export const config = { maxDuration: 90 };

const SCOPE = 'natal-human-daily';

type ResolvedDailyAccess = {
  accessTier: Extract<ContentAccessTier, 'premium' | 'stars' | 'lumi'>;
  entitlement: Awaited<ReturnType<typeof getPremiumEntitlementState>>['entitlement'];
};

async function findDailyOneOffUnlock(
  userId: string,
  chartId: number | null,
  cacheKey: string
) {
  const starsUnlock = await db.content_unlocks.getLatestActive(userId, {
    accessTier: 'stars',
    contentSurface: 'natal',
    contentVariant: 'living',
    chartId,
    cacheKey,
  });
  if (starsUnlock) return starsUnlock;

  // Legacy-only: match unlock rows written before Lumi → Stars migration.
  return db.content_unlocks.getLatestActive(userId, {
    accessTier: 'lumi',
    contentSurface: 'natal',
    contentVariant: 'living',
    chartId,
    cacheKey,
  });
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

  const unlock = await findDailyOneOffUnlock(userId, chartId, cacheKey);

  if (unlock) {
    return {
      accessTier: unlock.accessTier === 'lumi' ? 'stars' : unlock.accessTier,
      entitlement: entitlement.entitlement,
    };
  }

  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const startedAt = Date.now();
  const ready = await ensureValidContext(req, res);
  if (!ready) return;
  const { userId, ctx } = ready;
  const sectionKey = readSectionKey(req);
  const dateKey = readDateKey(req);

  logContentApi(
    {
      scope: SCOPE,
      userId,
      chartId: ctx.chartId,
      surface: 'natal',
      variant: 'living',
    },
    'request_start',
    { metadata: { sectionKey, dateKey, method: req.method } }
  );

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
  const isFreeOverview = sectionKey === 'daily_overview';

  logContentApi(
    {
      scope: SCOPE,
      userId,
      chartId: ctx.chartId,
      surface: 'natal',
      variant: 'living',
    },
    'access_check',
    {
      accessTier: isFreeOverview ? 'free' : (access?.accessTier ?? 'locked'),
      metadata: { sectionKey, dateKey, isFreeOverview },
    }
  );

  if (req.method === 'GET' && !access && !isFreeOverview) {
    warnContentApi(
      {
        scope: SCOPE,
        userId,
        chartId: ctx.chartId,
        surface: 'natal',
        variant: 'living',
      },
      'unlock_required',
      { errorCode: 'HUMAN_DAILY_LOCKED', metadata: { sectionKey, starsCost: HUMAN_DAILY_STARS_COST } }
    );
    return res.status(403).json({
      error: 'HUMAN_DAILY_LOCKED',
      code: 'HUMAN_DAILY_LOCKED',
      message: `Персональный слой дня доступен в Premium или открывается разово за ${HUMAN_DAILY_STARS_COST} Stars.`,
      starsCost: HUMAN_DAILY_STARS_COST,
      starsPaymentRequired: true,
      premiumAvailable: true,
    });
  }

  if (!access && !isFreeOverview) {
    const requestedAccessTier = normalizeAskLumiaTier(req.body?.accessTier) || 'premium';
    const starsPaymentChargeId = String(
      req.body?.starsPaymentChargeId || req.body?.telegramPaymentChargeId || ''
    ).trim();

    if (requestedAccessTier !== 'stars' || !starsPaymentChargeId) {
      warnContentApi(
        {
          scope: SCOPE,
          userId,
          chartId: ctx.chartId,
          surface: 'natal',
          variant: 'living',
        },
        'payment_required',
        { errorCode: 'STARS_PAYMENT_REQUIRED', metadata: { sectionKey, starsCost: HUMAN_DAILY_STARS_COST } }
      );
      return res.status(409).json({
        error: 'Stars payment required',
        code: 'STARS_PAYMENT_REQUIRED',
        message: `Этот персональный слой можно открыть разово за ${HUMAN_DAILY_STARS_COST} Stars через Telegram payment.`,
        starsCost: HUMAN_DAILY_STARS_COST,
        starsPaymentRequired: true,
        premiumAvailable: true,
      });
    }

    await unlockContentAfterStarsPayment({
      userId,
      chartId: ctx.chartId,
      contentSurface: 'natal',
      contentVariant: 'living',
      cacheKey,
      starsAmount: HUMAN_DAILY_STARS_COST,
      starsPaymentChargeId,
    });

    access = await resolveDailyAccess(userId, ctx.chartId, cacheKey);
  }

  if (!access && !isFreeOverview) {
    return res.status(500).json({
      error: 'HUMAN_DAILY_UNLOCK_FAILED',
      code: 'HUMAN_DAILY_UNLOCK_FAILED',
      message: 'Не удалось открыть персональный слой дня.',
    });
  }

  const cacheAccessTier: ContentAccessTier = isFreeOverview ? 'free' : access!.accessTier;
  const responseAccessTier: ContentAccessTier = isFreeOverview ? 'free' : access!.accessTier;

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
    logContentApi(
      {
        scope: SCOPE,
        userId,
        chartId: ctx.chartId,
        surface: 'natal',
        variant: 'living',
      },
      'cache_hit',
      {
        accessTier: responseAccessTier,
        status: 'ready',
        durationMs: Date.now() - startedAt,
        metadata: { sectionKey, dateKey },
      }
    );
    return res.status(200).json({
      interpretation: cached,
      source: 'human_v2',
      entitlement: access?.entitlement ?? null,
      accessTier: responseAccessTier,
    });
  }

  if (cached) {
    logContentApi(
      {
        scope: SCOPE,
        userId,
        chartId: ctx.chartId,
        surface: 'natal',
        variant: 'living',
      },
      'cache_hit',
      {
        accessTier: responseAccessTier,
        status: 'ready',
        durationMs: Date.now() - startedAt,
        metadata: { sectionKey, dateKey },
      }
    );
    return res.status(200).json({
      interpretation: cached,
      source: 'human_v2',
      entitlement: access?.entitlement ?? null,
      accessTier: responseAccessTier,
    });
  }

  try {
    logContentApi(
      {
        scope: SCOPE,
        userId,
        chartId: ctx.chartId,
        surface: 'natal',
        variant: 'living',
      },
      'generation_start',
      { accessTier: responseAccessTier, metadata: { sectionKey, dateKey } }
    );
    const section = await generateHumanDailySection(ctx.profile, ctx.chartData!, sectionKey, dateKey);
    const saved = await saveReading(ctx, cacheOpts, section);
    logContentApi(
      {
        scope: SCOPE,
        userId,
        chartId: ctx.chartId,
        surface: 'natal',
        variant: 'living',
      },
      'generation_success',
      {
        accessTier: responseAccessTier,
        status: 'ready',
        durationMs: Date.now() - startedAt,
        metadata: { sectionKey, dateKey },
      }
    );
    return res.status(200).json({
      interpretation: saved,
      source: 'generated',
      entitlement: access?.entitlement ?? null,
      accessTier: responseAccessTier,
    });
  } catch (error) {
    warnContentApi(
      {
        scope: SCOPE,
        userId,
        chartId: ctx.chartId,
        surface: 'natal',
        variant: 'living',
      },
      'generation_failed',
      {
        accessTier: responseAccessTier,
        errorCode: 'CONTENT_GENERATION_UNAVAILABLE',
        durationMs: Date.now() - startedAt,
        metadata: { sectionKey, dateKey },
      }
    );
    console.error(`[natal/human-daily:${sectionKey}] generation failed:`, error instanceof Error ? error.message : error);
    return res.status(503).json({
      error: 'CONTENT_GENERATION_UNAVAILABLE',
      code: 'CONTENT_GENERATION_UNAVAILABLE',
      message: 'Этот слой сейчас не удалось сгенерировать. Попробуй ещё раз.',
    });
  }
}
