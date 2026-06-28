import type { NextApiRequest, NextApiResponse } from 'next';
import { AdminAuthError, handleAdminError } from '../../../../../lib/adminAuth';
import { requireAdminPermission } from '../../../../../lib/admin/rbac';
import { recordAdminAction } from '../../../../../lib/admin/audit';
import { getPool } from '../../../../../lib/db';

/** CMS-контент: список (content.view) и создание черновика (content.edit). */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      await requireAdminPermission(req, 'content.view');
      const type = typeof req.query.type === 'string' ? req.query.type : null;
      const where = type ? 'WHERE type = $1' : '';
      const rows = await getPool().query(
        `SELECT id, type, locale, status, title, version, category, updated_at, published_at
           FROM cms_content ${where} ORDER BY updated_at DESC NULLS LAST, id DESC LIMIT 300`,
        type ? [type] : []
      );
      return res.status(200).json({
        items: rows.rows.map((r: any) => ({
          id: Number(r.id), type: r.type, locale: r.locale, status: r.status, title: r.title,
          version: Number(r.version), category: r.category,
          updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null,
          publishedAt: r.published_at ? new Date(r.published_at).toISOString() : null,
        })),
      });
    }
    if (req.method === 'POST') {
      const ctx = await requireAdminPermission(req, 'content.edit');
      const type = String(req.body?.type || '').trim();
      const locale = req.body?.locale === 'en' ? 'en' : 'ru';
      const title = String(req.body?.title || '').trim() || null;
      const body = String(req.body?.body || '').trim();
      if (!/^[a-z0-9_]{2,40}$/.test(type)) throw new AdminAuthError(400, 'BAD_TYPE', 'type must be 2–40 chars a-z 0-9 _');
      if (!body) throw new AdminAuthError(400, 'BAD_BODY', 'body is required');
      const ins = await getPool().query(
        `INSERT INTO cms_content (type, locale, status, title, body, version, author_id)
         VALUES ($1, $2, 'draft', $3, $4, 1, $5) RETURNING id`,
        [type, locale, title, body, ctx.userId]
      );
      await recordAdminAction({ req, actor: ctx, action: 'content_published', entityType: 'cms_content', entityId: ins.rows[0].id, after: { type, status: 'draft' } });
      return res.status(200).json({ ok: true, id: Number(ins.rows[0].id) });
    }
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
