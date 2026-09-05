import type { NextApiRequest, NextApiResponse } from 'next';
import type { ContentModelTier, NatalChartData, SynastryResult, UserProfile } from '../../../../types';
import type { NatalChartDataV2 } from '../../../../lib/natalChartV2Types';
import { AdminAuthError, handleAdminError } from '../../../../lib/adminAuth';
import { requireAppUser } from '../../../../lib/auth/appAuth';
import { toPublicAppProfile } from '../../../../lib/auth/profile';
import { getOpenAIModelForContent } from '../../../../lib/appSettings';
import { db } from '../../../../lib/db';
import {
  formatValidationErrors,
  validateBirthPlace,
  validateDate,
  validateName,
  validateTime,
  type ValidationError,
} from '../../../../lib/validation';
import { getContentLayer, getPremiumEntitlementState } from '../../../../lib/contentArchitecture';
import {
  buildSynastryExtendedCacheKey,
  SYNASTRY_CONTEXT_PROMPT_VERSION,
} from '../../../../lib/synastryExtended';
import { RATE_LIMIT_CONFIGS, withRateLimit } from '../../../../lib/rateLimit';
import { logContentApi, warnContentApi } from '../../../../lib/contentApiLogging';
import {
  classifyCompatibilityPerson,
  normalizeCompatibilityPersonSource,
  resolveCompatibilityPairLevel,
  type CompatibilityPairLevel,
  type CompatibilityPersonSource,
} from '../../../../lib/synastry/compatibilityInput';
import { normalizeZodiacKey } from '../../../../lib/zodiacKeys';
import { createOrReuseCanonicalChart } from '../../../../lib/natalChartPersistence';
import { isCanonicalNatalChartDataComplete } from '../../../../lib/natalChartCanonical';
import {
  calculateCompatibility,
  COMPATIBILITY_ENGINE_VERSION,
} from '../../../../lib/synastry/compatibilityEngine';
import {
  buildCompatibilityResult,
  CompatibilityNarrativeError,
  COMPATIBILITY_NARRATIVE_VERSION,
} from '../../../../lib/synastry/compatibilityNarrative';
import { buildCompatibilityStoryPrompt, COMPATIBILITY_STORY_SCHEMA } from '../../../../lib/synastry/compatibilityVoice';
import {
  normalizeRelationshipContext,
  type RelationshipContext,
} from '../../../../lib/synastry/relationshipContext';
import { buildDeepCompatibilityReactionKey } from '../../../../lib/synastry/compatibilityReaction';
import {
  assertChartReadable,
  ChartAccessPolicyError,
} from '../../../../lib/chartAccessPolicy';
import { persistSavedSynastryHistory } from '../../../../lib/astrologyHistoryPersistence';
import {
  createLunaStructuredResponse,
  getOpenAIResponsesClient,
} from '../../../../lib/openaiResponses';

const SCOPE = 'synastry-extended';

type SynastryChartData = NatalChartData | NatalChartDataV2;

function savedSunSign(chart: SynastryChartData | null): string {
  return String((chart as NatalChartDataV2 | null)?.positions?.sun?.sign || chart?.sun?.sign || '').trim();
}

type FlexiblePersonInput = {
  source: CompatibilityPersonSource;
  name: string;
  date: string;
  time: string;
  place: string;
  sign: string;
  birthTimeQuality: 'exact' | 'approximate' | 'unknown';
};

function validateFlexiblePerson(input: FlexiblePersonInput, fieldPrefix: 'subject' | 'partner'): ValidationError[] {
  const errors: ValidationError[] = [];
  if (input.source === 'sign') {
    if (!normalizeZodiacKey(input.sign)) {
      errors.push({ field: `${fieldPrefix}Sign`, message: 'Zodiac sign is required' });
    }
    return errors;
  }
  if (input.source === 'saved') return errors;

  const date = validateDate(input.date);
  if (!date.isValid) errors.push({ field: `${fieldPrefix}Date`, message: date.error || 'Invalid birth date' });
  if (input.name) {
    const name = validateName(input.name);
    if (!name.isValid) errors.push({ field: `${fieldPrefix}Name`, message: name.error || 'Invalid name' });
  }
  if (input.time) {
    const time = validateTime(input.time);
    if (!time.isValid) errors.push({ field: `${fieldPrefix}Time`, message: time.error || 'Invalid birth time' });
  }
  const place = validateBirthPlace(input.place);
  if (!place.isValid) errors.push({ field: `${fieldPrefix}Place`, message: place.error || 'Invalid birth place' });
  return errors;
}

