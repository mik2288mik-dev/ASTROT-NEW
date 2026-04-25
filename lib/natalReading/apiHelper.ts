import type { NextApiRequest, NextApiResponse } from 'next';
import type {
  ContentInterpretation,
  NatalChartData,
  UserProfile,
} from '../../types';
import { db } from '../db';
import { getContentLayer } from '../contentArchitecture';

export type ReadingContext = {
  user: any;
  profile: UserProfile;
  chartId: number | null;
  chartData: NatalChartData | null;
};

function toProfile(user: any, fallback?: Partial<UserProfile>): UserProfile {
  return {
    id: user.id,
    name: fallback?.name || user.name || '',
    birthDate: fallback?.birthDate || user.birth_date || '',
    birthTime: fallback?.birthTime || user.birth_time || '12:00',
    birthPlace: fallback?.birthPlace || user.birth_place || '',
    isSetup: user.is_setup ?? true,
    language: (fallback?.language as 'ru' | 'en') || user.language || 'ru',
    theme: (fallback?.theme as 'dark' | 'light') || user.theme || 'dark',
    isPremium: !!user.is_premium,
    isAdmin: !!user.is_admin,
    lumiBalance: user.lumi_balance ?? 0,
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
  chartDataFallback?: NatalChartData | null
): Promise<ReadingContext | null> {
  const user = await db.users.get(userId);
  if (!user) return null;
  const chart =
    chartId != null
      ? await db.natal_charts.getById(chartId)
      : await db.natal_charts.getPrimary(userId);
  return {
    user,
    profile: toProfile(user, profileFallback),
    chartId: chart?.id ?? null,
    chartData: (chartDataFallback || chart?.chart_data || null) as NatalChartData | null,
  };
}

export type CachedReadingOptions = {
  accessTier: 'free' | 'premium';
  contentVariant:
    | 'anchor'
    | 'living'
    | 'planet_insight'
    | 'wheel_insight'
    | 'daily'
    | 'morning'
    | 'day'
    | 'evening'
    | 'weekly'
    | 'monthly'
    | 'brief'
    | 'full'
    | 'one_off';
  cacheKey: string;
  promptVersion: string;
  modelTier?: 'base' | 'premium';
  isPersistent?: boolean;
  validFrom?: Date | null;
  validTo?: Date | null;
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
    inputHash: opts.cacheKey,
    content,
    modelTier: (opts.modelTier ?? (opts.accessTier === 'premium' ? 'premium' : 'base')) as
      | 'base'
      | 'premium',
    promptVersion: opts.promptVersion,
    calculationVersion: ctx.chartData?.calculationVersion || null,
    isPersistent: opts.isPersistent ?? true,
    canRegenerateForLumi: false,
    regenerationCostLumi: null,
    legacySource: null,
    validFrom: opts.validFrom ?? null,
    validTo: opts.validTo ?? null,
  };

  if (ctx.chartId != null) {
    return (await db.content_interpretations.upsertByChart(
      ctx.chartId,
      payload as any,
      String(ctx.profile.id)
    )) as ContentInterpretation<T>;
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
  try {
    const ent = await db.premium_entitlements.getActive(userId);
    return !!ent;
  } catch {
    return false;
  }
}

export async function ensureValidContext(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<{ userId: string; ctx: ReadingContext } | null> {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return null;
  }
  const userId = await readUserId(req);
  if (!userId) {
    res.status(400).json({ error: 'Bad request', message: 'userId is required' });
    return null;
  }
  const chartId = await readChartId(req);
  const ctx = await resolveReadingContext(
    userId,
    chartId,
    req.method === 'POST' ? req.body?.profile : undefined,
    req.method === 'POST' ? req.body?.chartData : undefined
  );
  if (!ctx) {
    res.status(404).json({ error: 'User not found', message: 'Profile not found' });
    return null;
  }
  if (!ctx.chartData) {
    res.status(409).json({
      error: 'PRIMARY_CHART_MISSING',
      message: 'A saved natal chart is required for the natal reading.',
    });
    return null;
  }
  return { userId, ctx };
}
