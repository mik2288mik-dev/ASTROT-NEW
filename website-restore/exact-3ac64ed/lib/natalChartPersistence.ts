import { db } from './db';
import { birthProfileRepository } from './birthProfileRepository';
import { natalChartV2Repository } from './natalChartV2Repository';
import { calculateNatalChart, resolveBirthCoordinates } from './swisseph-calculator';
import {
  buildCanonicalNatalInputHash,
  isCanonicalNatalChartDataComplete,
  normalizeBirthDateInput,
  normalizeBirthPlaceInput,
  normalizeBirthTimeInput,
} from './natalChartCanonical';
import { normalizeBirthTimeInput as normalizeBirthTimeContract, type BirthTimeMode } from './birthTime';

type ProvidedCoordinates = { lat?: number | null; lon?: number | null; timezone?: string | null };
type ChartInput = {
  userId: string;
  name: string;
  birthDate: string;
  birthTime?: string;
  birthTimeMode?: BirthTimeMode;
  birthTimeUncertaintyMinutes?: number | null;
  birthTimeRangeStart?: string | null;
  birthTimeRangeEnd?: string | null;
  birthPlace: string;
  language?: string;
  coordinates?: ProvidedCoordinates | null;
};
type EnsurePrimaryArgs = ChartInput & { forceRecalculate?: boolean };
type CreateOrReuseArgs = ChartInput & { chartData?: any };

function normalizeInput(args: ChartInput) {
  const birthDate = normalizeBirthDateInput(args.birthDate);
  const birthPlace = normalizeBirthPlaceInput(args.birthPlace);
  const legacyBirthTime = normalizeBirthTimeInput(args.birthTime);
  const time = normalizeBirthTimeContract({
    mode: args.birthTimeMode,
    localTime: legacyBirthTime,
    uncertaintyMinutes: args.birthTimeUncertaintyMinutes,
    rangeStart: args.birthTimeRangeStart,
    rangeEnd: args.birthTimeRangeEnd,
    legacyBirthTime,
  });
  return { birthDate, birthPlace, birthTime: time.localTime || '', time };
}

async function ensureMinimalUser(args: ChartInput, normalized: ReturnType<typeof normalizeInput>, syncSelfBirthTime: boolean) {
  const existing = syncSelfBirthTime
    ? await db.users.updateExisting(args.userId, {
        name: args.name,
        birth_date: normalized.birthDate,
        birth_time: normalized.time.localTime,
        birth_place: normalized.birthPlace,
        language: args.language || 'ru',
        theme: 'light',
      })
    : await db.users.get(args.userId, { hydratePrimaryChart: false });
  if (!existing) throw new Error('ACCOUNT_NO_LONGER_EXISTS');
  if (syncSelfBirthTime) await birthProfileRepository.set(args.userId, normalized.time);
  return existing;
}

function isStoredCanonicalChart(chart: any): boolean {
  return !!chart && !!chart.input_hash && isCanonicalNatalChartDataComplete(chart.chart_data);
}

function hashInput(normalized: ReturnType<typeof normalizeInput>, coordinates: {lat:number;lon:number;timezone:string}) {
  return buildCanonicalNatalInputHash({
    birthDate: normalized.birthDate,
    birthTime: normalized.time.localTime,
    birthTimeMode: normalized.time.mode,
    birthTimeUncertaintyMinutes: normalized.time.uncertaintyMinutes,
    birthTimeRangeStart: normalized.time.rangeStart,
    birthTimeRangeEnd: normalized.time.rangeEnd,
    latitude: coordinates.lat,
    longitude: coordinates.lon,
    timezone: coordinates.timezone,
  });
}

function persistencePayload(args: ChartInput, normalized: ReturnType<typeof normalizeInput>, inputHash: string, chartData: any) {
  return {
    name: args.name,
    birthDate: normalized.birthDate,
    birthTime: normalized.time.localTime || undefined,
    birthTimeMode: normalized.time.mode,
    birthTimeUncertaintyMinutes: normalized.time.uncertaintyMinutes,
    birthTimeRangeStart: normalized.time.rangeStart,
    birthTimeRangeEnd: normalized.time.rangeEnd,
    birthPlace: normalized.birthPlace,
    inputHash,
    chartData,
  };
}

export async function ensureCanonicalPrimaryChart(args: EnsurePrimaryArgs): Promise<{ chart:any; source:'cache'|'calculated'|'repaired' }> {
  const normalized = normalizeInput(args);
  const coordinates = await resolveBirthCoordinates(normalized.birthPlace, args.coordinates);
  const inputHash = hashInput(normalized, coordinates);
  const existing = await natalChartV2Repository.findByInputHash(args.userId, inputHash, { subjectType:'self' });
  if (!args.forceRecalculate && isStoredCanonicalChart(existing)) return { chart:existing, source:'cache' };

  await ensureMinimalUser(args, normalized, true);
  const chartData = await calculateNatalChart(args.name, normalized.birthDate, normalized.birthTime, normalized.birthPlace, {
    coordinates,
    birthTime: normalized.time,
  });
  const chart = await natalChartV2Repository.persistPrimary(args.userId, persistencePayload(args, normalized, inputHash, chartData));
  return { chart, source: existing ? 'repaired' : 'calculated' };
}

