import type { NextApiRequest, NextApiResponse } from 'next';
import { randomUUID } from 'crypto';
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

type DiagnosticMetadata = Record<string, unknown>;

function headerValue(headers: unknown, name: string): string | undefined {
  if (!headers || typeof headers !== 'object') return undefined;
  const anyHeaders = headers as any;
  const direct = anyHeaders[name] || anyHeaders[name.toLowerCase()];
  if (typeof direct === 'string') return direct;
  if (Array.isArray(direct)) return direct[0];
  if (typeof anyHeaders.get === 'function') {
    const value = anyHeaders.get(name) || anyHeaders.get(name.toLowerCase());
    return typeof value === 'string' ? value : undefined;
  }
  return undefined;
}

function isPostgresError(value: any): boolean {
  if (!value || typeof value !== 'object') return false;
  return (
    typeof value.constraint === 'string' ||
    typeof value.detail === 'string' ||
    (typeof value.code === 'string' && /^[0-9A-Z]{5}$/.test(value.code))
  );
}

function errorDiagnostics(error: unknown): DiagnosticMetadata {
  const err = error as any;
  const cause = err?.cause;
  const dbError = isPostgresError(err) ? err : isPostgresError(cause) ? cause : null;
  const openaiError = err?.status || err?.request_id || err?.requestId || err?.headers || err?.error
    ? err
    : cause?.status || cause?.request_id || cause?.requestId || cause?.headers || cause?.error
      ? cause
      : null;

  const details: DiagnosticMetadata = {
    errorMessage: err?.message || String(error),
  };
  if (err?.stack) details.errorStack = err.stack;
  if (dbError?.code) details.pgCode = dbError.code;
  if (dbError?.detail) details.pgDetail = dbError.detail;
  if (dbError?.constraint) details.pgConstraint = dbError.constraint;
  if (dbError?.table) details.pgTable = dbError.table;
  if (openaiError?.status || openaiError?.statusCode) {
    details.openaiStatus = openaiError.status || openaiError.statusCode;
  }
  if (openaiError?.code || openaiError?.error?.code) {
    details.openaiCode = openaiError.code || openaiError.error.code;
  }
  const openaiRequestId =
    openaiError?.request_id ||
    openaiError?.requestId ||
    headerValue(openaiError?.headers, 'x-request-id') ||
    headerValue(openaiError?.headers, 'x-openai-request-id');
  if (openaiRequestId) details.openaiRequestId = openaiRequestId;
  return details;
}

