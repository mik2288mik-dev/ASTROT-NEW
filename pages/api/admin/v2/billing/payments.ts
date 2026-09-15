import type { NextApiRequest, NextApiResponse } from 'next';
import { handleAdminError } from '../../../../../lib/adminAuth';
import { requireAdminPermission } from '../../../../../lib/admin/rbac';
import { getPool } from '../../../../../lib/db';

/** Единый журнал Telegram Stars и RuStore. Право billing.view. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    await requireAdminPermission(req, 'billing.view');
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(Math.max(Number(req.query.pageSize) || 25, 1), 100);
    const offset = (page - 1) * pageSize;

    const pool = getPool();
    const [countRes, rowsRes] = await Promise.all([
      pool.query(`SELECT (
        (SELECT COUNT(*) FROM star_payments) +
        (SELECT COUNT(*) FROM store_purchases)
      )::int AS total`),
      pool.query(
        `SELECT payments.*, u.name AS owner_name
           FROM (
             SELECT ('telegram:' || p.id::text) AS id, p.id AS refundable_id, p.user_id,
                    COALESCE(p.provider, 'telegram_stars') AS provider,
                    COALESCE(p.status, 'completed') AS status, p.stars_amount::numeric AS amount,
                    COALESCE(p.currency, 'XTR') AS currency, p.product,
                    COALESCE(p.platform, 'telegram') AS platform,
                    p.telegram_payment_charge_id AS charge_id, p.created_at, p.refunded_at,
                    TRUE AS can_refund
             FROM star_payments p
             UNION ALL
             SELECT ('rustore:' || p.id::text) AS id, NULL::integer AS refundable_id, p.user_id,
                    p.provider, p.status, NULL::numeric AS amount, 'RUB' AS currency,
                    p.external_product_id AS product, 'android' AS platform,
                    COALESCE(p.external_purchase_id, p.external_invoice_id) AS charge_id,
                    COALESCE(p.purchased_at, p.created_at) AS created_at,
                    NULL::timestamp AS refunded_at, FALSE AS can_refund
             FROM store_purchases p
           ) payments
           LEFT JOIN users u ON u.id = payments.user_id
           ORDER BY payments.created_at DESC NULLS LAST, payments.id DESC
           LIMIT $1 OFFSET $2`,
        [pageSize, offset]
      ),
    ]);

    const total = Number(countRes.rows[0]?.total || 0);
    return res.status(200).json({
      payments: rowsRes.rows.map((r: any) => ({
        id: String(r.id),
        refundableId: r.refundable_id === null ? null : Number(r.refundable_id),
        userId: String(r.user_id),
        ownerName: r.owner_name || null,
        provider: r.provider || 'telegram_stars',
        status: r.status || 'paid',
        amount: r.amount === null ? null : Number(r.amount),
        currency: r.currency || 'XTR',
        product: r.product || null,
        platform: r.platform || 'telegram',
        chargeId: r.charge_id || null,
        canRefund: r.can_refund === true,
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
        refundedAt: r.refunded_at ? new Date(r.refunded_at).toISOString() : null,
      })),
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
