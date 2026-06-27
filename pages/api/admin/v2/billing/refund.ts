import type { NextApiRequest, NextApiResponse } from 'next';
import { AdminAuthError, handleAdminError } from '../../../../../lib/adminAuth';
import { requireAdminPermission } from '../../../../../lib/admin/rbac';
import { recordAdminAction } from '../../../../../lib/admin/audit';
import { getPool } from '../../../../../lib/db';
import { refundStarPayment } from '../../../../../lib/telegramBot';

/**
 * Возврат платежа. Право billing.refund (опасная операция → подтверждение на клиенте).
 * Сейчас провайдер telegram_stars (Telegram refundStarPayment); App Store/Google Play/
 * Stripe refund — стратегия на провайдер при миграции на native. Логируется как refund_issued.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    const ctx = await requireAdminPermission(req, 'billing.refund');
    const paymentId = Number(req.body?.paymentId);
    if (!Number.isFinite(paymentId)) throw new AdminAuthError(400, 'PAYMENT_ID_REQUIRED', 'paymentId is required');

    const pool = getPool();
    const found = await pool.query(
      `SELECT id, user_id, provider, status, stars_amount, telegram_payment_charge_id FROM star_payments WHERE id = $1`,
      [paymentId]
    );
    const p = found.rows[0];
    if (!p) throw new AdminAuthError(404, 'PAYMENT_NOT_FOUND', 'Payment not found');
    if (p.status === 'refunded') throw new AdminAuthError(400, 'ALREADY_REFUNDED', 'Payment already refunded');

    const provider = p.provider || 'telegram_stars';
    if (provider !== 'telegram_stars') {
      throw new AdminAuthError(400, 'PROVIDER_NOT_SUPPORTED', `Refund for ${provider} is not wired yet`);
    }

    const result = await refundStarPayment(String(p.user_id), p.telegram_payment_charge_id);
    if (!result.ok) {
      await recordAdminAction({
        req, actor: ctx, action: 'refund_issued', entityType: 'payment', entityId: paymentId,
        before: { status: p.status }, result: 'error', error: result.error,
      });
      throw new AdminAuthError(502, 'REFUND_FAILED', result.error || 'Telegram refund failed');
    }

    await pool.query(`UPDATE star_payments SET status = 'refunded', refunded_at = CURRENT_TIMESTAMP WHERE id = $1`, [paymentId]);
    await recordAdminAction({
      req, actor: ctx, action: 'refund_issued', entityType: 'payment', entityId: paymentId,
      before: { status: p.status, amount: p.stars_amount }, after: { status: 'refunded' },
    });
    return res.status(200).json({ ok: true });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