function buildWriterPersonContext(
  input: FlexiblePersonInput,
  gender: 'male' | 'female',
) {
  return {
    source: input.source,
    name: input.name,
    gender,
    zodiacSign: normalizeZodiacKey(input.sign) || null,
    birthTimeQuality: input.birthTimeQuality,
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
      if (parsed?.schemaVersion === 'compatibility-v2' && parsed?.engineVersion === COMPATIBILITY_ENGINE_VERSION && parsed?.narrativeVersion === COMPATIBILITY_NARRATIVE_VERSION) {
        return parsed as SynastryResult;
      }
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
    if (payload.schemaVersion === 'compatibility-v2' && payload.engineVersion === COMPATIBILITY_ENGINE_VERSION && payload.narrativeVersion === COMPATIBILITY_NARRATIVE_VERSION) {
      return payload;
    }
  }

  return null;
}

function normalizeBirthTimeQuality(value: unknown, time: string): 'exact' | 'approximate' | 'unknown' {
  if (value === 'approximate' && time) return 'approximate';
  if (value === 'unknown' || !time) return 'unknown';
  return 'exact';
}

function resolveRelationshipContext(value: unknown, legacyLabel: string): RelationshipContext {
  if (value != null) return normalizeRelationshipContext(value);
  const normalized = legacyLabel.toLowerCase();
  if (normalized.includes('бывш') || normalized.includes('former') || normalized === 'ex') return 'ex';
  if (normalized.includes('друж') || normalized.includes('friend')) return 'friendship';
  if (normalized.includes('работ') || normalized.includes('делов') || normalized.includes('work') || normalized.includes('business')) return 'work';
  if (normalized.includes('сем') || normalized.includes('family')) return 'family';
  if (normalized.includes('существующ') || normalized === 'отношения' || normalized.includes('established')) return 'relationship';
  return 'romance';
}

