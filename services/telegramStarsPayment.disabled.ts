import type { PremiumPlanId } from '../lib/premiumPricing';
import type { UserProfile } from '../types';
import type { TelegramStarsPaymentOutcome } from './telegramService';

/**
 * Store-channel replacement injected at build time.
 * It deliberately contains no invoice endpoint or Telegram payment runtime.
 */
export async function requestStarsPayment(
  _profile: UserProfile,
  _planId: PremiumPlanId = 'premium_week',
): Promise<TelegramStarsPaymentOutcome> {
  return 'cancelled';
}
