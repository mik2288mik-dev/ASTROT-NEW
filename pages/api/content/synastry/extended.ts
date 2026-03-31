import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import type { NatalChartData, SynastryResult, UserProfile } from '../../../../types';
import { calculateNatalChart } from '../../../../lib/swisseph-calculator';
import { db } from '../../../../lib/db';
import {
  SYSTEM_PROMPT_ASTRA,
  addLanguageInstruction,
  createExtendedSynastryPrompt,
  ExtendedSynastryAIResponse,
} from '../../../../lib/prompts';
import { getOpenAIInterpretationModel } from '../../../../lib/appSettings';
import { validateSynastryInput, formatValidationErrors } from '../../../../lib/validation';
import { unlockContentLayer } from '../../../../lib/contentArchitecture';
import { SYNASTRY_EXTENDED_LUMI_COST, buildSynastryExtendedCacheKey } from '../../../../lib/synastryExtended';
import { RATE_LIMIT_CONFIGS, withRateLimit } from '../../../../lib/rateLimit';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

function mapExtendedToSynastryResult(raw: ExtendedSynastryAIResponse): SynastryResult {
  const score =
    typeof raw.compatibilityScore === 'number' && Number.isFinite(raw.compatibilityScore)
      ? Math.min(100, Math.max(0, Math.round(raw.compatibilityScore)))
      : undefined;
  return {
    summary: String(raw.summary || '').trim() || '—',
    compatibilityScore: score,
    extendedOverview: {
      connection: String(raw.connection || '').trim(),
      tension: String(raw.tension || '').trim(),
      navigation: String(raw.navigation || '').trim(),
      bondContext: String(raw.bondContext || '').trim(),
    },
  };
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
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
    allowLumiSpend,
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

  const user = await db.users.get(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found', message: 'Profile not found' });
  }

  const lumiCost = SYNASTRY_EXTENDED_LUMI_COST;
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

  const readCached = async (): Promise<SynastryResult | null> => {
    if (primaryChartRecord?.id && partnerChartRecord?.id) {
      const cached = await db.synastry.get(
        primaryChartRecord.id,
        partnerChartRecord.id,
        'extended',
        contentCacheKey
      );
      if (cached) {
        const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
        if (parsed?.extendedOverview || parsed?.summary) return parsed as SynastryResult;
      }
    }

    const row = await db.content_interpretations.get(userId, 'lumi', 'synastry', 'one_off', contentCacheKey);
    if (row?.content && typeof row.content === 'object' && (row.content as SynastryResult).extendedOverview) {
      return row.content as SynastryResult;
    }
    return null;
  };

  const cachedResult = await readCached();
  if (cachedResult) {
    const balance = await db.lumi_transactions.getBalance(userId);
    return res.status(200).json({
      result: cachedResult,
      lumiSpent: 0,
      lumiBalance: balance,
      fromCache: true,
    });
  }

  if (!allowLumiSpend) {
    return res.status(409).json({
      error: 'Lumi required',
      code: 'LUMI_REQUIRED',
      message: langRu
        ? `Средний разбор совместимости открывается за ${lumiCost} Lumi.`
        : `The mid-depth compatibility layer opens for ${lumiCost} Lumi.`,
      lumiCost,
      lumiBalance: user.lumi_balance ?? 0,
    });
  }

  const balanceBefore = await db.lumi_transactions.getBalance(userId);
  if (balanceBefore < lumiCost) {
    return res.status(402).json({
      error: 'Insufficient Lumi',
      code: 'INSUFFICIENT_LUMI',
      message: langRu ? 'Недостаточно Lumi.' : 'Not enough Lumi.',
      lumiCost,
      lumiBalance: balanceBefore,
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

  let lumiSpent = 0;
  let unlockAttempted = false;
  let resultPayload: SynastryResult | null = null;

  const runUnlock = async () => {
    const balanceBeforeUnlock = await db.lumi_transactions.getBalance(userId);
    await unlockContentLayer({
      userId,
      chartId: primaryChartRecord?.id ?? null,
      accessTier: 'lumi',
      contentSurface: 'synastry',
      contentVariant: 'one_off',
      cacheKey: contentCacheKey,
      lumiCost,
    });
    unlockAttempted = true;
    const balanceAfterUnlock = await db.lumi_transactions.getBalance(userId);
    lumiSpent = Math.max(0, balanceBeforeUnlock - balanceAfterUnlock);
  };

  const persist = async (payload: SynastryResult) => {
    if (primaryChartRecord?.id && partnerChartRecord?.id) {
      await db.synastry.set(
        primaryChartRecord.id,
        partnerChartRecord.id,
        'extended',
        contentCacheKey,
        payload
      );
    }
    if (primaryChartRecord?.id) {
      await db.content_interpretations.upsertByChart(
        primaryChartRecord.id,
        {
          accessTier: 'lumi',
          contentSurface: 'synastry',
          contentVariant: 'one_off',
          cacheKey: contentCacheKey,
          inputHash: contentCacheKey,
          content: payload,
          modelTier: 'base',
          isPersistent: true,
          canRegenerateForLumi: false,
          legacySource: 'synastry.extended.lumi',
        },
        userId
      );
    } else {
      await db.content_interpretations.upsertByUser(userId, {
        accessTier: 'lumi',
        contentSurface: 'synastry',
        contentVariant: 'one_off',
        cacheKey: contentCacheKey,
        inputHash: contentCacheKey,
        content: payload,
        modelTier: 'base',
        isPersistent: true,
        canRegenerateForLumi: false,
        legacySource: 'synastry.extended.lumi',
      });
    }
  };

  try {
    await runUnlock();

    if (!openai) {
      resultPayload = {
        summary: langRu
          ? `Средний разбор для ${profile.name} и ${partnerName}: больше контекста, чем в бесплатном слое.`
          : `Mid-depth read for ${profile.name} and ${partnerName}: more context than the free layer.`,
        compatibilityScore: 72,
        extendedOverview: {
          connection: langRu
            ? 'Между вами есть живой обмен качествами: вы замечаете друг друга и реагируете по-разному на близость и границы.'
            : 'There is a living exchange between you: you notice each other and respond differently to closeness and boundaries.',
          tension: langRu
            ? 'Напряжение чаще растёт из ожиданий и темпа, а не из «плохого характера». Имеет смысл называть это прямо и раньше.'
            : 'Tension often grows from expectations and pacing, not from bad character. Naming it early helps.',
          navigation: langRu
            ? 'Договоритесь о одном простом правиле на неделю: как вы просите о внимании и как даёте паузу без исчезновения.'
            : 'Agree on one simple rule for the week: how you ask for attention and how you pause without disappearing.',
          bondContext: langRu
            ? `В связи типа «${rel}» важно держать в фокусе уважение к ролям и честность о потребностях — без игры в догадки.`
            : `For a bond like "${rel}", keep respect for roles and honesty about needs — without guessing games.`,
        },
      };
    } else {
      const userPrompt = addLanguageInstruction(
        createExtendedSynastryPrompt(
          userChartData as NatalChartData,
          profile as UserProfile,
          partnerChartData as NatalChartData,
          partnerName,
          rel
        ),
        currentLanguage
      );
      const modelId = await getOpenAIInterpretationModel();
      const completion = await openai.chat.completions.create({
        model: modelId,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT_ASTRA },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.78,
        max_tokens: 2000,
      });
      const content = completion.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(content) as ExtendedSynastryAIResponse;
      resultPayload = mapExtendedToSynastryResult(parsed);
    }

    await persist(resultPayload);
  } catch (err: any) {
    if (unlockAttempted && lumiSpent > 0) {
      await db.lumi_transactions.add(userId, lumiSpent, 'refund').catch(() => {});
    }
    return res.status(500).json({
      error: 'Synastry extended failed',
      message: err?.message || (langRu ? 'Не удалось сохранить разбор.' : 'Could not save reading.'),
      lumiBalance: await db.lumi_transactions.getBalance(userId).catch(() => user.lumi_balance ?? 0),
    });
  }

  const nextBalance = await db.lumi_transactions.getBalance(userId);

  return res.status(200).json({
    result: resultPayload,
    lumiSpent,
    lumiBalance: nextBalance,
    fromCache: false,
  });
}

export default withRateLimit(handler, () => RATE_LIMIT_CONFIGS.AI_FREE);
