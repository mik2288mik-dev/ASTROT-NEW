import type { HoroscopeDailySectionKey, HoroscopeLayer, NatalChartData, UserProfile } from '../types';
import { PREMIUM_DAILY_READINESS_SECTION_KEYS } from './contentPrewarm';
import { getMoscowTodayKey } from './date-utils';
import { ensureFullDaypartForecast } from '../services/astrologyService';
import { loadHumanDailySection } from '../services/natalReadingService';

function resolveSectionKey(
  layer: HoroscopeLayer,
  dailySectionKey?: HoroscopeDailySectionKey
): (typeof PREMIUM_DAILY_READINESS_SECTION_KEYS)[number] | null {
  if (layer === 'love') return 'daily_love';
  if (layer === 'work_money') {
    const key = dailySectionKey ?? 'daily_work_business';
    if (key === 'daily_money' || key === 'daily_goals' || key === 'daily_work_business') return key;
    return 'daily_work_business';
  }
  return null;
}

export function prefetchHomeCardLayer(input: {
  profile: UserProfile;
  chartData: NatalChartData;
  chartId?: number | null;
  layer: HoroscopeLayer;
  dailySectionKey?: HoroscopeDailySectionKey;
}): void {
  const userId = String(input.profile.id || '');
  if (!userId || !input.chartData?.sun || !input.chartData?.moon) return;

  const today = getMoscowTodayKey();
  const chartId = input.chartId ?? undefined;
  const { profile, chartData } = input;

  if (input.layer === 'chart') {
    void ensureFullDaypartForecast(profile, chartData, 'day', {
      accessTier: 'premium',
      date: today,
      chartId,
    }).catch(() => undefined);
    return;
  }

  const sectionKey = resolveSectionKey(input.layer, input.dailySectionKey);
  if (!sectionKey) return;

  void loadHumanDailySection(userId, sectionKey, chartId, today, {
    accessTier: 'premium',
    profile,
    chartData,
  }).catch(() => undefined);
}

export function prefetchAllHomeCardDailyContent(input: {
  profile: UserProfile;
  chartData: NatalChartData;
  chartId?: number | null;
}): void {
  const userId = String(input.profile.id || '');
  if (!userId || !input.chartData?.sun || !input.chartData?.moon) return;

  const today = getMoscowTodayKey();
  const chartId = input.chartId ?? undefined;
  const { profile, chartData } = input;

  void ensureFullDaypartForecast(profile, chartData, 'day', {
    accessTier: 'premium',
    date: today,
    chartId,
  }).catch(() => undefined);

  for (const sectionKey of PREMIUM_DAILY_READINESS_SECTION_KEYS) {
    void loadHumanDailySection(userId, sectionKey, chartId, today, {
      accessTier: 'premium',
      profile,
      chartData,
    }).catch(() => undefined);
  }
}
