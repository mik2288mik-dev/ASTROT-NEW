import type { NextApiRequest, NextApiResponse } from 'next';
import { handleAdminError } from '../../../../../lib/adminAuth';
import { getAdminContext, roleHasPermission } from '../../../../../lib/admin/rbac';
import { getPool } from '../../../../../lib/db';
import { recordAdminAction } from '../../../../../lib/admin/audit';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const ctx = await getAdminContext(req);

    if (req.method === 'GET') {
      if (!roleHasPermission(ctx.role, 'analytics.view') && !roleHasPermission(ctx.role, 'audit.view')) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'analytics.view or audit.view permission required' });
      }

      const { status = 'all' } = req.query;
      const where: string[] = [];
      const vals: any[] = [];

      if (status && typeof status === 'string' && status !== 'all') {
        vals.push(status);
        where.push(`status = $${vals.length}`);
      }

      const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const pool = getPool();

      const result = await pool.query(`
        SELECT
          id, fingerprint, endpoint, http_status, error_code, message,
          stack_trace, app_version, platform, occurrences_count, affected_users_count,
          first_seen_at, last_seen_at, sample_request_id, status, admin_note
        FROM app_technical_errors
        ${whereClause}
        ORDER BY last_seen_at DESC
        LIMIT 100
      `, vals);

      return res.status(200).json({
        errors: result.rows.map((row) => ({
          id: Number(row.id),
          fingerprint: row.fingerprint,
          endpoint: row.endpoint,
          httpStatus: row.http_status,
          errorCode: row.error_code,
          message: row.message,
          stackTrace: row.stack_trace || null,
          appVersion: row.app_version || null,
          platform: row.platform || null,
          occurrencesCount: Number(row.occurrences_count),
          affectedUsersCount: Number(row.affected_users_count),
          firstSeenAt: row.first_seen_at,
          lastSeenAt: row.last_seen_at,
          sampleRequestId: row.sample_request_id || null,
          status: row.status,
          adminNote: row.admin_note || null,
        })),
      });
    }

    if (req.method === 'PATCH') {
      if (!roleHasPermission(ctx.role, 'settings.manage') && ctx.role !== 'admin' && ctx.role !== 'super_admin') {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Admin permissions required to update error status' });
      }

      const { id, status, adminNote } = req.body || {};
      const errorId = Number.parseInt(String(id), 10);
      if (!Number.isFinite(errorId) || errorId <= 0) {
        return res.status(400).json({ error: 'INVALID_ERROR_ID', message: 'Valid id is required' });
      }

      const allowedStatuses = ['new', 'investigating', 'resolved', 'ignored'];
      if (status && !allowedStatuses.includes(status)) {
        return res.status(400).json({ error: 'INVALID_STATUS', message: 'Invalid status value' });
      }

      const pool = getPool();
      const existing = await pool.query('SELECT * FROM app_technical_errors WHERE id = $1', [errorId]);
      if (!existing.rowCount) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Error record not found' });
      }

      const prev = existing.rows[0];
      const newStatus = status || prev.status;

      await pool.query(
        `UPDATE app_technical_errors
         SET status = $1, admin_note = COALESCE($2, admin_note)
         WHERE id = $3`,
        [newStatus, adminNote !== undefined ? adminNote : null, errorId]
      );

      await recordAdminAction({
        req,
        actor: ctx,
        action: 'settings_changed',
        entityType: 'technical_error',
        entityId: errorId,
        before: { status: prev.status, adminNote: prev.admin_note },
        after: { status: newStatus, adminNote },
      });

      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, PATCH');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
