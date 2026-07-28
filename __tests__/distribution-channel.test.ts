import {
  DistributionChannelError,
  canUseRuStorePay,
  canUseTelegramStars,
  resolveDistributionChannel,
} from '../lib/distributionChannel';

describe('distribution channel isolation', () => {
  it.each(['telegram', 'rustore', 'google_play', 'development'] as const)('accepts %s', (channel) => {
    expect(resolveDistributionChannel(channel)).toBe(channel);
  });

  it('permits Telegram Stars only for Telegram', () => {
    expect(canUseTelegramStars('telegram')).toBe(true);
    expect(canUseTelegramStars('rustore')).toBe(false);
    expect(canUseTelegramStars('google_play')).toBe(false);
  });

  it('permits RuStore Pay only for the RuStore build', () => {
    expect(canUseRuStorePay('rustore')).toBe(true);
    expect(canUseRuStorePay('telegram')).toBe(false);
    expect(canUseRuStorePay('google_play')).toBe(false);
  });

  it('rejects an unknown channel instead of falling back to Telegram', () => {
    expect(() => resolveDistributionChannel('telegram-like')).toThrow(DistributionChannelError);
  });
});
