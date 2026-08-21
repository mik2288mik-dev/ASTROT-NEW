import type { NextApiRequest, NextApiResponse } from 'next';
import type {
  ContentInterpretation,
  NatalChartData,
  UserProfile,
} from '../../types';
import { toDateInputValue } from '../date-utils';
import { db } from '../db';
import { isCanonicalNatalChartDataComplete } from '../natalChartCanonical';
import {
  repairCanonicalChartForUser,
  repairCanonicalChartRecord,
} from '../natalChartPersistence';
import { getContentLayer, getPremiumEntitlementState } from '../contentArchitecture';
import { AdminAuthError, handleAdminError } from '../adminAuth';
import { requireAppUser } from '../auth/appAuth';
import {
  assertChartReadable,
  ChartAccessPolicyError,
  getChartSubjectType,
  isActiveChart,
  isSelfChart,
  type ChartSubjectType,
} from '../chartAccessPolicy';
import {
  persistNatalReadingHistory,
  type NatalHistoryGeneration,
} from '../astrologyHistoryPersistence';

export type ReadingContext = {
  user: any;
  profile: UserProfile;
  chartId: number | null;
  chartData: NatalChartData | null;
  chartSubjectType?: ChartSubjectType | null;
  relationLabel?: string | null;
};

function toProfile(user: any, fallback?: Partial<UserProfile>): UserProfile {
  const birthDate = toDateInputValue(fallback?.birthDate || user.birth_date);
  return {
    id: user.id,
    name: fallback?.name || user.name || '',
    birthDate,
    birthTime: fallback?.birthTime ?? user.birth_time ?? '',
    birthPlace: fallback?.birthPlace || user.birth_place || '',
    isSetup: user.is_setup ?? true,
    language: (fallback?.language as 'ru' | 'en') || user.language || 'ru',
    theme: (fallback?.theme as 'dark' | 'light') || user.theme || 'dark',
    isPremium: !!user.is_premium,
    isAdmin: !!user.is_admin,
    loginStreak: user.login_streak ?? 0,
    chartSlots: user.chart_slots ?? 1,
    generatedContent: fallback?.generatedContent,
  };
}

export async function readUserId(req: NextApiRequest): Promise<string | null> {
  const raw =
    req.method === 'GET'
      ? (req.query.userId as string | undefined)
      : (req.body?.userId as string | undefined);
  return raw && raw.trim() ? raw.trim() : null;
}

