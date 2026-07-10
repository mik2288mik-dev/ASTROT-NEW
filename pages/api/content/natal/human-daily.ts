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
  buildDailyCanvasFallback,
  generateDailyCanvas,
  sliceCanvasToSection,
} from '../../../../lib/natalHumanInterpretation';
import {
  DAILY_CANVAS_FREE_SECTION_KEYS,
  DAILY_CANVAS_SECTION_KEYS,
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

type DailyResponseSource = 'human_v2' | 'generated' | 'fallback' | 'fallback_unsaved';
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
  const card = canvas.card;
  const summary = canvas.summary;
  const freeSectionKey = canvas.meta?.free_section_key;
  const sections = Array.isArray(canvas.sections) ? canvas.sections : [];
  const sectionKeys = new Set(sections.map((section) => section?.key));
  return (
    !!card &&
    typeof card === 'object' &&
    typeof card.title === 'string' &&
    card.title.trim().length > 0 &&
    typeof card.teaser === 'string' &&
    card.teaser.trim().length > 0 &&
    !!summary &&
    typeof summary === 'object' &&
    typeof summary.best_action === 'string' &&
    typeof summary.main_risk === 'string' &&
    DAILY_CANVAS_FREE_SECTION_KEYS.includes(freeSectionKey as any) &&
    DAILY_CANVAS_SECTION_KEYS.every((key) => sectionKeys.has(key)) &&
    sections.every((section) => typeof section?.title === 'string' && typeof section?.text === 'string' && section.text.trim().length > 0)
  );
}

function isFreeSectionAllowed(canvas: DailyCanvas, sectionKey: HumanDailySectionKey): boolean {
  const canvasKey = DAILY_SECTION_TO_CANVAS_KEY[sectionKey];
  return canvasKey === 'overview' || canvasKey === canvas.meta.free_section_key;
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
  const cacheKey = humanDailyCanvasCacheKey(dateKey);
  const inputHash = buildHumanInputHash({
    profile: ctx.profile,
    chartData: ctx.chartData!,
    sectionKey: 'canvas',
    dateKey,
    promptVersion: HUMAN_DAILY_PROMPT_VERSION,
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
      // Не должно случаться для canvas-backed ключей, но подстрахуемся.
      const fallbackSection = buildHumanDailyFallback(ctx.profile, ctx.chartData!, sectionKey, dateKey);
      return res.status(200).json({
        interpretation: buildSectionEnvelope(ctx, { ...sectionWrapperOpts, accessTier: responseAccessTier }, fallbackSection),
        source: 'fallback' satisfies DailyResponseSource,
        persistenceStatus: 'saved' satisfies DailyPersistenceStatus,
        accessTier: responseAccessTier,
        meta: { freeSectionKey: canvas.meta.free_section_key },
      });
    }
    return res.status(200).json({
      interpretation: buildSectionEnvelope(ctx, { ...sectionWrapperOpts, accessTier: responseAccessTier }, section),
      source,
      persistenceStatus,
      accessTier: responseAccessTier,
      meta: { freeSectionKey: canvas.meta.free_section_key },
    });
  };

  // Чтение кеша полотна.
  let cachedCanvas: DailyCanvas | null = null;
  let cacheReadFailed = false;
  try {
    const rawCached = await getCachedReading<DailyCanvas>(ctx, canvasCacheOpts);
    cachedCanvas = rawCached && isUsableCanvas(rawCached.content) ? rawCached.content : null;
    if (rawCached && !cachedCanvas) {
      warnContentApi(apiLogContext, 'invalid_cached_row', {
        accessTier: requestedAccessTier,
        errorCode: 'EMPTY_INTERPRETATION',
        metadata: { sectionKey, dateKey, cacheKey },
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
    const canvas = buildDailyCanvasFallback(ctx.profile, ctx.chartData!, dateKey);
    return respondWithCanvas(canvas, 'fallback_unsaved', 'failed');
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
    let generatedSource: DailyResponseSource = 'generated';
    let generatedPersistenceStatus: DailyPersistenceStatus = 'saved';

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
        return again && isUsableCanvas(again.content)
          ? { value: again.content, source: 'human_v2' as const }
          : null;
      },
      generate: async () => {
        // fallback-first: сохраняем fallback-полотно, затем пытаемся AI и перезаписываем.
        const fallbackCanvas = buildDailyCanvasFallback(ctx.profile, ctx.chartData!, dateKey);
        try {
          await saveReading<DailyCanvas>(ctx, canvasSaveOpts, fallbackCanvas);
          generatedSource = 'fallback';
        } catch (fallbackError: any) {
          generatedSource = 'fallback_unsaved';
          generatedPersistenceStatus = 'failed';
          warnContentApi(apiLogContext, 'persistence_failed', {
            accessTier: requestedAccessTier,
            status: 'ready',
            errorCode: 'FALLBACK_SAVE_FAILED',
            durationMs: Date.now() - startedAt,
            metadata: { sectionKey, dateKey, error: fallbackError?.message || String(fallbackError) },
          });
          return fallbackCanvas;
        }

        try {
          const canvas = await generateDailyCanvas(ctx.profile, ctx.chartData!, dateKey);
          if (!isUsableCanvas(canvas)) throw new Error('EMPTY_DAILY_CANVAS');
          await saveReading<DailyCanvas>(ctx, canvasSaveOpts, canvas);
          generatedSource = 'generated';
          generatedPersistenceStatus = 'saved';
          logContentApi(apiLogContext, 'generation_saved', {
            accessTier: requestedAccessTier,
            status: 'ready',
            durationMs: Date.now() - startedAt,
            metadata: { sectionKey, dateKey },
          });
          return canvas;
        } catch (generationError: any) {
          generatedSource = 'fallback';
          generatedPersistenceStatus = 'saved';
          warnContentApi(apiLogContext, 'generation_failed', {
            accessTier: requestedAccessTier,
            status: 'ready',
            errorCode: generationError?.code || generationError?.message || 'CONTENT_GENERATION_UNAVAILABLE',
            durationMs: Date.now() - startedAt,
            metadata: { sectionKey, dateKey },
          });
          console.error(
            '[natal/human-daily:canvas] generation failed after fallback save:',
            generationError instanceof Error ? generationError.message : generationError,
          );
          return fallbackCanvas;
        }
      },
    });

    if (lockResult.status === 'in_progress') {
      return res.status(202).json(generationInProgressPayload(lockResult.retryAfterMs));
    }

    const canvas = lockResult.value;
    const source = lockResult.fromCache ? (lockResult.source as DailyResponseSource) || 'human_v2' : generatedSource;
    const persistenceStatus: DailyPersistenceStatus = lockResult.fromCache ? 'saved' : generatedPersistenceStatus;
    return respondWithCanvas(canvas, source, persistenceStatus);
  } catch (error) {
    warnContentApi(apiLogContext, 'generation_failed', {
      accessTier: requestedAccessTier,
      errorCode: 'CONTENT_GENERATION_UNAVAILABLE',
      durationMs: Date.now() - startedAt,
      metadata: { sectionKey, dateKey },
    });
    console.error(
      '[natal/human-daily:canvas] generation flow failed:',
      error instanceof Error ? error.message : error,
    );
    const canvas = buildDailyCanvasFallback(ctx.profile, ctx.chartData!, dateKey);
    return respondWithCanvas(canvas, 'fallback_unsaved', 'failed');
  }
}
