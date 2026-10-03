const mockFetch = jest.fn();
const mockStart = jest.fn();
const mockStore = jest.fn();
jest.mock('../services/apiClient', () => ({ apiFetchUnauthenticated: mockFetch }));
jest.mock('@capacitor/core', () => ({ registerPlugin: () => ({ startUpdate: mockStart, openStore: mockStore }) }));
import { fetchAndroidUpdatePolicy, readCachedAndroidUpdatePolicy, startAndroidUpdate } from '../services/androidUpdates';

const cache = new Map<string, string>();
beforeEach(() => {
  jest.clearAllMocks();
  cache.clear();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => cache.get(key) || null,
    setItem: (key: string, value: string) => cache.set(key, value),
  } });
});
afterAll(() => { delete (globalThis as unknown as { localStorage?: unknown }).localStorage; });

it('retains the confirmed minimum when the network fails', async () => {
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ minVersionCode: 9, versionName: '1.0.6' }) });
  const policy = await fetchAndroidUpdatePolicy();
  expect(readCachedAndroidUpdatePolicy()).toEqual(policy);
  mockFetch.mockRejectedValue(new Error('offline'));
  await expect(fetchAndroidUpdatePolicy()).rejects.toThrow('offline');
  expect(readCachedAndroidUpdatePolicy()).toEqual(policy);
});
it('honors an explicit server rollback to disabled and rejects malformed replacement policy', async () => {
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ minVersionCode: 9 }) });
  await fetchAndroidUpdatePolicy();
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ minVersionCode: 'oops' }) });
  await expect(fetchAndroidUpdatePolicy()).rejects.toThrow('Invalid');
  expect(readCachedAndroidUpdatePolicy()?.minVersionCode).toBe(9);
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ minVersionCode: 0 }) });
  await fetchAndroidUpdatePolicy();
  expect(readCachedAndroidUpdatePolicy()?.minVersionCode).toBe(0);
});
it.each(['started', 'cancelled'])('does not open the store after SDK %s', async (status) => {
  mockStart.mockResolvedValue({ status });
  expect(await startAndroidUpdate()).toBe(status);
  expect(mockStore).not.toHaveBeenCalled();
});
it('opens the app listing when the update SDK is unavailable', async () => {
  mockStart.mockRejectedValue(new Error('RuStore not authorized'));
  await startAndroidUpdate();
  expect(mockStore).toHaveBeenCalledTimes(1);
});