export async function readChartId(req: NextApiRequest): Promise<number | null> {
  const raw =
    req.method === 'GET'
      ? (req.query.chartId as string | undefined)
      : (req.body?.chartId as string | number | undefined);
  if (typeof raw === 'string') {
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  return null;
}

export async function resolveReadingContext(
  userId: string,
  chartId: number | null,
  profileFallback?: Partial<UserProfile>,
  _chartDataFallback?: NatalChartData | null,
  options: { repairCanonical?: boolean } = {},
): Promise<ReadingContext | null> {
  const user = await db.users.get(userId);
  if (!user) return null;
  const chart = chartId != null
    ? await db.natal_charts.getById(chartId)
    : await db.natal_charts.getPrimary(userId);
  const ownedChart = chart &&
    String(chart.user_id) === String(userId) &&
    isActiveChart(chart) &&
    (chartId != null || isSelfChart(chart))
      ? chart
      : null;
  let resolvedChart = ownedChart;
  const profileHasBirthData = Boolean(
    (resolvedChart?.birth_date || user.birth_date)
    && (resolvedChart?.birth_place || user.birth_place),
  );
  const repairCanonical = options.repairCanonical !== false;
  if (repairCanonical && !resolvedChart && chartId == null && profileHasBirthData) {
    console.info('[natal/context] restoring missing primary V2 chart from birth profile', { userId });
    const repaired = await repairCanonicalChartForUser(userId);
    if (repaired?.chart && isCanonicalNatalChartDataComplete(repaired.chart.chart_data)) {
      resolvedChart = repaired.chart;
    }
  }
  if (
    repairCanonical
    && resolvedChart
    && isSelfChart(resolvedChart)
    && !isCanonicalNatalChartDataComplete(resolvedChart.chart_data)
    && resolvedChart.birth_date
    && resolvedChart.birth_place
  ) {
    const repaired = await repairCanonicalChartRecord(userId, resolvedChart.id);
    if (repaired?.chart && isCanonicalNatalChartDataComplete(repaired.chart.chart_data)) {
      resolvedChart = repaired.chart;
    }
  }
  const chartProfile = resolvedChart ? {
    ...profileFallback,
    name: resolvedChart.name || profileFallback?.name,
    birthDate: resolvedChart.birth_date || profileFallback?.birthDate,
    birthTime: resolvedChart.birth_time ?? profileFallback?.birthTime ?? '',
    birthPlace: resolvedChart.birth_place || profileFallback?.birthPlace,
  } : profileFallback;
  return {
    user,
    profile: toProfile(user, chartProfile),
    chartId: resolvedChart?.id ?? null,
    chartData: (resolvedChart?.chart_data || null) as NatalChartData | null,
    chartSubjectType: resolvedChart ? getChartSubjectType(resolvedChart) : null,
    relationLabel: (resolvedChart as any)?.relation_label || null,
  };
}

export type CachedReadingOptions = {
  accessTier: 'free' | 'premium';
  contentVariant:
    | 'anchor'
    | 'living'
    | 'planet_insight'
    | 'daily'
    | 'morning'
    | 'day'
    | 'evening'
    | 'weekly'
    | 'monthly'
    | 'brief'
    | 'full';
  cacheKey: string;
  inputHash?: string;
  promptVersion: string;
  modelTier?: 'base' | 'premium';
  isPersistent?: boolean;
  validFrom?: Date | null;
  validTo?: Date | null;
  history?: NatalHistoryGeneration;
};

/**
 * Look up cached reading content. Considers it valid if:
 *  - prompt_version matches (so we never serve stale prompt versions);
 *  - valid_to (if set) is still in the future.
 */
export async function getCachedReading<T>(
  ctx: ReadingContext,
  opts: CachedReadingOptions
): Promise<ContentInterpretation<T> | null> {
  if (!ctx.profile.id) return null;
  const layer = await getContentLayer({
    userId: String(ctx.profile.id),
    chartId: ctx.chartId,
    accessTier: opts.accessTier,
    contentSurface: 'natal',
    contentVariant: opts.contentVariant,
    cacheKey: opts.cacheKey,
  });
  const ip = layer.interpretation as ContentInterpretation<T> | null;
  if (!ip) return null;
  if (opts.inputHash && ip.inputHash !== opts.inputHash) return null;
  if (ip.promptVersion !== opts.promptVersion) return null;
  if (ip.validTo) {
    const validUntil = new Date(ip.validTo).getTime();
    if (Number.isFinite(validUntil) && validUntil <= Date.now()) return null;
  }
  return ip;
}

export async function saveReading<T>(
  ctx: ReadingContext,
  opts: CachedReadingOptions,
  content: T
): Promise<ContentInterpretation<T>> {
  if (!ctx.profile.id) throw new Error('user id missing');
  const payload = {
    accessTier: opts.accessTier,
    contentSurface: 'natal' as const,
    contentVariant: opts.contentVariant,
    cacheKey: opts.cacheKey,
    inputHash: opts.inputHash ?? opts.cacheKey,
    content,
    modelTier: (opts.modelTier ?? (opts.accessTier === 'free' ? 'base' : 'premium')) as
      | 'base'
      | 'premium',
    promptVersion: opts.promptVersion,
    calculationVersion: ctx.chartData?.calculationVersion || null,
    isPersistent: opts.isPersistent ?? true,
    legacySource: null,
    validFrom: opts.validFrom ?? null,
    validTo: opts.validTo ?? null,
  };

  if (ctx.chartId != null) {
    const saved = (await db.content_interpretations.upsertByChart(
      ctx.chartId,
      payload as any,
      String(ctx.profile.id)
    )) as ContentInterpretation<T>;
    try {
      await persistNatalReadingHistory({
        userId: String(ctx.profile.id),
        chartId: ctx.chartId,
        chart: ctx.chartData!,
        rawBirthTime: ctx.profile.birthTime,
        language: ctx.profile.language === 'en' ? 'en' : 'ru',
        accessTier: opts.accessTier,
        contentVariant: opts.contentVariant,
        cacheKey: opts.cacheKey,
        inputHash: opts.inputHash ?? opts.cacheKey,
        promptVersion: opts.promptVersion,
        content,
        generation: opts.history,
      });
    } catch (error) {
      console.error(
        '[natal/history] saved reading could not be appended to durable history:',
        error instanceof Error ? error.message : error,
      );
    }
    return saved;
  }
  return (await db.content_interpretations.upsertByUser(
    String(ctx.profile.id),
    payload as any
  )) as ContentInterpretation<T>;
}

export function endOfDayMoscow(date: Date = new Date()): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const d = date.getUTCDate();
  // Moscow = UTC+3. End of Moscow day = 21:00 UTC of same day; if already past, next day.
  const endUtc = Date.UTC(y, m, d, 21, 0, 0, 0);
  if (date.getTime() >= endUtc) {
    return new Date(Date.UTC(y, m, d + 1, 21, 0, 0, 0));
  }
  return new Date(endUtc);
}

