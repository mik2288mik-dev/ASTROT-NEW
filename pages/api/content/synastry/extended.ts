import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import type { NatalChartData, SynastryResult, UserProfile } from '../../../../types';
import { AdminAuthError, handleAdminError } from '../../../../lib/adminAuth';
import { requireAppUser } from '../../../../lib/auth/appAuth';
import { toPublicAppProfile } from '../../../../lib/auth/profile';
import { getOpenAIModelForContent } from '../../../../lib/appSettings';
import { buildOpenAIChatParams } from '../../../../lib/openaiChat';
import { calculateNatalChart } from '../../../../lib/swisseph-calculator';
import { db } from '../../../../lib/db';
import {
  FullSynastryAIResponse,
} from '../../../../lib/prompts';
import { validateSynastryInput, formatValidationErrors } from '../../../../lib/validation';
import { getContentLayer, getPremiumEntitlementState } from '../../../../lib/contentArchitecture';
import { buildSynastryExtendedCacheKey } from '../../../../lib/synastryExtended';
import { RATE_LIMIT_CONFIGS, withRateLimit } from '../../../../lib/rateLimit';
import { logContentApi, warnContentApi } from '../../../../lib/contentApiLogging';
import { buildSynastryPrompt, parseModelJson } from '../../../../lib/contentPromptBuilders';
import { computeSynastryAspects } from '../../../../lib/synastry/synastryAspects';

const SCOPE = 'synastry-extended';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

function mapFullToSynastryResult(raw: FullSynastryAIResponse & { summary?: string; compatibilityScore?: number }): SynastryResult {
  const score =
    typeof raw.compatibilityScore === 'number' && Number.isFinite(raw.compatibilityScore)
      ? Math.min(100, Math.max(0, Math.round(raw.compatibilityScore)))
      : undefined;
  return {
    summary: String(raw.summary || '').trim() || '—',
    compatibilityScore: score,
    fullAnalysis: {
      generalTheme: String(raw.generalTheme || '').trim(),
      attraction: String(raw.attraction || '').trim(),
      difficulties: String(raw.difficulties || '').trim(),
      recommendations: Array.isArray(raw.recommendations)
        ? raw.recommendations.map((item) => String(item || '').trim()).filter(Boolean)
        : [],
      potential: String(raw.potential || '').trim(),
    },
  };
}

function buildSynastryFallback(
  langRu: boolean,
  firstName: string,
  partnerName: string,
  relationship: string,
): FullSynastryAIResponse & { summary: string } {
  const normalized = relationship.toLowerCase();
  const isWork = normalized.includes('работ') || normalized.includes('делов');
  const isFriendship = normalized.includes('друж');
  const isFamily = normalized.includes('сем');
  const relationRu = isWork ? 'рабочего союза' : isFriendship ? 'дружбы' : isFamily ? 'семейной связи' : 'отношений';
  const relationEn = isWork ? 'work partnership' : isFriendship ? 'friendship' : isFamily ? 'family bond' : 'relationship';
  return {
    summary: langRu
      ? `Главная проверка ${relationRu} ${firstName} и ${partnerName} — не угадывать ожидания, а сверять их словами и поступками.`
      : `The main test of the ${relationEn} between ${firstName} and ${partnerName} is replacing guesses with clear words and repeated actions.`,
    generalTheme: langRu ? 'Связь держится крепче, когда ожидания названы прямо.' : 'The bond holds better when expectations are stated directly.',
    attraction: langRu
      ? (isWork ? 'Вместе вы можете замечать разные стороны одной задачи и быстрее находить рабочий вариант.' : isFriendship ? 'Контакт держится на живом отклике и ощущении, что рядом не нужно постоянно играть роль.' : isFamily ? 'Связь поддерживает знание привычек друг друга и способность замечать реальную помощь.' : 'Притяжение усиливает живой отклик и ощущение, что рядом привычное видно по-новому.')
      : (isWork ? 'You can notice different sides of one task and reach a workable option faster together.' : isFriendship ? 'The connection is supported by a lively response and less need to perform.' : isFamily ? 'The bond is supported by knowing each other’s patterns and recognizing practical care.' : 'Attraction grows through a lively response and a fresh view of familiar things.'),
    difficulties: langRu ? 'Сложности начинаются, когда один торопится с выводом, а другой уходит от разговора.' : 'Friction starts when one rushes to a conclusion and the other avoids the conversation.',
    recommendations: langRu ? ['Сначала уточни, что человек имел в виду.', 'Говори о конкретной ситуации, а не о характере.', 'Договоритесь, когда вернуться к сложному разговору.'] : ['Clarify what the other person meant.', 'Discuss the situation, not their character.', 'Agree when to return to a hard conversation.'],
    potential: langRu ? 'Потенциал этой связи раскрывается там, где договорённость можно проверить действием.' : 'The bond’s potential shows where an agreement can be confirmed by action.',
  };
}

