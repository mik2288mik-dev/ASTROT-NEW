import type { NatalChartData, UserProfile } from '../types';
import { db } from './db';
import { toDateInputValue } from './date-utils';
import { getCanonicalNatalChart } from './natalChartRead';
import type { NatalChartDataV2 } from './natalChartV2Types';

/** Shared legacy content adapter. Birth facts always come from the saved snapshot. */
export async function resolveNatalContentChartContext(
  userId: string,
  chartId?: number | null,
  preferences?: Partial<UserProfile>,
) {
  const user = await db.users.get(userId, { hydratePrimaryChart: false });
  if (!user) return null;
  const chart = await getCanonicalNatalChart(userId, chartId);
  const chartData = chart.chart_data as NatalChartData;
  const birth = chartData.birth;
  const profile: UserProfile = {
    id: user.id,
    name: chart.name || user.name || '',
    birthDate: birth?.localDate || toDateInputValue(chart.birth_date) || '',
    birthTime: birth?.time?.localTime ?? chart.birth_time ?? '',
    birthPlace: birth?.place || chart.birth_place || '',
    birthTimeMode: birth?.time?.mode,
    birthTimeUncertaintyMinutes: birth?.time?.uncertaintyMinutes ?? null,
    birthTimeRangeStart: birth?.time?.rangeStart ?? null,
    birthTimeRangeEnd: birth?.time?.rangeEnd ?? null,
    birthTimezone: birth?.timezone || chart.timezone || null,
    birthLatitude: birth?.latitude ?? chart.latitude ?? null,
    birthLongitude: birth?.longitude ?? chart.longitude ?? null,
    isSetup: true,
    language: preferences?.language === 'en' || preferences?.language === 'ru' ? preferences.language : user.language || 'ru',
    theme: preferences?.theme === 'dark' || preferences?.theme === 'light' ? preferences.theme : user.theme || 'dark',
    isPremium: !!user.is_premium,
    isAdmin: !!user.is_admin,
    loginStreak: user.login_streak ?? 0,
    chartSlots: user.chart_slots ?? 1,
    generatedContent: preferences?.generatedContent,
  };
  const revision = (chart.chart_data as NatalChartDataV2).calculationMetadata?.calculatedAt
    || chart.calculation_version || chartData.calculationVersion;
  return { user, profile, chartId: chart.id, chartData, snapshotKey: `${chart.input_hash}:${revision}` };
}

export function natalContentChartErrorStatus(error: unknown): number | null {
  const code = (error as { code?: string } | null)?.code;
  switch (code) {
    case 'CHART_NOT_FOUND':
    case 'CHART_ARCHIVED': return 404;
    case 'CHART_REPAIR_REQUIRED': return 409;
    case 'PREMIUM_REQUIRED':
    case 'CHART_LIMIT_REACHED': return 403;
    default: return null;
  }
}
