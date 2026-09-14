import type { NextApiRequest, NextApiResponse } from 'next';
import { handleAdminError } from '../../../../../lib/adminAuth';
import { getAdminContext, roleHasPermission } from '../../../../../lib/admin/rbac';
import { getPool } from '../../../../../lib/db';
import { recordAdminAction } from '../../../../../lib/admin/audit';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const ctx = await getAdminContext(req);

    if (req.method === 'GET') {
      if (!roleHasPermission(ctx.role, 'ai.view')) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'ai.view permission required' });
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
          id, group_key, category, error_code, message, scenario, model,
          last_trace_id, last_user_id, occurrences_count, affected_users_count,
          first_seen_at, last_seen_at, sample_input_json, sample_output,
          status, admin_note, resolved_at
        FROM app_ai_defects
        ${whereClause}
        ORDER BY last_seen_at DESC
        LIMIT 100
      `, vals);

      return res.status(200).json({
        defects: result.rows.map((row) => ({
          id: Number(row.id),
          groupKey: row.group_key,
          category: row.category,
          errorCode: row.error_code,
          message: row.message,
          scenario: row.scenario,
          model: row.model,
          lastTraceId: row.last_trace_id,
          lastUserId: row.last_user_id ? String(row.last_user_id) : null,
          occurrencesCount: Number(row.occurrences_count),
          affectedUsersCount: Number(row.affected_users_count),
          firstSeenAt: row.first_seen_at,
          lastSeenAt: row.last_seen_at,
          sampleInput: row.sample_input_json,
          sampleOutput: row.sample_output,
          status: row.status,
          adminNote: row.admin_note || null,
          resolvedAt: row.resolved_at || null,
        })),
      });
    }

    if (req.method === 'PATCH') {
      if (!roleHasPermission(ctx.role, 'ai.edit')) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'ai.edit permission required' });
      }

      const { id, status, adminNote } = req.body || {};
      const defectId = Number.parseInt(String(id), 10);
      if (!Number.isFinite(defectId) || defectId <= 0) {
        return res.status(400).json({ error: 'INVALID_DEFECT_ID', message: 'Valid id is required' });
      }

      const allowedStatuses = ['new', 'investigating', 'fixed', 'ignored'];
      if (status && !allowedStatuses.includes(status)) {
        return res.status(400).json({ error: 'INVALID_STATUS', message: 'Invalid status value' });
      }

      const pool = getPool();
      const existing = await pool.query('SELECT * FROM app_ai_defects WHERE id = $1', [defectId]);
      if (!existing.rowCount) {
        return res.status(404).json({ error: 'DEFECT_NOT_FOUND', message: 'Defect not found' });
      }

      const prev = existing.rows[0];
      const newStatus = status || prev.status;
      const resolvedAt = newStatus === 'fixed' ? new Date().toISOString() : null;

      await pool.query(
        `UPDATE app_ai_defects
         SET status = $1, admin_note = COALESCE($2, admin_note), resolved_at = $3
         WHERE id = $4`,
        [newStatus, adminNote !== undefined ? adminNote : null, resolvedAt, defectId]
      );

      await recordAdminAction({
        req,
        actor: ctx,
        action: 'prompt_changed', // using audit action
        entityType: 'ai_defect',
        entityId: defectId,
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
