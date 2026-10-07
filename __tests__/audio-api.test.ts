const mockUser = jest.fn();
const mockEntitlement = jest.fn();
const mockReadAudio = jest.fn();
const mockEnsureAudio = jest.fn();
const mockStale = jest.fn();
jest.mock('../lib/auth/appAuth', () => ({ requireAppUser: (...args: unknown[]) => mockUser(...args) }));
jest.mock('../lib/contentArchitecture', () => ({ getPremiumEntitlementState: (...args: unknown[]) => mockEntitlement(...args) }));
jest.mock('../lib/db', () => ({ db: { users: { get: async () => ({ id: 'u1', name: 'Аня', language: 'ru' }) } } }));
jest.mock('../lib/birthProfileRepository', () => ({ birthProfileRepository: { get: async () => null } }));
jest.mock('../lib/personalForecastPrewarm', () => ({
  buildPersonalForecastPrewarmProfile: () => ({ name: 'Аня', birthDate: '1990-01-01', birthTime: '', birthPlace: '', birthTimezone: 'Europe/Moscow', language: 'ru' }),
}));
jest.mock('../lib/personalForecastCache', () => ({ getCompatibleStalePersonalForecast: (...args: unknown[]) => mockStale(...args) }));
jest.mock('../lib/tts/ttsStore', () => ({
  readStoredAudio: (...args: unknown[]) => mockReadAudio(...args),
  ensureAudio: (...args: unknown[]) => mockEnsureAudio(...args),
}));
import listen from '../pages/api/audio/listen';
import file from '../pages/api/audio/file/[id]';

function response() {
  const res: any = { headers: {} as Record<string, string>, setHeader: jest.fn((key: string, value: string) => { res.headers[key] = value; }) };
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.end = jest.fn(() => res);
  return res;
}

const ID = 'a'.repeat(64);

describe('audio API', () => {
  beforeEach(() => {
    mockUser.mockReset().mockResolvedValue({ userId: 'u1' });
    mockEntitlement.mockReset().mockResolvedValue({ isPremium: true });
    mockEnsureAudio.mockReset().mockResolvedValue({ id: ID, durationSec: 90, cached: false });
    mockStale.mockReset().mockResolvedValue({
      forecast: {
        period: 'day', periodKey: '2026-10-03', meta: { status: 'ready' },
        overview: { id: 'overview', kind: 'overview', status: 'ready', title: 'День', text: 'Тихий день.', contentBlocks: [{ role: 'body', text: 'Тихий день.' }] },
        sections: [],
      },
    });
  });

  it('voices only the person’s own saved reading for NEBO Premium', async () => {
    const res = response();
    await listen({ method: 'POST', body: { source: { type: 'personal_forecast', period: 'day', periodKey: '2026-10-03' } }, headers: {} } as any, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ audioId: ID, durationSec: 90, cached: false });
    expect(mockStale).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', accessTier: 'premium', period: 'day' }));
    expect(mockEnsureAudio.mock.calls[0][0].text).toContain('Привет, Аня.');
    expect(mockEnsureAudio.mock.calls[0][0].ttlDays).toBe(3);
  });

  it('refuses free accounts, raw text and unknown readings', async () => {
    mockEntitlement.mockResolvedValue({ isPremium: false });
    const free = response();
    await listen({ method: 'POST', body: { source: { type: 'personal_forecast', period: 'day', periodKey: '2026-10-03' } }, headers: {} } as any, free);
    expect(free.status).toHaveBeenCalledWith(403);

    mockEntitlement.mockResolvedValue({ isPremium: true });
    const raw = response();
    await listen({ method: 'POST', body: { source: { type: 'text', text: 'Любой текст' } }, headers: {} } as any, raw);
    expect(raw.status).toHaveBeenCalledWith(400);

    mockStale.mockResolvedValue(null);
    const missing = response();
    await listen({ method: 'POST', body: { source: { type: 'personal_forecast', period: 'day', periodKey: '2026-10-03' } }, headers: {} } as any, missing);
    expect(missing.status).toHaveBeenCalledWith(404);
    expect(mockEnsureAudio).not.toHaveBeenCalled();
  });

  it('serves byte ranges for seeking', async () => {
    mockReadAudio.mockResolvedValue({ id: ID, mime: 'audio/mpeg', bytes: Buffer.from('0123456789'), byteSize: 10 });
    const res = response();
    await file({ method: 'GET', query: { id: `${ID}.mp3` }, headers: { range: 'bytes=2-5' } } as any, res);
    expect(res.status).toHaveBeenCalledWith(206);
    expect(res.headers['Content-Range']).toBe('bytes 2-5/10');
    expect(res.end.mock.calls[0][0].toString()).toBe('2345');

    const whole = response();
    await file({ method: 'GET', query: { id: ID }, headers: {} } as any, whole);
    expect(whole.status).toHaveBeenCalledWith(200);
    expect(whole.headers['Accept-Ranges']).toBe('bytes');

    const bad = response();
    await file({ method: 'GET', query: { id: '../etc' }, headers: {} } as any, bad);
    expect(bad.status).toHaveBeenCalledWith(404);
  });
});
