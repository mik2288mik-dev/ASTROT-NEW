import type { NextApiRequest, NextApiResponse } from 'next';
import type { NatalChartData, UserProfile } from '../../../../types';
import type { NatalChartDataV2 } from '../../../../lib/natalChartV2Types';
import { AdminAuthError, handleAdminError } from '../../../../lib/adminAuth';
import { requireAppUser } from '../../../../lib/auth/appAuth';
import { toPublicAppProfile } from '../../../../lib/auth/profile';
import { db } from '../../../../lib/db';
import { validateDate } from '../../../../lib/validation';
import { getPremiumEntitlementState } from '../../../../lib/contentArchitecture';
import { RATE_LIMIT_CONFIGS, withRateLimit } from '../../../../lib/rateLimit';
import { isCanonicalNatalChartDataComplete } from '../../../../lib/natalChartCanonical';
import { assertChartReadable, ChartAccessPolicyError } from '../../../../lib/chartAccessPolicy';
import {
  classifyCompatibilityPerson,
  normalizeCompatibilityPersonSource,
  resolveCompatibilityPairLevel,
} from '../../../../lib/synastry/compatibilityInput';
import { calculateCompatibility } from '../../../../lib/synastry/compatibilityEngine';
import { buildCompatibilityPreview } from '../../../../lib/synastry/compatibilityPreview';
import { buildManualCompatibilityChart } from '../../../../lib/synastry/compatibilityManualChart';
import { normalizeRelationshipContext } from '../../../../lib/synastry/relationshipContext';
import { buildPairTalkCalendar } from '../../../../lib/synastry/pairTalkCalendar';

type ChartData = NatalChartData | NatalChartDataV2;

type ResolvedPerson = { name: string; chart: ChartData; chartId: number | null; level: ReturnType<typeof classifyCompatibilityPerson> };

class PreviewError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
  }
}

