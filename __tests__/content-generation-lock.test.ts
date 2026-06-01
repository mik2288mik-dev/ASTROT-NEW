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

import { tryAcquireLock, releaseLock } from '../lib/serverLocks';

const mockedTryAcquireLock = tryAcquireLock as jest.MockedFunction<typeof tryAcquireLock>;
const mockedReleaseLock = releaseLock as jest.MockedFunction<typeof releaseLock>;

function readApiSource(rel: string) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

describe('content generation lock', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
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

  describe('content POST generation routes use content generation lock', () => {
    const routes = [
      'pages/api/content/forecast/daily.ts',
      'pages/api/content/forecast/daypart.ts',
      'pages/api/content/natal/full.ts',
    ];

    it.each(routes)('%s uses withContentGenerationLock and rechecks cache inside lock', (rel) => {
      const source = readApiSource(rel);
      expect(source).toContain('withContentGenerationLock');
      expect(source).toContain('buildContentGenerationLockKey');
      expect(source).toContain('readCached:');
      expect(source).toContain('getContentLayer');
      expect(source).toContain('generationInProgressPayload');
    });
  });
});
