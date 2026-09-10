import type { NextApiRequest, NextApiResponse } from 'next';
import { getPremiumEntitlementState } from '../../../../lib/contentArchitecture';
import { generationInProgressPayload } from '../../../../lib/contentGenerationLock';
import {
  ensureValidContext,
} from '../../../../lib/natalReading/apiHelper';
import {
  generateNatalReportAnswerWithLock,
  getCachedNatalReportAnswer,
} from '../../../../lib/natalReading/reportCatalogApi';
import {
  getNatalReportAnswer,
  isNatalReportAnswerKey,
  type NatalReportAnswerKey,
} from '../../../../lib/natalReading/reportCatalog';

export const config = { maxDuration: 90 };

function readAnswerKey(req: NextApiRequest): NatalReportAnswerKey | null {
  const raw = req.method === 'GET' ? req.query.answerKey : req.body?.answerKey;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return isNatalReportAnswerKey(value) ? value : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }
  const answerKey = readAnswerKey(req);
  const definition = answerKey ? getNatalReportAnswer(answerKey) : null;
  if (!answerKey || !definition) {
    return res.status(400).json({
      error: 'INVALID_ANSWER_KEY',
      code: 'INVALID_ANSWER_KEY',
    });
  }
  const ready = await ensureValidContext(req, res, {
    allowGuest: true,
    requireCanonicalSnapshot: true,
    repairCanonicalSnapshot: false,
  });
  if (!ready) return;
  const { userId, ctx } = ready;
  const language = ctx.profile.language === 'en' ? 'en' : 'ru';
  const accessTier = definition.categoryKey === 'main' ? definition.access : 'premium';

  // Premium is checked before the first server cache lookup. A stale client flag
  // can never expose a paid answer from the durable cache.
  if (accessTier === 'premium') {
    const entitlement = await getPremiumEntitlementState(userId);
    if (!entitlement.isPremium) {
      return res.status(403).json({
        error: 'Premium required',
        code: 'PREMIUM_REQUIRED',
        premiumRequired: true,
      });
    }
  }

  const cached = await getCachedNatalReportAnswer(ctx, answerKey);
  if (req.method === 'GET') {
    if (!cached) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        code: 'NATAL_REPORT_ANSWER_NOT_READY',
      });
    }
    return res.status(200).json({
      interpretation: cached,
      source: 'natal_report_catalog_answer_v1',
      accessTier,
    });
  }

  if (cached) {
    return res.status(200).json({
      interpretation: cached,
      source: 'natal_report_catalog_answer_v1',
      accessTier,
    });
  }

  try {
    const lockResult = await generateNatalReportAnswerWithLock({ userId, ctx, answerKey });
    if (lockResult.status === 'in_progress') {
      return res.status(202).json(generationInProgressPayload(lockResult.retryAfterMs));
    }
    return res.status(200).json({
      interpretation: lockResult.value,
      source: lockResult.fromCache
        ? (lockResult.source || 'natal_report_catalog_answer_v1')
        : 'generated',
      accessTier,
    });
  } catch (error) {
    console.error(
      `[natal/catalog-answer] ${answerKey} generation failed:`,
      error instanceof Error ? error.message : error,
    );
    return res.status(503).json({
      error: 'NATAL_REPORT_ANSWER_GENERATION_FAILED',
      code: 'NATAL_REPORT_ANSWER_GENERATION_FAILED',
      message: language === 'en'
        ? 'This answer did not open right now. Try again — your saved chart has not changed.'
        : 'Этот ответ сейчас не открылся. Попробуй ещё раз — сохранённая карта не изменилась.',
      retryable: true,
    });
  }
}
