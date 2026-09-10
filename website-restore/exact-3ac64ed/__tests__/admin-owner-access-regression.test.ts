const mockGetVerifiedTelegramUser = jest.fn();
const mockGetConfiguredOwnerId = jest.fn();
const mockQuery = jest.fn();

class MockAdminAuthError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

jest.mock('../lib/adminAuth', () => ({
  AdminAuthError: MockAdminAuthError,
  getVerifiedTelegramUser: (...args: unknown[]) => mockGetVerifiedTelegramUser(...args),
  getConfiguredOwnerId: (...args: unknown[]) => mockGetConfiguredOwnerId(...args),
}));

jest.mock('../lib/db', () => ({
  getPool: () => ({ query: (...args: unknown[]) => mockQuery(...args) }),
}));

import { getAdminContext } from '../lib/admin/rbac';

describe('Telegram owner admin access regression', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedTelegramUser.mockReturnValue({ id: '3102', rawUser: { id: 3102 } });
  });

  it('recognizes an owner by Telegram ID after the identity maps to another internal user', async () => {
    mockGetConfiguredOwnerId.mockReturnValue('3102');
    mockQuery.mockResolvedValueOnce({ rows: [{ user_id: '2816' }] });

    await expect(getAdminContext({} as any)).resolves.toMatchObject({
      userId: '2816',
      role: 'super_admin',
      isOwner: true,
    });
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('also recognizes an owner when OWNER_ID contains the internal account ID', async () => {
    mockGetConfiguredOwnerId.mockReturnValue('2816');
    mockQuery.mockResolvedValueOnce({ rows: [{ user_id: '2816' }] });

    await expect(getAdminContext({} as any)).resolves.toMatchObject({
      userId: '2816',
      role: 'super_admin',
      isOwner: true,
    });
  });

  it('keeps a legacy users.is_admin account accessible until RBAC is seeded', async () => {
    mockGetConfiguredOwnerId.mockReturnValue('');
    mockQuery
      .mockResolvedValueOnce({ rows: [{ user_id: '2816' }] })
      .mockResolvedValueOnce({ rows: [{ role: null, status: null, is_admin: true }] });

    await expect(getAdminContext({} as any)).resolves.toMatchObject({
      userId: '2816',
      role: 'admin',
      isOwner: false,
    });
  });

  it('does not let a legacy flag bypass an explicitly revoked RBAC row', async () => {
    mockGetConfiguredOwnerId.mockReturnValue('');
    mockQuery
      .mockResolvedValueOnce({ rows: [{ user_id: '2816' }] })
      .mockResolvedValueOnce({ rows: [{ role: 'super_admin', status: 'revoked', is_admin: true }] });

    await expect(getAdminContext({} as any)).rejects.toMatchObject({
      status: 403,
      code: 'ADMIN_REQUIRED',
    });
  });
});
