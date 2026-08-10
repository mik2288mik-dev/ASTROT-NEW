import type { NextApiRequest, NextApiResponse } from 'next';
import type { NatalChartData, SynastryResult, UserProfile } from '../../../../types';
import type { NatalChartDataV2 } from '../../../../lib/natalChartV2Types';
import { AdminAuthError, handleAdminError } from '../../../../lib/adminAuth';
import { requireAppUser } from '../../../../lib/auth/appAuth';
import { toPublicAppProfile } from '../../../../lib/auth/profile';
import { getOpenAIModelForContent } from '../../../../lib/appSettings';
import { calculateNatalChart } from '../../../../lib/swisseph-calculator';
import { db } from '../../../../lib/db';
import {
  FullSynastryAIResponse,
} from '../../../../lib/prompts';
import { validateSynastryInput, formatValidationErrors } from '../../../../lib/validation';
import { getContentLayer, getPremiumEntitlementState } from '../../../../lib/contentArchitecture';
import {
  buildSynastryExtendedCacheKey,
  SYNASTRY_CONTEXT_PROMPT_VERSION,
} from '../../../../lib/synastryExtended';
import { RATE_LIMIT_CONFIGS, withRateLimit } from '../../../../lib/rateLimit';
import { logContentApi, warnContentApi } from '../../../../lib/contentApiLogging';
import { buildSynastryPrompt, parseModelJson } from '../../../../lib/contentPromptBuilders';
import { computeSynastryAspects } from '../../../../lib/synastry/synastryAspects';
import {
  assertChartReadable,
  ChartAccessPolicyError,
} from '../../../../lib/chartAccessPolicy';
import { persistSavedSynastryHistory } from '../../../../lib/astrologyHistoryPersistence';
import {
  createLunaStructuredResponse,
  getOpenAIResponsesClient,
  type StrictJsonSchema,
} from '../../../../lib/openaiResponses';

const SCOPE = 'synastry-extended';

const SYNASTRY_RESPONSE_SCHEMA: StrictJsonSchema = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    generalTheme: { type: 'string' },
    attraction: { type: 'string' },
    difficulties: { type: 'string' },
    recommendations: { type: 'array', items: { type: 'string' } },
    potential: { type: 'string' },
    compatibilityScore: { type: 'number' },
  },
  required: [
    'summary',
    'generalTheme',
    'attraction',
    'difficulties',
    'recommendations',
    'potential',
    'compatibilityScore',
  ],
  additionalProperties: false,
};