export function endOfIsoWeek(date: Date = new Date()): Date {
  const tmp = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = (tmp.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  const sunday = new Date(tmp);
  sunday.setUTCDate(sunday.getUTCDate() + (6 - dayNum));
  // End of Sunday Moscow = next Monday 21:00 UTC of prior day; we approximate as Sunday 21:00 UTC.
  return new Date(Date.UTC(sunday.getUTCFullYear(), sunday.getUTCMonth(), sunday.getUTCDate(), 21, 0, 0, 0));
}

export async function isPremium(userId: string): Promise<boolean> {
  const entitlement = await getPremiumEntitlementState(userId);
  return entitlement.isPremium;
}

type EnsureValidContextOptions = {
  allowGuest?: boolean;
  requireSelfChart?: boolean;
  requireCanonicalSnapshot?: boolean;
  repairCanonicalSnapshot?: boolean;
  onAuthSuccess?: (detail: { userId: string }) => void;
  onAuthFailed?: (detail: { userId?: string | null; status: number; code: string; error?: unknown }) => void;
  onChartResolved?: (detail: { userId: string; chartId: number | null; hasChartData: boolean }) => void;
  onChartFailed?: (detail: { userId: string; chartId: number | null; status: number; code: string; error?: unknown }) => void;
};

export async function ensureValidContext(
  req: NextApiRequest,
  res: NextApiResponse,
  options: EnsureValidContextOptions = {}
): Promise<{ userId: string; ctx: ReadingContext } | null> {
  if (req.method !== 'GET' && req.method !== 'POST') {
    options.onAuthFailed?.({
      userId: null,
      status: 405,
      code: 'METHOD_NOT_ALLOWED',
      error: new Error('Method not allowed'),
    });
    res.status(405).json({ error: 'Method not allowed' });
    return null;
  }
  let userId: string | null = null;
  try {
    const auth = await requireAppUser(req, { allowGuest: options.allowGuest });
    userId = auth.userId;
    options.onAuthSuccess?.({ userId });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      options.onAuthFailed?.({
        userId: null,
        status: error.status,
        code: error.code,
        error,
      });
      handleAdminError(res, error);
      return null;
    }
    options.onAuthFailed?.({
      userId: null,
      status: 500,
      code: 'AUTH_UNEXPECTED_ERROR',
      error,
    });
    throw error;
  }
  if (!userId) {
    throw new Error('Authenticated user id is missing');
  }
  let chartId = await readChartId(req);
  if (chartId != null) {
    let effectiveChart = await db.natal_charts.getById(chartId);
    if (!effectiveChart || String(effectiveChart.user_id) !== userId || !isActiveChart(effectiveChart)) {
      if (options.requireSelfChart) {
        console.info('[natal/context] replacing stale requested chart id with repaired primary chart', {
          userId,
          requestedChartId: chartId,
        });
        const repaired = await repairCanonicalChartForUser(userId);
        if (repaired?.chart && isCanonicalNatalChartDataComplete(repaired.chart.chart_data)) {
          chartId = repaired.chart.id;
          effectiveChart = repaired.chart;
        } else {
          options.onChartFailed?.({
            userId,
            chartId,
            status: 404,
            code: 'CHART_NOT_FOUND',
            error: new Error('Chart not found'),
          });
          res.status(404).json({ error: 'CHART_NOT_FOUND', message: 'Chart not found' });
          return null;
        }
      } else {
        options.onChartFailed?.({
          userId,
          chartId,
          status: 404,
          code: 'CHART_NOT_FOUND',
          error: new Error('Chart not found'),
        });
        res.status(404).json({ error: 'CHART_NOT_FOUND', message: 'Chart not found' });
        return null;
      }
    }
    if (!effectiveChart) {
      throw new Error('CHART_REPAIR_RETURNED_EMPTY');
    }
    if (options.requireSelfChart && !isSelfChart(effectiveChart)) {
      options.onChartFailed?.({
        userId,
        chartId,
        status: 409,
        code: 'SELF_CHART_REQUIRED',
        error: new Error('This feature uses your own chart.'),
      });
      res.status(409).json({
        error: 'SELF_CHART_REQUIRED',
        message: 'This feature uses your own chart.',
      });
      return null;
    }
    try {
      const entitlement = await getPremiumEntitlementState(userId);
      assertChartReadable(effectiveChart, entitlement.isPremium);
    } catch (error) {
      if (error instanceof ChartAccessPolicyError) {
        options.onChartFailed?.({ userId, chartId, status: error.status, code: error.code, error });
        res.status(error.status).json({ error: error.code, message: error.message });
        return null;
      }
      throw error;
    }
  }
  const ctx = await resolveReadingContext(
    userId,
    chartId,
    req.method === 'POST' ? req.body?.profile : undefined,
    req.method === 'POST' ? req.body?.chartData : undefined,
    { repairCanonical: options.repairCanonicalSnapshot !== false },
  );
  if (!ctx) {
    options.onChartFailed?.({
      userId,
      chartId,
      status: 404,
      code: 'USER_NOT_FOUND',
      error: new Error('Profile not found'),
    });
    res.status(404).json({ error: 'User not found', message: 'Profile not found' });
    return null;
  }
  if (!ctx.chartData) {
    options.onChartFailed?.({
      userId,
      chartId: ctx.chartId ?? chartId,
      status: 409,
      code: 'PRIMARY_CHART_MISSING',
      error: new Error('A saved natal chart is required for the natal reading.'),
    });
    res.status(409).json({
      error: 'PRIMARY_CHART_MISSING',
      message: 'A saved natal chart is required for the natal reading.',
    });
    return null;
  }
  if (options.requireCanonicalSnapshot && !isCanonicalNatalChartDataComplete(ctx.chartData)) {
    options.onChartFailed?.({
      userId,
      chartId: ctx.chartId ?? chartId,
      status: 409,
      code: 'NATAL_SNAPSHOT_INVALID',
      error: new Error('A complete saved natal snapshot is required.'),
    });
    res.status(409).json({
      error: 'NATAL_SNAPSHOT_INVALID',
      message: 'A complete saved natal snapshot is required. Open the natal chart and check its data.',
    });
    return null;
  }
  options.onChartResolved?.({
    userId,
    chartId: ctx.chartId,
    hasChartData: !!ctx.chartData,
  });
  return { userId, ctx };
}
