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
  getDailyVoiceVersion,
  generateDailyCanvas,
  sliceCanvasToSection,
  validateDailyCanvas,
} from '../../../../lib/natalHumanInterpretation';
import {
  DAILY_CANVAS_TOPIC_KEYS,
  DAILY_SECTION_TO_CANVAS_KEY,
  HUMAN_DAILY_PROMPT_VERSION,
  humanDailyCanvasCacheKey,
  isHumanDailySectionKey,
  isCanvasBackedDailySection,
  type DailyCanvas,
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

// Полотно кешируется под ЕДИНЫМ access_tier (это часть ключа кеша в БД), чтобы и
// free-overview, и премиум-сферы читали одну и ту же дневную запись.
const CANVAS_CACHE_TIER: ContentAccessTier = 'premium';

type DailyResponseSource = 'human_v2' | 'generated' | 'fallback';
type DailyPersistenceStatus = 'saved' | 'failed';

type SectionWrapperOptions = {
  accessTier: ContentAccessTier;
  cacheKey: string;
  inputHash?: string;
  promptVersion: string;
  validFrom?: Date | null;
  validTo?: Date | null;
};

function isUsableCanvas(value: unknown): value is DailyCanvas {
  if (!value || typeof value !== 'object') return false;
  const canvas = value as Partial<DailyCanvas>;
  const locale = canvas.meta?.locale === 'en' ? 'en' : 'ru';
  return validateDailyCanvas(value, locale).valid;
}

function isFreeSectionAllowed(canvas: DailyCanvas, sectionKey: HumanDailySectionKey): boolean {
  const canvasKey = DAILY_SECTION_TO_CANVAS_KEY[sectionKey];
  return canvasKey === 'overview' || canvasKey === canvas.meta.free_section_key;
}

function buildDailyPackagePayload(canvas: DailyCanvas, includePremiumBodies: boolean) {
  const payload: Record<string, unknown> = {
    hero_title: canvas.hero_title,
    hero_hook: canvas.hero_hook,
    overview: canvas.overview,
    meta: {
      free_section_key: canvas.meta.free_section_key,
      pattern_keys: canvas.meta.pattern_keys || {},
      locale: canvas.meta.locale || 'ru',
      voice_version: canvas.meta.voice_version || null,
      date_key: canvas.meta.date_key || null,
    },
  };

  for (const key of DAILY_CANVAS_TOPIC_KEYS) {
    const canIncludeBody = includePremiumBodies || key === canvas.meta.free_section_key;
    payload[key] = {
      hook: canvas[key].hook,
      body: canIncludeBody ? canvas[key].body : '',
    };
  }

  return payload;
}

// Обёртка секции в транспортный shell, который распаковывает клиент
// (natalReadingService.unwrapDailySectionPayload читает interpretation.content).
function buildSectionEnvelope(
  ctx: NonNullable<Awaited<ReturnType<typeof ensureValidContext>>>['ctx'],
  opts: SectionWrapperOptions,
  section: InterpretationSection,
) {
  return {
    id: 0,
    userId: String(ctx.profile.id),
    chartId: ctx.chartId,
    accessTier: opts.accessTier,
    contentSurface: 'natal' as const,
    contentVariant: 'living' as const,
    modelTier: (opts.accessTier === 'free' ? 'base' : 'premium') as 'base' | 'premium',
    cacheKey: opts.cacheKey,
    inputHash: opts.inputHash ?? opts.cacheKey,
    content: section,
    promptVersion: opts.promptVersion,
    calculationVersion: ctx.chartData?.calculationVersion || null,
    validFrom: opts.validFrom ? new Date(opts.validFrom).toISOString() : null,
    validTo: opts.validTo ? new Date(opts.validTo).toISOString() : null,
    isPersistent: false,
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

async function resolveIsPremium(userId: string): Promise<boolean> {
  const entitlement = await getPremiumEntitlementState(userId);
  return entitlement.isPremium;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const startedAt = Date.now();
  const ready = await ensureValidContext(req, res);
  if (!ready) return;
  const { userId, ctx } = ready;
  const sectionKey = readSectionKey(req);
  const dateKey = readDateKey(req);

  logContentApi(
    { scope: SCOPE, userId, chartId: ctx.chartId, surface: 'natal', variant: 'living' },
    'request_start',
    { metadata: { sectionKey, dateKey, method: req.method } },
  );

  if (!sectionKey) {
    return res.status(400).json({
      error: 'BAD_REQUEST',
      message: 'sectionKey must be a daily human interpretation section key',
    });
  }

  const isFreeOverview = sectionKey === 'daily_overview';
  const isPremium = await resolveIsPremium(userId);
  const requestedAccessTier: ContentAccessTier = isFreeOverview ? 'free' : 'premium';

  const apiLogContext = {
    scope: SCOPE,
    userId,
    chartId: ctx.chartId,
    surface: 'natal' as const,
    variant: 'living' as const,
  };

  logContentApi(apiLogContext, 'access_check', {
    accessTier: requestedAccessTier,
    metadata: { sectionKey, dateKey, isFreeOverview },
  });

  const canvasBacked = isCanvasBackedDailySection(sectionKey);

  if (!isPremium && !canvasBacked) {
    warnContentApi(apiLogContext, 'premium_required', {
      errorCode: 'PREMIUM_REQUIRED',
      metadata: { sectionKey },
    });
    return res.status(403).json({
      error: 'Premium required',
      code: 'PREMIUM_REQUIRED',
      premiumRequired: true,
      message: 'Персональный разбор дня доступен в Premium.',
    });
  }

  const window = getMoscowDayWindow(dateKey);
  const sectionWrapperOpts: SectionWrapperOptions = {
    accessTier: 'premium',
    cacheKey: `human_v2.daily.${dateKey}.${sectionKey}`,
    promptVersion: HUMAN_DAILY_PROMPT_VERSION,
    validFrom: window.validFrom,
    validTo: window.validTo,
  };

  // Ключи вне полотна (communication/risks/best_action/advice) — курируемый fallback
  // без AI и без канвы (в живом UI не отображаются).
  if (!canvasBacked) {
    const responseAccessTier: ContentAccessTier = 'premium';
    const section = buildHumanDailyFallback(ctx.profile, ctx.chartData!, sectionKey, dateKey);
    logContentApi(apiLogContext, 'fallback_saved', {
      accessTier: responseAccessTier,
      status: 'ready',
      durationMs: Date.now() - startedAt,
      metadata: { sectionKey, dateKey, source: 'curated_fallback_no_canvas' },
    });
    return res.status(200).json({
      interpretation: buildSectionEnvelope(ctx, sectionWrapperOpts, section),
      source: 'fallback' satisfies DailyResponseSource,
      persistenceStatus: 'saved' satisfies DailyPersistenceStatus,
      accessTier: responseAccessTier,
    });
  }

  // ── Полотно ──
  const locale = ctx.profile.language === 'en' ? 'en' : 'ru';
  const voiceVersion = getDailyVoiceVersion(locale);
  const cacheKey = humanDailyCanvasCacheKey(userId, dateKey, locale, voiceVersion);
  const inputHash = buildHumanInputHash({
    profile: ctx.profile,
    chartData: ctx.chartData!,
    sectionKey: 'canvas',
    dateKey,
    promptVersion: HUMAN_DAILY_PROMPT_VERSION,
    locale,
  });
  const canvasCacheOpts = {
    accessTier: CANVAS_CACHE_TIER,
    contentVariant: 'living' as const,
    cacheKey,
    // inputHash обязателен и при ЧТЕНИИ: getCachedReading сверяет его и отбрасывает
    // строки со старым хешем (в т.ч. со старым голосом → voiceHash в inputHash),
    // иначе кеш прошлого голоса читался бы как валидный.
    inputHash,
    promptVersion: HUMAN_DAILY_PROMPT_VERSION,
    isPersistent: false,
    validFrom: window.validFrom,
    validTo: window.validTo,
  };
  const canvasSaveOpts = { ...canvasCacheOpts, inputHash };
  sectionWrapperOpts.inputHash = inputHash;

  const respondWithCanvas = (
    canvas: DailyCanvas,
    source: DailyResponseSource,
    persistenceStatus: DailyPersistenceStatus,
  ) => {
    const responseAccessTier: ContentAccessTier = isFreeSectionAllowed(canvas, sectionKey) ? 'free' : 'premium';
    if (!isPremium && responseAccessTier !== 'free') {
      warnContentApi(apiLogContext, 'premium_required', {
        accessTier: 'premium',
        errorCode: 'PREMIUM_REQUIRED',
        metadata: { sectionKey, dateKey, freeSectionKey: canvas.meta.free_section_key },
      });
      return res.status(403).json({
        error: 'Premium required',
        code: 'PREMIUM_REQUIRED',
        premiumRequired: true,
        message: 'Персональный разбор дня доступен в Premium.',
        freeSectionKey: canvas.meta.free_section_key,
      });
    }

    const section = sliceCanvasToSection(canvas, sectionKey);
    if (!section) {
      warnContentApi(apiLogContext, 'invalid_daily_package_section', {
        accessTier: responseAccessTier,
        errorCode: 'EMPTY_INTERPRETATION',
        metadata: { sectionKey, dateKey, freeSectionKey: canvas.meta.free_section_key },
      });
      return res.status(502).json({
        error: 'EMPTY_INTERPRETATION',
        code: 'DAILY_PACKAGE_INVALID',
        message: 'Daily package is missing the requested section.',
      });
    }
    return res.status(200).json({
      interpretation: buildSectionEnvelope(ctx, { ...sectionWrapperOpts, accessTier: responseAccessTier }, section),
      source,
      persistenceStatus,
      accessTier: responseAccessTier,
      meta: { freeSectionKey: canvas.meta.free_section_key },
      dailyPackage: buildDailyPackagePayload(canvas, isPremium),
    });
  };

  // Чтение кеша полотна.
  let cachedCanvas: DailyCanvas | null = null;
  let cacheReadFailed = false;
  try {
    const rawCached = await getCachedReading<DailyCanvas>(ctx, canvasCacheOpts);
    cachedCanvas = rawCached && isUsableCanvas(rawCached.content) ? rawCached.content : null;
    if (rawCached && !cachedCanvas) {
      const cachedLocale = (rawCached.content as Partial<DailyCanvas> | undefined)?.meta?.locale === 'en' ? 'en' : locale;
      const validation = validateDailyCanvas(rawCached.content, cachedLocale);
      warnContentApi(apiLogContext, 'invalid_cached_row', {
        accessTier: requestedAccessTier,
        errorCode: 'EMPTY_INTERPRETATION',
        metadata: {
          sectionKey,
          dateKey,
          cacheKey,
          reasonCode: 'CACHE_VALIDATION_FAILED',
          hardErrors: validation.hardErrors,
          styleWarnings: validation.styleWarnings,
        },
      });
    }
  } catch (error: any) {
    cacheReadFailed = true;
    warnContentApi(apiLogContext, 'cache_read_failed', {
      accessTier: requestedAccessTier,
      errorCode: 'CACHE_READ_FAILED',
      metadata: { sectionKey, dateKey, error: error?.message || String(error) },
    });
  }

  if (cacheReadFailed) {
    return res.status(503).json({
      error: 'DAILY_PACKAGE_UNAVAILABLE',
      code: 'CACHE_READ_FAILED',
      message: 'Daily package is temporarily unavailable.',
    });
  }

  if (cachedCanvas) {
    logContentApi(apiLogContext, 'cache_hit', {
      accessTier: requestedAccessTier,
      status: 'ready',
      durationMs: Date.now() - startedAt,
      metadata: { sectionKey, dateKey },
    });
    return respondWithCanvas(cachedCanvas, 'human_v2', 'saved');
  }

  // GET читает только кеш — если полотна ещё нет, 404 (клиент триггерит POST).
  if (req.method === 'GET') {
    return res.status(404).json({ error: 'NOT_FOUND', code: 'HUMAN_DAILY_NOT_READY' });
  }

  logContentApi(apiLogContext, 'cache_miss', {
    accessTier: requestedAccessTier,
    metadata: { sectionKey, dateKey, cacheKey },
  });

  // POST + промах → генерим полотно ОДИН раз под общей блокировкой на сутки.
  try {
    const lockResult = await withContentGenerationLock<DailyCanvas>({
      lockKey: buildContentGenerationLockKey({
        userId,
        chartId: ctx.chartId,
        accessTier: CANVAS_CACHE_TIER,
        contentSurface: 'natal',
        contentVariant: 'living',
        cacheKey,
        promptVersion: HUMAN_DAILY_PROMPT_VERSION,
      }),
      operation: 'human-daily-canvas',
      readCached: async () => {
        const again = await getCachedReading<DailyCanvas>(ctx, canvasCacheOpts);
        if (!again) return null;
        if (isUsableCanvas(again.content)) {
          return { value: again.content, source: 'human_v2' as const };
        }
        const validation = validateDailyCanvas(again.content, locale);
        warnContentApi(apiLogContext, 'lock_cache_invalid', {
          accessTier: requestedAccessTier,
          errorCode: 'EMPTY_INTERPRETATION',
          metadata: {
            sectionKey,
            dateKey,
            reasonCode: 'LOCK_CACHE_VALIDATION_FAILED',
            hardErrors: validation.hardErrors,
            styleWarnings: validation.styleWarnings,
          },
        });
        return null;
      },
      generate: async () => {
        const canvas = await generateDailyCanvas(ctx.profile, ctx.chartData!, dateKey);
        const validation = validateDailyCanvas(canvas, locale);
        if (!validation.valid) {
          const error = new Error('EMPTY_DAILY_CANVAS') as Error & { code?: string; hardErrors?: string[] };
          error.code = 'DAILY_PACKAGE_HARD_INVALID';
          error.hardErrors = validation.hardErrors;
          throw error;
        }
        if (validation.styleWarnings.length) {
          warnContentApi(apiLogContext, 'daily_package_style_warnings', {
            accessTier: requestedAccessTier,
            status: 'ready',
            metadata: {
              sectionKey,
              dateKey,
              reasonCode: 'STYLE_WARNINGS',
              styleWarnings: validation.styleWarnings,
            },
          });
        }
        try {
          await saveReading<DailyCanvas>(ctx, canvasSaveOpts, canvas);
        } catch (error) {
          const saveError = new Error('SAVE_READING_FAILED') as Error & { code?: string; cause?: unknown };
          saveError.code = 'SAVE_READING_FAILED';
          saveError.cause = error;
          throw saveError;
        }
        logContentApi(apiLogContext, 'generation_saved', {
          accessTier: requestedAccessTier,
          status: 'ready',
          durationMs: Date.now() - startedAt,
          metadata: { sectionKey, dateKey },
        });
        return canvas;
      },
    });

    if (lockResult.status === 'in_progress') {
      return res.status(202).json({
        ...generationInProgressPayload(lockResult.retryAfterMs),
        reasonCode: 'GENERATION_LOCK_BUSY',
      });
    }

    const canvas = lockResult.value;
    const source = lockResult.fromCache ? (lockResult.source as DailyResponseSource) || 'human_v2' : 'generated';
    const persistenceStatus: DailyPersistenceStatus = 'saved';
    return respondWithCanvas(canvas, source, persistenceStatus);
  } catch (error) {
    const err = error as Error & { code?: string; hardErrors?: string[] };
    const errorCode = err.code || 'CONTENT_GENERATION_UNAVAILABLE';
    warnContentApi(apiLogContext, 'generation_failed', {
      accessTier: requestedAccessTier,
      errorCode,
      durationMs: Date.now() - startedAt,
      metadata: {
        sectionKey,
        dateKey,
        reasonCode: errorCode,
        hardErrors: err.hardErrors || [],
      },
    });
    console.error(
      '[natal/human-daily:canvas] generation flow failed:',
      error instanceof Error ? `${errorCode}:${error.message}` : errorCode,
    );
    return res.status(503).json({
      error: 'DAILY_PACKAGE_UNAVAILABLE',
      code: errorCode,
      reasonCode: errorCode,
      message: 'Daily package could not be prepared.',
    });
  }
}
