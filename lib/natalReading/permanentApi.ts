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
import { generatePermanentNatalPremiumReport } from './permanentGeneration';
import {
  buildPermanentNatalCacheKey,
  buildPermanentNatalInputHash,
  NATAL_PERMANENT_PREMIUM_CACHE_KEY,
  NATAL_PERMANENT_PREMIUM_PROMPT_VERSION,
  type NatalPermanentPremiumReport,
} from './permanentReport';

export function permanentPremiumCacheOptions(
  ctx: ReadingContext,
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
    }),
    promptVersion: NATAL_PERMANENT_PREMIUM_PROMPT_VERSION,
    modelTier: 'premium',
    isPersistent: true,
  };
}

export async function getCachedPermanentPremiumReport(
  ctx: ReadingContext,
): Promise<ContentInterpretation<NatalPermanentPremiumReport> | null> {
  return getCachedReading<NatalPermanentPremiumReport>(
    ctx,
    permanentPremiumCacheOptions(ctx),
  );
}

export async function generatePermanentPremiumWithLock(input: {
  userId: string;
  ctx: ReadingContext;
}) {
  const cacheOptions = permanentPremiumCacheOptions(input.ctx);
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
