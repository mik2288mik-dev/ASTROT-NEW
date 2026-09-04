import { paymentFailureCopy } from '../lib/paymentFailureCopy';

describe('payment failure copy', () => {
  it.each([
    'RUSTORE_PURCHASE_OWNED_BY_ANOTHER_USER',
    'RUSTORE_PURCHASE_USER_MISMATCH',
  ])('gives an account recovery path for %s', (reason) => {
    const message = paymentFailureCopy(reason, 'ru');

    expect(message).toContain('исходный аккаунт');
    expect(message).toContain('Меню → Поддержка');
    expect(message).toContain('Повторно покупать не нужно');
  });

  it('does not mislabel a product mismatch as an internet problem', () => {
    const message = paymentFailureCopy('RUSTORE_PURCHASE_PRODUCT_MISMATCH', 'ru');

    expect(message).toContain('другого тарифа');
    expect(message).toContain('Поддержка');
    expect(message).not.toContain('интернет');
  });

  it('explains an inactive subscription without inviting a duplicate purchase', () => {
    expect(paymentFailureCopy('RUSTORE_SUBSCRIPTION_PAUSED', 'ru')).toContain('повторно покупать не нужно');
    expect(paymentFailureCopy('RUSTORE_PREMIUM_NOT_CONFIRMED', 'en')).toContain('do not buy it again');
  });
});
