import { NextRequest } from 'next/server';
import { middleware } from '../middleware';

const mutableEnv = process.env as Record<string, string | undefined>;

describe('external cron runtime mode', () => {
  const previousCronSecret = process.env.CRON_SECRET;
  const previousPublicSite = process.env.NEXT_PUBLIC_MEOU_PUBLIC_SITE;

  afterEach(() => {
    if (previousCronSecret === undefined) delete mutableEnv.CRON_SECRET;
    else mutableEnv.CRON_SECRET = previousCronSecret;
    if (previousPublicSite === undefined) delete mutableEnv.NEXT_PUBLIC_MEOU_PUBLIC_SITE;
    else mutableEnv.NEXT_PUBLIC_MEOU_PUBLIC_SITE = previousPublicSite;
  });

  it('refuses a configured weak secret before any external cron handler runs', () => {
    mutableEnv.NEXT_PUBLIC_MEOU_PUBLIC_SITE = '0';
    mutableEnv.CRON_SECRET = 'stale-short-secret';

    const response = middleware(new NextRequest('https://api.example.ru/api/cron/tick'));

    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('lets a strong external-cron secret reach the route-level authorization', () => {
    mutableEnv.NEXT_PUBLIC_MEOU_PUBLIC_SITE = '0';
    mutableEnv.CRON_SECRET = 'c'.repeat(32);

    const response = middleware(new NextRequest('https://api.example.ru/api/cron/tick'));

    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  it('measures UTF-8 bytes and leaves non-cron healthchecks untouched', () => {
    mutableEnv.NEXT_PUBLIC_MEOU_PUBLIC_SITE = '0';
    mutableEnv.CRON_SECRET = 'я'.repeat(16);

    const cronResponse = middleware(new NextRequest('https://api.example.ru/api/cron/tick'));
    const healthResponse = middleware(new NextRequest('https://api.example.ru/api/health'));

    expect(cronResponse.status).toBe(200);
    expect(cronResponse.headers.get('x-middleware-next')).toBe('1');
    expect(healthResponse.status).toBe(200);
    expect(healthResponse.headers.get('x-middleware-next')).toBe('1');
  });
});
