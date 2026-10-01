jest.mock('../lib/db', () => ({ getPool: () => ({ query: jest.fn((...args: unknown[]) => query(...args)) }) }));
jest.mock('../lib/auth/appAuth', () => ({ requireAppUser: jest.fn() }));

import type { NextApiRequest } from 'next';
import { requireAppUser, type AppUserContext } from '../lib/auth/appAuth';
import { rememberNativeSignReader, resolveSignHoroscopeRequestVersion, signSchemaForNativeBuild } from '../lib/horoscope/signClientCompatibility';

const query = jest.fn();
const ua = 'Dalvik/2.1.0 (Linux; U; Android 13; M2101K9AG Build/test)';
const auth: AppUserContext = { userId: '-1', sessionId: 'phone-five', provider: 'native', isGuest: false };
const req = { headers: { 'user-agent': ua, authorization: 'Bearer existing-apk-session' } } as NextApiRequest;

describe('already installed Android horoscope formats', () => {
  beforeEach(() => {
    query.mockReset().mockResolvedValue({ rows: [] });
    (requireAppUser as jest.Mock).mockReset().mockResolvedValue(auth);
  });

  it.each([
    { metadata: { appVersion: '1.0.4', versionCode: 7 }, expected: 'sign-horoscope-reading-v4' },
    { metadata: { appVersion: '1.0.4', versionCode: 8 }, expected: 'sign-horoscope-reading-v5' },
    { metadata: { appVersion: '1.0.5', versionCode: 8 }, expected: 'sign-horoscope-reading-v5' },
  ])('recognizes the actual build $metadata.appVersion/$metadata.versionCode', ({ metadata, expected }) => {
    expect(signSchemaForNativeBuild(metadata)).toBe(expected);
  });

  it('serves the unmodified 1.0.5 request using its existing login metadata', async () => {
    query.mockResolvedValue({ rows: [{ payload: { appVersion: '1.0.5', versionCode: 8 } }] });
    expect(await resolveSignHoroscopeRequestVersion(req, undefined)).toBe('sign-horoscope-reading-v5');
    expect(query.mock.calls[0][1]).toEqual(['-1', 'native_sign_reader', 'phone-five', 'native-sign-reader-v1', 'auth:phone-five']);
  });

  it('keeps two authenticated devices on one account on their own formats', async () => {
    query.mockImplementation((_sql, params) => Promise.resolve({ rows: [{ payload: {
      schemaVersion: params[2] === 'phone-five' ? 'sign-horoscope-reading-v5' : 'sign-horoscope-reading-v4',
    } }] }));
    expect(await resolveSignHoroscopeRequestVersion(req, undefined, auth)).toBe('sign-horoscope-reading-v5');
    expect(await resolveSignHoroscopeRequestVersion(req, undefined, { ...auth, sessionId: 'phone-four' })).toBe('sign-horoscope-reading-v4');
  });

  it('refreshes the same session format after an APK update, even when ops notifications are disabled', async () => {
    const updated = { headers: { ...req.headers, 'x-nebo-client': encodeURIComponent(JSON.stringify({
      appVersion: '1.0.5', versionCode: 8, runtime: 'native',
    })) } } as NextApiRequest;
    await rememberNativeSignReader(updated, auth);
    expect(query.mock.calls[0][1]).toEqual(['-1', 'native_sign_reader', 'phone-five', 'native-sign-reader-v1', JSON.stringify({ schemaVersion: 'sign-horoscope-reading-v5' })]);
    expect(query.mock.calls[0][0]).toContain('ON CONFLICT');
  });

  it.each([
    ['personal-forecast-feed-v29-period-horoscope', 'sign-horoscope-reading-v4'],
    ['personal-forecast-feed-v33-direct-prose', 'sign-horoscope-reading-v5'],
    ['personal-forecast-feed-v34-direct-prose', 'sign-horoscope-reading-v5'],
  ])('learns the installed reader from the existing forecast contract %s', async (contract, schemaVersion) => {
    await rememberNativeSignReader(req, auth, contract);
    expect(query.mock.calls[0][1][4]).toBe(JSON.stringify({ schemaVersion }));
  });

  it('keeps anonymous old requests public and does not look up an account', async () => {
    expect(await resolveSignHoroscopeRequestVersion({ headers: { 'user-agent': ua } } as NextApiRequest, undefined)).toBe('sign-horoscope-reading-v4');
    expect(requireAppUser).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });

  it('honors explicit format requests without session storage', async () => {
    expect(await resolveSignHoroscopeRequestVersion(req, 'sign-horoscope-reading-v5')).toBe('sign-horoscope-reading-v5');
    expect(await resolveSignHoroscopeRequestVersion(req, ['sign-horoscope-reading-v5'])).toBeNull();
    expect(query).not.toHaveBeenCalled();
  });

  it('does not cache native format for a web session', async () => {
    await rememberNativeSignReader(req, { ...auth, provider: 'web_guest' }, 'personal-forecast-feed-v34-direct-prose');
    expect(query).not.toHaveBeenCalled();
  });
});