export async function createOrReuseCanonicalChart(args: CreateOrReuseArgs): Promise<{ chart:any; reused:boolean }> {
  const normalized = normalizeInput(args);
  const coordinates = await resolveBirthCoordinates(normalized.birthPlace, args.coordinates);
  const inputHash = hashInput(normalized, coordinates);
  const existing = await natalChartV2Repository.findByInputHash(args.userId, inputHash, { subjectType:'saved_person', name:args.name });
  if (isStoredCanonicalChart(existing)) return { chart:existing, reused:true };

  await ensureMinimalUser(args, normalized, false);
  const chartData = await calculateNatalChart(args.name, normalized.birthDate, normalized.birthTime, normalized.birthPlace, {
    coordinates,
    birthTime: normalized.time,
  });
  const chart = await natalChartV2Repository.create(args.userId, persistencePayload(args, normalized, inputHash, chartData));
  return { chart, reused:false };
}

export async function repairCanonicalChartForUser(userId:string) {
  const user = await db.users.get(userId);
  const birthSettings = await birthProfileRepository.get(userId);
  const chart = await natalChartV2Repository.getPrimary(userId);
  // The account profile is the source of truth for a self chart. A legacy or
  // incomplete chart may describe an older birth profile, so using chart-first
  // values here can both repair the wrong chart and write those stale values
  // back into users through ensureMinimalUser().
  const birthDate = normalizeBirthDateInput(user?.birth_date || chart?.birth_date);
  const birthPlace = normalizeBirthPlaceInput(user?.birth_place || chart?.birth_place);
  if (!birthDate || !birthPlace) {
    console.warn('[natal/chart-repair] skipped: birth profile is incomplete', {
      missingFields: [!birthDate && 'birthDate', !birthPlace && 'birthPlace'].filter(Boolean),
      hasPrimaryChart: !!chart,
    });
    return null;
  }
  const profileTimeMode = birthSettings?.birth_time_mode
    || (user ? (user.birth_time ? 'exact' : 'unknown') : undefined);
  const timeMetadata = user ? birthSettings : chart;
  return ensureCanonicalPrimaryChart({
    userId,
    name:(user?.name || chart?.name || 'Chart').trim(),
    birthDate,
    birthTime:user ? (user.birth_time ?? '') : (chart?.birth_time ?? ''),
    birthTimeMode:profileTimeMode || timeMetadata?.birth_time_mode || undefined,
    birthTimeUncertaintyMinutes:timeMetadata?.birth_time_uncertainty_minutes ?? null,
    birthTimeRangeStart:timeMetadata?.birth_time_range_start || null,
    birthTimeRangeEnd:timeMetadata?.birth_time_range_end || null,
    birthPlace,
    language:user?.language || 'ru',
  });
}

export async function repairCanonicalChartRecord(userId:string, chartId?:number|null) {
  if (!chartId) return repairCanonicalChartForUser(userId);
  const chart = await natalChartV2Repository.getById(chartId);
  if (!chart) return null;
  if (String(chart.user_id) !== String(userId)) return null;
  if (chart.is_primary || chart.subject_type === 'self') return repairCanonicalChartForUser(userId);
  const args: ChartInput = {
    userId,
    name:chart.name || 'Моя карта',
    birthDate:normalizeBirthDateInput(chart.birth_date),
    birthTime:chart.birth_time || '',
    birthTimeMode:chart.birth_time_mode || undefined,
    birthTimeUncertaintyMinutes:chart.birth_time_uncertainty_minutes ?? null,
    birthTimeRangeStart:chart.birth_time_range_start || null,
    birthTimeRangeEnd:chart.birth_time_range_end || null,
    birthPlace:normalizeBirthPlaceInput(chart.birth_place),
  };
  const normalized = normalizeInput(args);
  const coordinates = await resolveBirthCoordinates(normalized.birthPlace);
  const inputHash = hashInput(normalized, coordinates);
  await ensureMinimalUser(args, normalized, false);
  const chartData = await calculateNatalChart(args.name, normalized.birthDate, normalized.birthTime, normalized.birthPlace, {
    coordinates,
    birthTime: normalized.time,
  });
  const repaired = await natalChartV2Repository.repairSaved(
    userId,
    chartId,
    persistencePayload(args, normalized, inputHash, chartData),
  );
  return { chart:repaired, source:'repaired' } as const;
}
