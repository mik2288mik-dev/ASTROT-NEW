import type {
  BirthTimeQuality,
  ChartQuality,
  DailyCheckIn,
  Language,
  NatalChartData,
  PlanetPosition,
  TodayPulse,
  UserProfile,
} from '../types';
import { db } from './db';
import { getMoscowTodayKey } from './date-utils';
import { resolveTodayPulseForUser } from './todayPulseResolver';
import { extractPersonalizationPrivacyFlags, logger } from './logger';

export type PersonalizationSurface = 'today' | 'ask_lumia' | 'natal' | 'synastry';

export type RecentQuestionContext = {
  question: string;
  answer?: string;
  createdAt?: string;
};

export type RelationshipContextItem = {
  summary: string;
  compatibilityScore?: number | null;
  updatedAt?: string | null;
  cacheKey?: string | null;
};

export type PersonalizationContext = {
  surface: PersonalizationSurface;
  user: UserProfile;
  chartId: number | null;
  chartData: NatalChartData | null;
  chartQuality: ChartQuality;
  planets: Record<string, PlanetPosition | null>;
  todayPulse?: TodayPulse | null;
  recentCheckIns: DailyCheckIn[];
  recentQuestions: RecentQuestionContext[];
  relationshipContext: RelationshipContextItem[];
};

type BuildPersonalizationContextOptions = {
  userId: string;
  surface: PersonalizationSurface;
  chartId?: number | null;
  profileFallback?: Partial<UserProfile>;
  chartDataFallback?: NatalChartData | null;
  includeTodayPulse?: boolean;
  includeRecentCheckIns?: boolean;
  includeRecentQuestions?: boolean;
  includeRelationshipContext?: boolean;
  relationshipContext?: RelationshipContextItem[];
  dateKey?: string;
};

function toProfile(user: any, fallback?: Partial<UserProfile>): UserProfile {
  return {
    id: fallback?.id || String(user?.id || ''),
    name: fallback?.name || user?.name || '',
    birthDate: fallback?.birthDate || user?.birth_date || '',
    birthTime: fallback?.birthTime ?? user?.birth_time ?? '',
    birthPlace: fallback?.birthPlace || user?.birth_place || '',
    isSetup: fallback?.isSetup ?? user?.is_setup ?? false,
    language: (fallback?.language as Language) || user?.language || 'ru',
    theme: (fallback?.theme as 'dark' | 'light') || user?.theme || 'light',
    isPremium: !!user?.is_premium,
    isAdmin: fallback?.isAdmin ?? !!user?.is_admin,
    loginStreak: fallback?.loginStreak ?? user?.login_streak ?? 0,
    chartSlots: fallback?.chartSlots ?? user?.chart_slots ?? 1,
    generatedContent: fallback?.generatedContent,
  };
}

function inferBirthTimeQuality(rawBirthTime?: string | null): BirthTimeQuality {
  const value = String(rawBirthTime || '').trim();
  if (!value) return 'unknown';
  if (value.toLowerCase().includes('default') || value.toLowerCase().includes('unknown')) return 'unknown';
  return /^\d{1,2}:\d{2}/.test(value) ? 'exact' : 'approximate';
}

export function normalizeChartQuality(
  chartData: NatalChartData | null | undefined,
  profile?: Pick<UserProfile, 'birthTime'> | null,
  chartRow?: any
): ChartQuality {
  const explicitQuality = chartData?.chartQuality;
  const birthTimeQuality =
    explicitQuality?.birthTimeQuality ||
    chartData?.birthTimeQuality ||
    inferBirthTimeQuality(profile?.birthTime || chartRow?.birth_time);
  const timed = birthTimeQuality === 'exact';

  return {
    birthTimeQuality,
    ascendantReliable: explicitQuality?.ascendantReliable ?? timed,
    housesReliable: explicitQuality?.housesReliable ?? timed,
    houseBasedPersonalization: explicitQuality?.houseBasedPersonalization ?? timed,
    notes: explicitQuality?.notes?.length
      ? explicitQuality.notes
      : timed
        ? []
        : ['Birth time is unknown or approximate; do not treat Ascendant and houses as exact.'],
  };
}

function pickPlanets(chartData: NatalChartData | null, chartQuality: ChartQuality) {
  return {
    sun: chartData?.sun || null,
    moon: chartData?.moon || null,
    ascendant: chartQuality.ascendantReliable ? chartData?.rising || null : null,
    mercury: chartData?.mercury || null,
    venus: chartData?.venus || null,
    mars: chartData?.mars || null,
    jupiter: chartData?.jupiter || null,
    saturn: chartData?.saturn || null,
  };
}

