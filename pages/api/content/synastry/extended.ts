import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import type { NatalChartData, SynastryResult, UserProfile } from '../../../../types';
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
import { unlockContentLayer } from '../../../../lib/contentArchitecture';
import { SYNASTRY_EXTENDED_LUMI_COST, buildSynastryExtendedCacheKey } from '../../../../lib/synastryExtended';
import { RATE_LIMIT_CONFIGS, withRateLimit } from '../../../../lib/rateLimit';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

function mapLumiFullToSynastryResult(raw: FullSynastryAIResponse & { summary?: string; compatibilityScore?: number }): SynastryResult {
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
        if (parsed?.fullAnalysis) return parsed as SynastryResult;
      }
    }

    const row = await db.content_interpretations.get(userId, 'lumi', 'synastry', 'one_off', contentCacheKey);
    if (row?.content && typeof row.content === 'object' && (row.content as SynastryResult).fullAnalysis) {
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
        ? `Полный разбор совместимости открывается за ${lumiCost} Lumi.`
        : `The full compatibility reading opens for ${lumiCost} Lumi.`,
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
    const { modelTier } = await getOpenAIModelForContent({
      accessTier: 'lumi',
      contentSurface: 'synastry',
      contentVariant: 'one_off',
    });
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
          modelTier,
          isPersistent: true,
          canRegenerateForLumi: false,
          legacySource: 'synastry.full.lumi',
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
        modelTier,
        isPersistent: true,
        canRegenerateForLumi: false,
        legacySource: 'synastry.full.lumi',
      });
    }
  };

  try {
    await runUnlock();

    if (!openai) {
      resultPayload = {
        summary: langRu
          ? `Полный разбор совместимости для ${profile.name} и ${partnerName}: динамика, напряжение и потенциал этой пары.`
          : `Full compatibility reading for ${profile.name} and ${partnerName}: dynamic, tension, and relational potential.`,
        compatibilityScore: 74,
        fullAnalysis: {
          generalTheme: langRu
            ? `Между вами есть связь, которая держится не только на притяжении, но и на внутреннем росте. Такие отношения сильнее раскрываются там, где оба готовы замечать различия в темпе, чувствах и ожиданиях, а не спорить с ними.`
            : `There is a connection here that rests not only on attraction, but on mutual growth. Bonds like this become stronger when both people notice differences in pace, feeling, and expectation instead of fighting them.`,
          attraction: langRu
            ? `Вас притягивает ощущение живого отклика: рядом можно быть собой и при этом видеть в другом то, что расширяет собственный взгляд на близость. Часто именно это создаёт чувство, что связь не пустая, а по-настоящему включённая.`
            : `You are drawn by the sense of real response: around each other, you can be yourselves and still see something that broadens your understanding of closeness. That is often what makes the bond feel genuinely alive instead of decorative.`,
          difficulties: langRu
            ? `Главные сложности обычно растут не из отсутствия чувства, а из разного способа проживать напряжение. Один может хотеть больше прямоты и ясности, другой — больше мягкости или времени; если это не проговаривать, связь быстро уходит в недопонимание или тихую дистанцию.`
            : `The main difficulties usually do not come from a lack of feeling, but from different ways of moving through tension. One person may want clarity and directness while the other needs more softness or time; without naming that difference, the bond can slide into misunderstanding or quiet distance.`,
          recommendations: langRu
            ? [
                'Проговаривайте ожидания раньше, чем они становятся скрытой обидой.',
                'В чувствительных разговорах сначала уточняйте смысл, а не сразу защищайте свою позицию.',
                'Сохраняйте маленькие ритуалы контакта, чтобы связь не жила только на напряжённых темах.',
              ]
            : [
                'Name expectations before they harden into quiet resentment.',
                'In sensitive conversations, clarify meaning before defending your position.',
                'Keep small rituals of contact so the bond does not live only through tense moments.',
              ],
          potential: langRu
            ? `У этой пары есть потенциал к глубокой, зрелой близости, если оба не будут прятать реальные потребности за молчанием или резкостью. Тогда связь может стать не только эмоционально сильной, но и устойчивой.`
            : `This bond holds real potential for deep, mature closeness if both people stop hiding real needs behind silence or sharpness. In that case, the connection can become not only emotionally strong, but steady as well.`,
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
        accessTier: 'lumi',
        contentSurface: 'synastry',
        contentVariant: 'one_off',
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
      resultPayload = mapLumiFullToSynastryResult(parsed);
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
