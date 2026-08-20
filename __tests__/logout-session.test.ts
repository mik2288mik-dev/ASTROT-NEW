const requireAppUser = jest.fn();
const revokeAppSession = jest.fn();
const clearAppSessionCookie = jest.fn();
const readAppRefreshCookie = jest.fn();

jest.mock('../lib/auth/appAuth', () => ({
  requireAppUser,
  revokeAppSession,
  clearAppSessionCookie,
  readAppRefreshCookie,
}));

import handler from '../pages/api/users/session/logout';

function response() {
  const res: any = {
    setHeader: jest.fn(),
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
}

describe('idempotent app logout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    readAppRefreshCookie.mockReturnValue('');
  });

  it('clears the cookie and succeeds when the session is already invalid', async () => {
    requireAppUser.mockRejectedValue({
      status: 401,
      code: 'APP_SESSION_REVOKED',
    });
    const res = response();

    await handler({ method: 'POST' } as any, res);

    expect(clearAppSessionCookie).toHaveBeenCalledWith(res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ ok: true, alreadySignedOut: true });
  });

  it('revokes a valid session before reporting success', async () => {
    requireAppUser.mockResolvedValue({
      userId: '-42',
      sessionId: 'active-session',
    });
    revokeAppSession.mockResolvedValue(undefined);
    const res = response();

    await handler({ method: 'POST' } as any, res);

    expect(revokeAppSession).toHaveBeenCalledWith(
      'active-session',
      expect.any(Number),
    );
    expect(clearAppSessionCookie).toHaveBeenCalledWith(res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it('clears the cookie and succeeds when the account is blocked', async () => {
    requireAppUser.mockRejectedValue({
      status: 403,
      code: 'ACCOUNT_BLOCKED',
    });
    const res = response();

    await handler({ method: 'POST' } as any, res);

    expect(clearAppSessionCookie).toHaveBeenCalledWith(res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ ok: true, alreadySignedOut: true });
  });

  it('keeps a genuine server failure visible', async () => {
    requireAppUser.mockResolvedValue({
      userId: '-42',
      sessionId: 'active-session',
    });
    revokeAppSession.mockRejectedValue(new Error('database unavailable'));
    const res = response();

    await handler({ method: 'POST' } as any, res);

    expect(clearAppSessionCookie).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'LOGOUT_FAILED' });
  });
});
