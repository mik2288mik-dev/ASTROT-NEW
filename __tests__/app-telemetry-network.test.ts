jest.mock('../services/nativeRuntime', () => ({
  isNativeAppRuntime: () => false,
  isNativeAndroidRuntime: () => false,
}));
jest.mock('../services/nativeNetwork', () => ({ assertNativeNetworkAvailable: async () => undefined }));
jest.mock('../services/appTelemetryClient', () => ({
  captureAppTrace: jest.fn(),
  currentTraceScreen: jest.fn(() => 'auth'),
  traceGeneration: jest.fn(() => 1),
  hasTraceIdentity: () => false,
}));

import { apiFetch, apiFetchUnauthenticated } from '../services/apiClient';
import { captureAppTrace, traceGeneration } from '../services/appTelemetryClient';

const capture = captureAppTrace as jest.Mock;
const generation = traceGeneration as jest.Mock;
const originalFetch = globalThis.fetch;

describe('network waits in app telemetry', () => {
  beforeEach(() => { jest.clearAllMocks(); generation.mockReturnValue(1); });
  afterEach(() => { globalThis.fetch = originalFetch; jest.restoreAllMocks(); });

  it('records a pre-login request without copying credentials or consuming the response', async () => {
    const response = new Response(JSON.stringify({ profile: { id: 42 } }), { status: 200 });
    let now = 10000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    globalThis.fetch = jest.fn().mockImplementation(async () => { now = 33000; return response; });
    const result = await apiFetchUnauthenticated('/api/auth/password/login?secret=private', {
      method: 'POST', body: JSON.stringify({ password: 'private-password' }),
    });
    expect(result).toBe(response);
    expect(result.bodyUsed).toBe(false);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [start, finish] = capture.mock.calls;
    expect(start).toEqual(['request_started', { request_id: expect.any(String), operation: '/api/auth/password/login' }]);
    expect(finish).toEqual(['request_finished', {
      request_id: start[1].request_id, operation: '/api/auth/password/login',
      duration_ms: 23000, status: 200, outcome: 'success',
    }, 'auth']);
    expect(JSON.stringify(capture.mock.calls)).not.toMatch(/private|secret=/);
  });

  it('records a full API URL once and keeps the original request unchanged', async () => {
    const response = new Response('{}', { status: 200 });
    globalThis.fetch = jest.fn().mockResolvedValue(response);
    const path = 'https://api.example.test/api/content/today/sky?userId=42';
    const result = await apiFetch(path, { headers: { Authorization: 'Bearer test' } });
    expect(result).toBe(response);
    expect(globalThis.fetch).toHaveBeenCalledWith(path, expect.objectContaining({ headers: expect.any(Headers) }));
    expect(capture.mock.calls.map(call => call[1].operation)).toEqual(['/api/content/today/sky', '/api/content/today/sky']);
    expect(capture).toHaveBeenCalledTimes(2);
  });

  it('reports failed and cancelled requests while preserving their original error', async () => {
    const error = new Error('private transport detail');
    globalThis.fetch = jest.fn().mockRejectedValue(error);
    await expect(apiFetchUnauthenticated('/api/content/natal/questions')).rejects.toBe(error);
    expect(capture.mock.calls[1][1]).toMatchObject({ status: 0, outcome: 'network_error' });
    capture.mockClear();
    globalThis.fetch = jest.fn().mockImplementation(async (_path, init) => {
      if (init.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      throw error;
    });
    const controller = new AbortController(); controller.abort();
    await expect(apiFetchUnauthenticated('/api/content/natal/questions', { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(capture.mock.calls[1][1]).toMatchObject({ status: 0, outcome: 'cancelled' });
    expect(JSON.stringify(capture.mock.calls)).not.toContain(error.message);
  });

  it('does not attribute an old request completion to a different account', async () => {
    globalThis.fetch = jest.fn().mockImplementation(async () => {
      generation.mockReturnValue(2);
      return new Response('{}', { status: 200 });
    });
    await apiFetchUnauthenticated('/api/content/natal/questions');
    expect(capture.mock.calls.map(call => call[0])).toEqual(['request_started']);
  });

  it('does not recursively record telemetry delivery or requests from the admin interface', async () => {
    globalThis.fetch = jest.fn().mockImplementation(async () => new Response('{}', { status: 200 }));
    await apiFetchUnauthenticated('/api/telemetry');
    await apiFetchUnauthenticated('https://api.example.test/api/admin/v2/app-telemetry');
    expect(capture).not.toHaveBeenCalled();
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });
});
