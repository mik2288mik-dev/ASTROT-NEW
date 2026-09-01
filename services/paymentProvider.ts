import type { PremiumPlanId } from '../lib/premiumPricing';
import { canUseRuStorePay, canUseTelegramStars, resolveDistributionChannel, type DistributionChannel } from '../lib/distributionChannel';
import type { PremiumEntitlementSnapshot, UserProfile } from '../types';
import { requestStarsPayment } from './telegramStarsPayment';
import { requestRuStorePayment } from './rustorePayService';

export type PaymentEntitlementSnapshot = PremiumEntitlementSnapshot;
export type PurchaseRestoreStatus = 'completed' | 'pending';

export type PaymentResult =
  | { status: 'completed'; entitlement?: PaymentEntitlementSnapshot }
  | { status: 'cancelled' }
  | { status: 'pending'; reason: string }
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
  constructor(private readonly enabledValue?: string) {}
  async purchase(profile: UserProfile, planId: PremiumPlanId): Promise<PaymentResult> {
    if (!canUseRuStorePay(this.channel, this.enabledValue)) {
      return { status: 'unavailable', reason: 'RUSTORE_PAY_DISABLED' };
    }
    return requestRuStorePayment(profile, planId);
  }
}

class DisabledPaymentProvider implements PaymentProvider {
  constructor(readonly channel: DistributionChannel) {}
  async purchase(): Promise<PaymentResult> {
    return { status: 'unavailable', reason: 'PAYMENTS_NOT_AVAILABLE_ON_THIS_CHANNEL' };
  }
}

export function getPaymentProvider(
  channel = resolveDistributionChannel(),
  rustorePaymentsEnabled = process.env.NEXT_PUBLIC_RUSTORE_PAYMENTS_ENABLED,
): PaymentProvider {
  if (channel === 'telegram') return new TelegramStarsPaymentProvider();
  if (channel === 'rustore' && canUseRuStorePay(channel, rustorePaymentsEnabled)) {
    return new RuStorePaymentProvider(rustorePaymentsEnabled);
  }
  return new DisabledPaymentProvider(channel);
}
