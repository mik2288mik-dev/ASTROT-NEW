import type { NextApiRequest, NextApiResponse } from 'next';
import { AdminAuthError, handleAdminError } from '../../../../../lib/adminAuth';
import { requireAdminPermission } from '../../../../../lib/admin/rbac';
import { recordAdminAction } from '../../../../../lib/admin/audit';
import {
  dispatchScheduledNotifications,
  planRetentionNotifications,
  sendNotificationSelfTest,
  type RetentionJobType,
} from '../../../../../services/notificationRetentionService';

const PLANNER_JOBS: RetentionJobType[] = [
  'rolling-daily',
  'morning-retention-planner',
  'midday-retention-planner',
  'evening-retention-planner',
  'inactive-user-reactivation',
  'premium-conversion-planner',
  'unfinished-action-reminder',
  'weekly-summary-generator',
  'admin-campaign-runner',
];

/**
 * Ручной запуск пайплайна уведомлений из админки (право push.send). Три действия:
 *  - selftest: сквозной тест — реальный пуш себе (или указанному userId) через весь движок;
 *  - dispatch: немедленный флаш очереди (отправляет всё созревшее);
 *  - plan: прогон планировщика (наполняет очередь) — по одному userId или по аудитории.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    const ctx = await requireAdminPermission(req, 'push.send');
    const action = String(req.body?.action || '').trim();
    const now = new Date();

    if (action === 'selftest') {
      const userId = String(req.body?.userId || ctx.userId || '').trim();
      if (!/^-?\d+$/.test(userId)) throw new AdminAuthError(400, 'BAD_USER', 'valid userId required');
      const result = await sendNotificationSelfTest(userId);
      await recordAdminAction({
        req, actor: ctx, action: 'push_sent', entityType: 'notification_selftest', entityId: userId,
        after: { ok: result.ok, type: result.type, error: result.error || null, dryRun: result.dryRun || false },
      });
      return res.status(200).json({ ok: true, action, result });
    }

    if (action === 'dispatch') {
      const result = await dispatchScheduledNotifications(now, 100);
      await recordAdminAction({
        req, actor: ctx, action: 'push_sent', entityType: 'notification_dispatch', entityId: 'manual',
        after: { total: result.total, sent: result.successCount, failed: result.failureCount },
      });
      return res.status(200).json({ ok: true, action, result });
    }

    if (action === 'plan') {
      const jobType = (PLANNER_JOBS.includes(req.body?.jobType) ? req.body.jobType : 'admin-campaign-runner') as RetentionJobType;
      const rawUser = String(req.body?.userId || '').trim();
      const userId = rawUser && /^-?\d+$/.test(rawUser) ? rawUser : null;
      const result = await planRetentionNotifications(jobType, now, { userId, limit: userId ? 1 : 250 });
      await recordAdminAction({
        req, actor: ctx, action: 'campaign_created', entityType: 'notification_plan', entityId: jobType,
        after: { jobType, userId, total: result.total, enqueued: result.enqueued },
      });
      return res.status(200).json({ ok: true, action, result });
    }

    throw new AdminAuthError(400, 'BAD_ACTION', 'action must be one of: selftest, dispatch, plan');
  } catch (error) {
    return handleAdminError(res, error);
  }
}
