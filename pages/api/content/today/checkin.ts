import type { NextApiRequest, NextApiResponse } from 'next';
import type { DailyCheckInSubmitResult } from '../../../../types';
import { db } from '../../../../lib/db';
import {
  assertDailyCheckInInput,
  buildAccuracySummary,
  buildPatternTeaser,
  buildPersonalPatterns,
} from '../../../../lib/todayAssistant';
import { getTodayCheckInDateInfo } from '../../../../lib/todayCheckInDate';
import { pickTodayCheckInReferencePoint } from '../../../../lib/todayCheckInReference';
import { invalidUserIdPayload, isValidUserId } from '../../../../lib/userId';
import {
  readOptionalChartId,
  readTodayDateKey,
  resolveTodayPulseForUser,
} from '../../../../lib/todayPulseResolver';

export const config = { maxDuration: 90 };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DailyCheckInSubmitResult | { error: string; message?: string }>
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

  const input = assertDailyCheckInInput(req.body?.checkIn || req.body);
  if (!input) {
    return res.status(400).json({
      error: 'BAD_REQUEST',
      message: language === 'en' ? 'Check-in payload is invalid.' : 'Ответы чек-ина заполнены неверно.',
    });
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
      return res.status(400).json({ error: resolved.code, message: resolved.message });
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
    const referencePoint = pickTodayCheckInReferencePoint(checkInPulse);

    const checkIn = await db.daily_checkins.upsert(
      userId,
      resolved.chartId,
      checkInDateInfo.date,
      checkInPulse.timezone,
      input,
      {
        time: referencePoint.time,
        phase: referencePoint.phase,
        score: referencePoint.score,
        layers: referencePoint.layers,
      }
    );
    const [checkins, actionEvents] = await Promise.all([
      db.daily_checkins.listRecent(userId, resolved.chartId, 30).catch(() => [checkIn]),
      db.action_timing_events.listRecent(userId, resolved.chartId, 60).catch(() => []),
    ]);
    const insights = buildPersonalPatterns(checkins, actionEvents, resolved.profile.language);
    if (insights.length > 0) {
      void db.personal_pattern_insights.upsertMany(userId, resolved.chartId, insights).catch(() => undefined);
    }

    return res.status(200).json({
      status: 'saved',
      checkIn,
      accuracySummary: buildAccuracySummary(checkins, resolved.profile.language),
      patternTeaser: buildPatternTeaser(checkins, insights, resolved.profile.language),
      insights,
    });
  } catch (error: any) {
    console.error('[API/content/today/checkin]', error?.message || error);
    return res.status(500).json({
      error: 'TODAY_CHECKIN_FAILED',
      message: language === 'en' ? 'Could not save the day mark.' : 'Не удалось сохранить отметку дня.',
    });
  }
}
