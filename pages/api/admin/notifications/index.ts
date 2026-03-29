import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdminAccess, handleAdminError } from '../../../../lib/adminAuth';
import { db } from '../../../../lib/db';
import { serializeNotificationHistoryItem } from '../../../../lib/adminSerializers';
import type { AdminHistoryResultFilter, AdminNotificationModeFilter } from '../../../../types';

function isValidMode(value: unknown): value is AdminNotificationModeFilter {
  return value === 'all' || value === 'personal' || value === 'broadcast';
}

function isValidResult(value: unknown): value is AdminHistoryResultFilter {
  return value === 'all' || value === 'success' || value === 'partial' || value === 'failed';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
  }

  try {
    await requireAdminAccess(req);
    const pageRaw = typeof req.query.page === 'string' ? parseInt(req.query.page, 10) : 1;
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
    const pageSizeRaw = typeof req.query.pageSize === 'string'
      ? parseInt(req.query.pageSize, 10)
      : (typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 20);
    const pageSize = Math.min(Math.max(Number.isFinite(pageSizeRaw) ? pageSizeRaw : 20, 1), 50);
    const mode = isValidMode(req.query.mode) ? req.query.mode : 'all';
    const result = isValidResult(req.query.result) ? req.query.result : 'all';

    const historyPayload = await db.notifications.getRecentCampaigns({
      page,
      pageSize,
      mode,
      result,
    });

    return res.status(200).json({
      history: historyPayload.history.map(serializeNotificationHistoryItem),
      pagination: historyPayload.pagination,
    });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
