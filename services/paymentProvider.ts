import type { PremiumPlanId } from '../lib/premiumPricing';
import { canUseRuStorePay, canUseTelegramStars, resolveDistributionChannel, type DistributionChannel } from '../lib/distributionChannel';
import type { UserProfile } from '../types';
import { requestStarsPayment } from './telegramService';
import { requestRuStorePayment } from './rustorePayService';

export type PaymentResult =
  | { status: 'completed' }
  | { status: 'cancelled' }
  | { status: 'unavailable'; reason: string }
  | { status: 'failed'; reason: string };

export interface PaymentProvider {
  readonly channel: DistributionChannel;
  purchase(profile: UserProfile, planId: PremiumPlanId): Promise<PaymentResult>;
}

class TelegramStarsPaymentProvider implements PaymentProvider {
  readonly channel: DistributionChannel = 'telegram';
  async purchase(profile: UserProfile, planId: PremiumPlanId): Promise<PaymentResult> {
    if (!canUseTelegramStars(this.channel)) return { status: 'unavailable', reason: 'TELEGRAM_STARS_DISABLED' };
    return (await requestStarsPayment(profile, planId))
      ? { status: 'completed' }
      : { status: 'failed', reason: 'TELEGRAM_STARS_NOT_COMPLETED' };
  }
}

class RuStorePaymentProvider implements PaymentProvider {
  readonly channel: DistributionChannel = 'rustore';
  async purchase(profile: UserProfile, planId: PremiumPlanId): Promise<PaymentResult> {
    if (!canUseRuStorePay(this.channel)) return { status: 'unavailable', reason: 'RUSTORE_PAY_DISABLED' };
    return requestRuStorePayment(profile, planId);
  }
}

class DisabledPaymentProvider implements PaymentProvider {
  constructor(readonly channel: DistributionChannel) {}
  async purchase(): Promise<PaymentResult> {
    return { status: 'unavailable', reason: 'PAYMENTS_NOT_AVAILABLE_ON_THIS_CHANNEL' };
  }
}

export function getPaymentProvider(channel = resolveDistributionChannel()): PaymentProvider {
  if (channel === 'telegram') return new TelegramStarsPaymentProvider();
  if (channel === 'rustore') return new RuStorePaymentProvider();
  return new DisabledPaymentProvider(channel);
}
