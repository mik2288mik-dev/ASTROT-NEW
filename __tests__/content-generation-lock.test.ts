import fs from 'fs';
import path from 'path';
import {
  buildContentGenerationLockKey,
  withContentGenerationLock,
} from '../lib/contentGenerationLock';

const ROOT = path.resolve(__dirname, '..');

jest.mock('../lib/serverLocks', () => ({
  tryAcquireLock: jest.fn(),
  releaseLock: jest.fn(),
}));
jest.mock('../lib/database-url', () => ({
  hasDatabaseUrl: jest.fn(() => false),
}));
jest.mock('../lib/db', () => ({
  getPool: jest.fn(),
}));

import { tryAcquireLock, releaseLock } from '../lib/serverLocks';
import { hasDatabaseUrl } from '../lib/database-url';
import { getPool } from '../lib/db';

const mockedTryAcquireLock = tryAcquireLock as jest.MockedFunction<typeof tryAcquireLock>;
const mockedReleaseLock = releaseLock as jest.MockedFunction<typeof releaseLock>;
const mockedHasDatabaseUrl = hasDatabaseUrl as jest.MockedFunction<typeof hasDatabaseUrl>;
const mockedGetPool = getPool as jest.MockedFunction<typeof getPool>;

function readApiSource(rel: string) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

describe('content generation lock', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockedHasDatabaseUrl.mockReturnValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('duplicate content generation lock key is stable', () => {
    const input = {
      userId: 'user-1',
      chartId: 42,
      accessTier: 'premium' as const,
      contentSurface: 'forecast' as const,
      contentVariant: 'morning' as const,
      cacheKey: '2026-05-29:morning',
      promptVersion: 'v4',
    };

    const first = buildContentGenerationLockKey(input);
    const second = buildContentGenerationLockKey(input);

    expect(first).toBe(second);
    expect(first).toBe(
      'content-generation:42:premium:forecast:morning:2026-05-29:morning:v4'
    );
  });

  it('uses userId scope when chartId is missing', () => {
    const key = buildContentGenerationLockKey({
      userId: 'user-1',
      chartId: null,
      accessTier: 'free',
      contentSurface: 'forecast',
      contentVariant: 'daily',
      cacheKey: '2026-05-29',
    });

    expect(key).toBe('content-generation:user-1:free:forecast:daily:2026-05-29:default');
  });

  it('POST generation path checks cache again after acquiring lock', async () => {
    mockedTryAcquireLock.mockReturnValue(true);

    const readCached = jest.fn().mockResolvedValue({ value: { id: 9 }, source: 'content_v1' });
    const generate = jest.fn();

    const result = await withContentGenerationLock({
      lockKey: 'content-generation:1:free:forecast:daily:2026-05-29:default',
      operation: 'test',
      readCached,
      generate,
    });

    expect(readCached).toHaveBeenCalledTimes(1);
    expect(generate).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: 'ready',
      value: { id: 9 },
      fromCache: true,
      source: 'content_v1',
    });
    expect(mockedReleaseLock).toHaveBeenCalledWith(
      'content-generation:1:free:forecast:daily:2026-05-29:default'
    );
  });

  it('waits and returns cached content when lock is busy', async () => {
    mockedTryAcquireLock.mockReturnValue(false);

    const readCached = jest.fn().mockResolvedValue({ value: { id: 3 }, source: 'content_v1' });
    const generate = jest.fn();

    const resultPromise = withContentGenerationLock({
      lockKey: 'content-generation:1:free:forecast:daily:2026-05-29:default',
      operation: 'test',
      readCached,
      generate,
      waitMs: 100,
    });

    await jest.advanceTimersByTimeAsync(100);
    const result = await resultPromise;

    expect(readCached).toHaveBeenCalledTimes(1);
    expect(generate).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: 'ready',
      value: { id: 3 },
      fromCache: true,
      source: 'content_v1',
    });
    expect(mockedReleaseLock).not.toHaveBeenCalled();
  });

  it('returns in progress when lock is busy and cache is still empty', async () => {
    mockedTryAcquireLock.mockReturnValue(false);

    const readCached = jest.fn().mockResolvedValue(null);
    const generate = jest.fn();

    const resultPromise = withContentGenerationLock({
      lockKey: 'content-generation:1:free:forecast:daily:2026-05-29:default',
      operation: 'test',
      readCached,
      generate,
      waitMs: 200,
    });

    await jest.advanceTimersByTimeAsync(200);
    const result = await resultPromise;

    expect(result).toEqual({ status: 'in_progress', retryAfterMs: 200 });
    expect(generate).not.toHaveBeenCalled();
  });

  describe('content generation paths use content generation lock', () => {
    it('personal forecast cache locks generation and rechecks its canonical cache', () => {
      const source = readApiSource('lib/personalForecastCache.ts');
      expect(source).toContain('withContentGenerationLock');
      expect(source).toContain('buildContentGenerationLockKey');
      expect(source).toContain('readCached:');
      expect(source).toContain('getCachedPersonalForecast');
    });

    it('natal full route locks generation and rechecks content cache', () => {
      const source = readApiSource('pages/api/content/natal/full.ts');
      expect(source).toContain('withContentGenerationLock');
      expect(source).toContain('buildContentGenerationLockKey');
      expect(source).toContain('readCached:');
      expect(source).toContain('getContentLayer');
      expect(source).toContain('generationInProgressPayload');
    });
  });

  it('holds a PostgreSQL advisory lock across generation when a database is configured', async () => {
    mockedTryAcquireLock.mockReturnValue(true);
    mockedHasDatabaseUrl.mockReturnValue(true);
    const query = jest.fn()
      .mockResolvedValueOnce({ rows: [{ acquired: true }] })
      .mockResolvedValueOnce({ rows: [{ pg_advisory_unlock: true }] });
    const release = jest.fn();
    mockedGetPool.mockReturnValue({
      connect: jest.fn().mockResolvedValue({ query, release }),
    } as any);
    const generate = jest.fn().mockResolvedValue({ id: 10 });

    await expect(withContentGenerationLock({
      lockKey: 'content-generation:distributed',
      operation: 'test',
      readCached: jest.fn().mockResolvedValue(null),
      generate,
    })).resolves.toMatchObject({
      status: 'ready',
      value: { id: 10 },
      fromCache: false,
    });

    expect(query).toHaveBeenNthCalledWith(
      1,
      'SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS acquired',
      ['content-generation:distributed'],
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      'SELECT pg_advisory_unlock(hashtextextended($1, 0))',
      ['content-generation:distributed'],
    );
    expect(release).toHaveBeenCalledTimes(1);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('can keep a forecast calculation available when the distributed lock is offline', async () => {
    mockedTryAcquireLock.mockReturnValue(true);
    mockedHasDatabaseUrl.mockReturnValue(true);
    mockedGetPool.mockReturnValue({
      connect: jest.fn().mockRejectedValue(new Error('database offline')),
    } as any);
    const generate = jest.fn().mockResolvedValue({ id: 11 });
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      await expect(withContentGenerationLock({
        lockKey: 'content-generation:forecast-fallback',
        operation: 'personal-forecast-feed-v4-day',
        readCached: jest.fn().mockResolvedValue(null),
        generate,
        allowLocalLockFallback: true,
      })).resolves.toMatchObject({
        status: 'ready',
        value: { id: 11 },
        fromCache: false,
      });
    } finally {
      consoleError.mockRestore();
    }

    expect(generate).toHaveBeenCalledTimes(1);
  });
});
