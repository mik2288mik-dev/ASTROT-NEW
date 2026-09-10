import type { ContentAccessTier, ContentSurface, ContentVariant } from '../types';
import { hasDatabaseUrl } from './database-url';
import { releaseLock, tryAcquireLock } from './serverLocks';

export const CONTENT_GENERATION_RETRY_AFTER_MS = 1500;

export type ContentGenerationVariant = ContentVariant;

export type ContentGenerationLockKeyInput = {
  userId: string;
  chartId?: number | null;
  accessTier: ContentAccessTier;
  contentSurface: ContentSurface;
  contentVariant: ContentGenerationVariant;
  cacheKey: string;
  promptVersion?: string | null;
};

export function buildContentGenerationLockKey(input: ContentGenerationLockKeyInput): string {
  const scopeId = input.chartId != null ? String(input.chartId) : String(input.userId).trim();
  const promptVersion = String(input.promptVersion || 'default').trim() || 'default';
  return `content-generation:${scopeId}:${input.accessTier}:${input.contentSurface}:${input.contentVariant}:${input.cacheKey}:${promptVersion}`;
}

export type CachedContentLayer<T> = {
  value: T;
  source?: string;
};

export type ContentGenerationLockResult<T> =
  | { status: 'ready'; value: T; fromCache: boolean; source?: string }
  | { status: 'in_progress'; retryAfterMs: number };

export function generationInProgressPayload(retryAfterMs: number) {
  return {
    error: 'Generation in progress',
    code: 'GENERATION_IN_PROGRESS' as const,
    retryAfterMs,
  };
}

type DistributedLock = {
  acquired: boolean;
  release: () => Promise<void>;
};

async function tryAcquireDistributedLock(lockKey: string): Promise<DistributedLock> {
  if (!hasDatabaseUrl()) {
    return { acquired: true, release: async () => undefined };
  }

  const { getPool } = await import('./db');
  const client = await getPool().connect();
  let acquired = false;
  try {
    const result = await client.query<{ acquired: boolean }>(
      'SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS acquired',
      [lockKey],
    );
    acquired = result.rows[0]?.acquired === true;
    if (!acquired) client.release();
    return {
      acquired,
      release: async () => {
        if (!acquired) return;
        acquired = false;
        try {
          await client.query(
            'SELECT pg_advisory_unlock(hashtextextended($1, 0))',
            [lockKey],
          );
        } finally {
          client.release();
        }
      },
    };
  } catch (error) {
    client.release();
    throw error;
  }
}

export async function withContentGenerationLock<T>(options: {
  lockKey: string;
  operation: string;
  readCached: () => Promise<CachedContentLayer<T> | null>;
  generate: () => Promise<T>;
  waitMs?: number;
  allowLocalLockFallback?: boolean;
  onLockAcquired?: () => void;
  onLockBusy?: () => void;
}): Promise<ContentGenerationLockResult<T>> {
  const waitMs = options.waitMs ?? CONTENT_GENERATION_RETRY_AFTER_MS;

  if (!tryAcquireLock(options.lockKey, options.operation)) {
    options.onLockBusy?.();
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    const afterWait = await options.readCached();
    if (afterWait != null) {
      return {
        status: 'ready',
        value: afterWait.value,
        fromCache: true,
        source: afterWait.source,
      };
    }
    return { status: 'in_progress', retryAfterMs: waitMs };
  }

  let distributedLock: DistributedLock | null = null;
  try {
    try {
      distributedLock = await tryAcquireDistributedLock(options.lockKey);
    } catch (error) {
      if (!options.allowLocalLockFallback) throw error;
      console.error(
        `[${options.operation}] distributed generation lock unavailable; using process lock:`,
        error instanceof Error ? error.message : String(error),
      );
      distributedLock = { acquired: true, release: async () => undefined };
    }
    if (!distributedLock.acquired) {
      options.onLockBusy?.();
      releaseLock(options.lockKey);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      const afterWait = await options.readCached();
      if (afterWait != null) {
        return {
          status: 'ready',
          value: afterWait.value,
          fromCache: true,
          source: afterWait.source,
        };
      }
      return { status: 'in_progress', retryAfterMs: waitMs };
    }

    options.onLockAcquired?.();
    const insideLock = await options.readCached();
    if (insideLock != null) {
      return {
        status: 'ready',
        value: insideLock.value,
        fromCache: true,
        source: insideLock.source,
      };
    }

    const generated = await options.generate();
    return { status: 'ready', value: generated, fromCache: false };
  } finally {
    await distributedLock?.release();
    releaseLock(options.lockKey);
  }
}
