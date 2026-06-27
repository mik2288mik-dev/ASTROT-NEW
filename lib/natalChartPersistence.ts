import { db } from './db';
import { calculateNatalChart, resolveBirthCoordinates } from './swisseph-calculator';
import {
  buildCanonicalNatalInputHash,
  isCanonicalNatalChartDataComplete,
  normalizeBirthDateInput,
  normalizeBirthPlaceInput,
  normalizeBirthTimeInput,
} from './natalChartCanonical';
import type { BirthTimeQuality, ChartQuality } from '../types';

// Координаты, разрешённые на стороне клиента (автокомплит города). Если переданы —
// сервер не геокодит место заново. Опционально: при отсутствии — обычный геокодинг.
type ProvidedCoordinates = { lat?: number | null; lon?: number | null; timezone?: string | null };

type EnsurePrimaryArgs = {
  userId: string;
  name: string;
  birthDate: string;
  birthTime?: string;
  birthPlace: string;
  language?: string;
  forceRecalculate?: boolean;
  coordinates?: ProvidedCoordinates | null;
};

type CreateOrReuseArgs = {
  userId: string;
  name: string;
  birthDate: string;
  birthTime?: string;
  birthPlace: string;
  chartData?: any;
  language?: string;
  coordinates?: ProvidedCoordinates | null;
};

function inferBirthTimeQuality(rawBirthTime?: string | null): BirthTimeQuality {
  const value = String(rawBirthTime || '').trim();
  if (!value) return 'unknown';
  if (value.toLowerCase().includes('default') || value.toLowerCase().includes('unknown')) return 'unknown';
  return /^\d{1,2}:\d{2}/.test(value) ? 'exact' : 'approximate';
}

function buildChartQuality(birthTimeQuality: BirthTimeQuality): ChartQuality {
  const timed = birthTimeQuality === 'exact';
  return {
    birthTimeQuality,
    ascendantReliable: timed,
    housesReliable: timed,
    houseBasedPersonalization: timed,
    notes: timed
      ? []
      : ['Birth time is not exact; Ascendant and houses are not precise enough for exact personalization.'],
  };
}

function ensureChartQuality(chartData: any, birthTimeQuality: BirthTimeQuality) {
  if (!chartData || typeof chartData !== 'object') return chartData;
  const existingQuality = chartData.birthTimeQuality || chartData.chartQuality?.birthTimeQuality;
  if (existingQuality) return chartData;
  return {
    ...chartData,
    birthTimeQuality,
    chartQuality: buildChartQuality(birthTimeQuality),
  };
}

async function ensureMinimalUser(args: EnsurePrimaryArgs) {
  const existingUser = await db.users.get(args.userId);
  if (existingUser) return existingUser;

  await db.users.set(args.userId, {
    name: args.name,
    birth_date: args.birthDate,
    birth_time: normalizeBirthTimeInput(args.birthTime),
    birth_place: normalizeBirthPlaceInput(args.birthPlace),
    is_setup: false,
    language: args.language || 'ru',
    theme: 'light',
    is_admin: false,
  });

  return db.users.get(args.userId);
}

function isStoredCanonicalChart(chart: any): boolean {
  return !!chart &&
    isCanonicalNatalChartDataComplete(chart.chart_data) &&
    !!chart.input_hash &&
    !!chart.sun_sign &&
    !!chart.moon_sign &&
    !!chart.ascendant_sign;
}

export async function ensureCanonicalPrimaryChart(args: EnsurePrimaryArgs): Promise<{ chart: any; source: 'cache' | 'calculated' | 'repaired' }> {
  const normalizedBirthDate = normalizeBirthDateInput(args.birthDate);
  const birthTimeQuality = inferBirthTimeQuality(args.birthTime);
  const normalizedBirthTime = normalizeBirthTimeInput(args.birthTime);
  const normalizedBirthPlace = normalizeBirthPlaceInput(args.birthPlace);

  const coordinates = await resolveBirthCoordinates(normalizedBirthPlace, args.coordinates);
  const inputHash = buildCanonicalNatalInputHash({
    birthDate: normalizedBirthDate,
    birthTime: normalizedBirthTime,
    birthTimeQuality,
    latitude: coordinates.lat,
    longitude: coordinates.lon,
    timezone: coordinates.timezone,
  });

  const existingSameHash = await db.natal_charts.findByInputHash(args.userId, inputHash);
  if (!args.forceRecalculate && isStoredCanonicalChart(existingSameHash)) {
    const canonicalChart = existingSameHash!;
    if (!canonicalChart.is_primary) {
      await db.natal_charts.setPrimary(canonicalChart.id);
      const primary = await db.natal_charts.getPrimary(args.userId);
      if (primary) {
        return { chart: primary, source: 'cache' };
      }
    }
    return { chart: canonicalChart, source: 'cache' };
  }

  await ensureMinimalUser(args);

  const chartData = await calculateNatalChart(
    args.name,
    normalizedBirthDate,
    normalizedBirthTime,
    normalizedBirthPlace,
    { coordinates, birthTimeQuality }
  );

  const savedChart = await db.natal_charts.persistPrimary(args.userId, {
    name: args.name,
    birthDate: normalizedBirthDate,
    birthTime: normalizedBirthTime,
    birthPlace: normalizedBirthPlace,
    inputHash,
    chartData,
  });

  return {
    chart: savedChart,
    source: existingSameHash ? 'repaired' : 'calculated',
  };
}

