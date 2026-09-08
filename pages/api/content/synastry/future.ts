import type { NextApiRequest, NextApiResponse } from 'next';
import { AdminAuthError, handleAdminError } from '../../../../lib/adminAuth';
import { requireAppUser } from '../../../../lib/auth/appAuth';
import { getPremiumEntitlementState } from '../../../../lib/contentArchitecture';
import { checkRateLimit } from '../../../../lib/rateLimit';
import { normalizeZodiacKey } from '../../../../lib/zodiacKeys';
import { RELATIONSHIP_CONTEXT_OPTIONS } from '../../../../lib/synastry/relationshipContext';
import { pairFutureTopics, PAIR_QUESTIONS, type PairFutureRequest } from '../../../../lib/synastry/pairFutureContract';
import { ensurePairFuture, PairFutureError } from '../../../../lib/synastry/pairFutureGeneration';

export const config = { maxDuration: 120 };
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ code: 'METHOD_NOT_ALLOWED' }); }
  try {
    const { userId } = await requireAppUser(req, { allowGuest: true });
    const entitlement = await getPremiumEntitlementState(userId);
    if (!entitlement.isPremium) throw new PairFutureError('PREMIUM_REQUIRED', 403);
    if (!checkRateLimit(userId, { name: 'pair-future-read', windowMs: 60000, maxRequests: 60 }).allowed) throw new PairFutureError('RATE_LIMITED', 429);
    const b = req.body || {}, signA = typeof b.signA === 'string' ? normalizeZodiacKey(b.signA) : null, signB = typeof b.signB === 'string' ? normalizeZodiacKey(b.signB) : null;
    if (!['future', 'question'].includes(b.kind) || !['sign', 'birth'].includes(b.mode) || !signA || !signB
      || !RELATIONSHIP_CONTEXT_OPTIONS.some(r => r.value === b.relation) || !pairFutureTopics(b.relation).includes(b.topic)
      || !['ru', 'en'].includes(b.language) || !['day', 'week', 'month'].includes(b.period)
      || typeof b.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(b.date)
      || (b.period === 'week' ? typeof b.endDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(b.endDate) : b.endDate !== undefined)
      || [b.chartId, b.partnerChartId].some(id => id !== undefined && (!Number.isSafeInteger(id) || id <= 0))
      || (b.partnerDate !== undefined && (typeof b.partnerDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(b.partnerDate)))
      || (b.kind === 'question' && !PAIR_QUESTIONS[b.topic as keyof typeof PAIR_QUESTIONS])) throw new PairFutureError('INVALID_SELECTION', 400);
    const input: PairFutureRequest = { kind: b.kind, mode: b.mode, signA, signB, relation: b.relation, topic: b.topic, language: b.language, date: b.date, period: b.period,
      ...(b.endDate ? { endDate: b.endDate } : {}), ...(b.chartId ? { chartId: b.chartId } : {}), ...(b.partnerChartId ? { partnerChartId: b.partnerChartId } : {}), ...(b.partnerDate ? { partnerDate: b.partnerDate } : {}) };
    const result = await ensurePairFuture(input, String(userId), entitlement.isPremium);
    if (result.status === 'generating') res.setHeader('Retry-After', '3');
    return res.status(result.status === 'ready' ? 200 : 202).json(result);
  } catch (error) {
    if (error instanceof AdminAuthError) return handleAdminError(res, error);
    const known = error instanceof PairFutureError, status = known ? error.status : 503;
    if (status === 429) res.setHeader('Retry-After', '60');
    return res.status(status).json({ code: known ? error.code : 'PAIR_FUTURE_UNAVAILABLE' });
  }
}
