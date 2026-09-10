const mockRequireAppUser = jest.fn();

jest.mock('../lib/auth/appAuth', () => ({
  requireAppUser: (...args: unknown[]) => mockRequireAppUser(...args),
}));

import type { NextApiRequest, NextApiResponse } from 'next';
import { AdminAuthError } from '../lib/adminAuth';
import handler from '../pages/api/content/forecast/personal';

function responseMock() {
  const result: { statusCode: number; body: unknown; headers: Record<string, unknown> } = {
    statusCode: 200,
    body: null,
    headers: {},
  };
  const response = {
    setHeader(name: string, value: unknown) { result.headers[name] = value; },
    status(code: number) { result.statusCode = code; return response; },
    json(body: unknown) { result.body = body; return response; },
  };
  return { response: response as unknown as NextApiResponse, result };
}

describe('personal forecast session refresh contract', () => {
  it('preserves an expired-session 401 so the native client can refresh and retry', async () => {
    mockRequireAppUser.mockRejectedValueOnce(new AdminAuthError(
      401,
      'APP_SESSION_EXPIRED',
      'App session expired',
    ));
    const { response, result } = responseMock();

    await handler({
      method: 'GET',
      query: { period: 'day' },
      headers: {},
    } as unknown as NextApiRequest, response);

    expect(result.statusCode).toBe(401);
    expect(result.body).toMatchObject({ error: 'APP_SESSION_EXPIRED' });
  });
});
