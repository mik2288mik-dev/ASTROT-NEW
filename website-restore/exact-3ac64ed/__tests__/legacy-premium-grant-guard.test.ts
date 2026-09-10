const mockActivatePremium = jest.fn();
const mockGetUser = jest.fn();
const mockSetUser = jest.fn();

jest.mock('../services/premiumService', () => ({
  activatePremium: (...args: unknown[]) => mockActivatePremium(...args),
}));

jest.mock('../lib/db', () => ({
  db: {
    users: {
      get: (...args: unknown[]) => mockGetUser(...args),
      set: (...args: unknown[]) => mockSetUser(...args),
    },
  },
}));

jest.mock('../lib/adminAuth', () => ({
  AdminAuthError: class AdminAuthError extends Error {},
  handleAdminError: jest.fn(),
  requireTelegramUserId: jest.fn(),
}));

jest.mock('../lib/auth/appAuth', () => ({
  requireAppUser: jest.fn().mockResolvedValue({ userId: '42' }),
}));

jest.mock('../lib/premiumPlanSettings', () => ({
  getManagedPremiumPlan: jest.fn().mockResolvedValue({
    id: 'premium_month',
    days: 30,
    stars: 100,
  }),
}));

import activateHandler from '../pages/api/subscriptions/activate';
import legacyPremiumHandler from '../pages/api/subscriptions/premium';

function responseMock() {
  const res: any = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

describe('legacy Premium grant endpoints fail closed', () => {
  const mutableEnv = process.env as Record<string, string | undefined>;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalSimulationFlag = process.env.ALLOW_TEST_PREMIUM_SIMULATION;

  beforeEach(() => {
    jest.clearAllMocks();
    mutableEnv.NODE_ENV = 'test';
    delete process.env.ALLOW_TEST_PREMIUM_SIMULATION;
  });

  afterAll(() => {
    mutableEnv.NODE_ENV = originalNodeEnv;
    if (originalSimulationFlag === undefined) delete process.env.ALLOW_TEST_PREMIUM_SIMULATION;
    else process.env.ALLOW_TEST_PREMIUM_SIMULATION = originalSimulationFlag;
  });

  it('never enables direct legacy activation merely because BOT_TOKEN is absent', async () => {
    const res = responseMock();
    await legacyPremiumHandler({
      method: 'POST',
      query: { userId: '42' },
      body: {},
      url: '/api/subscriptions/premium?userId=42',
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(410);
    expect(mockSetUser).not.toHaveBeenCalled();
    expect(mockActivatePremium).not.toHaveBeenCalled();
  });

  it('denies simulation without the explicit test flag', async () => {
    const res = responseMock();
    await activateHandler({
      method: 'POST',
      query: {},
      body: { userId: '42', simMode: true, type: 'premium_month' },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'PREMIUM_SIMULATION_DISABLED',
    }));
    expect(mockActivatePremium).not.toHaveBeenCalled();
  });

  it('denies simulation in production even if the test flag is set', async () => {
    mutableEnv.NODE_ENV = 'production';
    process.env.ALLOW_TEST_PREMIUM_SIMULATION = '1';
    const res = responseMock();
    await activateHandler({
      method: 'POST',
      query: {},
      body: { userId: '42', simMode: true, type: 'premium_month' },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockActivatePremium).not.toHaveBeenCalled();
  });
});
