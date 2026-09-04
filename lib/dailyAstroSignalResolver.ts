import type { NatalChartData, DailyAstroSignal, DailyAstroSignalResult, UserProfile } from '../types';
import type { NatalCalculationMetadataV2 } from './natalChartV2Types';
import { db } from './db';
import { getMoscowTodayKey } from './date-utils';
import { isCanonicalNatalChartDataComplete } from './natalChartCanonical';
import { DAILY_ASTRO_SIGNAL_CALCULATION_VERSION, buildDailyAstroSignal, isFullSwissDailyAstroSignal } from './dailyAstroSignal';
import { fromZonedTime } from 'date-fns-tz';

const DEFAULT_TIMEZONE = 'Europe/Moscow';

type ResolvedPulseReady = {
  status: 'ready';
  pulse: DailyAstroSignal;
  chartId: number | null;
  profile: UserProfile;
  source: string;
  repaired: boolean;
};

type ResolvedPulseNeedsSetup = Extract<DailyAstroSignalResult, { status: 'needs_setup' }> & {
  profile: UserProfile;
  chartId: number | null;
};

export type ResolvedDailyAstroSignal = ResolvedPulseReady | ResolvedPulseNeedsSetup;

function toProfile(user: any | null, fallback?: Partial<UserProfile>): UserProfile {
  return {
    id: fallback?.id || user?.id,
    name: fallback?.name || user?.name || '',
    birthDate: fallback?.birthDate || user?.birth_date || '',
    birthTime: fallback?.birthTime ?? user?.birth_time ?? '',
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

function isUsableChartData(chartData: NatalChartData | null | undefined): chartData is NatalChartData & { calculationMetadata: NatalCalculationMetadataV2 } {
  return isCanonicalNatalChartDataComplete(chartData);
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

function isDailyAstroSignal(value: unknown): value is DailyAstroSignal {
  const pulse = value as DailyAstroSignal | null;
  if (!pulse || !isFullSwissDailyAstroSignal(pulse)) return false;
  return typeof pulse === 'object' &&
    Array.isArray(pulse.points) &&
    pulse.points.length === 24 &&
    Array.isArray(pulse.windows) &&
    pulse.windows.length === 6 &&
    Array.isArray(pulse.keyMoments) &&
    pulse.keyMoments.length >= 4 &&
    typeof pulse.timezone === 'string';
}

async function readCachedPulse(chartId: number | null, userId: string, cacheKey: string) {
  try {
    const existing = chartId != null
      ? await db.content_interpretations.getByChart(chartId, 'free', 'forecast', 'daily', cacheKey)
      : await db.content_interpretations.getByUser(userId, 'free', 'forecast', 'daily', cacheKey);
    return isDailyAstroSignal(existing?.content) ? existing.content : null;
  } catch {
    return null;
  }
}

async function writeCachedPulse(chartId: number | null, userId: string, cacheKey: string, pulse: DailyAstroSignal) {
  if (!isFullSwissDailyAstroSignal(pulse)) {
    console.warn('[dailyAstroSignalResolver] refusing to cache non-Swiss daily astro signal', {
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
    legacySource: 'daily_astro_signal_v1',
  };

  try {
    if (chartId != null) {
      await db.content_interpretations.upsertByChart(chartId, payload, userId);
    } else {
      await db.content_interpretations.upsertByUser(userId, payload);
    }
  } catch (error: any) {
    console.warn('[dailyAstroSignalResolver] cache write failed:', error?.message || error);
  }
}

export async function resolveDailyAstroSignalForUser({
  userId,
  chartId,
  dateKey = getMoscowTodayKey(),
  profileFallback,
  chartDataFallback: _chartDataFallback,
}: {
  userId: string;
  chartId?: number | null;
  dateKey?: string;
  profileFallback?: Partial<UserProfile>;
  chartDataFallback?: NatalChartData | null;
}): Promise<ResolvedDailyAstroSignal | null> {
  const user = await db.users.get(userId).catch(() => null);
  const profile = toProfile(user, profileFallback);
  const requestedChart = chartId != null ? await db.natal_charts.getById(chartId).catch(() => null) : null;
  const ownedRequestedChart = requestedChart && String(requestedChart.user_id) === String(userId) ? requestedChart : null;
  const primaryChart = ownedRequestedChart || await db.natal_charts.getPrimary(userId).catch(() => null);
  const chartRow = primaryChart;
  const chartData = (primaryChart?.chart_data || null) as NatalChartData | null;
  const repaired = false;

  if (!user && !profileFallback) return null;

  const resolvedChartId = chartRow?.id ?? chartId ?? null;
  if (!chartRow?.input_hash || !isUsableChartData(chartData)) {
    return {
      status: 'needs_setup',
      code: 'PROFILE_BIRTH_DATA_REQUIRED',
      message: profile.language === 'en'
        ? 'Add birth date and place so the astrologer can calculate your personal day pulse.'
        : 'Добавь дату и место рождения, чтобы астролог рассчитал персональный пульс дня.',
      actionLabel: profile.language === 'en' ? 'Complete profile' : 'Заполнить профиль',
      profile,
      chartId: resolvedChartId,
    };
  }

  const timezone = normalizeTimezone(chartData.timezone || chartRow?.timezone);
  const cacheKey = `daily-astro-signal:${dateKey}:${timezone}:${DAILY_ASTRO_SIGNAL_CALCULATION_VERSION}:${chartRow.input_hash}:${chartData.calculationMetadata?.calculatedAt || ''}`;
  const cached = await readCachedPulse(resolvedChartId, userId, cacheKey);
  if (cached) {
    return {
      status: 'ready',
      pulse: cached,
      chartId: resolvedChartId,
      profile,
      source: 'cache',
      repaired,
    };
  }

  const pulse = await buildDailyAstroSignal({
    chartData,
    dateKey,
    timezone,
    language: profile.language === 'en' ? 'en' : 'ru',
  });
  await writeCachedPulse(resolvedChartId, userId, cacheKey, pulse);

  return {
    status: 'ready',
    pulse,
    chartId: resolvedChartId,
    profile,
    source: repaired ? 'calculated_repaired' : pulse.source,
    repaired,
  };
}

export function readTodayDateKey(raw: unknown) {
  const value = String(raw || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : getMoscowTodayKey();
}

export function readOptionalChartId(raw: unknown) {
  const parsed = typeof raw === 'string' ? Number.parseInt(raw, 10) : typeof raw === 'number' ? raw : null;
  return Number.isFinite(parsed as number) ? parsed as number : null;
}
