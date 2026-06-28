import type { NextApiRequest, NextApiResponse } from 'next';
import { AdminAuthError, handleAdminError } from '../../../../../lib/adminAuth';
import { requireAdminPermission } from '../../../../../lib/admin/rbac';
import { recordAdminAction } from '../../../../../lib/admin/audit';
import { getPool } from '../../../../../lib/db';

/** AI-промпты: список (ai.view) и создание (ai.edit). Публикация — отдельным экшеном. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      await requireAdminPermission(req, 'ai.view');
      const rows = await getPool().query(
        `SELECT id, key, type, locale, version, status, author_id, approved_by, updated_at
           FROM ai_prompts ORDER BY updated_at DESC NULLS LAST, id DESC LIMIT 200`
      );
      return res.status(200).json({
        prompts: rows.rows.map((r: any) => ({
          id: Number(r.id), key: r.key, type: r.type, locale: r.locale, version: Number(r.version),
          status: r.status, updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null,
        })),
      });
    }
    if (req.method === 'POST') {
      const ctx = await requireAdminPermission(req, 'ai.edit');
      const key = String(req.body?.key || '').trim();
      const type = String(req.body?.type || 'chat').trim();
      const locale = req.body?.locale === 'en' ? 'en' : 'ru';
      const body = String(req.body?.body || '').trim();
      if (!/^[a-z0-9_]{3,60}$/.test(key)) throw new AdminAuthError(400, 'BAD_KEY', 'key must be 3–60 chars a-z 0-9 _');
      if (!body) throw new AdminAuthError(400, 'BAD_BODY', 'body is required');
      const ins = await getPool().query(
        `INSERT INTO ai_prompts (key, type, locale, version, status, body, author_id)
         VALUES ($1, $2, $3, 1, 'draft', $4, $5) RETURNING id`,
        [key, type, locale, body, ctx.userId]
      );
      await recordAdminAction({ req, actor: ctx, action: 'prompt_changed', entityType: 'ai_prompt', entityId: ins.rows[0].id, after: { key, type, locale } });
      return res.status(200).json({ ok: true, id: Number(ins.rows[0].id) });
    }
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
