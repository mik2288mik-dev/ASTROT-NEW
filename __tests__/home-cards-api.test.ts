jest.mock('../lib/auth/appAuth', () => ({ requireAppUser: jest.fn() }));
jest.mock('../lib/contentArchitecture', () => ({ getPremiumEntitlementState: jest.fn() }));
jest.mock('../lib/admin/contentStore', () => ({ getPublishedContent: jest.fn() }));
jest.mock('../lib/admin/rbac', () => ({ requireAdminPermission: jest.fn() }));
jest.mock('../lib/admin/audit', () => ({ recordAdminAction: jest.fn() }));
jest.mock('../lib/db', () => ({ getPool: jest.fn() }));
jest.mock('../lib/adminAuth', () => {
  class AdminAuthError extends Error { constructor(public status: number, public code: string, message: string) { super(message); } }
  return { AdminAuthError, handleAdminError: (res: any, error: any) => res.status(error.status || 500).json({ error: error.code || 'FAILED', message: error.message }) };
});

import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAppUser } from '../lib/auth/appAuth';
import { getPublishedContent } from '../lib/admin/contentStore';
import { getPremiumEntitlementState } from '../lib/contentArchitecture';
import { requireAdminPermission } from '../lib/admin/rbac';
import { AdminAuthError } from '../lib/adminAuth';
import { getPool } from '../lib/db';
import runtime from '../pages/api/content/home-cards';
import create from '../pages/api/admin/v2/cms/index';
import detail from '../pages/api/admin/v2/cms/[id]';
import { homeCardFixture } from './fixtures/homeCard';

async function request(handler: typeof runtime, method = 'GET', body: Record<string, unknown> = {}, query: Record<string, string> = {}) {
  const result = { status: 200, body: null as any, headers: {} as Record<string, unknown> };
  const res = { setHeader(key: string, value: unknown) { result.headers[key] = value; }, status(value: number) { result.status = value; return res; }, json(value: unknown) { result.body = value; return res; } };
  await handler({ method, headers: {}, query, body } as NextApiRequest, res as unknown as NextApiResponse);
  return result;
}

describe('home cards runtime authentication', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getPublishedContent as jest.Mock).mockResolvedValue([
      { id: 1, body: JSON.stringify(homeCardFixture()) }, { id: 2, body: JSON.stringify(homeCardFixture({ audience: 'premium' })) },
    ]);
  });
  it('allows anonymous cards, ignores premium query claims, and never uses a shared response cache', async () => {
    (requireAppUser as jest.Mock).mockRejectedValue(new AdminAuthError(401, 'APP_AUTH_REQUIRED', 'Sign in'));
    const result = await request(runtime, 'GET', {}, { premium: 'true', locale: 'en' });
    expect(result.status).toBe(200);
    expect(result.body.cards.map((card: any) => card.id)).toEqual([1]);
    expect(getPremiumEntitlementState).not.toHaveBeenCalled();
    expect(getPublishedContent).toHaveBeenCalledWith('home_card', 'en');
    expect(result.headers['Cache-Control']).toContain('no-store');
  });
  it('uses the authenticated account entitlement', async () => {
    (requireAppUser as jest.Mock).mockResolvedValue({ userId: 'owner' });
    (getPremiumEntitlementState as jest.Mock).mockResolvedValue({ isPremium: true, endsAt: null });
    const result = await request(runtime);
    expect(result.body.cards).toHaveLength(2);
    expect(getPremiumEntitlementState).toHaveBeenCalledWith('owner');
  });
  it('does not downgrade a revoked session to anonymous', async () => {
    (requireAppUser as jest.Mock).mockRejectedValue(new AdminAuthError(401, 'APP_SESSION_REVOKED', 'Session revoked'));
    expect((await request(runtime)).status).toBe(401);
    expect(getPublishedContent).not.toHaveBeenCalled();
  });
});

