jest.mock('../lib/errorLogger', () => ({ recordTechnicalError: jest.fn(async () => undefined) }));

import type { NextApiRequest, NextApiResponse } from 'next';
import { recordTechnicalError } from '../lib/errorLogger';
import { withRequestTelemetry } from '../lib/requestTelemetry';
import clientError from '../pages/api/app/client-error';

const recorded = recordTechnicalError as jest.Mock;

function request(query: Record<string, string>, userAgent: string, method = 'GET', body?: unknown): NextApiRequest {
  return { method, query, body, headers: { 'user-agent': userAgent } } as unknown as NextApiRequest;
}

function response() {
  const res: any = { statusCode: 200, headersSent: false };
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.json = (body: unknown) => { res.body = body; return res; };
  res.send = res.json;
  res.end = () => res;
  return res as NextApiResponse & { body?: any };
}

describe('request telemetry', () => {
  beforeEach(() => recorded.mockClear());

  it('records a not-ready sign horoscope with the exact period and the APK device', async () => {
    const handler = withRequestTelemetry('/api/content/horoscope/sign-weekly', async (_req, res) => {
      res.status(404).json({ error: 'NOT_FOUND', code: 'SIGN_WEEKLY_NOT_READY' });
    });
    await handler(request({ sign: 'libra', periodKey: '2026-W40' }, 'Dalvik/2.1.0 (Linux; U; Android 14; SM-S918B Build/UP1A)'), response());
    expect(recorded).toHaveBeenCalledWith(expect.objectContaining({
      endpoint: '/api/content/horoscope/sign-weekly',
      httpStatus: 404,
      errorCode: 'SIGN_WEEKLY_NOT_READY',
      platform: 'android-apk',
      message: expect.stringContaining('periodKey=2026-W40'),
    }));
    expect(recorded.mock.calls[0][0].message).toContain('SM-S918B');
  });

  it('records stale answers, skips normal ones and premium gates', async () => {
    const ok = withRequestTelemetry('/x', async (_req, res) => { res.status(200).json({ reading: {}, stale: false }); });
    const gate = withRequestTelemetry('/x', async (_req, res) => { res.status(403).json({ code: 'PREMIUM_REQUIRED' }); });
    const stale = withRequestTelemetry('/y', async (_req, res) => {
      res.status(200).json({ reading: { periodKey: '2026-09' }, stale: true });
    });
    await ok(request({}, 'web-a'), response());
    await gate(request({}, 'web-a'), response());
    await stale(request({ periodKey: '2026-10' }, 'web-b'), response());
    expect(recorded).toHaveBeenCalledTimes(1);
    expect(recorded.mock.calls[0][0]).toMatchObject({ errorCode: 'SERVED_STALE' });
  });

  it('turns a thrown handler into a recorded 500', async () => {
    const res = response();
    await withRequestTelemetry('/z', async () => { throw new Error('db down'); })(request({}, 'web-c'), res);
    expect(res.statusCode).toBe(500);
    expect(recorded.mock.calls[0][0]).toMatchObject({ errorCode: 'UNHANDLED', httpStatus: 500 });
  });

  it('accepts sanitized client reports and rejects junk', () => {
    const ok = response();
    clientError(request({}, 'web-d', 'POST', { feature: 'sign-horoscope', code: 'SIGN_WEEKLY_NOT_READY', status: 404, detail: 'week 2026-W40 <script>' }), ok);
    expect(ok.statusCode).toBe(204);
    expect(recorded.mock.calls[0][0]).toMatchObject({ endpoint: 'client:sign-horoscope', httpStatus: 404 });
    expect(recorded.mock.calls[0][0].message).not.toContain('<');
    const bad = response();
    clientError(request({}, 'web-d', 'POST', { feature: '../x', code: 'A' }), bad);
    expect(bad.statusCode).toBe(400);
  });
});
