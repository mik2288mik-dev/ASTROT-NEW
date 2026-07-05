import type { NextApiRequest, NextApiResponse } from 'next';
import type { ContentAccessTier, InterpretationSection } from '../../../../types';
import { getPremiumEntitlementState } from '../../../../lib/contentArchitecture';
import { getMoscowTodayKey } from '../../../../lib/date-utils';
import {
  ensureValidContext,
  getCachedReading,
  saveReading,
} from '../../../../lib/natalReading/apiHelper';
import {
  buildHumanInputHash,
  buildHumanDailyFallback,
  generateHumanDailySection,
} from '../../../../lib/natalHumanInterpretation';
import {
  HUMAN_DAILY_PROMPT_VERSION,
  humanDailyCacheKey,
  isHumanDailySectionKey,
  type HumanDailySectionKey,
} from '../../../../lib/natalHumanShared';
import { logContentApi, warnContentApi } from '../../../../lib/contentApiLogging';
import {
  buildContentGenerationLockKey,
  generationInProgressPayload,
  withContentGenerationLock,
} from '../../../../lib/contentGenerationLock';

export const config = { maxDuration: 90 };

const SCOPE = 'natal-human-daily';

type ResolvedDailyAccess = {
  accessTier: Extract<ContentAccessTier, 'premium'>;
};

type DailyResponseSource = 'human_v2' | 'generated' | 'fallback' | 'fallback_unsaved';
type DailyPersistenceStatus = 'saved' | 'failed';
type DailySaveOptions = {
  accessTier: ContentAccessTier;
  contentVariant: 'living';
  cacheKey: string;
  inputHash?: string;
  promptVersion: string;
  modelTier?: 'base' | 'premium';
  isPersistent?: boolean;
  validFrom?: Date | null;
  validTo?: Date | null;
};

function isUsableDailySectionContent(value: unknown): value is InterpretationSection {
  if (!value || typeof value !== 'object') return false;
  const section = value as Partial<InterpretationSection>;
  return typeof section.content === 'string' && section.content.trim().length > 0;
}

