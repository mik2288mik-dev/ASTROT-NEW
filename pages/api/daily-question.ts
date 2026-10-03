import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAppUser } from '../../lib/auth/appAuth';
import { db } from '../../lib/db';
import { buildQuestionResults, questionForDay } from '../../lib/dailyQuestion';
import { networkHash, readCounts, readMyVote, saveVote } from '../../lib/dailyQuestionRepository';
import { resolveNotificationSign } from '../../lib/nativeNotificationPolicy';

/** pg returns DATE columns as local-midnight Date objects. */
function dateKey(value: unknown): string | undefined {
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  return typeof value === 'string' ? value.slice(0, 10) : undefined;
}

function clientIp(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return String(raw || req.socket?.remoteAddress || '').split(',')[0].trim();
}

/**
 * «Вопрос дня». GET — the question, my answer and results; POST { option } —
 * one vote per account per day. The sign comes from the saved profile.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ code: 'METHOD_NOT_ALLOWED' });
  try {
    const auth = await requireAppUser(req, { allowGuest: true });
    const userId = String(auth.userId);
    const dayKey = new Date(Date.now() + 3 * 3_600_000).toISOString().slice(0, 10);
    const question = questionForDay(dayKey);
    const user = await db.users.get(userId, { hydratePrimaryChart: false });
    const sign = resolveNotificationSign((user as { selected_zodiac_sign?: string } | null)?.selected_zodiac_sign, dateKey((user as { birth_date?: unknown } | null)?.birth_date));

    if (req.method === 'POST') {
      const option = Number((req.body || {}).option);
      if (!Number.isInteger(option) || option < 0 || option >= question.options.length) return res.status(400).json({ code: 'OPTION_INVALID' });
      if (!sign) return res.status(409).json({ code: 'SIGN_REQUIRED' });
      const outcome = await saveVote({ dayKey, userId, questionId: question.id, sign, optionIndex: option, network: networkHash(clientIp(req), dayKey) });
      if (outcome === 'network_limit') return res.status(429).json({ code: 'VOTE_LIMIT' });
    }

    const [myVote, counts] = await Promise.all([
      readMyVote(dayKey, userId),
      readCounts(dayKey, sign, question.options.length),
    ]);
    return res.status(200).json({
      dayKey,
      question,
      sign,
      myVote,
      results: myVote === null ? null : buildQuestionResults({ optionCount: question.options.length, signCounts: counts.sign, allCounts: counts.all }),
    });
  } catch (error: any) {
    const status = typeof error?.status === 'number' ? error.status : 503;
    return res.status(status).json({ code: status >= 500 ? 'QUESTION_UNAVAILABLE' : error?.code || 'AUTH_REQUIRED' });
  }
}