describe('home cards CMS validation and lifecycle', () => {
  const query = jest.fn();
  const txQuery = jest.fn();
  const release = jest.fn();
  beforeEach(() => {
    jest.clearAllMocks();
    (requireAdminPermission as jest.Mock).mockResolvedValue({ userId: 'editor' });
    (getPool as jest.Mock).mockReturnValue({ query, connect: async () => ({ query: txQuery, release }) });
    query.mockReset(); txQuery.mockReset();
  });
  it('creates a validated draft with the card title as its CMS title', async () => {
    query.mockResolvedValue({ rows: [{ id: 5 }] });
    expect((await request(create, 'POST', { type: 'home_card', body: JSON.stringify(homeCardFixture()), title: 'wrong' })).status).toBe(200);
    expect(requireAdminPermission).toHaveBeenCalledWith(expect.anything(), 'content.edit');
    expect(query.mock.calls[0][0]).toContain("'draft'");
    expect(query.mock.calls[0][1][2]).toBe(homeCardFixture().title);
  });
  it('rejects invalid audiences before creating a row', async () => {
    const result = await request(create, 'POST', { type: 'home_card', body: JSON.stringify({ ...homeCardFixture(), audience: 'admin' }) });
    expect(result.status).toBe(400); expect(query).not.toHaveBeenCalled();
  });
  it('rejects invalid existing body before publishing and checks publish permission', async () => {
    query.mockResolvedValueOnce({ rows: [{ type: 'home_card', body: '{}', version: 1 }] });
    expect((await request(detail, 'POST', { action: 'publish', expectedVersion: 1 }, { id: '5' })).status).toBe(400);
    expect(requireAdminPermission).toHaveBeenCalledWith(expect.anything(), 'content.publish');
    expect(query).toHaveBeenCalledTimes(1);
  });
  it('publishes only the reviewed version, refusing a concurrent edit', async () => {
    query.mockResolvedValueOnce({ rows: [{ type: 'home_card', body: JSON.stringify(homeCardFixture()), version: 2 }] });
    expect((await request(detail, 'POST', { action: 'publish', expectedVersion: 1 }, { id: '5' })).status).toBe(409);
    expect(query).toHaveBeenCalledTimes(1);
  });
  it('publishes a valid reviewed draft and preserves its version', async () => {
    query.mockResolvedValueOnce({ rows: [{ type: 'home_card', body: JSON.stringify(homeCardFixture()), version: 2 }] }).mockResolvedValueOnce({ rowCount: 1 });
    const result = await request(detail, 'POST', { action: 'publish', expectedVersion: 2 }, { id: '5' });
    expect(result.body).toEqual({ ok: true });
    expect(query.mock.calls[1][0]).toContain("status = 'published'");
    expect(query.mock.calls[1][1]).toEqual([5, 2]);
  });
  it('saves version history and draft together inside a transaction', async () => {
    query.mockResolvedValueOnce({ rows: [{ type: 'home_card', body: JSON.stringify(homeCardFixture()), version: 2 }] });
    txQuery.mockImplementation(async (sql: string) => sql.includes('FOR UPDATE') ? { rows: [{ version: 2, body: 'previous' }] } : { rows: [], rowCount: 1 });
    const result = await request(detail, 'PATCH', { body: JSON.stringify(homeCardFixture({ title: 'Новое' })), expectedVersion: 2 }, { id: '5' });
    expect(result.body).toEqual({ ok: true, version: 3 });
    expect(txQuery.mock.calls.map(([sql]) => sql)).toEqual(expect.arrayContaining(['BEGIN', 'COMMIT']));
    expect(txQuery.mock.calls.find(([sql]) => sql.startsWith('UPDATE'))?.[1]).toMatchObject({ 1: 'Новое', 2: 3 });
    expect(release).toHaveBeenCalled();
  });
  it('rolls back a stale edit before writing history', async () => {
    query.mockResolvedValueOnce({ rows: [{ type: 'home_card', version: 2 }] });
    txQuery.mockImplementation(async (sql: string) => sql.includes('FOR UPDATE') ? { rows: [{ version: 3, body: 'newer' }] } : { rows: [] });
    expect((await request(detail, 'PATCH', { body: JSON.stringify(homeCardFixture()), expectedVersion: 2 }, { id: '5' })).status).toBe(409);
    expect(txQuery).toHaveBeenCalledWith('ROLLBACK');
    expect(txQuery.mock.calls.some(([sql]) => sql.startsWith('INSERT'))).toBe(false);
  });
  it('archives only with edit permission and reports missing cards', async () => {
    query.mockResolvedValue({ rowCount: 0 });
    expect((await request(detail, 'POST', { action: 'archive' }, { id: '5' })).status).toBe(404);
    expect(requireAdminPermission).toHaveBeenCalledWith(expect.anything(), 'content.edit');
  });
  it('archives an existing card without deleting its saved content', async () => {
    query.mockResolvedValue({ rowCount: 1 });
    expect((await request(detail, 'POST', { action: 'archive' }, { id: '5' })).body).toEqual({ ok: true });
    expect(query.mock.calls[0][0]).toContain("status = 'archived'");
    expect(query.mock.calls[0][0]).not.toContain('DELETE');
  });
  it('rejects denied permissions without writing', async () => {
    (requireAdminPermission as jest.Mock).mockRejectedValue(new AdminAuthError(403, 'FORBIDDEN', 'Нет доступа'));
    expect((await request(create, 'POST', { type: 'home_card', body: JSON.stringify(homeCardFixture()) })).status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });
});
