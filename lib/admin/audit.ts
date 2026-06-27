/**
 * Неизменяемый журнал действий админов (admin_audit_log).
 * Любое опасное/мутирующее действие и просмотр PII обязаны записываться сюда.
 * Запись только на вставку — UI не редактирует и не удаляет журнал.
 */
import type { NextApiRequest } from 'next';
import { getPool } from '../db';
import type { AdminContext } from './rbac';

export type AdminAuditAction =
  | 'admin_login' | 'admin_login_failed'
  | 'role_changed' | 'admin_added' | 'admin_removed'
  | 'pii_viewed'
  | 'user_edited' | 'user_blocked' | 'user_unblocked' | 'user_deleted'
  | 'data_exported'
  | 'subscription_changed' | 'premium_granted' | 'premium_revoked' | 'refund_issued'
  | 'content_published' | 'content_reverted'
  | 'prompt_changed' | 'prompt_published'
  | 'push_sent' | 'campaign_created'
  | 'settings_changed' | 'feature_flag_changed'
  | 'chart_recalculated'
  | 'deletion_requested' | 'deletion_completed';

function clientIp(req: NextApiRequest): string {
  const fwd = req.headers['x-forwarded-for'];
  const raw = Array.isArray(fwd) ? fwd[0] : fwd;
  return String(raw || req.socket?.remoteAddress || '').split(',')[0].trim().slice(0, 100);
}

function userAgent(req: NextApiRequest): string {
  const ua = req.headers['user-agent'];
  return String(Array.isArray(ua) ? ua[0] : ua || '').slice(0, 300);
}

export async function recordAdminAction(params: {
  req: NextApiRequest;
  actor: Pick<AdminContext, 'userId' | 'role'>;
  action: AdminAuditAction;
  entityType?: string | null;
  entityId?: string | number | null;
  before?: unknown;
  after?: unknown;
  result?: 'ok' | 'error';
  error?: string | null;
}): Promise<void> {
  try {
    await getPool().query(
      `INSERT INTO admin_audit_log
         (actor_user_id, actor_role, action, entity_type, entity_id, before_json, after_json, ip, user_agent, result, error)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        /^-?\d+$/.test(String(params.actor.userId)) ? params.actor.userId : null,
        params.actor.role,
        params.action,
        params.entityType ?? null,
        params.entityId != null ? String(params.entityId) : null,
        params.before != null ? JSON.stringify(params.before) : null,
        params.after != null ? JSON.stringify(params.after) : null,
        clientIp(params.req),
        userAgent(params.req),
        params.result ?? 'ok',
        params.error ?? null,
      ]
    );
  } catch (err: any) {
    // Журнал не должен ронять основное действие, но факт сбоя логируем.
    console.error('[admin/audit] failed to record action', { action: params.action, error: err?.message });
  }
}

export type AdminAuditEntry = {
  id: number;
  actorUserId: string | null;
  actorRole: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  userAgent: string | null;
  result: string;
  error: string | null;
  createdAt: string | null;
};

export async function listAuditEntries(params: {
  action?: string | null;
  actorUserId?: string | null;
  entityType?: string | null;
  limit?: number;
  offset?: number;
}): Promise<{ entries: AdminAuditEntry[]; total: number }> {
  const where: string[] = [];
  const vals: any[] = [];
  if (params.action) { vals.push(params.action); where.push(`action = $${vals.length}`); }
  if (params.actorUserId) { vals.push(params.actorUserId); where.push(`actor_user_id = $${vals.length}`); }
  if (params.entityType) { vals.push(params.entityType); where.push(`entity_type = $${vals.length}`); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = Math.max(1, Math.min(Number(params.limit) || 50, 200));
  const offset = Math.max(0, Number(params.offset) || 0);

  const pool = getPool();
  const countRes = await pool.query(`SELECT COUNT(*)::int AS total FROM admin_audit_log ${whereSql}`, vals);
  const rowsRes = await pool.query(
    `SELECT id, actor_user_id, actor_role, action, entity_type, entity_id, before_json, after_json,
            ip, user_agent, result, error, created_at
       FROM admin_audit_log ${whereSql}
       ORDER BY id DESC
       LIMIT ${limit} OFFSET ${offset}`,
    vals
  );
  const entries: AdminAuditEntry[] = rowsRes.rows.map((r: any) => ({
    id: Number(r.id),
    actorUserId: r.actor_user_id != null ? String(r.actor_user_id) : null,
    actorRole: r.actor_role ?? null,
    action: r.action,
    entityType: r.entity_type ?? null,
    entityId: r.entity_id ?? null,
    before: r.before_json ?? null,
    after: r.after_json ?? null,
    ip: r.ip ?? null,
    userAgent: r.user_agent ?? null,
    result: r.result ?? 'ok',
    error: r.error ?? null,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
  }));
  return { entries, total: Number(countRes.rows[0]?.total ?? 0) };
}
