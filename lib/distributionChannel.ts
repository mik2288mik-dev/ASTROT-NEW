export const DISTRIBUTION_CHANNELS = ['telegram', 'rustore', 'google_play', 'development'] as const;

export type DistributionChannel = typeof DISTRIBUTION_CHANNELS[number];

export class DistributionChannelError extends Error {
  constructor(value: string) {
    super(`Unsupported distribution channel: ${value || '(empty)'}`);
    this.name = 'DistributionChannelError';
  }
}

/**
 * The channel is a build-time setting. It must never be inferred from a user
 * agent: a browser can be embedded by more than one distribution channel.
 */
export function resolveDistributionChannel(value = process.env.NEXT_PUBLIC_DISTRIBUTION_CHANNEL): DistributionChannel {
  const configured = String(value || '').trim();
  if (!configured && process.env.NODE_ENV === 'production') {
    throw new DistributionChannelError('');
  }
  const normalized = String(configured || 'development').toLowerCase();
  if ((DISTRIBUTION_CHANNELS as readonly string[]).includes(normalized)) {
    return normalized as DistributionChannel;
  }
  throw new DistributionChannelError(normalized);
}

export function canUseTelegramStars(channel = resolveDistributionChannel()): boolean {
  return channel === 'telegram';
}

export function isRuStorePaymentsEnabled(
  value = process.env.NEXT_PUBLIC_RUSTORE_PAYMENTS_ENABLED,
): boolean {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

export function canUseRuStorePay(
  channel = resolveDistributionChannel(),
  enabledValue = process.env.NEXT_PUBLIC_RUSTORE_PAYMENTS_ENABLED,
): boolean {
  return channel === 'rustore' && isRuStorePaymentsEnabled(enabledValue);
}

export function isStoreChannel(channel = resolveDistributionChannel()): boolean {
  return channel === 'rustore' || channel === 'google_play';
}

export type AccountAuthProvider = 'vk' | 'yandex' | 'google';

/**
 * Google sign-in is intentionally isolated to the future Google Play branch
 * (and development builds). RuStore keeps the database provider type for
 * account portability, but must not advertise or start Google authentication.
 */
export function canUseAccountAuthProvider(
  provider: AccountAuthProvider,
  channel = resolveDistributionChannel(),
): boolean {
  if (provider !== 'google') return true;
  return channel === 'google_play' || channel === 'development';
}
