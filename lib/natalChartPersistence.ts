import { db, getPool } from './db';
import { calculateNatalChart, getCoordinates } from './swisseph-calculator';
import {
  buildCanonicalNatalInputHash,
  isCanonicalNatalChartDataComplete,
  normalizeBirthDateInput,
  normalizeBirthPlaceInput,
  normalizeBirthTimeInput,
} from './natalChartCanonical';
import type { BirthTimeQuality, ChartQuality } from '../types';


let canonicalSchemaReady: Promise<void> | null = null;

async function ensureCanonicalNatalPersistenceSchema(): Promise<void> {
  if (!canonicalSchemaReady) {
    canonicalSchemaReady = (async () => {
      const pool = getPool();

      // This endpoint is the onboarding critical path. In production, deploys can
      // reach the API before the latest migration has been run; without these
      // columns the calculation succeeds but persistence fails and the user sees
      // "Не удалось рассчитать натальную карту". Keep this DDL idempotent and
      // narrow to the canonical natal chart columns used by persistPrimary().
      await pool.query(`
        ALTER TABLE natal_charts
          ADD COLUMN IF NOT EXISTS name TEXT DEFAULT 'Моя карта',
          ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT TRUE,
          ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
          ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
          ADD COLUMN IF NOT EXISTS timezone TEXT,
          ADD COLUMN IF NOT EXISTS sun_sign TEXT,
          ADD COLUMN IF NOT EXISTS moon_sign TEXT,
          ADD COLUMN IF NOT EXISTS ascendant_sign TEXT,
          ADD COLUMN IF NOT EXISTS input_hash TEXT,
          ADD COLUMN IF NOT EXISTS calculation_version TEXT,
          ADD COLUMN IF NOT EXISTS birth_date DATE,
          ADD COLUMN IF NOT EXISTS birth_time TIME,
          ADD COLUMN IF NOT EXISTS birth_place TEXT,
          ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      `);
      await pool.query('ALTER TABLE natal_charts DROP CONSTRAINT IF EXISTS natal_charts_user_id_key');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_natal_charts_user_hash_v2 ON natal_charts(user_id, input_hash) WHERE input_hash IS NOT NULL');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_natal_charts_user_primary_v2 ON natal_charts(user_id) WHERE is_primary = TRUE');
    })().catch((error) => {
      canonicalSchemaReady = null;
      throw error;
    });
  }

  return canonicalSchemaReady;
}

type EnsurePrimaryArgs = {
  userId: string;
  name: string;
  birthDate: string;
  birthTime?: string;
  birthPlace: string;
  language?: string;
  forceRecalculate?: boolean;
};

type CreateOrReuseArgs = {
  userId: string;
  name: string;
  birthDate: string;
  birthTime?: string;
  birthPlace: string;
  chartData?: any;
  language?: string;
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

  await ensureCanonicalNatalPersistenceSchema();

  const coordinates = await getCoordinates(normalizedBirthPlace);
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

  await ensureCanonicalNatalPersistenceSchema();

  const coordinates = await getCoordinates(normalizedBirthPlace);
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