async function saveManualNatal(userId: string, input: FlexiblePersonInput, language: string) {
  const result = await createOrReuseCanonicalChart({
    userId,
    name: input.name,
    birthDate: input.date,
    birthTime: input.time,
    birthPlace: input.place,
    birthTimeMode: input.birthTimeQuality,
    birthTimeUncertaintyMinutes: input.birthTimeQuality === 'approximate' ? 30 : undefined,
    language,
  });
  return result.chart;
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
    subjectSource,
    partnerSource,
    subjectSign,
    partnerSign,
    subjectGender,
    partnerGender,
    subjectBirthTimeQuality,
    partnerBirthTimeQuality,
    relationshipContext: requestedRelationshipContext,
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

  const legacySubjectUsesPrimary = subjectSource == null
    && !hasSubjectChartId
    && !String(subjectDate || '').trim()
    && !String(subjectSign || '').trim();
  const normalizedSubjectSource = normalizeCompatibilityPersonSource({
    source: legacySubjectUsesPrimary ? 'saved' : subjectSource,
    chartId: requestedSubjectChartId,
    date: subjectDate,
    sign: subjectSign,
  });
  const normalizedPartnerSource = normalizeCompatibilityPersonSource({
    source: partnerSource,
    chartId: requestedPartnerChartId,
    date: partnerDate,
    sign: partnerSign,
  });

  const user = await db.users.get(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found', message: 'Profile not found' });
  }

  const profile = toPublicAppProfile(user, auth) as UserProfile;
  const userLang = (language || profile.language || 'ru') === 'en' ? 'en' : 'ru';
  const currentLanguage = userLang === 'en' ? 'en' : 'ru';
  const langRu = currentLanguage === 'ru';
  if (normalizedSubjectSource === 'sign' || normalizedPartnerSource === 'sign') {
    return res.status(400).json({
      error: 'Use free sign compatibility',
      code: 'USE_SIGN_COMPATIBILITY',
      message: langRu
        ? 'Для сравнения по знакам используй бесплатный режим. Для полного сравнения нужны две сохранённые карты.'
        : 'Use the free mode for zodiac signs. Full compatibility requires two saved charts.',
    });
  }
  const rel = String(relationshipType || 'романтика').trim();
  const relationshipContext = resolveRelationshipContext(requestedRelationshipContext, rel);
  const entitlementState = await getPremiumEntitlementState(userId);
  const isPremium = entitlementState.isPremium;

  logContentApi(
    { scope: SCOPE, userId, chartId: null, surface: 'synastry', variant: 'full' },
    'request_start',
    {
      metadata: {
        hasSubjectChartId,
        hasPartnerChartId,
        subjectSource: normalizedSubjectSource,
        partnerSource: normalizedPartnerSource,
        isPremium,
      },
    }
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
        ? 'Подробный AI-разбор совместимости доступен в Premium.'
        : 'The detailed AI compatibility reading is available in Premium.',
    });
  }

  let primaryChartRecord: any = null;
  let partnerChartRecord: any = null;
  let userChartData: SynastryChartData | null = null;
  let partnerChartData: SynastryChartData | null = null;
  const accessibleCharts = await db.natal_charts.getAll(userId);

  const resolvedManualSubjectName = String(subjectName || '').trim();
  const resolvedManualSubjectDate = String(subjectDate || '').trim();
  const resolvedManualSubjectTime = String(subjectTime || '').trim();
  const resolvedManualSubjectPlace = String(subjectPlace || '').trim();
  const hasManualSubject = normalizedSubjectSource === 'birth' && Boolean(resolvedManualSubjectDate);

  if (normalizedSubjectSource === 'saved') {
    primaryChartRecord = requestedSubjectChartId !== null
      ? await db.natal_charts.getById(requestedSubjectChartId)
      : await db.natal_charts.getPrimary(userId);
  }
  if (normalizedSubjectSource === 'saved' && primaryChartRecord) {
    if (String(primaryChartRecord.user_id) !== userId) {
      return res.status(404).json({
        error: 'First chart not found',
        code: 'SUBJECT_CHART_NOT_FOUND',
        message: langRu ? 'Первая сохранённая карта не найдена.' : 'The first saved chart was not found.',
      });
    }
    try {
      assertChartReadable(primaryChartRecord, isPremium, accessibleCharts);
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
    if (!primaryChartRecord.id || !primaryChartRecord.input_hash || !isCanonicalNatalChartDataComplete(userChartData)) {
      return res.status(409).json({
        error: 'Natal chart required',
        code: 'CHART_REPAIR_REQUIRED',
        message: langRu ? 'В первой карте нет готового расчёта.' : 'The first chart has no calculation.',
      });
    }
  } else if (normalizedSubjectSource === 'saved') {
    return res.status(404).json({
      error: 'First chart not found',
      code: 'SUBJECT_CHART_NOT_FOUND',
      message: langRu ? 'Добавь данные первого человека.' : 'Add the first person details.',
    });
  } else if (normalizedSubjectSource === 'birth' && !hasManualSubject) {
    return res.status(400).json({
      error: 'First birth date required',
      code: 'SUBJECT_BIRTH_DATE_REQUIRED',
      message: langRu ? 'Укажи дату рождения первого человека.' : 'Add the first person birth date.',
    });
  }

  if (normalizedPartnerSource === 'saved' && requestedPartnerChartId === null) {
    return res.status(400).json({
      error: 'Second saved chart required',
      code: 'PARTNER_CHART_REQUIRED',
      message: langRu ? 'Выбери сохранённую карту второго человека.' : 'Choose the second saved chart.',
    });
  }

  if (normalizedPartnerSource === 'saved' && requestedPartnerChartId !== null) {
    partnerChartRecord = await db.natal_charts.getById(requestedPartnerChartId);
    if (!partnerChartRecord || String(partnerChartRecord.user_id) !== userId) {
      return res.status(404).json({
        error: 'Partner chart not found',
        code: 'PARTNER_CHART_NOT_FOUND',
        message: langRu ? 'Сохранённая карта человека не найдена.' : 'Saved person chart not found',
      });
    }
    try {
      assertChartReadable(partnerChartRecord, isPremium, accessibleCharts);
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

  const fallbackSubjectName = langRu ? 'Первый человек' : 'First person';
  const fallbackPartnerName = langRu ? 'Второй человек' : 'Second person';
  const subjectProfile = {
    ...profile,
    name: String(primaryChartRecord?.name || resolvedManualSubjectName || fallbackSubjectName).trim(),
    birthDate: String(primaryChartRecord?.birth_date || resolvedManualSubjectDate || '').trim(),
    birthTime: String(primaryChartRecord?.birth_time ?? resolvedManualSubjectTime ?? '').trim(),
    birthPlace: String(primaryChartRecord?.birth_place || resolvedManualSubjectPlace || '').trim(),
  } as UserProfile;
  const resolvedPartnerName = String(partnerChartRecord?.name || partnerName || fallbackPartnerName).trim();
  const resolvedPartnerDate = String(partnerChartRecord?.birth_date || partnerDate || '').trim();
  const resolvedPartnerTime = String(partnerChartRecord?.birth_time ?? partnerTime ?? '').trim();
  const resolvedPartnerPlace = String(partnerChartRecord?.birth_place || partnerPlace || '').trim();
  const normalizedSubjectGender = subjectGender === 'female' ? 'female' : 'male';
  const normalizedPartnerGender = partnerGender === 'male' ? 'male' : 'female';
  const subjectInput: FlexiblePersonInput = {
    source: normalizedSubjectSource,
    name: subjectProfile.name,
    date: subjectProfile.birthDate || '',
    time: subjectProfile.birthPlace ? (subjectProfile.birthTime || '') : '',
    place: subjectProfile.birthPlace || '',
    sign: savedSunSign(userChartData),
    birthTimeQuality: normalizedSubjectSource === 'saved'
      ? normalizeBirthTimeQuality((userChartData as any)?.birthTimeQuality, subjectProfile.birthTime || '')
      : normalizeBirthTimeQuality(subjectBirthTimeQuality, resolvedManualSubjectTime),
  };
  const partnerInput: FlexiblePersonInput = {
    source: normalizedPartnerSource,
    name: resolvedPartnerName,
    date: resolvedPartnerDate,
    time: resolvedPartnerPlace ? resolvedPartnerTime : '',
    place: resolvedPartnerPlace,
    sign: savedSunSign(partnerChartData),
    birthTimeQuality: normalizedPartnerSource === 'saved'
      ? normalizeBirthTimeQuality((partnerChartData as any)?.birthTimeQuality, resolvedPartnerTime)
      : normalizeBirthTimeQuality(partnerBirthTimeQuality, resolvedPartnerTime),
  };
  const validationErrors = [
    ...validateFlexiblePerson(subjectInput, 'subject'),
    ...validateFlexiblePerson(partnerInput, 'partner'),
  ];

  if (validationErrors.length) {
    const errorMessage = formatValidationErrors(validationErrors, userLang);
    return res.status(400).json({
      error: 'Validation failed',
      message: errorMessage,
      errors: validationErrors,
    });
  }

  try {
    if (normalizedSubjectSource === 'birth') {
      primaryChartRecord = await saveManualNatal(userId, subjectInput, currentLanguage);
      userChartData = primaryChartRecord.chart_data || null;
      subjectInput.source = 'saved';
      subjectInput.sign = savedSunSign(userChartData);
      subjectInput.birthTimeQuality = normalizeBirthTimeQuality(
        (userChartData as NatalChartDataV2 | null)?.birthTimeQuality,
        subjectInput.time,
      );
    }
    if (normalizedPartnerSource === 'birth') {
      partnerChartRecord = await saveManualNatal(userId, partnerInput, currentLanguage);
      partnerChartData = partnerChartRecord.chart_data || null;
      partnerInput.source = 'saved';
      partnerInput.sign = savedSunSign(partnerChartData);
      partnerInput.birthTimeQuality = normalizeBirthTimeQuality(
        (partnerChartData as NatalChartDataV2 | null)?.birthTimeQuality,
        partnerInput.time,
      );
    }
  } catch (error: any) {
    if (error instanceof ChartAccessPolicyError) {
      return res.status(error.status).json({
        error: error.message,
        code: error.code,
        premiumRequired: error.code === 'PREMIUM_REQUIRED',
      });
    }
    warnContentApi(
      { scope: SCOPE, userId, chartId: primaryChartRecord?.id ?? null, surface: 'synastry', variant: 'full' },
      'calculation_failed',
      { errorCode: 'SYNASTRY_CALCULATION_FAILED', metadata: { message: String(error?.message || 'unknown') } },
    );
    return res.status(422).json({
      error: 'Synastry calculation failed',
      code: 'SYNASTRY_CALCULATION_FAILED',
      message: langRu
        ? 'Не удалось рассчитать одну из карт. Проверь дату, время и место и повтори.'
        : 'One of the charts could not be calculated. Check the date, time and place and try again.',
    });
  }

  const primaryChartId = primaryChartRecord?.id ?? null;
  if (!primaryChartId || !partnerChartRecord?.id || !primaryChartRecord?.input_hash || !partnerChartRecord.input_hash || !isCanonicalNatalChartDataComplete(userChartData) || !isCanonicalNatalChartDataComplete(partnerChartData)) {
    return res.status(409).json({
      error: 'Saved natal charts required',
      code: 'CHART_REPAIR_REQUIRED',
      message: langRu ? 'Для сравнения нужны две сохранённые карты с готовым расчётом.' : 'Two saved calculated charts are required.',
    });
  }
  if (primaryChartId === partnerChartRecord.id) {
    return res.status(400).json({
      error: 'Select two different charts',
      code: 'CHART_PAIR_DUPLICATE',
      message: langRu ? 'Для сравнения нужны две разные карты.' : 'Choose two different charts.',
    });
  }

  const subjectClassification = classifyCompatibilityPerson({
    ...subjectInput,
    chartId: primaryChartId,
    chartBirthTimeQuality: (userChartData as NatalChartDataV2 | null)?.birthTimeQuality,
    birthTimeQuality: subjectInput.birthTimeQuality,
  });
  const partnerClassification = classifyCompatibilityPerson({
    ...partnerInput,
    chartId: partnerChartRecord?.id ?? null,
    chartBirthTimeQuality: (partnerChartData as NatalChartDataV2 | null)?.birthTimeQuality,
    birthTimeQuality: partnerInput.birthTimeQuality,
  });
  const calculationLevel = resolveCompatibilityPairLevel(subjectClassification, partnerClassification);

  if (calculationLevel === 'sign_only') {
    return res.status(400).json({
      error: 'Use free sign compatibility',
      code: 'USE_SIGN_COMPATIBILITY',
      message: langRu ? 'Для двух знаков используй бесплатный режим.' : 'Use the free sign compatibility mode.',
    });
  }

  const contentCacheKey = buildSynastryExtendedCacheKey(
    userId,
    primaryChartId,
    partnerChartRecord?.id ?? null,
    partnerChartRecord.name,
    partnerChartRecord.birth_date,
    rel,
    currentLanguage,
    partnerChartRecord.birth_time || '',
    partnerChartRecord.birth_place,
    primaryChartRecord.name,
    primaryChartRecord.birth_date,
    primaryChartRecord.birth_time || '',
    primaryChartRecord.birth_place,
    [
      subjectInput.source,
      partnerInput.source,
      subjectInput.sign,
      partnerInput.sign,
      normalizedSubjectGender,
      normalizedPartnerGender,
      calculationLevel,
      relationshipContext,
      subjectInput.birthTimeQuality,
      partnerInput.birthTimeQuality,
      primaryChartRecord?.input_hash || primaryChartRecord?.calculation_version || '',
      partnerChartRecord?.input_hash || partnerChartRecord?.calculation_version || '',
      (userChartData as NatalChartDataV2).calculationMetadata?.calculatedAt || primaryChartRecord.calculation_version || '',
      (partnerChartData as NatalChartDataV2).calculationMetadata?.calculatedAt || partnerChartRecord.calculation_version || '',
    ].join(':'),
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
      subjectChartId: primaryChartId,
      partnerChartId: partnerChartRecord.id,
      accessTier: 'premium',
      calculationLevel,
      contentKey: buildDeepCompatibilityReactionKey(contentCacheKey),
    });
  }

  const resolvedSubjectSign = normalizeZodiacKey(subjectInput.sign || userChartData?.sun?.sign);
  const resolvedPartnerSign = normalizeZodiacKey(partnerInput.sign || partnerChartData?.sun?.sign);
  const people = {
    subject: buildWriterPersonContext(subjectInput, normalizedSubjectGender),
    partner: buildWriterPersonContext(partnerInput, normalizedPartnerGender),
  };
  const calculated = calculateCompatibility({
    subjectChart: userChartData,
    partnerChart: partnerChartData,
    calculationLevel,
    relationshipContext,
    subjectName: subjectProfile.name,
    partnerName: resolvedPartnerName,
    subjectSign: resolvedSubjectSign,
    partnerSign: resolvedPartnerSign,
    language: currentLanguage,
  });
  const accessTier = 'premium' as const;
  let resultPayload!: SynastryResult;
  let modelTier: ContentModelTier = 'premium';
  const provider = 'openai' as const;
  let modelId = '';
  let generationAttempts: 0 | 1 | 2 = 0;
  let persistenceSucceeded = true;
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
    modelTier = modelAssignment.modelTier;
    modelId = modelAssignment.model;
    if (!getOpenAIResponsesClient()) throw new Error('SYNASTRY_WRITER_UNAVAILABLE');
    let revisionReason: string | undefined;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const prompt = buildCompatibilityStoryPrompt({
        language: currentLanguage,
        calculated,
        subject: people.subject,
        partner: people.partner,
        revisionReason,
      });
      generationAttempts = attempt === 0 ? 1 : 2;
      const response = await createLunaStructuredResponse({
        instructions: prompt.system,
        input: prompt.user,
        maxOutputTokens: 5200,
        schemaName: 'calculated_compatibility_story',
        schema: COMPATIBILITY_STORY_SCHEMA,
      });
      try {
        resultPayload = buildCompatibilityResult(calculated, JSON.parse(response.content));
        break;
      } catch (error) {
        if (attempt === 1 || !(error instanceof CompatibilityNarrativeError || error instanceof SyntaxError)) throw error;
        revisionReason = error instanceof CompatibilityNarrativeError ? error.reason : 'invalid_json';
      }
    }
  } catch (err: any) {
    warnContentApi(
      { scope: SCOPE, userId, chartId: primaryChartId, surface: 'synastry', variant: 'full' },
      'generation_failed',
      {
        accessTier,
        errorCode: 'SYNASTRY_READING_UNAVAILABLE',
        durationMs: Date.now() - startedAt,
        metadata: { message: String(err?.message || 'unknown'), generationAttempts },
      }
    );
    return res.status(503).json({
      error: currentLanguage === 'ru' ? 'Не удалось подготовить разбор. Попробуй ещё раз.' : 'The reading could not be prepared. Please try again.',
      code: 'SYNASTRY_READING_UNAVAILABLE',
      retryable: true,
      subjectChartId: primaryChartId,
      partnerChartId: partnerChartRecord.id,
    });
  }
  try {
    if (primaryChartId && partnerChartRecord?.id && userChartData && partnerChartData) {
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

    if (primaryChartId && partnerChartRecord?.id && userChartData && partnerChartData) {
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
          aspects: calculated.aspects.map((aspect) => ({
            from: aspect.aKey,
            to: aspect.bKey,
            type: aspect.aspectKey,
            orb: aspect.orb,
            strength: aspect.strength,
            reliability: aspect.reliability,
          })),
          content: resultPayload,
          provider,
          modelId,
          promptVersion: SYNASTRY_CONTEXT_PROMPT_VERSION,
          generationAttempts,
        });
      } catch (historyError) {
        console.error(
          '[synastry/history] saved reading could not be appended to durable history:',
          historyError instanceof Error ? historyError.message : historyError,
        );
      }
    }
  } catch (err: any) {
    persistenceSucceeded = false;
    warnContentApi(
      {
        scope: SCOPE,
        userId,
        chartId: primaryChartId,
        surface: 'synastry',
        variant: 'full',
      },
      'persistence_failed_non_blocking',
      {
        accessTier,
        errorCode: 'SYNASTRY_PERSISTENCE_FAILED',
        durationMs: Date.now() - startedAt,
        metadata: { message: String(err?.message || 'unknown') },
      }
    );
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
      metadata: { fromCache: false, generationAttempts, persistenceSucceeded, calculationLevel },
    }
  );

  return res.status(200).json({
    result: resultPayload,
    fromCache: false,
    subjectChartId: primaryChartId,
    partnerChartId: partnerChartRecord.id,
    accessTier,
    calculationLevel,
    contentKey: buildDeepCompatibilityReactionKey(contentCacheKey),
  });
}

export default withRateLimit(handler, () => RATE_LIMIT_CONFIGS.AI_FREE);