async function loadCachedSynastry(
  userId: string,
  primaryChartId: number | null,
  partnerChartId: number | null,
  contentCacheKey: string
): Promise<SynastryResult | null> {
  if (primaryChartId && partnerChartId) {
    const cached = await db.synastry.get(
      primaryChartId,
      partnerChartId,
      'extended',
      contentCacheKey
    );
    if (cached) {
      const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
      if (parsed?.fullAnalysis) return parsed as SynastryResult;
    }
  }

  const layer = await getContentLayer({
    userId,
    chartId: primaryChartId,
    accessTier: 'premium',
    contentSurface: 'synastry',
    contentVariant: 'full',
    cacheKey: contentCacheKey,
  });
  if (layer.interpretation?.content && typeof layer.interpretation.content === 'object') {
    const payload = layer.interpretation.content as SynastryResult;
    if (payload.fullAnalysis) return payload;
  }

  return null;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const startedAt = Date.now();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const claimedUserId = String(req.body?.userId || req.body?.profile?.id || '').trim();

  let auth;
  try {
    auth = await requireAppUser(req, { expectedUserId: claimedUserId || undefined });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return handleAdminError(res, error);
    }
    throw error;
  }

  const userId = auth.userId;

  const {
    partnerName,
    partnerDate,
    partnerTime,
    partnerPlace,
    language,
    relationshipType,
    partnerChartId,
  } = req.body;

  const user = await db.users.get(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found', message: 'Profile not found' });
  }

  const profile = toPublicAppProfile(user, auth) as UserProfile;
  const userLang = (language || profile.language || 'ru') === 'en' ? 'en' : 'ru';

  const validation = validateSynastryInput({
    profile,
    partnerName,
    partnerDate,
    partnerTime,
    partnerPlace,
    language: userLang,
  });

  if (!validation.isValid) {
    const errorMessage = formatValidationErrors(validation.errors, userLang);
    return res.status(400).json({
      error: 'Validation failed',
      message: errorMessage,
      errors: validation.errors,
    });
  }

  logContentApi(
    { scope: SCOPE, userId, chartId: null, surface: 'synastry', variant: 'full' },
    'request_start',
    { metadata: { hasPartnerChartId: !!partnerChartId } }
  );

  const rel = String(relationshipType || 'романтика').trim();
  const currentLanguage = userLang === 'en' ? 'en' : 'ru';
  const langRu = currentLanguage === 'ru';

  let primaryChartRecord: any = null;
  let partnerChartRecord: any = null;
  let userChartData: NatalChartData | null = null;
  let partnerChartData: NatalChartData | null = null;

  primaryChartRecord = await db.natal_charts.getPrimary(userId);
  userChartData = (primaryChartRecord?.chart_data as NatalChartData) || null;

  if (partnerChartId) {
    partnerChartRecord = await db.natal_charts.getById(Number(partnerChartId));
    if (!partnerChartRecord || String(partnerChartRecord.user_id) !== userId) {
      return res.status(404).json({
        error: 'Partner chart not found',
        message: langRu ? 'Сохранённая карта партнёра не найдена.' : 'Saved partner chart not found',
      });
    }
    partnerChartData = (partnerChartRecord.chart_data as NatalChartData) || null;
  }

  if (!primaryChartRecord?.id || !userChartData) {
    return res.status(409).json({
      error: 'Natal chart required',
      code: 'NEEDS_CHART',
      message: langRu ? 'Сначала создай натальную карту.' : 'Create your natal chart first.',
    });
  }

  const contentCacheKey = buildSynastryExtendedCacheKey(
    userId,
    primaryChartRecord.id,
    partnerChartRecord?.id ?? null,
    partnerName,
    partnerDate,
    rel,
    currentLanguage
  );

  const entitlementState = await getPremiumEntitlementState(userId);
  const isPremium = entitlementState.isPremium;

  logContentApi(
    {
      scope: SCOPE,
      userId,
      chartId: primaryChartRecord.id,
      surface: 'synastry',
      variant: 'full',
    },
    'access_check',
    {
      accessTier: isPremium ? 'premium' : 'locked',
      metadata: { isPremium },
    }
  );

  if (!isPremium) {
    warnContentApi(
      {
        scope: SCOPE,
        userId,
        chartId: primaryChartRecord.id,
        surface: 'synastry',
        variant: 'full',
      },
      'premium_required',
      { errorCode: 'PREMIUM_REQUIRED' }
    );
    return res.status(403).json({
      error: 'Premium required',
      code: 'PREMIUM_REQUIRED',
      premiumRequired: true,
      message: langRu
        ? 'Полный разбор совместимости доступен в Premium.'
        : 'The full compatibility reading is available in Premium.',
    });
  }

  const cachedResult = await loadCachedSynastry(
    userId,
    primaryChartRecord.id,
    partnerChartRecord?.id ?? null,
    contentCacheKey
  );

  if (cachedResult) {
    logContentApi(
      {
        scope: SCOPE,
        userId,
        chartId: primaryChartRecord.id,
        surface: 'synastry',
        variant: 'full',
      },
      'cache_hit',
      {
        accessTier: 'premium',
        status: 'ready',
        durationMs: Date.now() - startedAt,
      }
    );
    return res.status(200).json({
      result: cachedResult,
      fromCache: true,
      accessTier: 'premium',
    });
  }

  if (!partnerChartData) {
    partnerChartData = await calculateNatalChart(
      partnerName,
      partnerDate,
      partnerTime || '12:00',
      partnerPlace || profile.birthPlace
    );
  }

  const accessTier = 'premium' as const;
  let resultPayload: SynastryResult;

  logContentApi(
    {
      scope: SCOPE,
      userId,
      chartId: primaryChartRecord.id,
      surface: 'synastry',
      variant: 'full',
    },
    'generation_start',
    { accessTier }
  );

  try {
    if (!openai) {
      resultPayload = mapFullToSynastryResult(buildSynastryFallback(langRu, profile.name, partnerName, rel));
    } else {
      const synastryAspects = computeSynastryAspects(userChartData, partnerChartData);
      const prompt = buildSynastryPrompt({
        language: currentLanguage,
        context: { profile, partnerName, userChartData, partnerChartData, relationship: rel, synastryAspects },
      });
      const { model: modelId } = await getOpenAIModelForContent({
        accessTier,
        contentSurface: 'synastry',
        contentVariant: 'full',
      });
      const completion = await openai.chat.completions.create(buildOpenAIChatParams(modelId, {
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ],
        temperature: 0.72,
        maxTokens: 2500,
        jsonMode: true,
      }));
      const content = completion.choices[0]?.message?.content || '{}';
      const parsed = parseModelJson<FullSynastryAIResponse & { summary?: string; compatibilityScore?: number }>(
        content,
        buildSynastryFallback(langRu, profile.name, partnerName, rel)
      );
      resultPayload = mapFullToSynastryResult(parsed);
    }

    const { modelTier } = await getOpenAIModelForContent({
      accessTier,
      contentSurface: 'synastry',
      contentVariant: 'full',
    });

    if (partnerChartRecord?.id) {
      await db.synastry.set(
        primaryChartRecord.id,
        partnerChartRecord.id,
        'extended',
        contentCacheKey,
        resultPayload
      );
    }

    const interpretationData = {
      accessTier,
      contentSurface: 'synastry' as const,
      contentVariant: 'full' as const,
      cacheKey: contentCacheKey,
      inputHash: contentCacheKey,
      content: resultPayload,
      modelTier,
      isPersistent: true,
      legacySource: 'synastry.full.premium',
    };

    await db.content_interpretations.upsertByChart(
      primaryChartRecord.id,
      interpretationData,
      userId
    );
  } catch (err: any) {
    warnContentApi(
      {
        scope: SCOPE,
        userId,
        chartId: primaryChartRecord.id,
        surface: 'synastry',
        variant: 'full',
      },
      'generation_failed',
      {
        accessTier,
        errorCode: 'SYNASTRY_EXTENDED_SAVE_FAILED',
        durationMs: Date.now() - startedAt,
        metadata: { message: String(err?.message || 'unknown') },
      }
    );
    return res.status(500).json({
      error: 'Synastry extended failed',
      message: err?.message || (langRu ? 'Не удалось сохранить разбор.' : 'Could not save reading.'),
    });
  }

  logContentApi(
    {
      scope: SCOPE,
      userId,
      chartId: primaryChartRecord.id,
      surface: 'synastry',
      variant: 'full',
    },
    'generation_success',
    {
      accessTier,
      status: 'ready',
      durationMs: Date.now() - startedAt,
      metadata: { fromCache: false },
    }
  );

  return res.status(200).json({
    result: resultPayload,
    fromCache: false,
    accessTier,
  });
}

export default withRateLimit(handler, () => RATE_LIMIT_CONFIGS.AI_FREE);
