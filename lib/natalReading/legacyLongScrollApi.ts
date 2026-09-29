import type { NextApiRequest, NextApiResponse } from 'next';
import { getPremiumEntitlementState } from '../contentArchitecture';
import { ensureValidContext } from './apiHelper';
import {
  adaptUnifiedToLegacyLongScrollAspects,
  adaptUnifiedToLegacyLongScrollDive,
  adaptUnifiedToLegacyLongScrollPortrait,
  adaptUnifiedToLegacyLongScrollToday,
  adaptUnifiedToLegacyLongScrollWeek,
  legacyInterpretationEnvelope,
} from './legacyCompatibility';
import { loadUnifiedReadingForLegacyEndpoint } from './legacyCompatibilityApi';

export type LegacyLongScrollSurface = 'portrait' | 'aspects' | 'today' | 'week' | 'dive';

type LegacyLongScrollDiveTopic = 'love' | 'career' | 'health' | 'karma' | 'strengths';

const DIVE_TOPICS: readonly LegacyLongScrollDiveTopic[] = [
  'love',
  'career',
  'health',
  'karma',
  'strengths',
];

const PREMIUM_SURFACES = new Set<LegacyLongScrollSurface>(['today', 'week', 'dive']);

function readDiveTopic(req: NextApiRequest): LegacyLongScrollDiveTopic | null {
  const raw = req.method === 'GET' ? req.query.topic : req.body?.topic;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return DIVE_TOPICS.includes(value as LegacyLongScrollDiveTopic)
    ? value as LegacyLongScrollDiveTopic
    : null;
}

function notReadyCode(surface: LegacyLongScrollSurface): string {
  return `${surface.toUpperCase()}_NOT_READY`;
}

/**
 * Compatibility endpoint for the long-scroll natal APK released before the
 * unified reading. It only projects an existing unified reading into the old
 * response shape and intentionally owns no cache, prompt or writer.
 */
export async function handleLegacyLongScrollEndpoint(
  req: NextApiRequest,
  res: NextApiResponse,
  surface: LegacyLongScrollSurface,
): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    return;
  }

  const diveTopic = surface === 'dive' ? readDiveTopic(req) : null;
  if (surface === 'dive' && !diveTopic) {
    res.status(400).json({
      error: 'BAD_REQUEST',
      message: `topic must be one of: ${DIVE_TOPICS.join(', ')}`,
    });
    return;
  }

  const ready = await ensureValidContext(req, res, {
    requireCanonicalSnapshot: true,
    repairCanonicalSnapshot: false,
  });
  if (!ready) return;
  const { userId, ctx } = ready;
  const accessTier = PREMIUM_SURFACES.has(surface) ? 'premium' : 'free';

  if (accessTier === 'premium') {
    const entitlement = await getPremiumEntitlementState(userId);
    if (!entitlement.isPremium) {
      res.status(403).json({
        error: 'PREMIUM_REQUIRED',
        code: 'PREMIUM_REQUIRED',
        premiumRequired: true,
      });
      return;
    }
  }

  try {
    const unified = await loadUnifiedReadingForLegacyEndpoint({
      userId,
      ctx,
      method: req.method,
    });
    if (unified.status === 'not_found') {
      res.status(404).json({ error: 'NOT_FOUND', code: notReadyCode(surface) });
      return;
    }
    if (unified.status === 'in_progress') {
      // The old client only understands a complete interpretation or an error;
      // 202 would look like a malformed successful response to that client.
      res.status(503).json({
        error: 'NATAL_READING_IN_PROGRESS',
        code: 'NATAL_READING_IN_PROGRESS',
        retryable: true,
        retryAfterMs: unified.retryAfterMs,
      });
      return;
    }

    const language = ctx.profile.language === 'en' ? 'en' : 'ru';
    const reading = unified.interpretation.content;
    const content = surface === 'portrait'
      ? adaptUnifiedToLegacyLongScrollPortrait(reading, language)
      : surface === 'aspects'
        ? adaptUnifiedToLegacyLongScrollAspects(reading, language)
        : surface === 'today'
          ? adaptUnifiedToLegacyLongScrollToday(reading, language)
          : surface === 'week'
            ? adaptUnifiedToLegacyLongScrollWeek(reading, language)
            : adaptUnifiedToLegacyLongScrollDive(reading, diveTopic!, language);

    res.status(200).json({
      interpretation: legacyInterpretationEnvelope(unified.interpretation, content, accessTier),
      source: 'natal_unified_compat_v1',
      accessTier,
      ...(surface === 'dive' ? { topic: diveTopic } : {}),
    });
  } catch (error) {
    console.error(
      `[natal/${surface}] compatibility projection failed:`,
      error instanceof Error ? error.message : error,
    );
    res.status(503).json({
      error: 'NATAL_READING_GENERATION_FAILED',
      code: 'NATAL_READING_GENERATION_FAILED',
      retryable: true,
    });
  }
}
