import { db } from '../lib/db';
import { addLumi } from './lumiService';
import { getLumiPack, type LumiPackId } from './lumiPacks';

const log = {
  info: (msg: string, data?: any) => console.log(`[LumiTopUpService] ${msg}`, data || ''),
  error: (msg: string, err?: any) => console.error(`[LumiTopUpService] ERROR: ${msg}`, err || ''),
};

export interface ActivateLumiPackResult {
  activated: boolean;
  balance: number;
  packId: LumiPackId;
  lumiAmount: number;
}

export async function activateLumiPackPurchase(
  userId: string,
  telegramPaymentChargeId: string,
  starsAmount: number,
  packId: LumiPackId
): Promise<ActivateLumiPackResult> {
  if (!userId?.trim()) throw new Error('UserId is required');
  if (!telegramPaymentChargeId?.trim()) throw new Error('telegram_payment_charge_id is required');

  const pack = getLumiPack(packId);
  if (!pack) {
    throw new Error('Invalid Lumi pack');
  }

  const inserted = await db.star_payments.record(telegramPaymentChargeId, String(userId).trim(), starsAmount);
  if (!inserted) {
    log.info('Duplicate Lumi top-up ignored', { userId, telegramPaymentChargeId, packId });
    const balance = await db.lumi_transactions.getBalance(userId);
    return {
      activated: false,
      balance,
      packId,
      lumiAmount: pack.lumiAmount,
    };
  }

  if (starsAmount !== pack.starsAmount) {
    log.info('Lumi pack stars amount differs from pack config', {
      userId,
      packId,
      expected: pack.starsAmount,
      received: starsAmount,
    });
  }

  const result = await addLumi(userId, pack.lumiAmount, `lumi_pack_${pack.id}`);
  log.info('Lumi pack activated', { userId, packId, lumiAmount: pack.lumiAmount, balance: result.balance });

  return {
    activated: true,
    balance: result.balance,
    packId,
    lumiAmount: pack.lumiAmount,
  };
}
