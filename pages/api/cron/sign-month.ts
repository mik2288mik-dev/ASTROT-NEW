import type { NextApiRequest, NextApiResponse } from 'next';
import { getMoscowMonthKey } from '../../../lib/date-utils';
import { buildSignMonthPrewarmTargets, prewarmSignMonth } from '../../../lib/horoscope/signPrewarm';
import { getCachedSignHoroscopes } from '../../../lib/horoscope/signCache';
import { ZODIAC_KEYS } from '../../../lib/zodiacKeys';

// Dedicated monthly cron, separate from /api/cron/tick. The standalone server
// runs the full job in the background so HTTP timeouts cannot split the month.
const running = new Map<string, Promise<unknown>>();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers?.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }
  const currentMonth = getMoscowMonthKey();
  const [year, month] = currentMonth.split('-').map(Number);
  const next = new Date(Date.UTC(year, month, 1, 12));
  const nextMonth = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`;
  const source = req.method === 'GET' ? req.query : req.body;
  const targetMonthKey = String(source?.month || nextMonth);
  if (targetMonthKey !== currentMonth && targetMonthKey !== nextMonth) {
    return res.status(400).json({ error: 'SIGN_HOROSCOPE_MONTH_KEY_INVALID' });
  }
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') {
    const targets = buildSignMonthPrewarmTargets(targetMonthKey);
    let completeTargets = 0;
    for (const target of targets) {
      const cached = await getCachedSignHoroscopes(target.period, target.periodKey, 'ru');
      if (ZODIAC_KEYS.every((sign) => !!cached[sign])) completeTargets += 1;
    }
    return res.status(200).json({ targetMonthKey, totalTargets: targets.length, completeTargets,
      complete: completeTargets === targets.length });
  }
  if (!running.has(targetMonthKey)) {
    const job = prewarmSignMonth({ targetMonthKey })
      .then((result) => console.log('[cron/sign-month]', JSON.stringify(result)))
      .catch((error) => console.error('[cron/sign-month] failed:', error instanceof Error ? error.message : String(error)))
      .finally(() => running.delete(targetMonthKey));
    running.set(targetMonthKey, job);
  }
  return res.status(202).json({ targetMonthKey, status: 'in_progress' });
}
