const mockApiFetch = jest.fn();

jest.mock('../services/apiClient', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

import {
  loadTelegramPremiumPlans,
  TELEGRAM_PLAN_CATALOG_TIMEOUT_MS,
} from '../services/paymentPlanCatalog';

const response = (body: unknown, ok = true) => ({
  ok,
  json: jest.fn().mockResolvedValue(body),
});

describe('Telegram Premium plan catalog', () => {
  beforeEach(() => mockApiFetch.mockReset());

  it('loads only valid server-priced Stars plans through a bounded request', async () => {
    mockApiFetch.mockResolvedValue(response({ plans: [
      { id: 'premium_month', days: 30, stars: 321, isActive: true },
      { id: 'premium_year', days: 365, stars: 1999, isActive: true },
      { id: 'other', days: 1, stars: 1 },
      { id: 'premium_quarter', days: 90, stars: 0 },
    ] }));

    await expect(loadTelegramPremiumPlans()).resolves.toEqual([
      { id: 'premium_month', days: 30, stars: 321 },
      { id: 'premium_year', days: 365, stars: 1999 },
    ]);
    expect(mockApiFetch).toHaveBeenCalledWith(
      '/api/subscriptions/plans',
      { method: 'GET' },
      TELEGRAM_PLAN_CATALOG_TIMEOUT_MS,
    );
  });

  it('fails closed when the catalog response is unavailable or malformed', async () => {
    mockApiFetch.mockResolvedValueOnce(response({}, false));
    await expect(loadTelegramPremiumPlans()).rejects.toThrow('TELEGRAM_PLAN_CATALOG_UNAVAILABLE');

    mockApiFetch.mockResolvedValueOnce(response({ plans: null }));
    await expect(loadTelegramPremiumPlans()).rejects.toThrow('TELEGRAM_PLAN_CATALOG_INVALID');
  });
});
