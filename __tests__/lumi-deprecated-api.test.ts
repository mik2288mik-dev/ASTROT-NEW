import type { NextApiRequest, NextApiResponse } from 'next';
import {
  LUMI_DEPRECATED_CODE,
  LUMI_DEPRECATED_MESSAGE_EN,
  LUMI_DEPRECATED_MESSAGE_RU,
} from '../lib/lumiDeprecatedResponse';

type MockResponse = {
  statusCode?: number;
  body?: unknown;
  status: (code: number) => MockResponse;
  json: (payload: unknown) => MockResponse;
};

function createMockResponse(): MockResponse {
  const res: MockResponse = {
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
  };
  return res;
}

async function invokeDeprecatedHandler(
  modulePath: string,
  req: Partial<NextApiRequest> = { method: 'GET', query: {}, body: {} }
) {
  const handler = (await import(modulePath)).default;
  const res = createMockResponse();
  await handler(req as NextApiRequest, res as unknown as NextApiResponse);
  return res;
}

describe('deprecated public Lumi APIs', () => {
  const deprecatedModules = [
    '../pages/api/users/lumi/index',
    '../pages/api/users/lumi/add',
    '../pages/api/users/lumi/spend',
    '../pages/api/users/lumi/daily-roulette',
    '../pages/api/users/lumi/daily-tasks',
    '../pages/api/users/daily-login',
  ];

  it.each(deprecatedModules)('%s returns 410 LUMI_DEPRECATED', async (modulePath) => {
    const res = await invokeDeprecatedHandler(modulePath);
    expect(res.statusCode).toBe(410);
    expect(res.body).toEqual(
      expect.objectContaining({
        code: LUMI_DEPRECATED_CODE,
        messageRu: LUMI_DEPRECATED_MESSAGE_RU,
        messageEn: LUMI_DEPRECATED_MESSAGE_EN,
      })
    );
  });

  it('charts buy-slot returns 410 LUMI_DEPRECATED', async () => {
    const handler = (await import('../pages/api/charts/index')).default;
    const res = createMockResponse();
    await handler(
      {
        method: 'POST',
        query: {},
        body: { userId: '123456789', action: 'buy-slot' },
      } as NextApiRequest,
      res as unknown as NextApiResponse
    );
    expect(res.statusCode).toBe(410);
    expect(res.body).toEqual(expect.objectContaining({ code: LUMI_DEPRECATED_CODE }));
  });
});
