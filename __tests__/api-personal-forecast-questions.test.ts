const mockRequireAppUser = jest.fn();

jest.mock('../lib/auth/appAuth', () => ({
  requireAppUser: (...args: unknown[]) => mockRequireAppUser(...args),
}));

import handler from '../pages/api/content/forecast/questions';
import type { NextApiRequest, NextApiResponse } from 'next';

function responseMock(): {
  res: NextApiResponse;
  status: jest.Mock;
  json: jest.Mock;
} {
  const json = jest.fn();
  const status = jest.fn();
  const res = { status, json } as unknown as NextApiResponse;
  status.mockImplementation(() => res);
  return { res, status, json };
}

describe('retired legacy personal forecast dialogue API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAppUser.mockResolvedValue({
      userId: '1001',
      provider: 'email',
      isGuest: false,
    });
  });

  it.each(['GET', 'POST', 'PATCH'])(
    'returns an explicit retired response for %s',
    async (method) => {
      const { res, status, json } = responseMock();
      const req = {
        method,
        query: {},
        body: {},
        headers: {},
      } as unknown as NextApiRequest;

      await handler(req, res);

      expect(mockRequireAppUser).toHaveBeenCalledWith(req, { allowGuest: true });
      expect(status).toHaveBeenCalledWith(410);
      expect(json).toHaveBeenCalledWith({
        error: 'The legacy forecast question dialogue is retired',
        code: 'PERSONAL_FORECAST_DIALOGUE_RETIRED',
        retired: true,
      });
    },
  );

  it('does not expose the retired route through unsupported methods', async () => {
    const { res, status, json } = responseMock();
    const req = {
      method: 'DELETE',
      query: {},
      headers: {},
    } as unknown as NextApiRequest;

    await handler(req, res);

    expect(status).toHaveBeenCalledWith(405);
    expect(json).toHaveBeenCalledWith({
      error: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED',
    });
    expect(mockRequireAppUser).not.toHaveBeenCalled();
  });
});
