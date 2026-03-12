import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../lib/db';
import { generateFullReport } from '../../../lib/report-generator';
import { generateProReport } from '../../../lib/pro-report-generator';

const log = {
  info: (message: string, data?: any) => console.log(`[API/spend/lumi] ${message}`, data || ''),
  error: (message: string, error?: any) => console.error(`[API/spend/lumi] ERROR: ${message}`, error || ''),
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, card_id, item, cost } = req.body;

  if (!userId || !card_id || !item || cost === undefined) {
    return res.status(400).json({ error: 'userId, card_id, item, and cost are required' });
  }

  const costNum = parseInt(String(cost), 10);
  if (isNaN(costNum) || costNum < 0) {
    return res.status(400).json({ error: 'cost must be a non-negative number' });
  }

  const cardId = parseInt(String(card_id), 10);
  if (isNaN(cardId) || cardId < 1) {
    return res.status(400).json({ error: 'Invalid card_id' });
  }

  try {
    const card = await db.cards.getById(cardId, userId);
    if (!card) {
      return res.status(404).json({ error: 'Card not found' });
    }

    let dataJson = card.data_json;
    if (typeof dataJson === 'string') {
      try { dataJson = JSON.parse(dataJson); } catch { dataJson = {}; }
    }
    if (!dataJson || typeof dataJson !== 'object') {
      return res.status(400).json({ error: 'Card has no natal data' });
    }

    if (item === 'full_report') {
      if (card.is_purchased_full && dataJson.full_report) {
        return res.status(400).json({ error: 'Full report already purchased for this card' });
      }
    } else if (item === 'pro_report') {
      if (!card.is_purchased_full) {
        return res.status(400).json({ error: 'Full report must be purchased before Pro report' });
      }
      if (card.is_purchased_pro && dataJson.pro_report) {
        return res.status(400).json({ error: 'Pro report already purchased for this card' });
      }
    }

    const balance = await db.users.getBalance(userId);
    if (balance < costNum) {
      return res.status(400).json({
        error: 'Insufficient balance',
        balance,
        required: costNum,
      });
    }

    const { balance: newBalance } = await db.users.decrementBalance(userId, costNum);

    await db.purchases.create({
      user_id: userId,
      type: 'spend',
      amount_lumi: -costNum,
      item_id: `${item}:card_${cardId}`,
      status: 'success',
    });

    if (item === 'full_report') {
      log.info('Generating full report', { userId, cardId });
      const fullReport = generateFullReport(dataJson);
      await db.cards.saveReportToCard(cardId, userId, 'full_report', fullReport);
      log.info('Full report generated and saved', { userId, cardId });

      return res.status(200).json({
        success: true,
        balance: newBalance,
        report: fullReport,
      });
    }

    if (item === 'pro_report') {
      log.info('Generating pro report', { userId, cardId });
      const proReport = generateProReport(dataJson);
      await db.cards.saveReportToCard(cardId, userId, 'pro_report', proReport);
      log.info('Pro report generated and saved', { userId, cardId });

      return res.status(200).json({
        success: true,
        balance: newBalance,
        report: proReport,
      });
    }

    if (item === 'full_report' || item === 'pro_report') {
      // handled above
    } else {
      await db.cards.markFullPurchased(cardId, userId);
    }

    log.info('Lumi spent', { userId, card_id: cardId, item, cost: costNum, newBalance });

    return res.status(200).json({
      success: true,
      balance: newBalance,
    });
  } catch (error: any) {
    if (error.message === 'Insufficient balance') {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    log.error('Error spending lumi', { error: error.message, userId });
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
