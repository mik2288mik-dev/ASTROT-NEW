import { db } from './db';
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

async function ensureMinimalUser(args: ChartInput, normalized: ReturnType<typeof normalizeInput>) {
  const existing = await db.users.get(args.userId);
  if (existing) return existing;
  await db.users.set(args.userId, {
    name: args.name,
    birth_date: normalized.birthDate,
    birth_time: normalized.time.localTime,
    birth_time_mode: normalized.time.mode,
    birth_time_uncertainty_minutes: normalized.time.uncertaintyMinutes,
    birth_time_range_start: normalized.time.rangeStart,
    birth_time_range_end: normalized.time.rangeEnd,
    birth_place: normalized.birthPlace,
    is_setup: false,
    language: args.language || 'ru',
    theme: 'light',
    is_admin: false,
  });
  return db.users.get(args.userId);
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

  await ensureMinimalUser(args, normalized);
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

  await ensureMinimalUser(args, normalized);
  const chartData = await calculateNatalChart(args.name, normalized.birthDate, normalized.birthTime, normalized.birthPlace, {
    coordinates,
    birthTime: normalized.time,
  });
  const chart = await natalChartV2Repository.create(args.userId, persistencePayload(args, normalized, inputHash, chartData));
  return { chart, reused:false };
}

export async function repairCanonicalChartForUser(userId:string) {
  const user = await db.users.get(userId);
  const chart = await natalChartV2Repository.getPrimary(userId);
  const birthDate = normalizeBirthDateInput(chart?.birth_date || user?.birth_date);
  const birthPlace = normalizeBirthPlaceInput(chart?.birth_place || user?.birth_place);
  if (!birthDate || !birthPlace) return null;
  return ensureCanonicalPrimaryChart({
    userId,
    name:(user?.name || chart?.name || 'Chart').trim(),
    birthDate,
    birthTime:chart?.birth_time || user?.birth_time || '',
    birthTimeMode:chart?.birth_time_mode || user?.birth_time_mode || undefined,
    birthTimeUncertaintyMinutes:chart?.birth_time_uncertainty_minutes ?? user?.birth_time_uncertainty_minutes ?? null,
    birthTimeRangeStart:chart?.birth_time_range_start || user?.birth_time_range_start || null,
    birthTimeRangeEnd:chart?.birth_time_range_end || user?.birth_time_range_end || null,
    birthPlace,
    language:user?.language || 'ru',
  });
}

export async function repairCanonicalChartRecord(userId:string, chartId?:number|null) {
  if (!chartId) return repairCanonicalChartForUser(userId);
  const chart = await natalChartV2Repository.getById(chartId);
  if (!chart) return null;
  if (chart.is_primary) return repairCanonicalChartForUser(userId);
  const result = await createOrReuseCanonicalChart({
    userId,
    name:chart.name || 'Моя карта',
    birthDate:normalizeBirthDateInput(chart.birth_date),
    birthTime:chart.birth_time || '',
    birthTimeMode:chart.birth_time_mode || undefined,
    birthTimeUncertaintyMinutes:chart.birth_time_uncertainty_minutes ?? null,
    birthTimeRangeStart:chart.birth_time_range_start || null,
    birthTimeRangeEnd:chart.birth_time_range_end || null,
    birthPlace:normalizeBirthPlaceInput(chart.birth_place),
  });
  return { chart:result.chart, source:result.reused ? 'repaired' : 'calculated' } as const;
}
