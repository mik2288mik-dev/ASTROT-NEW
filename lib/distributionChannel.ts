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
  const normalized = String(value || 'development').trim().toLowerCase();
  if ((DISTRIBUTION_CHANNELS as readonly string[]).includes(normalized)) {
    return normalized as DistributionChannel;
  }
  throw new DistributionChannelError(normalized);
}

export function canUseTelegramStars(channel = resolveDistributionChannel()): boolean {
  return channel === 'telegram';
}

export function canUseRuStorePay(channel = resolveDistributionChannel()): boolean {
  return channel === 'rustore';
}

export function isStoreChannel(channel = resolveDistributionChannel()): boolean {
  return channel === 'rustore' || channel === 'google_play';
}
