import type { NextApiRequest, NextApiResponse } from 'next';
import type { ContentModelTier, NatalChartData, SynastryResult, UserProfile } from '../../../../types';
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
import { buildSynastryPrompt, parseModelJson } from '../../../../lib/contentPromptBuilders';
import {
  computeSynastryAspects,
  type SynastryAspect,
} from '../../../../lib/synastry/synastryAspects';
import {
  classifyCompatibilityPerson,
  normalizeCompatibilityPersonSource,
  resolveCompatibilityPairLevel,
  type CompatibilityPairLevel,
  type CompatibilityPersonSource,
} from '../../../../lib/synastry/compatibilityInput';
import { buildLocalSignCompatibility } from '../../../../lib/synastry/localSignText';
import type { SignCompatibilityResult } from '../../../../lib/synastry/signCompatibility';
import { normalizeZodiacKey } from '../../../../lib/zodiacKeys';
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

type FlexiblePersonInput = {
  source: CompatibilityPersonSource;
  name: string;
  date: string;
  time: string;
  place: string;
  sign: string;
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
  if (input.place) {
    const place = validateBirthPlace(input.place);
    if (!place.isValid) errors.push({ field: `${fieldPrefix}Place`, message: place.error || 'Invalid birth place' });
  }
  return errors;
}