function normalizeDate(value: any) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function summarizeRelationshipRow(row: any): RelationshipContextItem | null {
  const content = typeof row?.content === 'string'
    ? (() => {
        try {
          return JSON.parse(row.content);
        } catch {
          return null;
        }
      })()
    : row?.content;
  if (!content || typeof content !== 'object') return null;

  const summary =
    String(content.summary || '').trim() ||
    String(content.fullAnalysis?.generalTheme || '').trim() ||
    String(content.fullAnalysis?.attraction || '').trim();
  if (!summary) return null;

  return {
    summary: summary.slice(0, 900),
    compatibilityScore: typeof content.compatibilityScore === 'number' ? content.compatibilityScore : null,
    updatedAt: normalizeDate(row.updated_at || row.created_at) || null,
    cacheKey: row.cache_key || null,
  };
}

export async function buildPersonalizationContext(
  options: BuildPersonalizationContextOptions
): Promise<PersonalizationContext | null> {
  const startedAt = Date.now();
  logger.info({
    scope: 'personalization-context',
    event: 'personalization_build_start',
    userId: options.userId,
    chartId: options.chartId ?? null,
    surface: options.surface,
    metadata: {
      includeTodayPulse: !!options.includeTodayPulse,
      includeRecentCheckIns: !!options.includeRecentCheckIns,
      includeRecentQuestions: !!options.includeRecentQuestions,
      includeRelationshipContext: !!options.includeRelationshipContext,
    },
  });

  const user = await db.users.get(options.userId).catch(() => null);
  if (!user && !options.profileFallback) return null;

  const profile = toProfile(user, options.profileFallback);
  const chartRow = options.chartId != null
    ? await db.natal_charts.getById(options.chartId).catch(() => null)
    : await db.natal_charts.getPrimary(options.userId).catch(() => null);
  const chartData = (options.chartDataFallback || chartRow?.chart_data || null) as NatalChartData | null;
  const chartQuality = normalizeChartQuality(chartData, profile, chartRow);
  const chartId = chartRow?.id ?? options.chartId ?? null;

  const [todayPulseResult, recentCheckIns, recentQuestions, recentRelationships] = await Promise.all([
    options.includeTodayPulse && chartData
      ? resolveTodayPulseForUser({
          userId: options.userId,
          chartId,
          dateKey: options.dateKey || getMoscowTodayKey(),
          profileFallback: profile,
          chartDataFallback: chartData,
        }).catch(() => null)
      : Promise.resolve(null),
    options.includeRecentCheckIns
      ? db.daily_checkins.listRecent(options.userId, chartId, 7).catch(() => [])
      : Promise.resolve([]),
    options.includeRecentQuestions
      ? db.astro_questions.getByUser(options.userId, 6).catch(() => [])
      : Promise.resolve([]),
    options.includeRelationshipContext && typeof (db.synastry as any).listRecentForUser === 'function'
      ? (db.synastry as any).listRecentForUser(options.userId, chartId, 3).catch(() => [])
      : Promise.resolve([]),
  ]);

  const relationshipContext = [
    ...(options.relationshipContext || []),
    ...((recentRelationships as any[]).map(summarizeRelationshipRow).filter(Boolean) as RelationshipContextItem[]),
  ].slice(0, 4);

  if (!chartData) {
    logger.warn({
      scope: 'personalization-context',
      event: 'personalization_missing_chart',
      userId: options.userId,
      chartId,
      surface: options.surface,
      status: 'partial',
      durationMs: Date.now() - startedAt,
    });
  }

  const todayPulse = todayPulseResult?.status === 'ready' ? todayPulseResult.pulse : null;
  if (options.includeTodayPulse && chartData && !todayPulse) {
    logger.warn({
      scope: 'personalization-context',
      event: 'personalization_missing_today_pulse',
      userId: options.userId,
      chartId,
      surface: options.surface,
      status: 'partial',
      durationMs: Date.now() - startedAt,
    });
  }

  const context: PersonalizationContext = {
    surface: options.surface,
    user: profile,
    chartId,
    chartData,
    chartQuality,
    planets: pickPlanets(chartData, chartQuality),
    todayPulse,
    recentCheckIns: recentCheckIns as DailyCheckIn[],
    recentQuestions: (recentQuestions as any[]).map((item) => ({
      question: String(item.question || '').trim(),
      answer: item.answer ? String(item.answer).trim().slice(0, 900) : undefined,
      createdAt: normalizeDate(item.created_at),
    })).filter((item) => item.question),
    relationshipContext,
  };

  const flags = extractPersonalizationPrivacyFlags(context);
  logger.info({
    scope: 'personalization-context',
    event: 'personalization_context_blocks',
    userId: options.userId,
    chartId,
    surface: options.surface,
    status: 'ok',
    durationMs: Date.now() - startedAt,
    metadata: { blocks: flags },
  });
  logger.info({
    scope: 'personalization-context',
    event: 'personalization_build_success',
    userId: options.userId,
    chartId,
    surface: options.surface,
    status: 'ok',
    durationMs: Date.now() - startedAt,
    metadata: flags,
  });

  return context;
}

