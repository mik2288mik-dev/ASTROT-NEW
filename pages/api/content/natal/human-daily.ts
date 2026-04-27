import type { NextApiRequest, NextApiResponse } from 'next';
import type { InterpretationSection } from '../../../../types';
import { db } from '../../../../lib/db';
import { getPremiumEntitlementState } from '../../../../lib/contentArchitecture';
import { getMoscowTodayKey } from '../../../../lib/date-utils';
import {
  ensureValidContext,
  getCachedReading,
  saveReading,
} from '../../../../lib/natalReading/apiHelper';
import {
  buildHumanDailyFallback,
  buildHumanInputHash,
  generateHumanDailySection,
} from '../../../../lib/natalHumanInterpretation';
import {
  HUMAN_DAILY_PROMPT_VERSION,
  humanDailyCacheKey,
  isHumanDailySectionKey,
  type HumanDailySectionKey,
} from '../../../../lib/natalHumanShared';

export const config = { maxDuration: 90 };

function readSectionKey(req: NextApiRequest): HumanDailySectionKey | null {
  const raw = (req.method === 'GET' ? req.query.sectionKey : req.body?.sectionKey) as string | undefined;
  const value = String(raw || '').trim();
  return isHumanDailySectionKey(value) ? value : null;
}

function readDateKey(req: NextApiRequest): string {
  const raw = (req.method === 'GET' ? req.query.date : req.body?.date) as string | undefined;
  const value = String(raw || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : getMoscowTodayKey();
}

function getMoscowDayWindow(dateKey: string) {
  const [yearRaw, monthRaw, dayRaw] = dateKey.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return { validFrom: null, validTo: null };
  }
  return {
    validFrom: new Date(Date.UTC(year, month - 1, day, -3, 0, 0, 0)),
    validTo: new Date(Date.UTC(year, month - 1, day + 1, -3, 0, 0, 0)),
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ready = await ensureValidContext(req, res);
  if (!ready) return;
  const { userId, ctx } = ready;
  const sectionKey = readSectionKey(req);
  const dateKey = readDateKey(req);

  if (!sectionKey) {
    return res.status(400).json({
      error: 'BAD_REQUEST',
      message: 'sectionKey must be a daily human interpretation section key',
    });
  }

  const entitlement = await getPremiumEntitlementState(userId);
  if (!entitlement.isPremium) {
    return res.status(403).json({
      error: 'PREMIUM_REQUIRED',
      code: 'PREMIUM_REQUIRED',
      message: 'Ежедневные персональные разборы доступны в Lumia Premium.',
      lumiBalance: ctx.user.lumi_balance ?? 0,
    });
  }

  const cacheKey = humanDailyCacheKey(dateKey, sectionKey);
  const inputHash = buildHumanInputHash({
    profile: ctx.profile,
    chartData: ctx.chartData!,
    sectionKey,
    dateKey,
    promptVersion: HUMAN_DAILY_PROMPT_VERSION,
  });
  const window = getMoscowDayWindow(dateKey);
  const cacheOpts = {
    accessTier: 'premium' as const,
    contentVariant: 'living' as const,
    cacheKey,
    inputHash,
    promptVersion: HUMAN_DAILY_PROMPT_VERSION,
    isPersistent: false,
    validFrom: window.validFrom,
    validTo: window.validTo,
  };

  const cached = await getCachedReading<InterpretationSection>(ctx, cacheOpts);

  if (req.method === 'GET') {
    if (!cached) {
      return res.status(404).json({ error: 'NOT_FOUND', code: 'HUMAN_DAILY_NOT_READY' });
    }
    return res.status(200).json({
      interpretation: cached,
      source: 'human_v1',
      entitlement: entitlement.entitlement,
      lumiBalance: ctx.user.lumi_balance ?? 0,
    });
  }

  if (cached) {
    return res.status(200).json({
      interpretation: cached,
      source: 'human_v1',
      entitlement: entitlement.entitlement,
      lumiBalance: ctx.user.lumi_balance ?? 0,
    });
  }

  try {
    const section = await generateHumanDailySection(ctx.profile, ctx.chartData!, sectionKey, dateKey);
    const saved = await saveReading(ctx, cacheOpts, section);
    const lumiBalance = await db.lumi_transactions.getBalance(userId);
    return res.status(200).json({
      interpretation: saved,
      source: 'generated',
      entitlement: entitlement.entitlement,
      lumiBalance,
    });
  } catch (error) {
    console.error(`[natal/human-daily:${sectionKey}] generation failed:`, error instanceof Error ? error.message : error);
    const fallback = buildHumanDailyFallback(ctx.profile, ctx.chartData!, sectionKey, dateKey);
    const saved = await saveReading(ctx, cacheOpts, fallback).catch(() => null);
    return res.status(200).json({
      interpretation: saved || { content: fallback, promptVersion: cacheOpts.promptVersion },
      source: saved ? 'fallback' : 'fallback-inline',
      entitlement: entitlement.entitlement,
      lumiBalance: ctx.user.lumi_balance ?? 0,
    });
  }
}
