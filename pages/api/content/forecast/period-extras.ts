import type { NextApiRequest, NextApiResponse } from 'next';
import type {
  ContentInterpretation,
  NatalChartData,
  PersonalPeriodType,
  UserProfile,
} from '../../../../types';
import { AdminAuthError, handleAdminError, requireTelegramUserId } from '../../../../lib/adminAuth';
import {
  getMoscowIsoWeekKey,
  getMoscowMonthKey,
  getMoscowTodayKey,
  getMoscowYearKey,
  isValidMoscowIsoWeekKey,
  isValidMoscowMonthKey,
  isValidMoscowYearKey,
} from '../../../../lib/date-utils';
import { db } from '../../../../lib/db';
import {
  buildContentGenerationLockKey,
  generationInProgressPayload,
  withContentGenerationLock,
} from '../../../../lib/contentGenerationLock';
import { getPremiumEntitlementState } from '../../../../lib/contentArchitecture';
import {
  buildPeriodExtrasCacheKey,
  contentVariantForPeriodExtras,
  generatePeriodExtras,
  isPeriodExtras,
  PERIOD_EXTRAS_CALCULATION_VERSION,
  PERIOD_EXTRAS_PROMPT_VERSION,
  stripLockedPeriodExtras,
  validRangeForPeriodExtras,
} from '../../../../lib/periodExtras';

export const config = { maxDuration: 90 };

const PERIOD_TYPES: PersonalPeriodType[] = ['daily', 'weekly', 'monthly', 'yearly'];

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
    loginStreak: user.login_streak ?? 0,
    chartSlots: user.chart_slots ?? 1,
    generatedContent: fallback?.generatedContent,
  };
}

function requestValue(req: NextApiRequest, key: string): unknown {
  return req.method === 'GET' ? req.query[key] : req.body?.[key];
}

function parsePeriodType(req: NextApiRequest): PersonalPeriodType | null {
  const raw = String(requestValue(req, 'periodType') || '').trim() as PersonalPeriodType;
  return PERIOD_TYPES.includes(raw) ? raw : null;
}

function validDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function parsePeriodKey(req: NextApiRequest, periodType: PersonalPeriodType): string {
  const raw = String(requestValue(req, 'periodKey') || '').trim();
  if (periodType === 'daily') return validDateKey(raw) ? raw : getMoscowTodayKey();
  if (periodType === 'weekly') return isValidMoscowIsoWeekKey(raw) ? raw : getMoscowIsoWeekKey();
  if (periodType === 'monthly') return isValidMoscowMonthKey(raw) ? raw : getMoscowMonthKey();
  return isValidMoscowYearKey(raw) ? raw : getMoscowYearKey();
}

function parseChartId(req: NextApiRequest): number | null {
  const raw = requestValue(req, 'chartId');
  const parsed = typeof raw === 'number' ? raw : Number.parseInt(String(raw || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseLanguage(req: NextApiRequest, profile: UserProfile): 'ru' | 'en' {
  const raw = String(requestValue(req, 'language') || profile.language || '').trim();
  return raw === 'en' ? 'en' : 'ru';
}

function presentInterpretation(
  interpretation: ContentInterpretation,
  isPremium: boolean,
): ContentInterpretation {
  return {
    ...interpretation,
    content: stripLockedPeriodExtras(interpretation.content, isPremium),
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = String(requestValue(req, 'userId') || '').trim();
  const periodType = parsePeriodType(req);
  if (!userId || !periodType) {
    return res.status(400).json({
      error: 'Bad request',
      message: 'userId and a valid periodType are required',
    });
  }

  try {
    requireTelegramUserId(req, userId);
  } catch (error) {
    if (error instanceof AdminAuthError) return handleAdminError(res, error);
    throw error;
  }

  try {
    const user = await db.users.get(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const requestedChartId = parseChartId(req);
    const chart = requestedChartId != null
      ? await db.natal_charts.getById(requestedChartId)
      : await db.natal_charts.getPrimary(userId);
    if (!chart || String(chart.user_id) !== userId || !chart.chart_data) {
      return res.status(409).json({
        error: 'PRIMARY_CHART_MISSING',
        message: 'A saved personal chart is required for period cards.',
      });
    }

    const profile = toProfile(user, req.method === 'POST' ? req.body?.profile : undefined);
    const language = parseLanguage(req, profile);
    profile.language = language;
    const chartId = Number(chart.id);
    const chartData = chart.chart_data as NatalChartData;
    const periodKey = parsePeriodKey(req, periodType);
    const contentVariant = contentVariantForPeriodExtras(periodType);
    const cacheKey = buildPeriodExtrasCacheKey({
      userId,
      chartId,
      periodType,
      periodKey,
      language,
    });
    const entitlement = await getPremiumEntitlementState(userId);

    const readCached = async () => {
      const interpretation = await db.content_interpretations.getByChart(
        chartId,
        'premium',
        'forecast',
        contentVariant,
        cacheKey,
      );
      if (!interpretation || !isPeriodExtras(interpretation.content)) return null;
      return interpretation;
    };

    const cached = await readCached();
    if (cached) {
      return res.status(200).json({
        interpretation: presentInterpretation(cached, entitlement.isPremium),
        source: 'content_v1',
        chartId,
        cacheKey,
        locked: !entitlement.isPremium,
      });
    }

    if (req.method === 'GET') {
      return res.status(404).json({ error: 'Period extras not found' });
    }

    const lockKey = buildContentGenerationLockKey({
      userId,
      chartId,
      accessTier: 'premium',
      contentSurface: 'forecast',
      contentVariant: periodType === 'yearly' ? 'yearly' : contentVariant,
      cacheKey,
      promptVersion: PERIOD_EXTRAS_PROMPT_VERSION,
    });
    const lockResult = await withContentGenerationLock({
      lockKey,
      operation: 'period-extras-generation',
      readCached: async () => {
        const interpretation = await readCached();
        return interpretation ? { value: interpretation, source: 'content_v1' } : null;
      },
      generate: async () => {
        const generated = await generatePeriodExtras(profile, chartData, periodType, periodKey);
        const { validFrom, validTo } = validRangeForPeriodExtras(periodType, periodKey);
        const saved = await db.content_interpretations.upsertByChart(chartId, {
          accessTier: 'premium',
          contentSurface: 'forecast',
          contentVariant,
          cacheKey,
          inputHash: cacheKey,
          content: generated.extras,
          modelTier: generated.modelTier,
          promptVersion: PERIOD_EXTRAS_PROMPT_VERSION,
          calculationVersion: PERIOD_EXTRAS_CALCULATION_VERSION,
          validFrom,
          validTo,
          isPersistent: periodType === 'yearly',
        }, userId);
        if (!saved || !isPeriodExtras(saved.content)) {
          throw new Error('PERIOD_EXTRAS_PERSISTENCE_FAILED');
        }
        return saved;
      },
    });

    if (lockResult.status === 'in_progress') {
      return res.status(202).json(generationInProgressPayload(lockResult.retryAfterMs));
    }

    return res.status(200).json({
      interpretation: presentInterpretation(lockResult.value, entitlement.isPremium),
      source: lockResult.fromCache ? (lockResult.source || 'content_v1') : 'generated',
      chartId,
      cacheKey,
      locked: !entitlement.isPremium,
    });
  } catch {
    return res.status(503).json({
      error: 'PERIOD_EXTRAS_UNAVAILABLE',
      message: 'Personal period cards are temporarily unavailable.',
    });
  }
}
