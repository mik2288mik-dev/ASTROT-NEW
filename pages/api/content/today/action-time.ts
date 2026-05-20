import type { NextApiRequest, NextApiResponse } from 'next';
import type { ActionTimingRecommendation } from '../../../../types';
import { db } from '../../../../lib/db';
import {
  buildActionTimingRecommendation,
  isActionTimingKey,
} from '../../../../lib/todayAssistant';
import { invalidUserIdPayload, isValidUserId } from '../../../../lib/userId';
import {
  readOptionalChartId,
  readTodayDateKey,
  resolveTodayPulseForUser,
} from '../../../../lib/todayPulseResolver';

export const config = { maxDuration: 90 };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ status: 'ready'; recommendation: ActionTimingRecommendation; chartId: number | null } | { error: string; message?: string }>
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

  const actionKey = req.body?.actionKey;
  if (!isActionTimingKey(actionKey)) {
    return res.status(400).json({
      error: 'BAD_REQUEST',
      message: language === 'en' ? 'Action is invalid.' : 'Действие выбрано неверно.',
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

    const recommendation = buildActionTimingRecommendation(resolved.pulse, actionKey, resolved.profile.language);
    void db.action_timing_events.create(
      userId,
      resolved.chartId,
      resolved.pulse.date,
      resolved.pulse.timezone,
      recommendation
    ).catch(() => undefined);

    return res.status(200).json({
      status: 'ready',
      recommendation,
      chartId: resolved.chartId,
    });
  } catch (error: any) {
    console.error('[API/content/today/action-time]', error?.message || error);
    return res.status(500).json({
      error: 'ACTION_TIMING_FAILED',
      message: language === 'en' ? 'Could not choose the time.' : 'Не удалось выбрать время.',
    });
  }
}
