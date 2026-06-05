import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import type { NatalChartData, SynastryResult, UserProfile } from '../../../../types';
import { AdminAuthError, handleAdminError, requireTelegramUserId } from '../../../../lib/adminAuth';
import { getOpenAIModelForContent } from '../../../../lib/appSettings';
import { calculateNatalChart } from '../../../../lib/swisseph-calculator';
import { db } from '../../../../lib/db';
import {
  SYSTEM_PROMPT_ASTRA,
  addLanguageInstruction,
  createFullSynastryPrompt,
  FullSynastryAIResponse,
} from '../../../../lib/prompts';
import { validateSynastryInput, formatValidationErrors } from '../../../../lib/validation';
import { getContentLayer, getPremiumEntitlementState } from '../../../../lib/contentArchitecture';
import { buildSynastryExtendedCacheKey } from '../../../../lib/synastryExtended';
import { RATE_LIMIT_CONFIGS, withRateLimit } from '../../../../lib/rateLimit';
import { logContentApi, warnContentApi } from '../../../../lib/contentApiLogging';

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

  const {
    profile,
    partnerName,
    partnerDate,
    partnerTime,
    partnerPlace,
    language,
    relationshipType,
    partnerChartId,
  } = req.body;

  const validation = validateSynastryInput({
    profile,
    partnerName,
    partnerDate,
    partnerTime,
    partnerPlace,
    language: language || profile?.language || 'ru',
  });

  const userLang = (language || profile?.language || 'ru') === 'en' ? 'en' : 'ru';

  if (!validation.isValid) {
    const errorMessage = formatValidationErrors(validation.errors, userLang);
    return res.status(400).json({
      error: 'Validation failed',
      message: errorMessage,
      errors: validation.errors,
    });
  }

  const userId = String(profile?.id || '').trim();
  if (!userId) {
    return res.status(400).json({ error: 'Bad request', message: 'userId is required' });
  }
  try {
    requireTelegramUserId(req, userId);
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return handleAdminError(res, error);
    }
    throw error;
  }

  logContentApi(
    { scope: SCOPE, userId, chartId: null, surface: 'synastry', variant: 'full' },
    'request_start',
    { metadata: { hasPartnerChartId: !!partnerChartId } }
  );

  const user = await db.users.get(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found', message: 'Profile not found' });
  }

  const rel = String(relationshipType || 'романтика').trim();
  const currentLanguage = userLang === 'en' ? 'en' : 'ru';
  const langRu = currentLanguage === 'ru';

  let primaryChartRecord: any = null;
  let partnerChartRecord: any = null;
  let userChartData: NatalChartData | null = null;
  let partnerChartData: NatalChartData | null = null;

  if (profile?.id) {
    primaryChartRecord = await db.natal_charts.getPrimary(String(profile.id));
    userChartData = (primaryChartRecord?.chart_data as NatalChartData) || null;
  }

  if (partnerChartId && profile?.id) {
    partnerChartRecord = await db.natal_charts.getById(Number(partnerChartId));
    if (!partnerChartRecord || String(partnerChartRecord.user_id) !== String(profile.id)) {
      return res.status(404).json({
        error: 'Partner chart not found',
        message: langRu ? 'Сохранённая карта партнёра не найдена.' : 'Saved partner chart not found',
      });
    }
    partnerChartData = (partnerChartRecord.chart_data as NatalChartData) || null;
  }

  const contentCacheKey = buildSynastryExtendedCacheKey(
    userId,
    primaryChartRecord?.id ?? null,
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
      chartId: primaryChartRecord?.id ?? null,
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
        chartId: primaryChartRecord?.id ?? null,
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
        ? 'Полный разбор совместимости доступен в Lumia Premium.'
        : 'The full compatibility reading is available in Lumia Premium.',
    });
  }

  const cachedResult = await loadCachedSynastry(
    userId,
    primaryChartRecord?.id ?? null,
    partnerChartRecord?.id ?? null,
    contentCacheKey
  );

  if (cachedResult) {
    logContentApi(
      {
        scope: SCOPE,
        userId,
        chartId: primaryChartRecord?.id ?? null,
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
      profile.name,
      profile.birthDate,
      profile.birthTime || '12:00',
      profile.birthPlace
    );
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
      chartId: primaryChartRecord?.id ?? null,
      surface: 'synastry',
      variant: 'full',
    },
    'generation_start',
    { accessTier }
  );

  try {
    if (!openai) {
      resultPayload = {
        summary: langRu
          ? `Полный разбор совместимости для ${profile.name} и ${partnerName}: динамика, напряжение и потенциал этой пары.`
          : `Full compatibility reading for ${profile.name} and ${partnerName}: dynamic, tension, and relational potential.`,
        compatibilityScore: 74,
        fullAnalysis: {
          generalTheme: langRu
            ? `Между вами есть связь, которая держится не только на притяжении, но и на внутреннем росте.`
            : `There is a connection here that rests not only on attraction, but on mutual growth.`,
          attraction: langRu
            ? `Вас притягивает ощущение живого отклика.`
            : `You are drawn by the sense of real response.`,
          difficulties: langRu
            ? `Главные сложности обычно растут из разного способа проживать напряжение.`
            : `The main difficulties usually come from different ways of moving through tension.`,
          recommendations: langRu
            ? ['Проговаривайте ожидания раньше, чем они становятся скрытой обидой.']
            : ['Name expectations before they harden into quiet resentment.'],
          potential: langRu
            ? `У этой пары есть потенциал к глубокой, зрелой близости.`
            : `This bond holds real potential for deep, mature closeness.`,
        },
      };
    } else {
      const userPrompt = addLanguageInstruction(
        createFullSynastryPrompt(
          userChartData as NatalChartData,
          profile as UserProfile,
          partnerChartData as NatalChartData,
          partnerName,
          rel
        ),
        currentLanguage
      );
      const { model: modelId } = await getOpenAIModelForContent({
        accessTier,
        contentSurface: 'synastry',
        contentVariant: 'full',
      });
      const completion = await openai.chat.completions.create({
        model: modelId,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT_ASTRA },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.72,
        max_tokens: 2500,
      });
      const content = completion.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(content) as FullSynastryAIResponse & { summary?: string; compatibilityScore?: number };
      resultPayload = mapFullToSynastryResult(parsed);
    }

    const { modelTier } = await getOpenAIModelForContent({
      accessTier,
      contentSurface: 'synastry',
      contentVariant: 'full',
    });

    if (primaryChartRecord?.id && partnerChartRecord?.id) {
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
      canRegenerateForLumi: false,
      legacySource: 'synastry.full.premium',
    };

    if (primaryChartRecord?.id) {
      await db.content_interpretations.upsertByChart(
        primaryChartRecord.id,
        interpretationData,
        userId
      );
    } else {
      await db.content_interpretations.upsertByUser(userId, interpretationData);
    }
  } catch (err: any) {
    warnContentApi(
      {
        scope: SCOPE,
        userId,
        chartId: primaryChartRecord?.id ?? null,
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
      chartId: primaryChartRecord?.id ?? null,
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
