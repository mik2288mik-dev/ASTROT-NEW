jest.mock('../services/telegramService', () => ({
  requestStarsPayment: jest.fn(),
}));
jest.mock('../services/rustorePayService', () => ({
  requestRuStorePayment: jest.fn(),
}));

import { getPaymentProvider } from '../services/paymentProvider';
import { requestStarsPayment } from '../services/telegramService';
import { requestRuStorePayment } from '../services/rustorePayService';

const profile = { id: '42', language: 'ru' } as any;
const telegram = requestStarsPayment as jest.MockedFunction<typeof requestStarsPayment>;
const rustore = requestRuStorePayment as jest.MockedFunction<typeof requestRuStorePayment>;

describe('payment provider isolation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('only asks Telegram Stars on the telegram channel', async () => {
    telegram.mockResolvedValue(true);
    await expect(getPaymentProvider('telegram').purchase(profile, 'premium_week')).resolves.toEqual({ status: 'completed' });
    expect(telegram).toHaveBeenCalledTimes(1);
    expect(rustore).not.toHaveBeenCalled();
  });

  it('only asks RuStore Pay on the rustore channel', async () => {
    rustore.mockResolvedValue({ status: 'completed' });
    await expect(getPaymentProvider('rustore').purchase(profile, 'premium_week')).resolves.toEqual({ status: 'completed' });
    expect(rustore).toHaveBeenCalledTimes(1);
    expect(telegram).not.toHaveBeenCalled();
  });

  it.each(['google_play', 'development'] as const)('does not start external payment for %s', async (channel) => {
    await expect(getPaymentProvider(channel).purchase(profile, 'premium_week')).resolves.toEqual({
      status: 'unavailable',
      reason: 'PAYMENTS_NOT_AVAILABLE_ON_THIS_CHANNEL',
    });
    expect(telegram).not.toHaveBeenCalled();
    expect(rustore).not.toHaveBeenCalled();
  });
});
