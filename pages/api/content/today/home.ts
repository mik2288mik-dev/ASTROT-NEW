import type { NextApiRequest, NextApiResponse } from 'next';
import type { TodayAssistantHomeResult } from '../../../../types';
import { db } from '../../../../lib/db';
import { AdminAuthError, handleAdminError, requireTelegramUserId } from '../../../../lib/adminAuth';
import {
  buildAccuracySummary,
  buildPatternTeaser,
  buildPersonalPatterns,
  buildQuickActionRecommendations,
  getTodayAssistantDayMode,
} from '../../../../lib/todayAssistant';
import { getTodayCheckInDateInfo } from '../../../../lib/todayCheckInDate';
import { invalidUserIdPayload, isValidUserId } from '../../../../lib/userId';
import {
  readOptionalChartId,
  readTodayDateKey,
  resolveTodayPulseForUser,
} from '../../../../lib/todayPulseResolver';

export const config = { maxDuration: 90 };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TodayAssistantHomeResult | { error: string; message?: string }>
) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = String(req.body?.userId || '').trim();
  const language = req.body?.profile?.language === 'en' ? 'en' : 'ru';
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

  try {
    const resolved = await resolveTodayPulseForUser({
      userId,
      chartId: readOptionalChartId(req.body?.chartId),
      dateKey: readTodayDateKey(req.body?.date),
      profileFallback: req.body?.profile,
      chartDataFallback: req.body?.chartData,
    });

    if (!resolved) {
      return res.status(404).json({ error: 'USER_NOT_FOUND', message: 'Profile not found' });
    }

    if (resolved.status === 'needs_setup') {
      return res.status(200).json({
        status: 'needs_setup',
        code: resolved.code,
        message: resolved.message,
        actionLabel: resolved.actionLabel,
      });
    }

    const checkInDateInfo = getTodayCheckInDateInfo(resolved.pulse);
    let checkInPulse = resolved.pulse;
    if (checkInDateInfo.mode === 'previous_day_tail' && checkInDateInfo.date !== resolved.pulse.date) {
      const previousResolved = await resolveTodayPulseForUser({
        userId,
        chartId: resolved.chartId,
        dateKey: checkInDateInfo.date,
        profileFallback: req.body?.profile,
        chartDataFallback: req.body?.chartData,
      }).catch(() => null);
      if (previousResolved?.status === 'ready') {
        checkInPulse = previousResolved.pulse;
      }
    }

    const [todayCheckIn, checkins, actionEvents] = await Promise.all([
      db.daily_checkins.getForDate(userId, resolved.chartId, checkInDateInfo.date).catch(() => null),
      db.daily_checkins.listRecent(userId, resolved.chartId, 30).catch(() => []),
      db.action_timing_events.listRecent(userId, resolved.chartId, 60).catch(() => []),
    ]);
    const insights = buildPersonalPatterns(checkins, actionEvents, resolved.profile.language);
    if (insights.length > 0) {
      void db.personal_pattern_insights.upsertMany(userId, resolved.chartId, insights).catch(() => undefined);
    }

    return res.status(200).json({
      status: 'ready',
      pulse: resolved.pulse,
      chartId: resolved.chartId,
      source: resolved.source,
      dayMode: getTodayAssistantDayMode(resolved.pulse),
      checkInPulse,
      checkInDate: checkInDateInfo.date,
      checkInDateMode: checkInDateInfo.mode,
      checkIn: todayCheckIn
        ? { status: 'completed', entry: todayCheckIn }
        : { status: 'open' },
      quickActions: buildQuickActionRecommendations(resolved.pulse, resolved.profile.language),
      accuracySummary: buildAccuracySummary(checkins, resolved.profile.language),
      patternTeaser: buildPatternTeaser(checkins, insights, resolved.profile.language),
      insights,
    });
  } catch (error: any) {
    console.error('[API/content/today/home]', error?.message || error);
    return res.status(500).json({
      error: 'TODAY_HOME_FAILED',
      message: language === 'en'
        ? 'Could not prepare Today.'
        : 'Не удалось подготовить экран Сегодня.',
    });
  }
}
