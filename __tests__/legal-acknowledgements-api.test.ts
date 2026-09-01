const mockRequireAppUser = jest.fn();
const mockConsumeAuthRateLimit = jest.fn();
const mockQuery = jest.fn();
const mockClientQuery = jest.fn();
const mockClientRelease = jest.fn();
const mockConnect = jest.fn();

jest.mock('../lib/auth/appAuth', () => ({
  requireAppUser: (...args: unknown[]) => mockRequireAppUser(...args),
}));
jest.mock('../lib/auth/authRateLimit', () => ({
  consumeAuthRateLimit: (...args: unknown[]) => mockConsumeAuthRateLimit(...args),
}));

jest.mock('../lib/db', () => ({
  getPool: () => ({
    query: (...args: unknown[]) => mockQuery(...args),
    connect: (...args: unknown[]) => mockConnect(...args),
  }),
}));

import { AdminAuthError } from '../lib/adminAuth';
import handler from '../pages/api/users/legal-acknowledgements';
import { CURRENT_LEGAL_DOCUMENT_VERSIONS } from '../lib/legalAcknowledgement';

function response() {
  const res: any = {};
  res.setHeader = jest.fn(() => res);
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

function request(method: string, body?: unknown) {
  return { method, body, query: {}, headers: {} } as any;
}

describe('/api/users/legal-acknowledgements', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAppUser.mockResolvedValue({ userId: '42', isGuest: true });
    mockConsumeAuthRateLimit.mockResolvedValue(undefined);
    mockQuery.mockResolvedValue({ rows: [] });
    mockClientQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT id FROM users')) return { rows: [{ id: '42' }] };
      if (sql.includes('SELECT document_version')) return { rows: [] };
      if (sql.includes('INSERT INTO user_legal_acknowledgements')) {
        return { rows: [{ createdAt: new Date('2026-08-31T09:00:00.000Z') }] };
      }
      return { rows: [] };
    });
    mockConnect.mockResolvedValue({ query: mockClientQuery, release: mockClientRelease });
  });

  it('returns server-owned required versions and latest status for an authenticated guest', async () => {
    mockQuery.mockResolvedValue({
      rows: [
        {
          documentType: 'personal_data',
          documentVersion: CURRENT_LEGAL_DOCUMENT_VERSIONS.personal_data,
          action: 'accepted',
          createdAt: '2026-08-31T08:00:00.000Z',
        },
        {
          documentType: 'terms',
          documentVersion: '2026-08-01',
          action: 'accepted',
          createdAt: '2026-08-30T08:00:00.000Z',
        },
      ],
    });
    const req = request('GET');
    const res = response();

    await handler(req, res);

    expect(mockRequireAppUser).toHaveBeenCalledWith(req, { allowGuest: true });
    expect(res.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'private, no-store, max-age=0',
    );
    expect(res.setHeader).toHaveBeenCalledWith('Vary', 'Authorization, Cookie');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('SELECT DISTINCT ON (document_type)'),
      ['42'],
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      requiredVersions: CURRENT_LEGAL_DOCUMENT_VERSIONS,
      documents: [
        expect.objectContaining({
          documentType: 'personal_data',
          accepted: true,
          latestAction: 'accepted',
        }),
        expect.objectContaining({
          documentType: 'terms',
          accepted: false,
          latestDocumentVersion: '2026-08-01',
        }),
        expect.objectContaining({
          documentType: 'entertainment_notice',
          accepted: false,
          latestAction: null,
        }),
      ],
    });
  });

  it('appends one accepted document with the server-owned version and allowlisted metadata', async () => {
    const req = request('POST', {
      documentType: 'terms',
      action: 'accepted',
      source: 'onboarding_legal',
      language: 'ru',
      appVersionName: '1.0.2',
      appVersionCode: 4,
      distributionChannel: 'rustore',
    });
    const res = response();

    await handler(req, res);

    expect(mockRequireAppUser).toHaveBeenCalledWith(req, { allowGuest: true });
    expect(mockConsumeAuthRateLimit).toHaveBeenCalledWith({
      scope: 'legal_acknowledgement_user',
      key: '42',
      maxAttempts: 9,
      windowMs: 600_000,
    });
    const userLock = mockClientQuery.mock.calls.find(([sql]) => String(sql).includes('SELECT id FROM users'));
    const insert = mockClientQuery.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO user_legal_acknowledgements'));
    expect(userLock?.[1]).toEqual(['42']);
    expect(insert?.[1]).toEqual([
      '42',
      'terms',
      CURRENT_LEGAL_DOCUMENT_VERSIONS.terms,
      'accepted',
      'onboarding_legal',
      'ru',
      '1.0.2',
      4,
      'rustore',
    ]);
    expect(mockClientQuery.mock.calls.map(([sql]) => String(sql).trim())).toEqual(expect.arrayContaining([
      'BEGIN',
      'COMMIT',
    ]));
    expect(mockClientRelease).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      acknowledgement: {
        documentType: 'terms',
        documentVersion: CURRENT_LEGAL_DOCUMENT_VERSIONS.terms,
        action: 'accepted',
        createdAt: '2026-08-31T09:00:00.000Z',
      },
    });
  });

  it('returns an atomic no-op when the latest action already matches the current server version', async () => {
    mockClientQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT id FROM users')) return { rows: [{ id: '42' }] };
      if (sql.includes('SELECT document_version')) {
        return {
          rows: [{
            documentVersion: CURRENT_LEGAL_DOCUMENT_VERSIONS.terms,
            action: 'accepted',
            createdAt: new Date('2026-08-31T08:00:00.000Z'),
          }],
        };
      }
      return { rows: [] };
    });
    const res = response();

    await handler(request('POST', {
      documentType: 'terms',
      action: 'accepted',
      source: 'onboarding_legal',
    }), res);

    expect(mockClientQuery.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO user_legal_acknowledgements'))).toBe(false);
    expect(mockClientQuery).toHaveBeenCalledWith('COMMIT');
    expect(mockClientRelease).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      acknowledgement: {
        documentType: 'terms',
        documentVersion: CURRENT_LEGAL_DOCUMENT_VERSIONS.terms,
        action: 'accepted',
        createdAt: '2026-08-31T08:00:00.000Z',
      },
      alreadyRecorded: true,
    });
  });

  it.each([
    [{ documentTypes: ['terms'], action: 'accepted', source: 'legal_prompt' }],
    [{ documentType: 'terms', action: 'accepted', source: 'legal_prompt', documentVersion: 'fake' }],
    [{ documentType: 'terms', action: 'accepted', source: 'legal_prompt', device: 'phone' }],
    [{ documentType: 'terms', action: 'accepted', source: 'legal prompt' }],
    [{ documentType: 'terms', action: 'accepted' }],
  ])('rejects non-allowlisted or incomplete POST body %#', async (body) => {
    const res = response();

    await handler(request('POST', body), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('supports append-only personal-data withdrawal through POST and DELETE', async () => {
    for (const req of [
      request('POST', {
        documentType: 'personal_data',
        action: 'withdrawn',
        source: 'settings',
      }),
      request('DELETE', {
        documentType: 'personal_data',
        source: 'settings',
      }),
    ]) {
      const res = response();
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
    }

    const inserts = mockClientQuery.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO user_legal_acknowledgements'));
    expect(inserts).toHaveLength(2);
    expect(inserts[0][1][3]).toBe('withdrawn');
    expect(inserts[1][1][3]).toBe('withdrawn');
  });

  it.each(['terms', 'entertainment_notice'])(
    'never allows withdrawal of %s',
    async (documentType) => {
      const res = response();
      await handler(request('POST', {
        documentType,
        action: 'withdrawn',
        source: 'settings',
      }), res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockConnect).not.toHaveBeenCalled();
    },
  );

  it('rejects a parsed body larger than 8kb before authentication or persistence', async () => {
    const res = response();
    await handler(request('POST', {
      documentType: 'terms',
      action: 'accepted',
      source: 'legal_prompt',
      padding: 'x'.repeat(8 * 1024),
    }), res);

    expect(res.status).toHaveBeenCalledWith(413);
    expect(mockRequireAppUser).not.toHaveBeenCalled();
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('rate-limits valid mutations before opening a journal transaction', async () => {
    mockConsumeAuthRateLimit.mockRejectedValue(
      new AdminAuthError(429, 'AUTH_RATE_LIMITED', 'Try again later'),
    );
    const res = response();

    await handler(request('POST', {
      documentType: 'personal_data',
      action: 'accepted',
      source: 'onboarding_legal',
    }), res);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      error: 'AUTH_RATE_LIMITED',
      message: 'Try again later',
    });
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it('propagates authentication errors without querying the journal', async () => {
    mockRequireAppUser.mockRejectedValue(Object.assign(new Error('Authentication required'), {
      status: 401,
      code: 'APP_AUTH_REQUIRED',
    }));
    const res = response();

    await handler(request('GET'), res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'APP_AUTH_REQUIRED',
      message: 'Authentication required',
    });
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
