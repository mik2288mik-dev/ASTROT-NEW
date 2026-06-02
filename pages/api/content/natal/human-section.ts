import type { NextApiRequest, NextApiResponse } from 'next';
import type { ContentAccessTier, InterpretationSection } from '../../../../types';
import {
  ensureValidContext,
  getCachedReading,
  saveReading,
} from '../../../../lib/natalReading/apiHelper';
import {
  buildHumanInputHash,
  buildHumanPaidFallback,
  generateHumanPaidSection,
} from '../../../../lib/natalHumanInterpretation';
import {
  HUMAN_PAID_PROMPT_VERSION,
  humanPaidCacheKey,
  isHumanPaidSectionKey,
  type HumanPaidSectionKey,
} from '../../../../lib/natalHumanShared';
import { logContentApi, warnContentApi } from '../../../../lib/contentApiLogging';
import { getPremiumEntitlementState } from '../../../../lib/contentArchitecture';
import {
  buildContentGenerationLockKey,
  generationInProgressPayload,
  withContentGenerationLock,
} from '../../../../lib/contentGenerationLock';

export const config = { maxDuration: 90 };

const SCOPE = 'natal-human-section';

type ResolvedAccess = {
  accessTier: Extract<ContentAccessTier, 'premium'>;
};

function readSectionKey(req: NextApiRequest): HumanPaidSectionKey | null {
  const raw = (req.method === 'GET' ? req.query.sectionKey : req.body?.sectionKey) as string | undefined;
  const value = String(raw || '').trim();
  return isHumanPaidSectionKey(value) ? value : null;
}

async function resolvePaidAccess(userId: string): Promise<ResolvedAccess | null> {
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

  logContentApi(
    {
      scope: SCOPE,
      userId,
      chartId: ctx.chartId,
      surface: 'natal',
      variant: 'living',
    },
    'request_start',
    { metadata: { sectionKey, method: req.method } }
  );

  if (!sectionKey) {
    return res.status(400).json({
      error: 'BAD_REQUEST',
      message: 'sectionKey must be a paid human interpretation section key',
    });
  }

  const cacheKey = humanPaidCacheKey(sectionKey);
  const inputHash = buildHumanInputHash({
    profile: ctx.profile,
    chartData: ctx.chartData!,
    sectionKey,
    promptVersion: HUMAN_PAID_PROMPT_VERSION,
  });

  const access = await resolvePaidAccess(userId);

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
      accessTier: access?.accessTier ?? 'locked',
      metadata: { sectionKey, isPremium: !!access },
    }
  );

  if (!access) {
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
      message: 'Этот раздел доступен в Lumia Premium.',
    });
  }

  const cacheOpts = {
    accessTier: access.accessTier,
    contentVariant: 'full' as const,
    cacheKey,
    inputHash,
    promptVersion: HUMAN_PAID_PROMPT_VERSION,
    isPersistent: true,
  };
  const cached = await getCachedReading<InterpretationSection>(ctx, cacheOpts);

  if (cached) {
    logContentApi(
      {
        scope: SCOPE,
        userId,
        chartId: ctx.chartId,
        surface: 'natal',
        variant: 'living',
      },
      'cache_hit',
      {
        accessTier: access.accessTier,
        status: 'ready',
        durationMs: Date.now() - startedAt,
        metadata: { sectionKey },
      }
    );
    return res.status(200).json({
      interpretation: cached,
      source: 'human_v2',
      accessTier: access.accessTier,
    });
  }

  if (req.method === 'GET') {
    return res.status(404).json({ error: 'NOT_FOUND', code: 'HUMAN_SECTION_NOT_READY' });
  }

  try {
    logContentApi(
      {
        scope: SCOPE,
        userId,
        chartId: ctx.chartId,
        surface: 'natal',
        variant: 'living',
      },
      'generation_start',
      { accessTier: access.accessTier, metadata: { sectionKey } }
    );
    const lockResult = await withContentGenerationLock({
      lockKey: buildContentGenerationLockKey({
        userId,
        chartId: ctx.chartId,
        accessTier: access.accessTier,
        contentSurface: 'natal',
        contentVariant: 'full',
        cacheKey,
        promptVersion: HUMAN_PAID_PROMPT_VERSION,
      }),
      operation: `human-section-${sectionKey}`,
      readCached: async () => {
        const again = await getCachedReading<InterpretationSection>(ctx, cacheOpts);
        return again ? { value: again, source: 'human_v2' } : null;
      },
      generate: async () => {
        const section = await generateHumanPaidSection(ctx.profile, ctx.chartData!, sectionKey);
        return saveReading(ctx, cacheOpts, section);
      },
    });

    if (lockResult.status === 'in_progress') {
      return res.status(202).json(generationInProgressPayload(lockResult.retryAfterMs));
    }

    logContentApi(
      {
        scope: SCOPE,
        userId,
        chartId: ctx.chartId,
        surface: 'natal',
        variant: 'living',
      },
      'generation_success',
      {
        accessTier: access.accessTier,
        status: 'ready',
        durationMs: Date.now() - startedAt,
        metadata: { sectionKey },
      }
    );
    return res.status(200).json({
      interpretation: lockResult.value,
      source: lockResult.fromCache ? (lockResult.source || 'human_v2') : 'generated',
      accessTier: access.accessTier,
    });
  } catch (error) {
    warnContentApi(
      {
        scope: SCOPE,
        userId,
        chartId: ctx.chartId,
        surface: 'natal',
        variant: 'living',
      },
      'generation_failed',
      {
        accessTier: access.accessTier,
        errorCode: 'HUMAN_SECTION_GENERATION_FAILED',
        durationMs: Date.now() - startedAt,
        metadata: { sectionKey },
      }
    );
    console.error(`[natal/human-section:${sectionKey}] generation failed:`, error instanceof Error ? error.message : error);
    const fallback = buildHumanPaidFallback(ctx.profile, ctx.chartData!, sectionKey);
    const saved = await saveReading(
      ctx,
      { ...cacheOpts, isPersistent: false, validTo: new Date(Date.now() + 6 * 60 * 60 * 1000) },
      fallback
    ).catch(() => null);
    return res.status(200).json({
      interpretation: saved || { content: fallback, promptVersion: cacheOpts.promptVersion },
      source: saved ? 'fallback' : 'fallback-inline',
      accessTier: access.accessTier,
    });
  }
}
