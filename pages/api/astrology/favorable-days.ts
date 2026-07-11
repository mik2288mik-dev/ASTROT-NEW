import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../lib/db';
import { requireAppUser } from '../../../lib/auth/appAuth';
import { AdminAuthError, handleAdminError } from '../../../lib/adminAuth';
import { invalidUserIdPayload, isValidUserId } from '../../../lib/userId';
import { withRateLimit, RATE_LIMIT_CONFIGS } from '../../../lib/rateLimit';
import { computeDailyScores } from '../../../lib/dailyAstroSignal';
import { getPremiumEntitlementState } from '../../../lib/contentArchitecture';

// Оценка дня (0–100) на ВЕСЬ текущий календарный месяц (1-е → последнее число) — для
// «лучших дней» и календаря удачных дат. Один транзит на полдень каждого дня. Кэш 6 часов.
const memo = new Map<string, { exp: number; days: Array<{ date: string; score: number }> }>();

function monthDateKeys(tz: string): string[] {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const [y, m] = today.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const out: string[] = [];
  for (let d = 1; d <= lastDay; d += 1) out.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  return out;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const userId = String(req.query.userId || '').trim();
  if (!isValidUserId(userId)) return res.status(400).json(invalidUserIdPayload('ru'));

  try {
    await requireAppUser(req, { expectedUserId: userId, allowGuest: true });

    const entitlement = await getPremiumEntitlementState(userId);
    if (!entitlement.isPremium) {
      return res.status(403).json({ error: 'Premium required', code: 'PREMIUM_REQUIRED' });
    }

    const chart = await db.natal_charts.get(userId);
    const chartData = chart?.chart_data as any;
    if (!chartData || !chartData.sun) {
      return res.status(404).json({ error: 'NO_CHART', code: 'NO_CHART' });
    }

    const tz = (typeof chartData.timezone === 'string' && chartData.timezone) || 'Europe/Moscow';
    const dateKeys = monthDateKeys(tz);
    const cacheKey = `${userId}:${dateKeys[0]}`;

    const cached = memo.get(cacheKey);
    if (cached && cached.exp > Date.now()) {
      res.setHeader('Cache-Control', 'private, max-age=21600');
      return res.status(200).json({ days: cached.days, timezone: tz });
    }

    const days = await computeDailyScores(chartData, dateKeys, tz);
    memo.set(cacheKey, { exp: Date.now() + 6 * 60 * 60 * 1000, days });
    if (memo.size > 500) {
      const firstKey = memo.keys().next().value;
      if (firstKey) memo.delete(firstKey);
    }

    res.setHeader('Cache-Control', 'private, max-age=21600');
    return res.status(200).json({ days, timezone: tz });
  } catch (error: any) {
    if (error instanceof AdminAuthError) return handleAdminError(res, error);
    console.error('[API/favorable-days]', error?.message || error);
    return res.status(500).json({ error: 'Failed to compute favorable days' });
  }
}

export default withRateLimit(handler, RATE_LIMIT_CONFIGS.FREE);
