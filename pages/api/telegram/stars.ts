import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * @deprecated Payment verification is now handled by /api/telegram/webhook.
 * Real flow: create-invoice -> openInvoice -> Telegram sends webhook -> premium activated.
 * Sim flow: create-invoice (simMode) -> showPopup -> /api/subscriptions/activate.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  return res.status(410).json({
    error: 'Deprecated',
    message: 'Use /api/telegram/create-invoice and /api/telegram/webhook for payment flow',
  });
}
