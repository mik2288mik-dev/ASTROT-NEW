import type { ContentInterpretation } from '../../types';
import {
  buildContentGenerationLockKey,
  withContentGenerationLock,
} from '../contentGenerationLock';
import {
  getCachedReading,
  saveReading,
  type CachedReadingOptions,
  type ReadingContext,
} from './apiHelper';
import {
  generatePermanentNatalFreeReport,
  generatePermanentNatalPremiumReport,
} from './permanentGeneration';
import {
  buildPermanentNatalCacheKey,
  buildPermanentNatalInputHash,
  isNatalPermanentFreeReport,
  NATAL_PERMANENT_FREE_CACHE_KEY,
  NATAL_PERMANENT_FREE_PROMPT_VERSION,
  NATAL_PERMANENT_PREMIUM_CACHE_KEY,
  NATAL_PERMANENT_PREMIUM_PROMPT_VERSION,
  type NatalPermanentFreeReport,
  type NatalPermanentPremiumReport,
} from './permanentReport';

export function permanentFreeCacheOptions(
  ctx: ReadingContext,
): CachedReadingOptions {
  const language = ctx.profile.language === 'en' ? 'en' : 'ru';
  return {
    accessTier: 'free',
    contentVariant: 'anchor',
    cacheKey: buildPermanentNatalCacheKey(NATAL_PERMANENT_FREE_CACHE_KEY, language),
    inputHash: buildPermanentNatalInputHash({
      profile: ctx.profile,
      chartData: ctx.chartData!,
      tier: 'free',
      promptVersion: NATAL_PERMANENT_FREE_PROMPT_VERSION,
    }),
    promptVersion: NATAL_PERMANENT_FREE_PROMPT_VERSION,
    isPersistent: true,
  };
}

export function permanentPremiumCacheOptions(
  ctx: ReadingContext,
  readerAnchor: NatalPermanentFreeReport,
): CachedReadingOptions {
  const language = ctx.profile.language === 'en' ? 'en' : 'ru';
  return {
    accessTier: 'premium',
    contentVariant: 'full',
    cacheKey: buildPermanentNatalCacheKey(NATAL_PERMANENT_PREMIUM_CACHE_KEY, language),
    inputHash: buildPermanentNatalInputHash({
      profile: ctx.profile,
      chartData: ctx.chartData!,
      tier: 'premium',
      promptVersion: NATAL_PERMANENT_PREMIUM_PROMPT_VERSION,
      readerAnchor,
    }),
    promptVersion: NATAL_PERMANENT_PREMIUM_PROMPT_VERSION,
    modelTier: 'premium',
    isPersistent: true,
  };
}

export async function getCachedPermanentFreeReport(
  ctx: ReadingContext,
): Promise<ContentInterpretation<NatalPermanentFreeReport> | null> {
  const cached = await getCachedReading<NatalPermanentFreeReport>(
    ctx,
    permanentFreeCacheOptions(ctx),
  );
  return cached && isNatalPermanentFreeReport(cached.content) ? cached : null;
}

export async function generatePermanentFreeWithLock(input: {
  userId: string;
  ctx: ReadingContext;
}) {
  const cacheOptions = permanentFreeCacheOptions(input.ctx);
  return withContentGenerationLock({
    lockKey: buildContentGenerationLockKey({
      userId: input.userId,
      chartId: input.ctx.chartId,
      accessTier: 'free',
      contentSurface: 'natal',
      contentVariant: 'anchor',
      cacheKey: cacheOptions.cacheKey,
      promptVersion: NATAL_PERMANENT_FREE_PROMPT_VERSION,
    }),
    operation: 'natal-human-base-generation',
    readCached: async () => {
      const cached = await getCachedPermanentFreeReport(input.ctx);
      return cached
        ? { value: cached, source: 'natal_permanent_free_v2' }
        : null;
    },
    generate: async () => {
      const report = await generatePermanentNatalFreeReport(
        input.ctx.profile,
        input.ctx.chartData!,
      );
      return saveReading(input.ctx, cacheOptions, report);
    },
  });
}

export async function waitForPermanentFreeReport(input: {
  ctx: ReadingContext;
  timeoutMs?: number;
}): Promise<NatalPermanentFreeReport | null> {
  const deadline = Date.now() + Math.max(500, Math.min(input.timeoutMs || 15_000, 30_000));
  let delayMs = 300;
  while (Date.now() < deadline) {
    const cached = await getCachedPermanentFreeReport(input.ctx);
    if (cached?.content) return cached.content;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    delayMs = Math.min(Math.round(delayMs * 1.4), 1500);
  }
  return null;
}

async function ensurePermanentFreeReaderAnchor(input: {
  userId: string;
  ctx: ReadingContext;
}): Promise<NatalPermanentFreeReport> {
  const cached = await getCachedPermanentFreeReport(input.ctx);
  if (cached?.content) return cached.content;
  const generated = await generatePermanentFreeWithLock(input);
  if (generated.status === 'ready') return generated.value.content;
  const waited = await waitForPermanentFreeReport({ ctx: input.ctx, timeoutMs: 30_000 });
  if (waited) return waited;
  throw new Error('NATAL_PERMANENT_FREE_ANCHOR_NOT_READY');
}

export async function getCachedPermanentPremiumReport(
  ctx: ReadingContext,
): Promise<ContentInterpretation<NatalPermanentPremiumReport> | null> {
  const readerAnchor = await getCachedPermanentFreeReport(ctx);
  if (!readerAnchor?.content) return null;
  return getCachedReading<NatalPermanentPremiumReport>(
    ctx,
    permanentPremiumCacheOptions(ctx, readerAnchor.content),
  );
}

export async function generatePermanentPremiumWithLock(input: {
  userId: string;
  ctx: ReadingContext;
}) {
  const readerAnchor = await ensurePermanentFreeReaderAnchor(input);
  const cacheOptions = permanentPremiumCacheOptions(input.ctx, readerAnchor);
  return withContentGenerationLock({
    lockKey: buildContentGenerationLockKey({
      userId: input.userId,
      chartId: input.ctx.chartId,
      accessTier: 'premium',
      contentSurface: 'natal',
      contentVariant: 'full',
      cacheKey: cacheOptions.cacheKey,
      promptVersion: NATAL_PERMANENT_PREMIUM_PROMPT_VERSION,
    }),
    operation: 'natal-permanent-premium-generation',
    readCached: async () => {
      const cached = await getCachedReading<NatalPermanentPremiumReport>(input.ctx, cacheOptions);
      return cached
        ? { value: cached, source: 'natal_permanent_premium_v2' }
        : null;
    },
    generate: async () => {
      const report = await generatePermanentNatalPremiumReport(
        input.ctx.profile,
        input.ctx.chartData!,
        readerAnchor,
      );
      return saveReading(input.ctx, cacheOptions, report);
    },
  });
}

export async function waitForPermanentPremiumReport(input: {
  ctx: ReadingContext;
  timeoutMs?: number;
}): Promise<NatalPermanentPremiumReport | null> {
  const deadline = Date.now() + Math.max(500, Math.min(input.timeoutMs || 15_000, 30_000));
  let delayMs = 300;
  while (Date.now() < deadline) {
    const cached = await getCachedPermanentPremiumReport(input.ctx);
    if (cached?.content) return cached.content;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    delayMs = Math.min(Math.round(delayMs * 1.4), 1500);
  }
  return null;
}
