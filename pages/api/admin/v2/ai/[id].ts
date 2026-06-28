import type { NextApiRequest, NextApiResponse } from 'next';
import { AdminAuthError, handleAdminError } from '../../../../../lib/adminAuth';
import { requireAdminPermission } from '../../../../../lib/admin/rbac';
import { recordAdminAction } from '../../../../../lib/admin/audit';
import { getPool } from '../../../../../lib/db';
import { invalidatePromptCache } from '../../../../../lib/admin/contentStore';

/**
 * Детали/правка/публикация AI-промпта.
 * GET (ai.view) — промпт + история версий. PATCH (ai.edit) — новая версия (draft).
 * POST action publish (ai.publish — approval-гейт) / archive / revert. Логируется.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = Number(req.query.id);
  try {
    if (!Number.isFinite(id)) throw new AdminAuthError(400, 'BAD_ID', 'Valid id required');
    const pool = getPool();

    if (req.method === 'GET') {
      await requireAdminPermission(req, 'ai.view');
      const p = await pool.query(`SELECT * FROM ai_prompts WHERE id = $1`, [id]);
      if (!p.rows[0]) throw new AdminAuthError(404, 'NOT_FOUND', 'Prompt not found');
      const v = await pool.query(`SELECT version, body, editor_id, created_at FROM ai_prompt_versions WHERE prompt_id = $1 ORDER BY version DESC LIMIT 20`, [id]);
      const r = p.rows[0];
      return res.status(200).json({
        prompt: {
          id: Number(r.id), key: r.key, type: r.type, locale: r.locale, version: Number(r.version),
          status: r.status, body: r.body, updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null,
        },
        versions: v.rows.map((x: any) => ({ version: Number(x.version), body: x.body, createdAt: x.created_at ? new Date(x.created_at).toISOString() : null })),
      });
    }

    if (req.method === 'PATCH') {
      const ctx = await requireAdminPermission(req, 'ai.edit');
      const body = String(req.body?.body || '').trim();
      if (!body) throw new AdminAuthError(400, 'BAD_BODY', 'body is required');
      const cur = await pool.query(`SELECT version, body FROM ai_prompts WHERE id = $1`, [id]);
      if (!cur.rows[0]) throw new AdminAuthError(404, 'NOT_FOUND', 'Prompt not found');
      const nextVersion = Number(cur.rows[0].version) + 1;
      // снимок текущей версии в историю, затем апдейт
      await pool.query(`INSERT INTO ai_prompt_versions (prompt_id, version, body, editor_id) VALUES ($1, $2, $3, $4)`,
        [id, cur.rows[0].version, cur.rows[0].body, ctx.userId]);
      await pool.query(`UPDATE ai_prompts SET body = $1, version = $2, status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
        [body, nextVersion, id]);
      await recordAdminAction({ req, actor: ctx, action: 'prompt_changed', entityType: 'ai_prompt', entityId: id, after: { version: nextVersion } });
      return res.status(200).json({ ok: true, version: nextVersion });
    }

    if (req.method === 'POST') {
      const action = String(req.body?.action || '');
      if (action === 'publish') {
        const ctx = await requireAdminPermission(req, 'ai.publish'); // approval-гейт (только super_admin)
        const cur = await pool.query(`SELECT key, locale FROM ai_prompts WHERE id = $1`, [id]);
        if (!cur.rows[0]) throw new AdminAuthError(404, 'NOT_FOUND', 'Prompt not found');
        // один активный на (key, locale): остальные в archived
        await pool.query(`UPDATE ai_prompts SET status = 'archived' WHERE key = $1 AND locale = $2 AND id <> $3 AND status = 'active'`,
          [cur.rows[0].key, cur.rows[0].locale, id]);
        await pool.query(`UPDATE ai_prompts SET status = 'active', approved_by = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [ctx.userId, id]);
        invalidatePromptCache();
        await recordAdminAction({ req, actor: ctx, action: 'prompt_published', entityType: 'ai_prompt', entityId: id, after: { key: cur.rows[0].key } });
        return res.status(200).json({ ok: true });
      }
      if (action === 'archive') {
        const ctx = await requireAdminPermission(req, 'ai.edit');
        await pool.query(`UPDATE ai_prompts SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [id]);
        invalidatePromptCache();
        await recordAdminAction({ req, actor: ctx, action: 'prompt_changed', entityType: 'ai_prompt', entityId: id, after: { status: 'archived' } });
        return res.status(200).json({ ok: true });
      }
      throw new AdminAuthError(400, 'BAD_ACTION', 'action must be publish or archive');
    }

    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
