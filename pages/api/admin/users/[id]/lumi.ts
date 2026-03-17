import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdminAccess, handleAdminError } from '../../../../../lib/adminAuth';
import { db } from '../../../../../lib/db';
import { serializeAdminUserDetail } from '../../../../../lib/adminSerializers';
import { sendTelegramTextMessage } from '../../../../../lib/telegramBot';
import { addLumi, spendLumi } from '../../../../../services/lumiService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
  }

  const { id } = req.query;
  const userId = Array.isArray(id) ? id[0] : id;
  if (!userId) {
    return res.status(400).json({ error: 'USER_ID_REQUIRED', message: 'User ID is required' });
  }

  try {
    await requireAdminAccess(req);

    const action = req.body?.action;
    const amount = Number(req.body?.amount);
    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';

    if (action !== 'add' && action !== 'subtract') {
      return res.status(400).json({ error: 'INVALID_ACTION', message: 'Action must be add or subtract' });
    }
    if (!Number.isInteger(amount) || amount <= 0) {
      return res.status(400).json({ error: 'INVALID_AMOUNT', message: 'Amount must be a positive integer' });
    }

    const targetUser = await db.users.get(userId);
    if (!targetUser) {
      return res.status(404).json({ error: 'USER_NOT_FOUND', message: 'User not found' });
    }

    if (note) {
      console.log('[API/admin/users/[id]/lumi] Note supplied for admin Lumi adjustment', {
        userId,
        action,
        amount,
        note,
      });
    }

    try {
      if (action === 'add') {
        await addLumi(userId, amount, 'admin_lumi_add');
      } else {
        await spendLumi(userId, amount, 'admin_lumi_subtract');
      }
    } catch (error: any) {
      const message = error?.message || 'Failed to update Lumi balance';
      const isInsufficient = message.toLowerCase().includes('insufficient');
      return res.status(isInsufficient ? 400 : 500).json({
        error: isInsufficient ? 'INSUFFICIENT_LUMI' : 'LUMI_UPDATE_FAILED',
        message,
      });
    }

    let notificationSent = false;
    let notificationError: string | null = null;

    if (note) {
      const lang = targetUser.language === 'en' ? 'en' : 'ru';
      const messageText = action === 'add'
        ? (lang === 'ru'
            ? `На ваш баланс начислено ${amount} Lumi.\n\n${note}`
            : `${amount} Lumi was credited to your balance.\n\n${note}`)
        : (lang === 'ru'
            ? `С вашего баланса списано ${amount} Lumi.\n\n${note}`
            : `${amount} Lumi was deducted from your balance.\n\n${note}`);

      const notificationResult = await sendTelegramTextMessage(String(targetUser.id), messageText);
      notificationSent = notificationResult.ok;
      notificationError = notificationResult.ok ? null : (notificationResult.error || 'Failed to send Telegram notification');
    }

    const updated = await db.admin.getUserDetail(userId);
    return res.status(200).json({
      user: updated ? serializeAdminUserDetail(updated) : null,
      notificationSent,
      notificationError,
    });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
