import type { NextApiRequest, NextApiResponse } from 'next';
import { generationInProgressPayload } from '../../../../lib/contentGenerationLock';
import {
  ensureValidContext,
} from '../../../../lib/natalReading/apiHelper';
import {
  generateNatalReportCategoryWithLock,
  getCachedNatalReportCategory,
} from '../../../../lib/natalReading/reportCatalogApi';
import {
  isNatalReportCategoryKey,
  type NatalReportCategoryKey,
} from '../../../../lib/natalReading/reportCatalog';

export const config = { maxDuration: 90 };

function readCategoryKey(req: NextApiRequest): NatalReportCategoryKey | null {
  const raw = req.method === 'GET' ? req.query.categoryKey : req.body?.categoryKey;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return isNatalReportCategoryKey(value) ? value : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }
  const categoryKey = readCategoryKey(req);
  if (!categoryKey) {
    return res.status(400).json({
      error: 'INVALID_CATEGORY_KEY',
      code: 'INVALID_CATEGORY_KEY',
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
  const cached = await getCachedNatalReportCategory(ctx, categoryKey);

  if (req.method === 'GET') {
    if (!cached) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        code: 'NATAL_REPORT_CATEGORY_NOT_READY',
      });
    }
    return res.status(200).json({
      interpretation: cached,
      source: 'natal_report_catalog_v1',
      accessTier: 'free',
    });
  }

  if (cached) {
    return res.status(200).json({
      interpretation: cached,
      source: 'natal_report_catalog_v1',
      accessTier: 'free',
    });
  }

  try {
    const lockResult = await generateNatalReportCategoryWithLock({
      userId,
      ctx,
      categoryKey,
    });
    if (lockResult.status === 'in_progress') {
      return res.status(202).json(generationInProgressPayload(lockResult.retryAfterMs));
    }
    return res.status(200).json({
      interpretation: lockResult.value,
      source: lockResult.fromCache
        ? (lockResult.source || 'natal_report_catalog_v1')
        : 'generated',
      accessTier: 'free',
    });
  } catch (error) {
    console.error(
      `[natal/catalog] ${categoryKey} generation failed:`,
      error instanceof Error ? error.message : error,
    );
    return res.status(503).json({
      error: 'NATAL_REPORT_CATEGORY_GENERATION_FAILED',
      code: 'NATAL_REPORT_CATEGORY_GENERATION_FAILED',
      message: language === 'en'
        ? 'This part of the chart did not open right now. Try again — your saved chart has not changed.'
        : 'Эта часть карты сейчас не открылась. Попробуй ещё раз — сохранённая карта не изменилась.',
      retryable: true,
    });
  }
}
