import type { NextApiRequest, NextApiResponse } from 'next';
import { buildNatalProfileCards, NATAL_PROFILE_CARDS_VERSION } from '../../../../lib/natalProfileCards';
import { ensureValidContext, isPremium } from '../../../../lib/natalReading/apiHelper';
import { db } from '../../../../lib/db';
import { resolveDailyAstroSignalForUser } from '../../../../lib/dailyAstroSignalResolver';
import type { DailyAstroSignal, DailyAstroSignalWindow } from '../../../../types';

function readLocalHour(req: NextApiRequest): number | null {
  const raw = req.method === 'GET' ? req.query.localHour : req.body?.localHour;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 23 ? n : null;
}

function readTodayText(req: NextApiRequest): string | null {
  const raw = req.method === 'GET' ? req.query.todayText : req.body?.todayText;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 240) : null;
}

function localHourFor(timezone?: string | null): number | null {
  const candidate = String(timezone || '').trim() || 'Europe/Moscow';
  try {
    const formatted = new Intl.DateTimeFormat('en-US', {
      timeZone: candidate,
      hour: '2-digit',
      hour12: false,
    }).format(new Date());
    const parsed = Number.parseInt(formatted, 10);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function pickBestWindow(pulse: DailyAstroSignal): DailyAstroSignalWindow | null {
  const peakHour = Number(pulse.peakPoint?.hour);
  const byPeak = pulse.windows.find((window) => {
    const start = Number.parseInt(window.start.slice(0, 2), 10);
    const end = Number.parseInt(window.end.slice(0, 2), 10);
    return Number.isFinite(start) && Number.isFinite(end) && peakHour >= start && peakHour <= end;
  });
  return byPeak || pulse.windows.slice().sort((a, b) => b.score - a.score)[0] || null;
}

async function buildTodayContext(userId: string, chartId: number | null, valid: NonNullable<Awaited<ReturnType<typeof ensureValidContext>>>, req: NextApiRequest) {
  const explicitText = readTodayText(req);
  const explicitHour = readLocalHour(req);
  const fallbackHour = explicitHour ?? localHourFor(valid.ctx.chartData?.timezone);

  try {
    const resolved = await resolveDailyAstroSignalForUser({
      userId,
      chartId,
      profileFallback: valid.ctx.profile,
      chartDataFallback: valid.ctx.chartData,
    });
    if (!resolved || resolved.status !== 'ready') {
      return { shortText: explicitText, localHour: fallbackHour };
    }

    const todayCheckIn = await db.daily_checkins.getForDate(userId, resolved.chartId, resolved.pulse.date).catch(() => null);
    const bestWindow = pickBestWindow(resolved.pulse);
    return {
      shortText: explicitText || resolved.pulse.currentPoint.summary,
      dailySignalTitle: resolved.pulse.currentPoint.title,
      dailySignalSummary: resolved.pulse.currentPoint.summary,
      bestWindowLabel: bestWindow ? `${bestWindow.start}–${bestWindow.end}: ${bestWindow.label}` : null,
      checkinCompleted: !!todayCheckIn,
      localHour: explicitHour ?? localHourFor(resolved.pulse.timezone) ?? fallbackHour,
    };
  } catch (error: any) {
    console.warn('[profile-cards] Today context fallback:', error?.message || error);
    return { shortText: explicitText, localHour: fallbackHour };
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const valid = await ensureValidContext(req, res);
  if (!valid) return;

  try {
    const premium = await isPremium(valid.userId);
    const todayContext = await buildTodayContext(valid.userId, valid.ctx.chartId, valid, req);
    const profileCards = buildNatalProfileCards({
      profile: { ...valid.ctx.profile, isPremium: premium },
      chartData: valid.ctx.chartData!,
      isPremium: premium,
      todayContext,
    });

    return res.status(200).json({
      profileCards,
      meta: {
        version: NATAL_PROFILE_CARDS_VERSION,
        mapperVersion: NATAL_PROFILE_CARDS_VERSION,
        chartId: valid.ctx.chartId,
        generatedAt: new Date().toISOString(),
        isPremium: premium,
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      error: 'PROFILE_CARDS_FAILED',
      message: error?.message || 'Failed to build profile cards',
    });
  }
}
