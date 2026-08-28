const mockApiFetch = jest.fn();
const mockPersistNativeSessionResponse = jest.fn();
const mockIsNativeAppRuntime = jest.fn();
const mockIsNativeAndroidRuntime = jest.fn();
const mockSetAuthSessionMode = jest.fn();
const mockNativeSignIn = jest.fn();

jest.mock('../services/apiClient', () => ({
  apiFetch: mockApiFetch,
  persistNativeSessionResponse: mockPersistNativeSessionResponse,
}));

jest.mock('../services/nativeRuntime', () => ({
  isNativeAppRuntime: mockIsNativeAppRuntime,
  isNativeAndroidRuntime: mockIsNativeAndroidRuntime,
}));

jest.mock('../services/authSessionIntent', () => ({
  getRawTelegramInitData: jest.fn(),
  setAuthSessionMode: mockSetAuthSessionMode,
}));

jest.mock('../services/nativeIdentityAuthBridge', () => ({
  nativeIdentityAuth: {
    signIn: mockNativeSignIn,
    clearCredentialState: jest.fn(),
  },
}));

import {
  authenticateWithProvider,
  getAccountAuthCapabilities,
  getLocalAccountAuthCapabilities,
} from '../services/accountAuthService';

function setNodeEnv(value: string): void {
  Object.defineProperty(process.env, 'NODE_ENV', {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
}

describe('native auth startup resilience', () => {
  const originalChannel = process.env.NEXT_PUBLIC_DISTRIBUTION_CHANNEL;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_DISTRIBUTION_CHANNEL = 'development';
    mockIsNativeAppRuntime.mockReturnValue(true);
    mockIsNativeAndroidRuntime.mockReturnValue(true);
    mockPersistNativeSessionResponse.mockResolvedValue(undefined);
  });

  afterAll(() => {
    if (originalChannel === undefined) delete process.env.NEXT_PUBLIC_DISTRIBUTION_CHANNEL;
    else process.env.NEXT_PUBLIC_DISTRIBUTION_CHANNEL = originalChannel;
    setNodeEnv(originalNodeEnv);
  });

  it('returns compiled Android Yandex/VK capabilities without a capability request', async () => {
    expect(getLocalAccountAuthCapabilities()).toMatchObject({ yandex: true, vk: true });

    await expect(getAccountAuthCapabilities()).resolves.toMatchObject({ yandex: true, vk: true });

    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it('keeps Yandex sign-in usable when an old Android bundle has no channel', async () => {
    setNodeEnv('production');
    delete process.env.NEXT_PUBLIC_DISTRIBUTION_CHANNEL;
    mockNativeSignIn.mockResolvedValue({ accessToken: 'provider-token' });
    mockApiFetch
      .mockResolvedValueOnce(new Response(JSON.stringify({
        challengeId: 'challenge-id',
        provider: 'yandex',
        config: { clientId: 'android-client-id' },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        profile: { id: '42', isGuest: false },
        token: 'app-session-token',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    await expect(authenticateWithProvider('yandex')).resolves.toMatchObject({ id: '42' });

    expect(mockApiFetch).toHaveBeenNthCalledWith(
      1,
      '/api/auth/provider/yandex/start',
      expect.objectContaining({ method: 'POST' }),
      10_000,
    );
  });

  it('retains remote discovery for browser OAuth and email configuration', async () => {
    mockIsNativeAppRuntime.mockReturnValue(false);
    mockIsNativeAndroidRuntime.mockReturnValue(false);
    mockApiFetch.mockResolvedValue(new Response(JSON.stringify({
      yandex: true,
      vk: true,
      emailDelivery: true,
      emailPassword: true,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    await expect(getAccountAuthCapabilities()).resolves.toMatchObject({
      yandex: true,
      vk: true,
      emailDelivery: true,
      emailPassword: true,
    });

    expect(mockApiFetch).toHaveBeenCalledWith(
      '/api/auth/capabilities?runtime=browser&channel=development',
      {},
      8_000,
    );
  });
});