/**
 * Free compatibility by birth dates: the calculated answers without AI.
 * Saved charts are read as they are; a person entered by hand gets a temporary
 * whole-day chart that is never stored.
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let auth;
  try {
    auth = await requireAppUser(req);
  } catch (error) {
    if (error instanceof AdminAuthError) return handleAdminError(res, error);
    throw error;
  }
  const userId = auth.userId;
  const body = req.body || {};
  const user = await db.users.get(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const profile = toPublicAppProfile(user, auth) as UserProfile;
  const language: 'ru' | 'en' = (body.language || profile.language) === 'en' ? 'en' : 'ru';
  const ru = language === 'ru';
  const relationshipContext = normalizeRelationshipContext(body.relationshipContext);
  const { isPremium } = await getPremiumEntitlementState(userId);
  const accessibleCharts = await db.natal_charts.getAll(userId);

  const resolve = async (side: 'subject' | 'partner'): Promise<ResolvedPerson> => {
    const rawChartId = body[`${side}ChartId`];
    const chartId = rawChartId == null || String(rawChartId).trim() === '' ? null : Number(rawChartId);
    const source = normalizeCompatibilityPersonSource({
      source: body[`${side}Source`],
      chartId,
      date: body[`${side}Date`],
      sign: body[`${side}Sign`],
    });
    if (source === 'sign') {
      throw new PreviewError(400, 'USE_SIGN_COMPATIBILITY', ru ? 'Для сравнения по знакам используй режим «По знаку зодиака».' : 'Use the zodiac sign mode to compare signs.');
    }
    if (source === 'saved') {
      if (chartId == null || !Number.isSafeInteger(chartId) || chartId <= 0) {
        throw new PreviewError(400, 'CHART_REQUIRED', ru ? 'Выбери сохранённую карту.' : 'Choose a saved chart.');
      }
      const record = await db.natal_charts.getById(chartId);
      if (!record || String(record.user_id) !== userId) {
        throw new PreviewError(404, 'CHART_NOT_FOUND', ru ? 'Сохранённая карта не найдена.' : 'Saved chart not found.');
      }
      try {
        assertChartReadable(record, isPremium, accessibleCharts);
      } catch (error) {
        if (error instanceof ChartAccessPolicyError) throw new PreviewError(error.status, error.code, error.message);
        throw error;
      }
      if (!isCanonicalNatalChartDataComplete(record.chart_data)) {
        throw new PreviewError(409, 'CHART_REPAIR_REQUIRED', ru ? 'Карту нужно пересчитать в разделе «Мои карты».' : 'This chart needs to be recalculated.');
      }
      const chart = record.chart_data as ChartData;
      return {
        name: String(record.name || '').trim(),
        chart,
        chartId: record.id,
        level: classifyCompatibilityPerson({
          source,
          chartId: record.id,
          date: record.birth_date,
          time: record.birth_time,
          place: record.birth_place,
          chartBirthTimeQuality: (chart as NatalChartDataV2).birthTimeQuality,
        }),
      };
    }
    const date = String(body[`${side}Date`] || '').trim();
    if (!validateDate(date).isValid) {
      throw new PreviewError(400, 'BIRTH_DATE_REQUIRED', ru ? 'Укажи дату рождения.' : 'Add a birth date.');
    }
    const name = String(body[`${side}Name`] || '').trim().slice(0, 60);
    const chart = await buildManualCompatibilityChart({ name, date, place: body[`${side}Place`] });
    if (!chart) {
      throw new PreviewError(422, 'CHART_CALCULATION_FAILED', ru ? 'Не получилось посчитать карту по этой дате. Проверь дату и место.' : 'Could not calculate a chart for this date.');
    }
    return { name, chart, chartId: null, level: { source: 'birth', level: 'date_only', sign: null } };
  };

  let subject: ResolvedPerson;
  let partner: ResolvedPerson;
  try {
    subject = await resolve('subject');
    partner = await resolve('partner');
  } catch (error) {
    if (error instanceof PreviewError) return res.status(error.status).json({ error: error.message, code: error.code });
    throw error;
  }
  if (subject.chartId != null && subject.chartId === partner.chartId) {
    return res.status(400).json({ error: ru ? 'Для сравнения нужны две разные карты.' : 'Choose two different charts.', code: 'CHART_PAIR_DUPLICATE' });
  }

  const subjectName = subject.name || (ru ? 'Первый человек' : 'First person');
  const partnerName = partner.name || (ru ? 'Второй человек' : 'Second person');
  const calculated = calculateCompatibility({
    subjectChart: subject.chart,
    partnerChart: partner.chart,
    calculationLevel: resolveCompatibilityPairLevel(subject.level, partner.level),
    relationshipContext,
    subjectName,
    partnerName,
    language,
  });

  const pairLevel = resolveCompatibilityPairLevel(subject.level, partner.level);
  const topics = (['romance', 'relationship', 'friendship', 'family', 'work'] as const).map((context) => ({
    context,
    overallScore: context === relationshipContext
      ? calculated.overallScore
      : calculateCompatibility({ subjectChart: subject.chart, partnerChart: partner.chart, calculationLevel: pairLevel, relationshipContext: context, language }).overallScore,
  }));
  let talkDays: ReturnType<typeof buildPairTalkCalendar> = [];
  try {
    talkDays = buildPairTalkCalendar(subject.chart, partner.chart, { language });
  } catch {
    // The calendar is an extra: the answers stay available without it.
    talkDays = [];
  }

  return res.status(200).json({
    preview: {
      ...buildCompatibilityPreview(calculated, { subject: subjectName, partner: partnerName }, language),
      topics,
      talkDays,
    },
    subjectChartId: subject.chartId,
    partnerChartId: partner.chartId,
    isPremium,
  });
}

export default withRateLimit(handler, () => RATE_LIMIT_CONFIGS.AI_FREE);