function buildUnsavedReading(
  ctx: NonNullable<Awaited<ReturnType<typeof ensureValidContext>>>['ctx'],
  opts: DailySaveOptions,
  content: InterpretationSection
) {
  return {
    id: 0,
    userId: String(ctx.profile.id),
    chartId: ctx.chartId,
    accessTier: opts.accessTier,
    contentSurface: 'natal' as const,
    contentVariant: opts.contentVariant,
    modelTier: opts.modelTier ?? (opts.accessTier === 'free' ? 'base' : 'premium'),
    cacheKey: opts.cacheKey,
    inputHash: opts.inputHash ?? opts.cacheKey,
    content,
    promptVersion: opts.promptVersion,
    calculationVersion: ctx.chartData?.calculationVersion || null,
    validFrom: opts.validFrom ? new Date(opts.validFrom).toISOString() : null,
    validTo: opts.validTo ? new Date(opts.validTo).toISOString() : null,
    isPersistent: opts.isPersistent ?? false,
    canRegenerateForLumi: false,
    regenerationCostLumi: null,
    legacySource: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function readSectionKey(req: NextApiRequest): HumanDailySectionKey | null {
  const raw = (req.method === 'GET' ? req.query.sectionKey : req.body?.sectionKey) as string | undefined;
  const value = String(raw || '').trim();
  return isHumanDailySectionKey(value) ? value : null;
}

function readDateKey(req: NextApiRequest): string {
  const raw = (req.method === 'GET' ? req.query.date : req.body?.date) as string | undefined;
  const value = String(raw || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : getMoscowTodayKey();
}

function getMoscowDayWindow(dateKey: string) {
  const [yearRaw, monthRaw, dayRaw] = dateKey.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return { validFrom: null, validTo: null };
  }
  return {
    validFrom: new Date(Date.UTC(year, month - 1, day, -3, 0, 0, 0)),
    validTo: new Date(Date.UTC(year, month - 1, day + 1, -3, 0, 0, 0)),
  };
}

async function resolveDailyAccess(userId: string, _profile?: { isPremium?: boolean }): Promise<ResolvedDailyAccess | null> {
  const entitlement = await getPremiumEntitlementState(userId);
  if (entitlement.isPremium) {
    return { accessTier: 'premium' };
  }
  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const startedAt = Date.now();
  const ready = await ensureValidContext(req, res);
  if (!ready) return;
  const { userId, ctx } = ready;
  const sectionKey = readSectionKey(req);
  const dateKey = readDateKey(req);

  logContentApi(
    {
      scope: SCOPE,
      userId,
      chartId: ctx.chartId,
      surface: 'natal',
      variant: 'living',
    },
    'request_start',
    { metadata: { sectionKey, dateKey, method: req.method } }
  );

  if (!sectionKey) {
    return res.status(400).json({
      error: 'BAD_REQUEST',
      message: 'sectionKey must be a daily human interpretation section key',
    });
  }

  const cacheKey = humanDailyCacheKey(dateKey, sectionKey);
  const inputHash = buildHumanInputHash({
    profile: ctx.profile,
    chartData: ctx.chartData!,
    sectionKey,
    dateKey,
    promptVersion: HUMAN_DAILY_PROMPT_VERSION,
  });
  const window = getMoscowDayWindow(dateKey);
  const access = await resolveDailyAccess(userId, ctx.profile);
  const isFreeOverview = sectionKey === 'daily_overview';

  logContentApi(
    {
      scope: SCOPE,
      userId,
      chartId: ctx.chartId,
      surface: 'natal',
      variant: 'living',
    },
    'access_check',
    {
      accessTier: isFreeOverview ? 'free' : (access?.accessTier ?? 'locked'),
      metadata: { sectionKey, dateKey, isFreeOverview },
    }
  );

  if (!access && !isFreeOverview) {
    warnContentApi(
      {
        scope: SCOPE,
        userId,
        chartId: ctx.chartId,
        surface: 'natal',
        variant: 'living',
      },
      'premium_required',
      { errorCode: 'PREMIUM_REQUIRED', metadata: { sectionKey } }
    );
    return res.status(403).json({
      error: 'Premium required',
      code: 'PREMIUM_REQUIRED',
      premiumRequired: true,
      message: 'Персональный разбор дня доступен в Premium.',
    });
  }

  const cacheAccessTier: ContentAccessTier = isFreeOverview ? 'free' : access!.accessTier;
  const responseAccessTier: ContentAccessTier = isFreeOverview ? 'free' : access!.accessTier;

  const cacheOpts = {
    accessTier: cacheAccessTier,
    contentVariant: 'living' as const,
    cacheKey,
    promptVersion: HUMAN_DAILY_PROMPT_VERSION,
    isPersistent: false,
    validFrom: window.validFrom,
    validTo: window.validTo,
  };
  const saveOpts = { ...cacheOpts, inputHash };
  const apiLogContext = {
    scope: SCOPE,
    userId,
    chartId: ctx.chartId,
    surface: 'natal' as const,
    variant: 'living' as const,
  };

  let rawCached: Awaited<ReturnType<typeof getCachedReading<InterpretationSection>>> | null = null;
  let cacheReadFailed = false;
  try {
    rawCached = await getCachedReading<InterpretationSection>(ctx, cacheOpts);
  } catch (error: any) {
    cacheReadFailed = true;
    warnContentApi(apiLogContext, 'cache_read_failed', {
      accessTier: responseAccessTier,
      errorCode: 'CACHE_READ_FAILED',
      metadata: { sectionKey, dateKey, error: error?.message || String(error) },
    });
  }
  const cached = rawCached && isUsableDailySectionContent(rawCached.content) ? rawCached : null;
  if (rawCached && !cached) {
    warnContentApi(apiLogContext, 'invalid_cached_row', {
      accessTier: responseAccessTier,
      errorCode: 'EMPTY_INTERPRETATION',
      metadata: { sectionKey, dateKey, cacheKey },
    });
  } else if (!cached && !cacheReadFailed) {
    logContentApi(apiLogContext, 'cache_miss', {
      accessTier: responseAccessTier,
      metadata: { sectionKey, dateKey, cacheKey },
    });
  }

  if (cacheReadFailed) {
    const fallback = buildHumanDailyFallback(ctx.profile, ctx.chartData!, sectionKey, dateKey);
    warnContentApi(apiLogContext, 'persistence_failed', {
      accessTier: responseAccessTier,
      status: 'ready',
      errorCode: 'CACHE_READ_FAILED',
      durationMs: Date.now() - startedAt,
      metadata: { sectionKey, dateKey, source: 'fallback_unsaved' },
    });
    return res.status(200).json({
      interpretation: buildUnsavedReading(ctx, saveOpts, fallback),
      source: 'fallback_unsaved' satisfies DailyResponseSource,
      persistenceStatus: 'failed' satisfies DailyPersistenceStatus,
      accessTier: responseAccessTier,
    });
  }

  if (req.method === 'GET') {
    if (!cached) {
      return res.status(404).json({ error: 'NOT_FOUND', code: 'HUMAN_DAILY_NOT_READY' });
    }
    logContentApi(
      apiLogContext,
      'cache_hit',
      {
        accessTier: responseAccessTier,
        status: 'ready',
        durationMs: Date.now() - startedAt,
        metadata: { sectionKey, dateKey },
      }
    );
    return res.status(200).json({
      interpretation: cached,
      source: 'human_v2',
      persistenceStatus: 'saved' satisfies DailyPersistenceStatus,
      accessTier: responseAccessTier,
    });
  }

  if (cached) {
    logContentApi(apiLogContext, 'cache_hit', {
      accessTier: responseAccessTier,
      status: 'ready',
      durationMs: Date.now() - startedAt,
      metadata: { sectionKey, dateKey, method: req.method },
    });
    return res.status(200).json({
      interpretation: cached,
      source: 'human_v2',
      persistenceStatus: 'saved' satisfies DailyPersistenceStatus,
      accessTier: responseAccessTier,
    });
  }

  try {
    let generatedSource: DailyResponseSource = 'generated';
    let generatedPersistenceStatus: DailyPersistenceStatus = 'saved';
    let lockCacheReadFailed = false;
    const lockResult = await withContentGenerationLock({
      lockKey: buildContentGenerationLockKey({
        userId,
        chartId: ctx.chartId,
        accessTier: cacheAccessTier,
        contentSurface: 'natal',
        contentVariant: 'living',
        cacheKey,
        promptVersion: HUMAN_DAILY_PROMPT_VERSION,
      }),
      operation: `human-daily-${sectionKey}`,
      readCached: async () => {
        let again: Awaited<ReturnType<typeof getCachedReading<InterpretationSection>>> | null = null;
        try {
          again = await getCachedReading<InterpretationSection>(ctx, cacheOpts);
        } catch (error: any) {
          lockCacheReadFailed = true;
          warnContentApi(apiLogContext, 'cache_read_failed', {
            accessTier: responseAccessTier,
            errorCode: 'CACHE_READ_FAILED',
            metadata: { sectionKey, dateKey, phase: 'inside_lock', error: error?.message || String(error) },
          });
          return null;
        }
        if (again && !isUsableDailySectionContent(again.content)) {
          warnContentApi(apiLogContext, 'invalid_cached_row', {
            accessTier: responseAccessTier,
            errorCode: 'EMPTY_INTERPRETATION',
            metadata: { sectionKey, dateKey, phase: 'inside_lock' },
          });
        }
        return again && isUsableDailySectionContent(again.content)
          ? { value: again, source: 'human_v2' }
          : null;
      },
      generate: async () => {
        const fallback = buildHumanDailyFallback(ctx.profile, ctx.chartData!, sectionKey, dateKey);
        if (!isUsableDailySectionContent(fallback)) {
          throw new Error('EMPTY_HUMAN_DAILY_FALLBACK');
        }

        if (lockCacheReadFailed) {
          generatedSource = 'fallback_unsaved';
          generatedPersistenceStatus = 'failed';
          warnContentApi(apiLogContext, 'persistence_failed', {
            accessTier: responseAccessTier,
            status: 'ready',
            errorCode: 'CACHE_READ_FAILED_INSIDE_LOCK',
            durationMs: Date.now() - startedAt,
            metadata: { sectionKey, dateKey, source: 'fallback_unsaved' },
          });
          return buildUnsavedReading(ctx, saveOpts, fallback) as Awaited<ReturnType<typeof saveReading<InterpretationSection>>>;
        }

        let savedFallback: Awaited<ReturnType<typeof saveReading<InterpretationSection>>>;
        try {
          savedFallback = await saveReading(ctx, saveOpts, fallback);
          generatedSource = 'fallback';
          generatedPersistenceStatus = 'saved';
          logContentApi(apiLogContext, 'fallback_saved', {
            accessTier: responseAccessTier,
            status: 'ready',
            durationMs: Date.now() - startedAt,
            metadata: { sectionKey, dateKey },
          });
        } catch (fallbackError: any) {
          generatedSource = 'fallback_unsaved';
          generatedPersistenceStatus = 'failed';
          warnContentApi(apiLogContext, 'persistence_failed', {
            accessTier: responseAccessTier,
            status: 'ready',
            errorCode: 'FALLBACK_SAVE_FAILED',
            durationMs: Date.now() - startedAt,
            metadata: { sectionKey, dateKey, error: fallbackError?.message || String(fallbackError) },
          });
          return buildUnsavedReading(ctx, saveOpts, fallback) as Awaited<ReturnType<typeof saveReading<InterpretationSection>>>;
        }

        try {
          const section = await generateHumanDailySection(ctx.profile, ctx.chartData!, sectionKey, dateKey);
          if (!isUsableDailySectionContent(section)) {
            throw new Error('EMPTY_HUMAN_DAILY_SECTION');
          }
          const savedGenerated = await saveReading(ctx, saveOpts, section);
          generatedSource = 'generated';
          generatedPersistenceStatus = 'saved';
          logContentApi(apiLogContext, 'generation_saved', {
            accessTier: responseAccessTier,
            status: 'ready',
            durationMs: Date.now() - startedAt,
            metadata: { sectionKey, dateKey },
          });
          return savedGenerated;
        } catch (generationError: any) {
          generatedSource = 'fallback';
          generatedPersistenceStatus = 'saved';
          warnContentApi(apiLogContext, 'generation_failed', {
            accessTier: responseAccessTier,
            status: 'ready',
            errorCode: generationError?.code || generationError?.message || 'CONTENT_GENERATION_UNAVAILABLE',
            durationMs: Date.now() - startedAt,
            metadata: { sectionKey, dateKey },
          });
          console.error(
            `[natal/human-daily:${sectionKey}] generation failed after fallback save:`,
            generationError instanceof Error ? generationError.message : generationError
          );
          return savedFallback;
        }
      },
    });

    if (lockResult.status === 'in_progress') {
      return res.status(202).json(generationInProgressPayload(lockResult.retryAfterMs));
    }

    return res.status(200).json({
      interpretation: lockResult.value,
      source: lockResult.fromCache ? (lockResult.source || 'human_v2') : generatedSource,
      persistenceStatus: lockResult.fromCache ? 'saved' : generatedPersistenceStatus,
      accessTier: responseAccessTier,
    });
  } catch (error) {
    warnContentApi(apiLogContext, 'generation_failed', {
      accessTier: responseAccessTier,
      errorCode: 'CONTENT_GENERATION_UNAVAILABLE',
      durationMs: Date.now() - startedAt,
      metadata: { sectionKey, dateKey },
    });
    console.error(`[natal/human-daily:${sectionKey}] generation failed:`, error instanceof Error ? error.message : error);
    const fallback = buildHumanDailyFallback(ctx.profile, ctx.chartData!, sectionKey, dateKey);
    warnContentApi(apiLogContext, 'persistence_failed', {
      accessTier: responseAccessTier,
      status: 'ready',
      errorCode: 'LOCK_OR_FALLBACK_FLOW_FAILED',
      durationMs: Date.now() - startedAt,
      metadata: { sectionKey, dateKey, source: 'fallback_unsaved' },
    });
    return res.status(200).json({
      interpretation: buildUnsavedReading(ctx, saveOpts, fallback),
      source: 'fallback_unsaved' satisfies DailyResponseSource,
      persistenceStatus: 'failed' satisfies DailyPersistenceStatus,
      accessTier: responseAccessTier,
    });
  }
}
