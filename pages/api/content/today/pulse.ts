import type { NextApiRequest, NextApiResponse } from 'next';
import type { NatalChartData, TodayPulse, TodayPulseResult, UserProfile } from '../../../../types';
import { db } from '../../../../lib/db';
import { AdminAuthError, handleAdminError, requireTelegramUserId } from '../../../../lib/adminAuth';
import { getMoscowTodayKey } from '../../../../lib/date-utils';
import { isCanonicalNatalChartDataComplete } from '../../../../lib/natalChartCanonical';
import { repairCanonicalChartRecord } from '../../../../lib/natalChartPersistence';
import { TODAY_PULSE_CALCULATION_VERSION, buildTodayPulse, isFullSwissTodayPulse } from '../../../../lib/todayPulse';
import { invalidUserIdPayload, isValidUserId } from '../../../../lib/userId';
import { fromZonedTime } from 'date-fns-tz';
import { logContentApi, warnContentApi } from '../../../../lib/contentApiLogging';

export const config = { maxDuration: 90 };

const SCOPE = 'today-pulse';

const DEFAULT_TIMEZONE = 'Europe/Moscow';

type ResolvedContext = {
  user: any | null;
  profile: UserProfile;
  chartId: number | null;
  chartData: NatalChartData | null;
  chartRow: any | null;
  repaired: boolean;
};

function toProfile(user: any | null, fallback?: Partial<UserProfile>): UserProfile {
  return {
    id: fallback?.id || user?.id,
    name: fallback?.name || user?.name || '',
    birthDate: fallback?.birthDate || user?.birth_date || '',
    birthTime: fallback?.birthTime || user?.birth_time || '12:00',
    birthPlace: fallback?.birthPlace || user?.birth_place || '',
    isSetup: fallback?.isSetup ?? user?.is_setup ?? false,
    language: (fallback?.language as 'ru' | 'en') || user?.language || 'ru',
    theme: (fallback?.theme as 'dark' | 'light') || user?.theme || 'light',
    isPremium: !!user?.is_premium,
    isAdmin: fallback?.isAdmin ?? !!user?.is_admin,
    loginStreak: fallback?.loginStreak ?? user?.login_streak ?? 0,
    chartSlots: fallback?.chartSlots ?? user?.chart_slots ?? 1,
    generatedContent: fallback?.generatedContent,
  };
}

