import type { NextApiRequest, NextApiResponse } from 'next';
import { AdminAuthError, handleAdminError } from '../../../../../lib/adminAuth';
import { requireAdminPermission } from '../../../../../lib/admin/rbac';
import { recordAdminAction } from '../../../../../lib/admin/audit';
import { getPool } from '../../../../../lib/db';

/**
 * Детали/правка/публикация CMS-контента.
 * GET (content.view), PATCH (content.edit → новая версия draft),
 * POST action publish/archive (publish — content.publish). Логируется.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = Number(req.query.id);
  try {
    if (!Number.isFinite(id)) throw new AdminAuthError(400, 'BAD_ID', 'Valid id required');
    const pool = getPool();

    if (req.method === 'GET') {
      await requireAdminPermission(req, 'content.view');
      const c = await pool.query(`SELECT * FROM cms_content WHERE id = $1`, [id]);
      if (!c.rows[0]) throw new AdminAuthError(404, 'NOT_FOUND', 'Content not found');
      const v = await pool.query(`SELECT version, body, created_at FROM cms_content_versions WHERE content_id = $1 ORDER BY version DESC LIMIT 20`, [id]);
      const r = c.rows[0];
      return res.status(200).json({
        item: {
          id: Number(r.id), type: r.type, locale: r.locale, status: r.status, title: r.title,
          body: r.body, version: Number(r.version), category: r.category,
          publishedAt: r.published_at ? new Date(r.published_at).toISOString() : null,
        },
        versions: v.rows.map((x: any) => ({ version: Number(x.version), body: x.body, createdAt: x.created_at ? new Date(x.created_at).toISOString() : null })),
      });
    }

    if (req.method === 'PATCH') {
      const ctx = await requireAdminPermission(req, 'content.edit');
      const body = String(req.body?.body || '').trim();
      const title = req.body?.title !== undefined ? String(req.body.title).trim() : undefined;
      if (!body) throw new AdminAuthError(400, 'BAD_BODY', 'body is required');
      const cur = await pool.query(`SELECT version, body FROM cms_content WHERE id = $1`, [id]);
      if (!cur.rows[0]) throw new AdminAuthError(404, 'NOT_FOUND', 'Content not found');
      const nextVersion = Number(cur.rows[0].version) + 1;
      await pool.query(`INSERT INTO cms_content_versions (content_id, version, body, editor_id) VALUES ($1, $2, $3, $4)`,
        [id, cur.rows[0].version, cur.rows[0].body, ctx.userId]);
      await pool.query(`UPDATE cms_content SET body = $1, ${title !== undefined ? 'title = $4,' : ''} version = $2, status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
        title !== undefined ? [body, nextVersion, id, title] : [body, nextVersion, id]);
      await recordAdminAction({ req, actor: ctx, action: 'content_published', entityType: 'cms_content', entityId: id, after: { version: nextVersion, status: 'draft' } });
      return res.status(200).json({ ok: true, version: nextVersion });
    }

    if (req.method === 'POST') {
      const action = String(req.body?.action || '');
      if (action === 'publish') {
        const ctx = await requireAdminPermission(req, 'content.publish');
        await pool.query(`UPDATE cms_content SET status = 'published', published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [id]);
        await recordAdminAction({ req, actor: ctx, action: 'content_published', entityType: 'cms_content', entityId: id, after: { status: 'published' } });
        return res.status(200).json({ ok: true });
      }
      if (action === 'archive') {
        const ctx = await requireAdminPermission(req, 'content.edit');
        await pool.query(`UPDATE cms_content SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [id]);
        await recordAdminAction({ req, actor: ctx, action: 'content_reverted', entityType: 'cms_content', entityId: id, after: { status: 'archived' } });
        return res.status(200).json({ ok: true });
      }
      throw new AdminAuthError(400, 'BAD_ACTION', 'action must be publish or archive');
    }

    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
