import type { NatalChartData, TodayPulse, TodayPulseResult, UserProfile } from '../types';
import { db } from './db';
import { getMoscowTodayKey } from './date-utils';
import { isCanonicalNatalChartDataComplete } from './natalChartCanonical';
import { repairCanonicalChartRecord } from './natalChartPersistence';
import { TODAY_PULSE_CALCULATION_VERSION, buildTodayPulse, isFullSwissTodayPulse } from './todayPulse';
import { fromZonedTime } from 'date-fns-tz';

const DEFAULT_TIMEZONE = 'Europe/Moscow';

type ResolvedPulseReady = {
  status: 'ready';
  pulse: TodayPulse;
  chartId: number | null;
  profile: UserProfile;
  source: string;
  repaired: boolean;
};

type ResolvedPulseNeedsSetup = Extract<TodayPulseResult, { status: 'needs_setup' }> & {
  profile: UserProfile;
  chartId: number | null;
};

export type ResolvedTodayPulse = ResolvedPulseReady | ResolvedPulseNeedsSetup;

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
    isPremium: fallback?.isPremium ?? !!user?.is_premium,
    isAdmin: fallback?.isAdmin ?? !!user?.is_admin,
    lumiBalance: fallback?.lumiBalance ?? user?.lumi_balance ?? 0,
    loginStreak: fallback?.loginStreak ?? user?.login_streak ?? 0,
    chartSlots: fallback?.chartSlots ?? user?.chart_slots ?? 1,
    generatedContent: fallback?.generatedContent,
  };
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
    console.warn('[todayPulseResolver] refusing to cache non-Swiss Today Pulse', {
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
    console.warn('[todayPulseResolver] cache write failed:', error?.message || error);
  }
}

export async function resolveTodayPulseForUser({
  userId,
  chartId,
  dateKey = getMoscowTodayKey(),
  profileFallback,
  chartDataFallback,
}: {
  userId: string;
  chartId?: number | null;
  dateKey?: string;
  profileFallback?: Partial<UserProfile>;
  chartDataFallback?: NatalChartData | null;
}): Promise<ResolvedTodayPulse | null> {
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
    const repair = await repairCanonicalChartRecord(userId, chartRow?.id ?? chartId ?? null).catch(() => null);
    if (repair?.chart?.chart_data) {
      chartRow = repair.chart;
      chartData = repair.chart.chart_data as NatalChartData;
      repaired = true;
    }
  }

  if (!user && !profileFallback) return null;

  const resolvedChartId = chartRow?.id ?? chartId ?? null;
  if (!isUsableChartData(chartData)) {
    return {
      status: 'needs_setup',
      code: 'PROFILE_BIRTH_DATA_REQUIRED',
      message: profile.language === 'en'
        ? 'Add birth date and place so Lumia can calculate your personal day pulse.'
        : 'Добавь дату и место рождения, чтобы Lumia рассчитала персональный пульс дня.',
      actionLabel: profile.language === 'en' ? 'Complete profile' : 'Заполнить профиль',
      profile,
      chartId: resolvedChartId,
    };
  }

  const timezone = normalizeTimezone(chartData.timezone || chartRow?.timezone);
  const cacheKey = `today-pulse:${dateKey}:${timezone}:${TODAY_PULSE_CALCULATION_VERSION}`;
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

  const pulse = await buildTodayPulse({
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