async function calculateFlexibleNatalChart(input: FlexiblePersonInput): Promise<SynastryChartData> {
  if (!input.place) {
    return calculateNatalChart(input.name, input.date, '', 'UTC', {
      birthTimeMode: 'unknown',
      coordinates: { lat: 0, lon: 0, timezone: 'UTC' },
    });
  }
  return calculateNatalChart(input.name, input.date, input.time, input.place, {
    birthTimeMode: input.time ? 'exact' : 'unknown',
  });
}

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
  aspects: SynastryAspect[] = [],
  signCompatibility: SignCompatibilityResult | null = null,
  calculationLevel: CompatibilityPairLevel = 'full',
): FullSynastryAIResponse & { summary: string; compatibilityScore: number } {
  const normalized = relationship.toLowerCase();
  const isWork = normalized.includes('работ') || normalized.includes('делов');
  const isFriendship = normalized.includes('друж');
  const isFamily = normalized.includes('сем');
  const relationRu = isWork ? 'рабочего союза' : isFriendship ? 'дружбы' : isFamily ? 'семейной связи' : 'отношений';
  const relationEn = isWork ? 'work partnership' : isFriendship ? 'friendship' : isFamily ? 'family bond' : 'relationship';
  const supportive = aspects.filter((item) => /соедин|секстил|трин|conj|sextile|trine/i.test(item.aspect));
  const tense = aspects.filter((item) => /квадрат|оппоз|square|opposition/i.test(item.aspect));
  const hasMoreSupport = supportive.length >= tense.length;
  const compatibilityScore = Math.max(42, Math.min(86, 62 + supportive.length * 3 - tense.length * 2));
  const limitedData = calculationLevel === 'hybrid_sign' || calculationLevel === 'date_only';

  return {
    summary: langRu
      ? hasMoreSupport
        ? `${firstName} и ${partnerName}: в этой связи есть естественный отклик, а её устойчивость зависит от того, насколько прямо вы сверяете ожидания.`
        : `${firstName} и ${partnerName}: связь заметная, но вы можете по-разному реагировать на одну ситуацию. Здесь особенно важны ясные договорённости.`
      : hasMoreSupport
        ? `${firstName} and ${partnerName} have a natural response to each other; the bond becomes steadier when expectations are stated clearly.`
        : `${firstName} and ${partnerName} have a noticeable bond, but may react differently to the same situation. Clear agreements matter here.`,
    generalTheme: langRu
      ? limitedData
        ? `Это базовый разбор ${relationRu}: он показывает общий рисунок связи, но не подменяет полное сравнение двух карт.`
        : `Главная тема ${relationRu} — совместить живой отклик с понятными правилами общения.`
      : limitedData
        ? `This is a basic ${relationEn} reading: it shows the broad pattern without pretending to be a full two-chart comparison.`
        : `The main theme of this ${relationEn} is combining a lively response with clear communication rules.`,
    attraction: langRu
      ? signCompatibility?.attraction || (isWork ? 'Вместе вы замечаете разные стороны одной задачи и можете быстрее находить рабочий вариант.' : isFriendship ? 'Контакт держится на живом отклике и ощущении, что рядом не нужно играть роль.' : isFamily ? 'Связь поддерживают знание привычек друг друга и способность замечать реальную помощь.' : 'Притяжение усиливает ощущение, что рядом привычные вещи открываются по-новому.')
      : signCompatibility?.attraction || (isWork ? 'Together you notice different sides of one task and can reach a workable option faster.' : isFriendship ? 'The connection is supported by a lively response and less need to perform.' : isFamily ? 'The bond is supported by knowing each other’s patterns and recognizing practical care.' : 'Attraction grows when familiar things feel fresh around each other.'),
    difficulties: langRu
      ? signCompatibility?.difficulty || (tense.length
        ? 'Напряжение возникает, когда один давит на темп или решение, а другой отвечает сопротивлением либо закрывается.'
        : 'Сложности начинаются, когда лёгкость контакта принимают за полное совпадение и перестают проговаривать детали.')
      : signCompatibility?.difficulty || (tense.length
        ? 'Tension appears when one person pushes the pace or decision and the other resists or closes off.'
        : 'Friction starts when an easy connection is mistaken for total agreement and details remain unspoken.'),
    recommendations: langRu
      ? [signCompatibility?.communication || 'Сначала уточни, что человек имел в виду.', 'Говори о конкретной ситуации, а не о характере.', 'Договоритесь, когда вернуться к сложному разговору.']
      : [signCompatibility?.communication || 'Clarify what the other person meant.', 'Discuss the situation, not their character.', 'Agree when to return to a hard conversation.'],
    potential: langRu
      ? 'Потенциал связи раскрывается там, где договорённость можно проверить действием, а различия не приходится замалчивать.'
      : 'The bond’s potential grows where agreements are confirmed by action and differences do not need to be hidden.',
    compatibilityScore,
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
    subjectSource,
    partnerSource,
    subjectSign,
    partnerSign,
    subjectGender,
    partnerGender,
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
  const rel = String(relationshipType || 'романтика').trim();
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

  const fallbackSubjectName = langRu ? 'Первый человек' : 'First person';
  const fallbackPartnerName = langRu ? 'Второй человек' : 'Second person';
  const subjectProfile = {
    ...profile,
    name: String(primaryChartRecord?.name || resolvedManualSubjectName || fallbackSubjectName).trim(),
    birthDate: String(primaryChartRecord?.birth_date || resolvedManualSubjectDate || '').trim(),
    birthTime: String(primaryChartRecord?.birth_time ?? resolvedManualSubjectTime ?? '').trim(),
    birthPlace: String(primaryChartRecord?.birth_place || resolvedManualSubjectPlace || '').trim(),
  } as UserProfile;
  const primaryChartId = primaryChartRecord?.id ?? null;
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
    sign: String(subjectSign || userChartData?.sun?.sign || '').trim(),
  };
  const partnerInput: FlexiblePersonInput = {
    source: normalizedPartnerSource,
    name: resolvedPartnerName,
    date: resolvedPartnerDate,
    time: resolvedPartnerPlace ? resolvedPartnerTime : '',
    place: resolvedPartnerPlace,
    sign: String(partnerSign || partnerChartData?.sun?.sign || '').trim(),
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

  const subjectClassification = classifyCompatibilityPerson({
    ...subjectInput,
    chartId: primaryChartId,
    chartBirthTimeQuality: (userChartData as NatalChartDataV2 | null)?.birthTimeQuality,
  });
  const partnerClassification = classifyCompatibilityPerson({
    ...partnerInput,
    chartId: partnerChartRecord?.id ?? null,
    chartBirthTimeQuality: (partnerChartData as NatalChartDataV2 | null)?.birthTimeQuality,
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
    [
      normalizedSubjectSource,
      normalizedPartnerSource,
      subjectInput.sign,
      partnerInput.sign,
      normalizedSubjectGender,
      normalizedPartnerGender,
      calculationLevel,
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
      accessTier: 'premium',
      calculationLevel,
    });
  }

  if (!userChartData && normalizedSubjectSource === 'birth') {
    userChartData = await calculateFlexibleNatalChart(subjectInput);
  }

  if (!partnerChartData && normalizedPartnerSource === 'birth') {
    partnerChartData = await calculateFlexibleNatalChart(partnerInput);
  }

  const resolvedSubjectSign = normalizeZodiacKey(subjectInput.sign || userChartData?.sun?.sign);
  const resolvedPartnerSign = normalizeZodiacKey(partnerInput.sign || partnerChartData?.sun?.sign);
  const signCompatibility = resolvedSubjectSign && resolvedPartnerSign
    ? buildLocalSignCompatibility(
        resolvedSubjectSign,
        resolvedPartnerSign,
        currentLanguage,
        normalizedSubjectGender,
        normalizedPartnerGender,
        rel === 'дружба' || rel === 'friendship'
          ? 'friendship'
          : rel === 'работа' || rel === 'work'
            ? 'work'
            : rel === 'семья' || rel === 'family'
              ? 'family'
              : 'romance',
      )
    : null;

  const accessTier = 'premium' as const;
  let resultPayload: SynastryResult;
  let modelTier: ContentModelTier = 'premium';
  let provider: 'openai' | 'deterministic' = 'deterministic';
  let modelId = 'deterministic-synastry-fallback-v1';
  let usedFallback = false;
  let persistenceSucceeded = true;
  const synastryAspects = computeSynastryAspects(userChartData, partnerChartData);
  const fallbackPayload = () => mapFullToSynastryResult(buildSynastryFallback(
    langRu,
    subjectProfile.name,
    resolvedPartnerName,
    rel,
    synastryAspects,
    signCompatibility,
    calculationLevel,
  ));

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
    const aiClient = getOpenAIResponsesClient();
    if (!aiClient) {
      usedFallback = true;
      resultPayload = fallbackPayload();
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
          signCompatibility,
          calculationLevel,
          dataAvailability: {
            subject: {
              source: normalizedSubjectSource,
              level: subjectClassification.level,
              sign: resolvedSubjectSign,
              gender: normalizedSubjectGender,
            },
            partner: {
              source: normalizedPartnerSource,
              level: partnerClassification.level,
              sign: resolvedPartnerSign,
              gender: normalizedPartnerGender,
            },
          },
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
        buildSynastryFallback(
          langRu,
          subjectProfile.name,
          resolvedPartnerName,
          rel,
          synastryAspects,
          signCompatibility,
          calculationLevel,
        )
      );
      resultPayload = mapFullToSynastryResult(parsed);
      provider = 'openai';
      modelId = modelAssignment.model;
    }
  } catch (err: any) {
    usedFallback = true;
    resultPayload = fallbackPayload();
    warnContentApi(
      {
        scope: SCOPE,
        userId,
        chartId: primaryChartId,
        surface: 'synastry',
        variant: 'full',
      },
      'generation_failed_fallback',
      {
        accessTier,
        errorCode: 'SYNASTRY_MODEL_FALLBACK',
        durationMs: Date.now() - startedAt,
        metadata: { message: String(err?.message || 'unknown') },
      }
    );
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
          aspects: synastryAspects,
          content: resultPayload,
          provider,
          modelId,
          promptVersion: SYNASTRY_CONTEXT_PROMPT_VERSION,
          generationAttempts: provider === 'openai' ? 1 : 0,
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
      metadata: { fromCache: false, usedFallback, persistenceSucceeded, calculationLevel },
    }
  );

  return res.status(200).json({
    result: resultPayload,
    fromCache: false,
    accessTier,
    calculationLevel,
  });
}

export default withRateLimit(handler, () => RATE_LIMIT_CONFIGS.AI_FREE);
