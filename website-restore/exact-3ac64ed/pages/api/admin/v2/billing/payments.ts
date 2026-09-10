import type { NextApiRequest, NextApiResponse } from 'next';
import { handleAdminError } from '../../../../../lib/adminAuth';
import { requireAdminPermission } from '../../../../../lib/admin/rbac';
import { getPool } from '../../../../../lib/db';

/** Журнал платежей (провайдер-агностичный, на базе star_payments). Право billing.view. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    await requireAdminPermission(req, 'billing.view');
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(Math.max(Number(req.query.pageSize) || 25, 1), 100);
    const offset = (page - 1) * pageSize;

    const pool = getPool();
    const [countRes, rowsRes] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS total FROM star_payments'),
      pool.query(
        `SELECT p.id, p.user_id, p.provider, p.status, p.stars_amount, p.currency, p.product,
                p.platform, p.telegram_payment_charge_id, p.created_at, p.refunded_at, u.name AS owner_name
           FROM star_payments p LEFT JOIN users u ON u.id = p.user_id
           ORDER BY p.created_at DESC NULLS LAST, p.id DESC
           LIMIT $1 OFFSET $2`,
        [pageSize, offset]
      ),
    ]);

    const total = Number(countRes.rows[0]?.total || 0);
    return res.status(200).json({
      payments: rowsRes.rows.map((r: any) => ({
        id: Number(r.id),
        userId: String(r.user_id),
        ownerName: r.owner_name || null,
        provider: r.provider || 'telegram_stars',
        status: r.status || 'paid',
        amount: Number(r.stars_amount),
        currency: r.currency || 'XTR',
        product: r.product || null,
        platform: r.platform || 'telegram',
        chargeId: r.telegram_payment_charge_id || null,
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
        refundedAt: r.refunded_at ? new Date(r.refunded_at).toISOString() : null,
      })),
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
