jest.mock('../lib/auth/accountIdentity', () => ({
  cancelOAuth: jest.fn(async () => undefined),
  finishOAuth: jest.fn(),
}));

jest.mock('../lib/auth/oauthBrowserBinding', () => ({
  requireOAuthBrowserBinding: jest.fn(() => 'browser-binding'),
}));

import fs from 'fs';
import path from 'path';
import type { NextApiRequest, NextApiResponse } from 'next';
import { AdminAuthError } from '../lib/adminAuth';
import { finishOAuth } from '../lib/auth/accountIdentity';
import { requireOAuthBrowserBinding } from '../lib/auth/oauthBrowserBinding';
import callbackHandler from '../pages/api/auth/oauth/[provider]/callback';

const mockedFinishOAuth = finishOAuth as jest.MockedFunction<typeof finishOAuth>;
const mockedRequireOAuthBrowserBinding = requireOAuthBrowserBinding as jest.MockedFunction<
  typeof requireOAuthBrowserBinding
>;

function createResponse(): NextApiResponse & {
  status: jest.Mock;
  json: jest.Mock;
  redirect: jest.Mock;
} {
  const response: any = {};
  response.status = jest.fn(() => response);
  response.json = jest.fn(() => response);
  response.redirect = jest.fn(() => response);
  response.setHeader = jest.fn(() => response);
  return response;
}

function createRequest(query: NextApiRequest['query']): NextApiRequest {
  return {
    method: 'GET',
    query,
    headers: {},
    cookies: {},
  } as unknown as NextApiRequest;
}

describe('browser OAuth cancellation and terminal completion states', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRequireOAuthBrowserBinding.mockReturnValue('browser-binding');
    mockedFinishOAuth.mockResolvedValue({ exchangeCode: 'exchange-code' } as Awaited<ReturnType<typeof finishOAuth>>);
  });

  it('turns provider access_denied into a safe cancelled completion redirect', async () => {
    const response = createResponse();

    await callbackHandler(createRequest({
      provider: 'vk',
      state: 'state-1',
      error: 'access_denied',
      error_description: 'provider details must not leak',
    }), response);

    expect(mockedFinishOAuth).not.toHaveBeenCalled();
    expect(response.redirect).toHaveBeenCalledWith(
      302,
      expect.stringContaining('status=cancelled'),
    );
    const redirectLocation = String(response.redirect.mock.calls[0]?.[1] || '');
    expect(redirectLocation).not.toContain('provider details must not leak');
  });

  it('redirects provider completion failures to a retryable terminal page', async () => {
    mockedFinishOAuth.mockRejectedValueOnce(new AdminAuthError(
      503,
      'AUTH_PROVIDER_TEMPORARILY_UNAVAILABLE',
      'The provider is temporarily unavailable',
    ));
    const response = createResponse();

    await callbackHandler(createRequest({
      provider: 'yandex',
      code: 'provider-code',
      state: 'state-1',
    }), response);

    expect(response.redirect).toHaveBeenCalledWith(
      302,
      expect.stringContaining('status=error'),
    );
    expect(String(response.redirect.mock.calls[0]?.[1] || ''))
      .toContain('code=AUTH_PROVIDER_TEMPORARILY_UNAVAILABLE');
    expect(response.json).not.toHaveBeenCalled();
  });

  it('redirects a missing or expired browser binding to a terminal error page', async () => {
    mockedRequireOAuthBrowserBinding.mockImplementationOnce(() => {
      throw new AdminAuthError(
        401,
        'OAUTH_BROWSER_BINDING_REQUIRED',
        'The browser binding is missing',
      );
    });
    const response = createResponse();

    await expect(callbackHandler(createRequest({
      provider: 'vk',
      code: 'provider-code',
      state: 'state-1',
    }), response)).resolves.toBe(response);

    expect(mockedFinishOAuth).not.toHaveBeenCalled();
    expect(response.redirect).toHaveBeenCalledWith(
      302,
      '/auth/complete?status=error&code=OAUTH_BROWSER_BINDING_REQUIRED',
    );
  });

  it('renders explicit cancelled and error states instead of an endless completion spinner', () => {
    const page = fs.readFileSync(
      path.join(process.cwd(), 'pages/auth/complete.tsx'),
      'utf8',
    );

    expect(page).toContain("const status = typeof router.query.status === 'string'");
    expect(page).toContain("status === 'cancelled'");
    expect(page).toContain("status === 'error'");
    expect(page).not.toContain('if (!router.isReady || !code) return;');
    expect(page).toMatch(/href=['"]\/['"]|router\.(?:push|replace)\(['"]\/['"]\)/);
  });
});