function planetLine(label: string, position: PlanetPosition | null | undefined) {
  if (!position?.sign) return '';
  const degree = typeof position.degree === 'number' ? ` ${Number(position.degree).toFixed(1)} deg` : '';
  return `${label}: ${position.sign}${degree}`;
}

function formatLayers(pulse: TodayPulse) {
  const layers = pulse.layers || pulse.currentPoint?.layers;
  if (!layers) return '';
  return `energy ${layers.energy}, focus ${layers.focus}, emotions ${layers.emotions}, money ${layers.money}, relationships ${layers.relationships}`;
}

export function describePersonalizationContext(context: PersonalizationContext, language: Language = 'ru') {
  const lines = [
    `Surface: ${context.surface}`,
    `Name: ${context.user.name || 'Unknown'}`,
    context.user.birthDate ? `Birth date: ${context.user.birthDate}` : '',
    context.user.birthTime ? `Birth time: ${context.user.birthTime}` : 'Birth time: unknown',
    context.user.birthPlace ? `Birth place: ${context.user.birthPlace}` : '',
    `Birth time quality: ${context.chartQuality.birthTimeQuality}`,
    `Ascendant reliable: ${context.chartQuality.ascendantReliable ? 'yes' : 'no'}`,
    `Houses reliable: ${context.chartQuality.housesReliable ? 'yes' : 'no'}`,
    ...context.chartQuality.notes.map((note) => `Quality note: ${note}`),
    planetLine('Sun', context.planets.sun),
    planetLine('Moon', context.planets.moon),
    context.chartQuality.ascendantReliable
      ? planetLine('Ascendant', context.planets.ascendant)
      : 'Ascendant: not used as exact because birth time is not exact',
    planetLine('Mercury', context.planets.mercury),
    planetLine('Venus', context.planets.venus),
    planetLine('Mars', context.planets.mars),
    planetLine('Jupiter', context.planets.jupiter),
    planetLine('Saturn', context.planets.saturn),
  ].filter(Boolean);

  if (context.todayPulse) {
    lines.push(
      `Today Pulse source: ${context.todayPulse.source}`,
      `Today Pulse current: ${context.todayPulse.currentPoint?.time || context.todayPulse.currentTime}, ${context.todayPulse.currentPoint?.title || 'current point'}, score ${context.todayPulse.currentPoint?.score ?? 'n/a'}`,
      `Today Pulse peak: ${context.todayPulse.peakPoint?.time || 'n/a'}, ${context.todayPulse.peakPoint?.title || 'peak point'}, score ${context.todayPulse.peakPoint?.score ?? 'n/a'}`,
      `Today Pulse layers: ${formatLayers(context.todayPulse)}`
    );
  }

  if (context.recentCheckIns.length) {
    lines.push('Recent check-ins:');
    for (const checkIn of context.recentCheckIns.slice(0, 5)) {
      lines.push(`- ${checkIn.date}: focus=${checkIn.focus}, mood=${checkIn.mood}, people=${checkIn.people}, fit=${checkIn.forecastFit}`);
    }
  }

  if (context.recentQuestions.length) {
    lines.push('Recent Ask the astrologer questions:');
    for (const item of context.recentQuestions.slice(0, 5)) {
      lines.push(`- ${item.question}`);
    }
  }

  if (context.relationshipContext.length) {
    lines.push('Relationship context:');
    for (const item of context.relationshipContext) {
      const score = item.compatibilityScore != null ? ` score=${item.compatibilityScore}` : '';
      lines.push(`- ${item.summary}${score}`);
    }
  }

  if (language === 'en') return lines.join('\n');
  return lines.join('\n');
}