function readDate(req: NextApiRequest): string {
  const raw = String((req.method === 'GET' ? req.query.date : req.body?.date) || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : getMoscowTodayKey();
}

function readChartId(req: NextApiRequest) {
  const raw = req.method === 'GET' ? req.query.chartId : req.body?.chartId;
  const parsed = typeof raw === 'string' ? Number.parseInt(raw, 10) : typeof raw === 'number' ? raw : null;
  return Number.isFinite(parsed as number) ? parsed as number : null;
}

function hasBirthData(profile: UserProfile) {
  return !!profile.birthDate && !!profile.birthPlace;
}

function isUsableChartData(chartData: NatalChartData | null | undefined): chartData is NatalChartData {
  return !!chartData && !!chartData.sun && !!chartData.moon && !!chartData.rising;
}

function normalizeTimezone(timezone?: string | null) {
  const candidate = String(timezone || '').trim() || DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

function nextDateKey(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function validToForLocalDay(dateKey: string, timezone: string) {
  return fromZonedTime(`${nextDateKey(dateKey)}T00:00:00`, timezone).toISOString();
}

function isTodayPulse(value: unknown): value is TodayPulse {
  const pulse = value as TodayPulse | null;
  if (!pulse || !isFullSwissTodayPulse(pulse)) return false;
  return typeof pulse === 'object' &&
    Array.isArray(pulse.points) &&
    pulse.points.length === 24 &&
    Array.isArray(pulse.windows) &&
    pulse.windows.length === 6 &&
    Array.isArray(pulse.keyMoments) &&
    pulse.keyMoments.length >= 4 &&
    typeof pulse.timezone === 'string';
}

async function resolveContext(
  userId: string,
  chartId: number | null,
  profileFallback?: Partial<UserProfile>,
  chartDataFallback?: NatalChartData | null
): Promise<ResolvedContext | null> {
  const user = await db.users.get(userId).catch(() => null);
  const profile = toProfile(user, profileFallback);
  const requestedChart = chartId != null
    ? await db.natal_charts.getById(chartId).catch(() => null)
    : null;
  const primaryChart = requestedChart || await db.natal_charts.getPrimary(userId).catch(() => null);
  let chartRow = primaryChart;
  let chartData = (chartDataFallback || primaryChart?.chart_data || null) as NatalChartData | null;
  let repaired = false;

  if (!isCanonicalNatalChartDataComplete(chartData) && hasBirthData(profile)) {
    const repair = await repairCanonicalChartRecord(userId, chartRow?.id ?? chartId).catch(() => null);
    if (repair?.chart?.chart_data) {
      chartRow = repair.chart;
      chartData = repair.chart.chart_data as NatalChartData;
      repaired = true;
    }
  }

  if (!user && !profileFallback) return null;
  return {
    user,
    profile,
    chartId: chartRow?.id ?? chartId ?? null,
    chartData: isUsableChartData(chartData) ? chartData : null,
    chartRow,
    repaired,
  };
}

async function readCachedPulse(chartId: number | null, userId: string, cacheKey: string) {
  try {
    const existing = chartId != null
      ? await db.content_interpretations.getByChart(chartId, 'free', 'forecast', 'daily', cacheKey)
      : await db.content_interpretations.getByUser(userId, 'free', 'forecast', 'daily', cacheKey);
    return isTodayPulse(existing?.content) ? existing.content : null;
  } catch {
    return null;
  }
}

async function writeCachedPulse(chartId: number | null, userId: string, cacheKey: string, pulse: TodayPulse) {
  if (!isFullSwissTodayPulse(pulse)) {
    console.warn('[API/content/today/pulse] refusing to cache non-Swiss Today Pulse', {
      userId,
      chartId,
      source: pulse?.source,
      points: pulse?.points?.length,
    });
    return;
  }

  const payload = {
    accessTier: 'free' as const,
    contentSurface: 'forecast' as const,
    contentVariant: 'daily' as const,
    cacheKey,
    inputHash: `${pulse.date}:${pulse.timezone}:${pulse.calculationVersion}`,
    content: pulse,
    modelTier: 'base' as const,
    promptVersion: 'deterministic',
    calculationVersion: pulse.calculationVersion,
    validFrom: `${pulse.date}T00:00:00.000Z`,
    validTo: validToForLocalDay(pulse.date, pulse.timezone),
    isPersistent: false,
    canRegenerateForLumi: false,
    legacySource: 'today_pulse_v1',
  };
  try {
    if (chartId != null) {
      await db.content_interpretations.upsertByChart(chartId, payload, userId);
    } else {
      await db.content_interpretations.upsertByUser(userId, payload);
    }
  } catch (error: any) {
    console.warn('[API/content/today/pulse] cache write failed:', error?.message || error);
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<TodayPulseResult | { error: string; message?: string }>) {
  const startedAt = Date.now();
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = String((req.method === 'GET' ? req.query.userId : req.body?.userId) || '').trim();
  const language = req.method === 'POST' && req.body?.profile?.language === 'en' ? 'en' : 'ru';
  if (!isValidUserId(userId)) {
    return res.status(400).json(invalidUserIdPayload(language));
  }
  try {
    requireTelegramUserId(req, userId);
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return handleAdminError(res, error);
    }
    throw error;
  }

  const dateKey = readDate(req);
  const chartId = readChartId(req);

  logContentApi(
    {
      scope: SCOPE,
      userId,
      chartId,
      surface: 'forecast',
      variant: 'daily',
    },
    'request_start',
    { metadata: { dateKey, method: req.method, note: 'today_pulse_storage_anomaly' } }
  );

  try {
    const context = await resolveContext(
      userId,
      chartId,
      req.method === 'POST' ? req.body?.profile : undefined,
      req.method === 'POST' ? req.body?.chartData : undefined
    );

    if (!context) {
      return res.status(404).json({ error: 'USER_NOT_FOUND', message: 'Profile not found' });
    }

    if (!context.chartData) {
      return res.status(200).json({
        status: 'needs_setup',
        code: 'PROFILE_BIRTH_DATA_REQUIRED',
        message: context.profile.language === 'en'
          ? 'Add birth date and place so the astrologer can calculate your personal day pulse.'
          : 'Добавь дату и место рождения, чтобы астролог рассчитал персональный пульс дня.',
        actionLabel: context.profile.language === 'en' ? 'Complete profile' : 'Заполнить профиль',
      });
    }

    const timezone = normalizeTimezone(context.chartData.timezone || context.chartRow?.timezone);
    const cacheKey = `today-pulse:${dateKey}:${timezone}:${TODAY_PULSE_CALCULATION_VERSION}`;
    const cached = await readCachedPulse(context.chartId, userId, cacheKey);
    if (cached) {
      logContentApi(
        {
          scope: SCOPE,
          userId,
          chartId: context.chartId,
          surface: 'forecast',
          variant: 'daily',
        },
        'cache_hit',
        {
          accessTier: 'free',
          status: 'ready',
          durationMs: Date.now() - startedAt,
          metadata: { dateKey, cacheKey },
        }
      );
      return res.status(200).json({
        status: 'ready',
        pulse: cached,
        chartId: context.chartId,
        source: 'cache',
      });
    }

    logContentApi(
      {
        scope: SCOPE,
        userId,
        chartId: context.chartId,
        surface: 'forecast',
        variant: 'daily',
      },
      'generation_start',
      { accessTier: 'free', metadata: { dateKey, cacheKey } }
    );
    const pulse = await buildTodayPulse({
      chartData: context.chartData,
      dateKey,
      timezone,
      language: context.profile.language === 'en' ? 'en' : 'ru',
    });
    await writeCachedPulse(context.chartId, userId, cacheKey, pulse);

    if (context.repaired) {
      console.log('[API/content/today/pulse] chart repaired for pulse', {
        userId,
        chartId: context.chartId,
        timezone: pulse.timezone,
      });
    }

    logContentApi(
      {
        scope: SCOPE,
        userId,
        chartId: context.chartId,
        surface: 'forecast',
        variant: 'daily',
      },
      'generation_success',
      {
        accessTier: 'free',
        status: 'ready',
        durationMs: Date.now() - startedAt,
        metadata: { dateKey, repaired: context.repaired },
      }
    );

    return res.status(200).json({
      status: 'ready',
      pulse,
      chartId: context.chartId,
      source: context.repaired ? 'calculated_repaired' : pulse.source,
    });
  } catch (error: any) {
    warnContentApi(
      {
        scope: SCOPE,
        userId,
        chartId,
        surface: 'forecast',
        variant: 'daily',
      },
      'generation_failed',
      {
        errorCode: error?.code === 'TRANSITS_UNAVAILABLE' ? 'TRANSITS_UNAVAILABLE' : 'TODAY_PULSE_FAILED',
        durationMs: Date.now() - startedAt,
      }
    );
    console.error('[API/content/today/pulse]', error?.message || error);
    const code = error?.code === 'TRANSITS_UNAVAILABLE' || error?.code === 'TODAY_PULSE_REQUIRES_SWISSEPH'
      ? 'TRANSITS_UNAVAILABLE'
      : 'TODAY_PULSE_FAILED';
    return res.status(code === 'TRANSITS_UNAVAILABLE' ? 503 : 500).json({
      error: code,
      message: language === 'en'
        ? 'Could not calculate the day pulse.'
        : 'Не удалось рассчитать пульс дня.',
    });
  }
}