export async function createOrReuseCanonicalChart(args: CreateOrReuseArgs): Promise<{ chart: any; reused: boolean }> {
  const normalizedBirthDate = normalizeBirthDateInput(args.birthDate);
  const birthTimeQuality = inferBirthTimeQuality(args.birthTime);
  const normalizedBirthTime = normalizeBirthTimeInput(args.birthTime);
  const normalizedBirthPlace = normalizeBirthPlaceInput(args.birthPlace);

  const coordinates = await resolveBirthCoordinates(normalizedBirthPlace, args.coordinates);
  const inputHash = buildCanonicalNatalInputHash({
    birthDate: normalizedBirthDate,
    birthTime: normalizedBirthTime,
    birthTimeQuality,
    latitude: coordinates.lat,
    longitude: coordinates.lon,
    timezone: coordinates.timezone,
  });

  const existingSameHash = await db.natal_charts.findByInputHash(args.userId, inputHash);
  if (isStoredCanonicalChart(existingSameHash)) {
    return { chart: existingSameHash, reused: true };
  }

  await ensureMinimalUser({
    userId: args.userId,
    name: args.name,
    birthDate: normalizedBirthDate,
    birthTime: normalizedBirthTime,
    birthPlace: normalizedBirthPlace,
    language: args.language,
    forceRecalculate: false,
  });

  const chartData = isCanonicalNatalChartDataComplete(args.chartData)
    ? ensureChartQuality(args.chartData, birthTimeQuality)
    : await calculateNatalChart(
        args.name,
        normalizedBirthDate,
        normalizedBirthTime,
        normalizedBirthPlace,
        { coordinates, birthTimeQuality }
      );

  const savedChart = await db.natal_charts.create(args.userId, {
    name: args.name,
    birthDate: normalizedBirthDate,
    birthTime: normalizedBirthTime,
    birthPlace: normalizedBirthPlace,
    chartData,
    inputHash,
  });

  return { chart: savedChart, reused: !!existingSameHash };
}

export async function repairCanonicalChartForUser(userId: string) {
  const user = await db.users.get(userId);
  const primaryChart = await db.natal_charts.getPrimary(userId);

  const birthDate = normalizeBirthDateInput(primaryChart?.birth_date || user?.birth_date);
  const rawBirthTime = primaryChart?.birth_time || user?.birth_time || '';
  const birthPlace = normalizeBirthPlaceInput(primaryChart?.birth_place || user?.birth_place);
  const name = (user?.name || primaryChart?.name || 'Chart').trim();

  if (!birthDate || !birthPlace) {
    return null;
  }

  return ensureCanonicalPrimaryChart({
    userId,
    name,
    birthDate,
    birthTime: rawBirthTime,
    birthPlace,
    language: user?.language || 'ru',
    forceRecalculate: false,
  });
}

export async function repairCanonicalChartRecord(userId: string, chartId?: number | null) {
  if (!chartId) {
    return repairCanonicalChartForUser(userId);
  }

  const chart = await db.natal_charts.getById(chartId);
  if (!chart) return null;

  if (chart.is_primary) {
    return repairCanonicalChartForUser(userId);
  }

  const result = await createOrReuseCanonicalChart({
    userId,
    name: chart.name || 'Моя карта',
    birthDate: normalizeBirthDateInput(chart.birth_date),
    birthTime: chart.birth_time || '',
    birthPlace: normalizeBirthPlaceInput(chart.birth_place),
  });

  return {
    chart: result.chart,
    source: result.reused ? 'repaired' : 'calculated',
  } as const;
}
