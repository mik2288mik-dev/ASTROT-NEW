import type { ContentAccessTier, ContentSurface, ContentVariant } from '../types';
import { releaseLock, tryAcquireLock } from './serverLocks';

export const CONTENT_GENERATION_RETRY_AFTER_MS = 1500;

export type ContentGenerationLockKeyInput = {
  userId: string;
  chartId?: number | null;
  accessTier: ContentAccessTier;
  contentSurface: ContentSurface;
  contentVariant: ContentVariant;
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

export async function withContentGenerationLock<T>(options: {
  lockKey: string;
  operation: string;
  readCached: () => Promise<CachedContentLayer<T> | null>;
  generate: () => Promise<T>;
  waitMs?: number;
}): Promise<ContentGenerationLockResult<T>> {
  const waitMs = options.waitMs ?? CONTENT_GENERATION_RETRY_AFTER_MS;

  if (!tryAcquireLock(options.lockKey, options.operation)) {
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

  try {
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
    releaseLock(options.lockKey);
  }
}