function markDiagnosticStage(error: unknown, stage: string): void {
  if (error && typeof error === 'object') {
    (error as any).diagnosticStage = stage;
  }
}

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
  const requestId = randomUUID();
  res.setHeader('x-request-id', requestId);
  let diagnosticUserId: string | undefined;
  let diagnosticChartId: number | null = null;
  const earlyResponse = { current: null as { stage: string; status: number; code: string } | null };
  const sectionKey = readSectionKey(req);
  const dateKey = readDateKey(req);

  const diagnosticContext = () => ({
    scope: SCOPE,
    userId: diagnosticUserId,
    chartId: diagnosticChartId,
    surface: 'natal' as const,
    variant: 'living' as const,
  });

  const withDiagnosticMetadata = (stage: string, metadata?: DiagnosticMetadata) => ({
    requestId,
    stage,
    method: req.method,
    sectionKey,
    dateKey,
    ...(metadata || {}),
  });

  const logStage = (
    stage: string,
    fields: {
      accessTier?: ContentAccessTier;
      status?: string;
      errorCode?: string;
      durationMs?: number;
      metadata?: DiagnosticMetadata;
    } = {},
  ) => {
    logContentApi(diagnosticContext(), stage, {
      ...fields,
      metadata: withDiagnosticMetadata(stage, fields.metadata as DiagnosticMetadata | undefined),
    });
  };

  const warnStage = (
    stage: string,
    fields: {
      accessTier?: ContentAccessTier;
      status?: string;
      errorCode?: string;
      durationMs?: number;
      metadata?: DiagnosticMetadata;
    } = {},
  ) => {
    warnContentApi(diagnosticContext(), stage, {
      ...fields,
      metadata: withDiagnosticMetadata(stage, fields.metadata as DiagnosticMetadata | undefined),
    });
  };

  const logStageError = (
    stage: string,
    httpStatus: number,
    appErrorCode: string,
    error: unknown,
    metadata: DiagnosticMetadata = {},
  ) => {
    markDiagnosticStage(error, stage);
    warnStage(stage, {
      status: 'error',
      errorCode: appErrorCode,
      durationMs: Date.now() - startedAt,
      metadata: {
        httpStatus,
        appErrorCode,
        ...errorDiagnostics(error),
        ...metadata,
      },
    });
  };

  const logResponseSent = (
    httpStatus: number,
    appErrorCode?: string,
    metadata: DiagnosticMetadata = {},
  ) => {
    const status = httpStatus >= 400 ? 'error' : httpStatus === 202 ? 'pending' : 'ready';
    const fields = {
      status,
      ...(appErrorCode ? { errorCode: appErrorCode } : {}),
      durationMs: Date.now() - startedAt,
      metadata: {
        httpStatus,
        ...(appErrorCode ? { appErrorCode } : {}),
        ...metadata,
      },
    };
    if (httpStatus >= 400) {
      warnStage('response_sent', fields);
    } else {
      logStage('response_sent', fields);
    }
  };

  const sendJson = (
    httpStatus: number,
    payload: Record<string, unknown>,
    metadata: DiagnosticMetadata = {},
  ) => {
    const appErrorCode = typeof payload.code === 'string'
      ? payload.code
      : typeof payload.error === 'string' && httpStatus >= 400
        ? payload.error
        : undefined;
    logResponseSent(httpStatus, appErrorCode, metadata);
    return res.status(httpStatus).json(payload);
  };

  logStage('request_started');

  let ready: Awaited<ReturnType<typeof ensureValidContext>> | null = null;
  try {
    ready = await ensureValidContext(req, res, {
      onAuthSuccess: ({ userId: authenticatedUserId }) => {
        diagnosticUserId = authenticatedUserId;
        logStage('auth_success');
      },
      onAuthFailed: ({ userId: failedUserId, status, code, error }) => {
        diagnosticUserId = failedUserId ? String(failedUserId) : undefined;
        earlyResponse.current = { stage: 'auth_failed', status, code };
        logStageError('auth_failed', status, code, error || new Error(code));
      },
      onChartResolved: ({ userId: resolvedUserId, chartId: resolvedChartId }) => {
        diagnosticUserId = resolvedUserId;
        diagnosticChartId = resolvedChartId;
        logStage('chart_resolved', {
          metadata: { hasChartData: true },
        });
      },
      onChartFailed: ({ userId: failedUserId, chartId: failedChartId, status, code, error }) => {
        diagnosticUserId = failedUserId;
        diagnosticChartId = failedChartId;
        earlyResponse.current = { stage: 'chart_failed', status, code };
        logStageError('chart_failed', status, code, error || new Error(code));
      },
    });
  } catch (error) {
    logStageError('auth_failed', 500, 'AUTH_UNEXPECTED_ERROR', error);
    return sendJson(500, {
      error: 'INTERNAL_SERVER_ERROR',
      code: 'AUTH_UNEXPECTED_ERROR',
      message: 'Daily package could not be prepared.',
    });
  }

  if (!ready) {
    if (earlyResponse.current) {
      logResponseSent(earlyResponse.current.status, earlyResponse.current.code, {
        failedStage: earlyResponse.current.stage,
      });
    }
    return;
  }

  const { userId, ctx } = ready;
  diagnosticUserId = userId;
  diagnosticChartId = ctx.chartId;

  if (!sectionKey) {
    const error = new Error('sectionKey must be a daily human interpretation section key');
    logStageError('request_failed', 400, 'BAD_REQUEST', error);
    return sendJson(400, {
      error: 'BAD_REQUEST',
      message: 'sectionKey must be a daily human interpretation section key',
    });
  }

  const isFreeOverview = sectionKey === 'daily_overview';
  const isPremium = await resolveIsPremium(userId);
  const requestedAccessTier: ContentAccessTier = isFreeOverview ? 'free' : 'premium';

  logStage('access_check', {
    accessTier: requestedAccessTier,
    metadata: { isFreeOverview },
  });

  const canvasBacked = isCanvasBackedDailySection(sectionKey);

  if (!isPremium && !canvasBacked) {
    warnStage('premium_required', {
      errorCode: 'PREMIUM_REQUIRED',
      metadata: {},
    });
    return sendJson(403, {
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
    logStage('fallback_saved', {
      accessTier: responseAccessTier,
      status: 'ready',
      durationMs: Date.now() - startedAt,
      metadata: { source: 'curated_fallback_no_canvas' },
    });
    return sendJson(200, {
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
      warnStage('premium_required', {
        accessTier: 'premium',
        errorCode: 'PREMIUM_REQUIRED',
        metadata: { freeSectionKey: canvas.meta.free_section_key },
      });
      return sendJson(403, {
        error: 'Premium required',
        code: 'PREMIUM_REQUIRED',
        premiumRequired: true,
        message: 'Персональный разбор дня доступен в Premium.',
        freeSectionKey: canvas.meta.free_section_key,
      });
    }

    const section = sliceCanvasToSection(canvas, sectionKey);
    if (!section) {
      const error = new Error('Daily package is missing the requested section.');
      logStageError('validation_failed', 502, 'DAILY_PACKAGE_INVALID', error, {
        accessTier: responseAccessTier,
        freeSectionKey: canvas.meta.free_section_key,
      });
      return sendJson(502, {
        error: 'EMPTY_INTERPRETATION',
        code: 'DAILY_PACKAGE_INVALID',
        message: 'Daily package is missing the requested section.',
      });
    }
    return sendJson(200, {
      interpretation: buildSectionEnvelope(ctx, { ...sectionWrapperOpts, accessTier: responseAccessTier }, section),
      source,
      persistenceStatus,
      accessTier: responseAccessTier,
      meta: { freeSectionKey: canvas.meta.free_section_key },
      dailyPackage: buildDailyPackagePayload(canvas, isPremium),
    }, {
      source,
      persistenceStatus,
      responseAccessTier,
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
      warnStage('invalid_cached_row', {
        accessTier: requestedAccessTier,
        errorCode: 'EMPTY_INTERPRETATION',
        metadata: {
          cacheKey,
          reasonCode: 'CACHE_VALIDATION_FAILED',
          hardErrors: validation.hardErrors,
          styleWarnings: validation.styleWarnings,
        },
      });
    }
  } catch (error: any) {
    cacheReadFailed = true;
    logStageError('cache_read_failed', 503, 'CACHE_READ_FAILED', error, {
      accessTier: requestedAccessTier,
    });
  }

  if (cacheReadFailed) {
    return sendJson(503, {
      error: 'DAILY_PACKAGE_UNAVAILABLE',
      code: 'CACHE_READ_FAILED',
      message: 'Daily package is temporarily unavailable.',
    });
  }

  if (cachedCanvas) {
    logStage('cache_hit', {
      accessTier: requestedAccessTier,
      status: 'ready',
      durationMs: Date.now() - startedAt,
      metadata: { cacheKey },
    });
    return respondWithCanvas(cachedCanvas, 'human_v2', 'saved');
  }

  // GET читает только кеш — если полотна ещё нет, 404 (клиент триггерит POST).
  logStage('cache_miss', {
    accessTier: requestedAccessTier,
    metadata: { cacheKey },
  });

  if (req.method === 'GET') {
    return sendJson(404, { error: 'NOT_FOUND', code: 'HUMAN_DAILY_NOT_READY' });
  }

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
      onLockAcquired: () => logStage('lock_acquired', {
        accessTier: requestedAccessTier,
        metadata: { cacheKey },
      }),
      onLockBusy: () => logStage('lock_busy', {
        accessTier: requestedAccessTier,
        status: 'pending',
        metadata: { cacheKey },
      }),
      readCached: async () => {
        const again = await getCachedReading<DailyCanvas>(ctx, canvasCacheOpts);
        if (!again) return null;
        if (isUsableCanvas(again.content)) {
          return { value: again.content, source: 'human_v2' as const };
        }
        const validation = validateDailyCanvas(again.content, locale);
        warnStage('lock_cache_invalid', {
          accessTier: requestedAccessTier,
          errorCode: 'EMPTY_INTERPRETATION',
          metadata: {
            reasonCode: 'LOCK_CACHE_VALIDATION_FAILED',
            hardErrors: validation.hardErrors,
            styleWarnings: validation.styleWarnings,
          },
        });
        return null;
      },
      generate: async () => {
        logStage('generation_started', {
          accessTier: requestedAccessTier,
          metadata: { cacheKey },
        });
        let canvas: DailyCanvas;
        try {
          canvas = await generateDailyCanvas(ctx.profile, ctx.chartData!, dateKey, {
            onTransitsSuccess: (metadata) => logStage('transits_success', {
              accessTier: requestedAccessTier,
              status: 'ready',
              metadata: {
                transitSource: metadata.source,
                transitDate: metadata.date,
              },
            }),
            onTransitsFailed: (error) => logStageError('transits_failed', 200, 'TRANSITS_UNAVAILABLE', error, {
              accessTier: requestedAccessTier,
              degraded: true,
            }),
          });
          logStage('generation_success', {
            accessTier: requestedAccessTier,
            status: 'ready',
            durationMs: Date.now() - startedAt,
            metadata: { cacheKey },
          });
        } catch (error) {
          const err = error as Error & { code?: string; hardErrors?: string[] };
          const errorCode = err.code || 'CONTENT_GENERATION_UNAVAILABLE';
          logStageError('generation_failed', 503, errorCode, error, {
            accessTier: requestedAccessTier,
            reasonCode: errorCode,
            hardErrors: err.hardErrors || [],
          });
          throw error;
        }
        const validation = validateDailyCanvas(canvas, locale);
        if (!validation.valid) {
          const error = new Error('EMPTY_DAILY_CANVAS') as Error & { code?: string; hardErrors?: string[] };
          error.code = 'DAILY_PACKAGE_HARD_INVALID';
          error.hardErrors = validation.hardErrors;
          logStageError('validation_failed', 503, error.code, error, {
            accessTier: requestedAccessTier,
            hardErrors: validation.hardErrors,
          });
          throw error;
        }
        logStage('validation_success', {
          accessTier: requestedAccessTier,
          status: 'ready',
          metadata: { cacheKey },
        });
        if (validation.styleWarnings.length) {
          warnStage('daily_package_style_warnings', {
            accessTier: requestedAccessTier,
            status: 'ready',
            metadata: {
              reasonCode: 'STYLE_WARNINGS',
              styleWarnings: validation.styleWarnings,
            },
          });
        }
        logStage('save_started', {
          accessTier: requestedAccessTier,
          metadata: { cacheKey },
        });
        try {
          await saveReading<DailyCanvas>(ctx, canvasSaveOpts, canvas);
        } catch (error) {
          const saveError = new Error('SAVE_READING_FAILED') as Error & { code?: string; cause?: unknown };
          saveError.code = 'SAVE_READING_FAILED';
          saveError.cause = error;
          logStageError('save_failed', 503, saveError.code, saveError, {
            accessTier: requestedAccessTier,
            cacheKey,
          });
          throw saveError;
        }
        logStage('save_success', {
          accessTier: requestedAccessTier,
          status: 'ready',
          durationMs: Date.now() - startedAt,
          metadata: { cacheKey },
        });
        logStage('generation_saved', {
          accessTier: requestedAccessTier,
          status: 'ready',
          durationMs: Date.now() - startedAt,
          metadata: { cacheKey },
        });
        return canvas;
      },
    });

    if (lockResult.status === 'in_progress') {
      return sendJson(202, {
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
    if (!(err as any).diagnosticStage) {
      logStageError('generation_failed', 503, errorCode, error, {
        accessTier: requestedAccessTier,
        reasonCode: errorCode,
        hardErrors: err.hardErrors || [],
      });
    }
    return sendJson(503, {
      error: 'DAILY_PACKAGE_UNAVAILABLE',
      code: errorCode,
      reasonCode: errorCode,
      message: 'Daily package could not be prepared.',
    });
  }
}