type SynastryChartData = NatalChartData | NatalChartDataV2;

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

  let auth;
  try {
    auth = await requireAppUser(req);
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
    subjectChartId,
    subjectName,
    subjectDate,
    subjectTime,
    subjectPlace,
  } = req.body || {};

  const hasSubjectChartId = subjectChartId !== undefined
    && subjectChartId !== null
    && String(subjectChartId).trim() !== '';
  const requestedSubjectChartId = hasSubjectChartId ? Number(subjectChartId) : null;
  if (
    requestedSubjectChartId !== null
    && (!Number.isSafeInteger(requestedSubjectChartId) || requestedSubjectChartId <= 0)
  ) {
    return res.status(400).json({
      error: 'Invalid first chart',
      code: 'SUBJECT_CHART_INVALID',
    });
  }

  const hasPartnerChartId = partnerChartId !== undefined
    && partnerChartId !== null
    && String(partnerChartId).trim() !== '';
  const requestedPartnerChartId = hasPartnerChartId ? Number(partnerChartId) : null;
  if (
    requestedPartnerChartId !== null
    && (!Number.isSafeInteger(requestedPartnerChartId) || requestedPartnerChartId <= 0)
  ) {
    return res.status(400).json({
      error: 'Invalid saved person chart',
      code: 'PARTNER_CHART_INVALID',
    });
  }

  const user = await db.users.get(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found', message: 'Profile not found' });
  }

  const profile = toPublicAppProfile(user, auth) as UserProfile;
  const userLang = (language || profile.language || 'ru') === 'en' ? 'en' : 'ru';
  const currentLanguage = userLang === 'en' ? 'en' : 'ru';
  const langRu = currentLanguage === 'ru';
  const rel = String(relationshipType || 'романтика').trim();
  const entitlementState = await getPremiumEntitlementState(userId);
  const isPremium = entitlementState.isPremium;

  logContentApi(
    { scope: SCOPE, userId, chartId: null, surface: 'synastry', variant: 'full' },
    'request_start',
    { metadata: { hasSubjectChartId, hasPartnerChartId, isPremium } }
  );

  if (!isPremium) {
    warnContentApi(
      { scope: SCOPE, userId, chartId: null, surface: 'synastry', variant: 'full' },
      'premium_required',
      { errorCode: 'PREMIUM_REQUIRED' },
    );
    return res.status(403).json({
      error: 'Premium required',
      code: 'PREMIUM_REQUIRED',
      premiumRequired: true,
      message: langRu
        ? 'Сравнение по натальным картам доступно в Premium.'
        : 'Natal chart compatibility is available in Premium.',
    });
  }

  let primaryChartRecord: any = null;
  let partnerChartRecord: any = null;
  let userChartData: SynastryChartData | null = null;
  let partnerChartData: SynastryChartData | null = null;

  const resolvedManualSubjectName = String(subjectName || '').trim();
  const resolvedManualSubjectDate = String(subjectDate || '').trim();
  const resolvedManualSubjectTime = String(subjectTime || '').trim();
  const resolvedManualSubjectPlace = String(subjectPlace || '').trim();
  const hasManualSubject = requestedSubjectChartId === null
    && Boolean(resolvedManualSubjectName && resolvedManualSubjectDate && resolvedManualSubjectPlace);

  primaryChartRecord = requestedSubjectChartId !== null
    ? await db.natal_charts.getById(requestedSubjectChartId)
    : hasManualSubject
      ? null
      : await db.natal_charts.getPrimary(userId);
  if (primaryChartRecord) {
    if (String(primaryChartRecord.user_id) !== userId) {
      return res.status(404).json({
        error: 'First chart not found',
        code: 'SUBJECT_CHART_NOT_FOUND',
        message: langRu ? 'Первая сохранённая карта не найдена.' : 'The first saved chart was not found.',
      });
    }
    try {
      assertChartReadable(primaryChartRecord, isPremium);
    } catch (error) {
      if (error instanceof ChartAccessPolicyError) {
        return res.status(error.status).json({
          error: error.message,
          code: error.code,
          premiumRequired: error.code === 'PREMIUM_REQUIRED',
        });
      }
      throw error;
    }
    userChartData = (primaryChartRecord.chart_data as SynastryChartData) || null;
    if (!primaryChartRecord.id || !userChartData) {
      return res.status(409).json({
        error: 'Natal chart required',
        code: 'NEEDS_CHART',
        message: langRu ? 'В первой карте нет готового расчёта.' : 'The first chart has no calculation.',
      });
    }
  } else if (!hasManualSubject) {
    return res.status(404).json({
      error: 'First chart not found',
      code: 'SUBJECT_CHART_NOT_FOUND',
      message: langRu ? 'Добавь данные первого человека.' : 'Add the first person details.',
    });
  }

  if (requestedPartnerChartId !== null) {
    partnerChartRecord = await db.natal_charts.getById(requestedPartnerChartId);
    if (!partnerChartRecord || String(partnerChartRecord.user_id) !== userId) {
      return res.status(404).json({
        error: 'Partner chart not found',
        code: 'PARTNER_CHART_NOT_FOUND',
        message: langRu ? 'Сохранённая карта человека не найдена.' : 'Saved person chart not found',
      });
    }
    try {
      assertChartReadable(partnerChartRecord, isPremium);
    } catch (error) {
      if (error instanceof ChartAccessPolicyError) {
        return res.status(error.status).json({
          error: error.message,
          code: error.code,
          premiumRequired: error.code === 'PREMIUM_REQUIRED',
        });
      }
      throw error;
    }
    if (primaryChartRecord?.id && partnerChartRecord.id === primaryChartRecord.id) {
      return res.status(400).json({
        error: 'Select two different charts',
        code: 'CHART_PAIR_DUPLICATE',
        message: langRu ? 'Для сравнения нужны две разные карты.' : 'Choose two different charts.',
      });
    }
    partnerChartData = (partnerChartRecord.chart_data as SynastryChartData) || null;
  }

  const subjectProfile = {
    ...profile,
    name: String(primaryChartRecord?.name || resolvedManualSubjectName || profile.name || '').trim(),
    birthDate: String(primaryChartRecord?.birth_date || resolvedManualSubjectDate || profile.birthDate || '').trim(),
    birthTime: String(primaryChartRecord?.birth_time ?? resolvedManualSubjectTime ?? profile.birthTime ?? '').trim(),
    birthPlace: String(primaryChartRecord?.birth_place || resolvedManualSubjectPlace || profile.birthPlace || '').trim(),
  } as UserProfile;
  const primaryChartId = primaryChartRecord?.id ?? null;
  const resolvedPartnerName = String(partnerChartRecord?.name || partnerName || '').trim();
  const resolvedPartnerDate = String(partnerChartRecord?.birth_date || partnerDate || '').trim();
  const resolvedPartnerTime = String(partnerChartRecord?.birth_time ?? partnerTime ?? '').trim();
  const resolvedPartnerPlace = String(partnerChartRecord?.birth_place || partnerPlace || '').trim();
  if (!partnerChartRecord && !resolvedPartnerPlace) {
    return res.status(400).json({
      error: 'Partner birth place required',
      code: 'PARTNER_BIRTH_PLACE_REQUIRED',
      message: langRu ? 'Укажи место рождения второй карты.' : 'Add the second chart birth place.',
    });
  }
  const validation = validateSynastryInput({
    profile: subjectProfile,
    partnerName: resolvedPartnerName,
    partnerDate: resolvedPartnerDate,
    partnerTime: resolvedPartnerTime,
    partnerPlace: resolvedPartnerPlace,
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

  const contentCacheKey = buildSynastryExtendedCacheKey(
    userId,
    primaryChartId,
    partnerChartRecord?.id ?? null,
    resolvedPartnerName,
    resolvedPartnerDate,
    rel,
    currentLanguage,
    resolvedPartnerTime,
    resolvedPartnerPlace,
    subjectProfile.name,
    subjectProfile.birthDate,
    subjectProfile.birthTime || '',
    subjectProfile.birthPlace || '',
  );

  logContentApi(
    {
      scope: SCOPE,
      userId,
      chartId: primaryChartId,
      surface: 'synastry',
      variant: 'full',
    },
    'access_check',
    {
      accessTier: isPremium ? 'premium' : 'locked',
      metadata: { isPremium },
    }
  );

  const cachedResult = await loadCachedSynastry(
    userId,
    primaryChartId,
    partnerChartRecord?.id ?? null,
    contentCacheKey
  );

  if (cachedResult) {
    logContentApi(
      {
        scope: SCOPE,
        userId,
        chartId: primaryChartId,
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

  if (!userChartData) {
    userChartData = await calculateNatalChart(
      subjectProfile.name,
      subjectProfile.birthDate || '',
      subjectProfile.birthTime || '',
      subjectProfile.birthPlace || '',
    );
  }

  if (!partnerChartData) {
    partnerChartData = await calculateNatalChart(
      resolvedPartnerName,
      resolvedPartnerDate,
      resolvedPartnerTime,
      resolvedPartnerPlace
    );
  }

  const accessTier = 'premium' as const;
  let resultPayload: SynastryResult;
  const synastryAspects = computeSynastryAspects(userChartData, partnerChartData);

  logContentApi(
    {
      scope: SCOPE,
      userId,
      chartId: primaryChartId,
      surface: 'synastry',
      variant: 'full',
    },
    'generation_start',
    { accessTier }
  );

  try {
    const modelAssignment = await getOpenAIModelForContent({
      accessTier,
      contentSurface: 'synastry',
      contentVariant: 'full',
    });
    const aiClient = getOpenAIResponsesClient();
    if (!aiClient) {
      resultPayload = mapFullToSynastryResult(buildSynastryFallback(
        langRu,
        subjectProfile.name,
        resolvedPartnerName,
        rel,
      ));
    } else {
      const prompt = buildSynastryPrompt({
        language: currentLanguage,
        context: {
          profile: { name: subjectProfile.name },
          partnerName: resolvedPartnerName,
          userChartData,
          partnerChartData,
          relationship: rel,
          synastryAspects,
        },
      });
      const response = await createLunaStructuredResponse({
        instructions: prompt.system,
        input: prompt.user,
        maxOutputTokens: 2500,
        schemaName: 'extended_synastry',
        schema: SYNASTRY_RESPONSE_SCHEMA,
      });
      const parsed = parseModelJson<FullSynastryAIResponse & { summary?: string; compatibilityScore?: number }>(
        response.content,
        buildSynastryFallback(langRu, subjectProfile.name, resolvedPartnerName, rel)
      );
      resultPayload = mapFullToSynastryResult(parsed);
    }

    const { modelTier } = modelAssignment;

    if (primaryChartId && partnerChartRecord?.id) {
      await db.synastry.set(
        primaryChartId,
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

    if (primaryChartId) {
      await db.content_interpretations.upsertByChart(
        primaryChartId,
        interpretationData,
        userId
      );
    }

    if (primaryChartId && partnerChartRecord?.id) {
      try {
        await persistSavedSynastryHistory({
          userId,
          subjectChartId: primaryChartId,
          counterpartChartId: partnerChartRecord.id,
          subjectChart: userChartData,
          counterpartChart: partnerChartData,
          subjectBirthTime: primaryChartRecord?.birth_time || subjectProfile.birthTime,
          counterpartBirthTime: partnerChartRecord.birth_time,
          inputHash: contentCacheKey,
          language: currentLanguage,
          relationshipType: rel,
          aspects: synastryAspects,
          content: resultPayload,
          provider: aiClient ? 'openai' : 'deterministic',
          modelId: aiClient ? modelAssignment.model : 'deterministic-synastry-fallback-v1',
          promptVersion: SYNASTRY_CONTEXT_PROMPT_VERSION,
          generationAttempts: aiClient ? 1 : 0,
        });
      } catch (historyError) {
        console.error(
          '[synastry/history] saved reading could not be appended to durable history:',
          historyError instanceof Error ? historyError.message : historyError,
        );
      }
    }
  } catch (err: any) {
    warnContentApi(
      {
        scope: SCOPE,
        userId,
        chartId: primaryChartId,
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
      chartId: primaryChartId,
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
