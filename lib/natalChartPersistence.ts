import { db } from './db';
import { birthProfileRepository } from './birthProfileRepository';
import { natalChartV2Repository } from './natalChartV2Repository';
import { calculateNatalChart, resolveBirthCoordinates } from './swisseph-calculator';
import {
  buildCanonicalNatalInputHash, isCanonicalNatalChartDataComplete,
  normalizeBirthDateInput, normalizeBirthPlaceInput, normalizeBirthTimeInput, normalizeCoordinateForStorage,
} from './natalChartCanonical';
import { birthTimeFingerprint, normalizeBirthTimeInput as normalizeTime, type BirthTimeMode } from './birthTime';
import { assertCanCreateSavedPerson, assertChartReadable, isSelfChart, normalizeRelationLabel } from './chartAccessPolicy';

export type ChartInput = {
  userId: string; name: string; birthDate: string; birthTime?: string;
  birthTimeMode?: BirthTimeMode; birthTimeUncertaintyMinutes?: number | null;
  birthTimeRangeStart?: string | null; birthTimeRangeEnd?: string | null;
  birthPlace: string; language?: string;
  coordinates?: { lat?: number | null; lon?: number | null; timezone?: string | null } | null;
  relationLabel?: string | null;
};
type ChartSource = 'cache' | 'calculated' | 'repaired';

function normalizeInput(args: ChartInput) {
  const birthDate = normalizeBirthDateInput(args.birthDate);
  const birthPlace = normalizeBirthPlaceInput(args.birthPlace);
  const legacyBirthTime = normalizeBirthTimeInput(args.birthTime);
  const time = normalizeTime({ mode: args.birthTimeMode, localTime: legacyBirthTime, legacyBirthTime,
    uncertaintyMinutes: args.birthTimeUncertaintyMinutes,
    rangeStart: normalizeBirthTimeInput(args.birthTimeRangeStart), rangeEnd: normalizeBirthTimeInput(args.birthTimeRangeEnd) });
  if (!birthDate || !birthPlace) throw Object.assign(new Error('Birth profile is incomplete'), { code: 'BIRTH_PROFILE_INCOMPLETE' });
  return { birthDate, birthPlace, time };
}
const placeKey = (value: string) => normalizeBirthPlaceInput(value).toLocaleLowerCase('ru');
const nameKey = (value: string) => String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru');

function storedCoordinates(data: any): { lat: number; lon: number; timezone: string } | null {
  const lat = data?.birth?.latitude ?? data?.latitude;
  const lon = data?.birth?.longitude ?? data?.longitude;
  const timezone = data?.birth?.timezone ?? data?.timezone;
  return typeof lat === 'number' && Number.isFinite(lat) && typeof lon === 'number' && Number.isFinite(lon)
    && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && typeof timezone === 'string' && timezone.trim()
    ? { lat, lon, timezone } : null;
}
function coordinatesMatch(data: any, coordinates: ChartInput['coordinates']) {
  if (!coordinates || (coordinates.lat == null && coordinates.lon == null && !coordinates.timezone)) return true;
  const saved = storedCoordinates(data);
  if (!saved) return false;
  return (coordinates.lat == null || normalizeCoordinateForStorage(saved.lat) === normalizeCoordinateForStorage(Number(coordinates.lat)))
    && (coordinates.lon == null || normalizeCoordinateForStorage(saved.lon) === normalizeCoordinateForStorage(Number(coordinates.lon)))
    && (!coordinates.timezone || coordinates.timezone === saved.timezone);
}
function sameBirth(data: any, input: ReturnType<typeof normalizeInput>, coordinates: ChartInput['coordinates']) {
  return data?.birth && normalizeBirthDateInput(data.birth.localDate) === input.birthDate
    && placeKey(data.birth.place) === placeKey(input.birthPlace)
    && birthTimeFingerprint(data.birth.time) === birthTimeFingerprint(input.time)
    && coordinatesMatch(data, coordinates);
}
function fromRecord(userId: string, chart: any): ChartInput {
  return { userId, name: chart.name || 'Моя карта', birthDate: chart.birth_date,
    birthTime: chart.birth_time || '', birthPlace: chart.birth_place,
    birthTimeMode: chart.birth_time_mode || chart.chart_data?.birth?.time?.mode,
    birthTimeUncertaintyMinutes: chart.birth_time_uncertainty_minutes ?? null,
    birthTimeRangeStart: chart.birth_time_range_start ?? null, birthTimeRangeEnd: chart.birth_time_range_end ?? null,
    coordinates: storedCoordinates(chart.chart_data) || recordCoordinates(chart) || undefined };
}

function recordCoordinates(chart: any) {
  return chart.latitude != null && chart.longitude != null
    ? storedCoordinates({ latitude: Number(chart.latitude), longitude: Number(chart.longitude), timezone: chart.timezone }) : null;
}

function sameRecordBirth(chart: any, input: ReturnType<typeof normalizeInput>, coordinates: ChartInput['coordinates']) {
  if (sameBirth(chart.chart_data, input, coordinates)) return true;
  try {
    const saved = normalizeInput(fromRecord(String(chart.user_id), chart));
    return saved.birthDate === input.birthDate && placeKey(saved.birthPlace) === placeKey(input.birthPlace)
      && birthTimeFingerprint(saved.time) === birthTimeFingerprint(input.time)
      && coordinatesMatch(storedCoordinates(chart.chart_data) ? chart.chart_data
        : { latitude: recordCoordinates(chart)?.lat, longitude: recordCoordinates(chart)?.lon, timezone: chart.timezone }, coordinates);
  } catch { return false; }
}

/** The only user-facing calculation path. The DB lock spans lookup, Swiss and save. */
export async function getOrCreateCanonicalNatalChart(args: ChartInput, options: {
  subjectType: 'self' | 'saved_person'; chartId?: number; explicitRepair?: boolean;
}): Promise<{ chart: any; source: ChartSource; reused: boolean }> {
  let normalized = normalizeInput(args);
  return natalChartV2Repository.withUserLock(args.userId, async (repo) => {
    const charts = await repo.getAll(args.userId);
    const existing = options.chartId
      ? charts.find((chart) => chart.id === options.chartId)
      : options.subjectType === 'self' ? charts.find(isSelfChart)
        : charts.find((chart) => !isSelfChart(chart) && nameKey(chart.name) === nameKey(args.name)
          && sameRecordBirth(chart, normalized, args.coordinates));
    if (options.chartId && (!existing || isSelfChart(existing) !== (options.subjectType === 'self'))) {
      throw Object.assign(new Error('Chart not found'), { code: 'CHART_NOT_FOUND' });
    }
    if (options.explicitRepair) {
      // Repair must target the state protected by this transaction, never birth
      // data captured before a concurrent profile edit completed.
      const current = options.subjectType === 'self' ? await repo.getBirthProfile(args.userId) : existing;
      if (!current) throw Object.assign(new Error('Chart not found'), { code: 'CHART_NOT_FOUND' });
      args = fromRecord(args.userId, current);
      normalized = normalizeInput(args);
    }
    const isPremium = options.subjectType === 'saved_person' && !options.explicitRepair
      ? await repo.isPremium(args.userId) : false;
    if (existing && options.subjectType === 'saved_person' && !options.explicitRepair) assertChartReadable(existing, isPremium, charts);

    if (!options.explicitRepair && existing?.input_hash && isCanonicalNatalChartDataComplete(existing.chart_data)
      && sameBirth(existing.chart_data, normalized, args.coordinates)) {
      let chart = existing.name === args.name ? existing : await repo.updateName(existing.id, args.name);
      if (options.subjectType === 'saved_person' && args.relationLabel !== undefined) {
        chart = await repo.setIdentityMetadata(chart.id, 'saved_person', normalizeRelationLabel(args.relationLabel));
      }
      if (options.subjectType === 'self') await repo.syncPrimaryProfile(args.userId, { ...normalized, name: args.name });
      console.info('[natal/chart]', { chart_source: 'stored' });
      return { chart, source: 'cache', reused: true };
    }
    if (!existing && options.subjectType === 'saved_person') assertCanCreateSavedPerson(charts, isPremium);
    if (existing && !options.explicitRepair && (!existing.input_hash || !isCanonicalNatalChartDataComplete(existing.chart_data))) {
      // A write with genuinely changed inputs is allowed; identical damaged data
      // requires the explicit repair path, just like an ordinary read.
      if (sameRecordBirth(existing, normalized, args.coordinates)) {
        throw Object.assign(new Error('Chart repair required'), { code: 'CHART_REPAIR_REQUIRED' });
      }
    }
    const calculations = [...charts, ...await repo.getCalculations(args.userId)];
    const reusable = !options.explicitRepair && calculations.find((row) => row.input_hash
      && isCanonicalNatalChartDataComplete(row.chart_data) && sameBirth(row.chart_data, normalized, args.coordinates));
    let data = reusable ? reusable.chart_data : null;
    let inputHash = reusable ? reusable.input_hash : '';
    if (!data) {
      const location = calculations.find((row) => placeKey(row.chart_data?.birth?.place) === placeKey(normalized.birthPlace)
        && storedCoordinates(row.chart_data));
      const savedLocation = location && storedCoordinates(location.chart_data);
      const unchangedCoordinates = !args.coordinates || (args.coordinates.lat == null && args.coordinates.lon == null);
      const provided = unchangedCoordinates && savedLocation
        ? { ...savedLocation, timezone: args.coordinates?.timezone || savedLocation.timezone }
        : args.coordinates;
      const coordinates = savedLocation && coordinatesMatch(location.chart_data, args.coordinates)
        ? savedLocation : await resolveBirthCoordinates(normalized.birthPlace, provided);
      inputHash = buildCanonicalNatalInputHash({ ...normalized, birthTime: normalized.time.localTime,
        birthTimeMode: normalized.time.mode, birthTimeUncertaintyMinutes: normalized.time.uncertaintyMinutes,
        birthTimeRangeStart: normalized.time.rangeStart, birthTimeRangeEnd: normalized.time.rangeEnd,
        latitude: coordinates.lat, longitude: coordinates.lon, timezone: coordinates.timezone });
      data = await calculateNatalChart(args.name, normalized.birthDate, normalized.time.localTime || '', normalized.birthPlace,
        { coordinates, birthTime: normalized.time });
    }
    const payload = { name: args.name, birthDate: normalized.birthDate, birthPlace: normalized.birthPlace,
      birthTime: normalized.time.localTime || undefined, birthTimeMode: normalized.time.mode,
      birthTimeUncertaintyMinutes: normalized.time.uncertaintyMinutes, birthTimeRangeStart: normalized.time.rangeStart,
      birthTimeRangeEnd: normalized.time.rangeEnd,
      relationLabel: args.relationLabel === undefined ? existing?.relation_label ?? null : normalizeRelationLabel(args.relationLabel), inputHash, chartData: data };
    const chart = options.subjectType === 'self' ? await repo.persistPrimary(args.userId, payload)
      : existing ? await repo.repairSaved(args.userId, existing.id, payload) : await repo.create(args.userId, payload);
    if (options.subjectType === 'self') await repo.syncPrimaryProfile(args.userId, { ...normalized, name: args.name });
    const source: ChartSource = reusable ? 'cache' : options.explicitRepair ? 'repaired' : 'calculated';
    console.info('[natal/chart]', { chart_source: source === 'cache' ? 'stored' : source,
      ...(reusable ? {} : { reason: options.explicitRepair ? 'explicit_repair' : existing ? 'birth_data_changed' : 'new_chart' }) });
    return { chart, source, reused: !!reusable };
  });
}

// Legacy forceRecalculate is deliberately ignored on user writes. Only the
// explicit admin/backfill entrypoints below may repair unchanged birth data.
export async function ensureCanonicalPrimaryChart(args: ChartInput & { forceRecalculate?: boolean }) {
  return getOrCreateCanonicalNatalChart(args, { subjectType: 'self' });
}
export async function createOrReuseCanonicalChart(args: ChartInput & { chartData?: any }) {
  return getOrCreateCanonicalNatalChart(args, { subjectType: 'saved_person' });
}
export async function updateCanonicalSavedChart(userId: string, chartId: number, args: Omit<ChartInput, 'userId'>) {
  return getOrCreateCanonicalNatalChart({ ...args, userId }, { subjectType: 'saved_person', chartId });
}

/** Explicit maintenance only. No page load, AI consumer or GET calls this. */
export async function repairCanonicalChartForUser(userId: string) {
  const user = await db.users.get(userId, { hydratePrimaryChart: false });
  if (!user?.birth_date || !user.birth_place) return null;
  const time = await birthProfileRepository.get(userId);
  return getOrCreateCanonicalNatalChart({ userId, name: user.name || 'Моя карта', birthDate: user.birth_date,
    birthTime: user.birth_time || '', birthPlace: user.birth_place,
    birthTimeMode: time?.birth_time_mode || undefined, birthTimeUncertaintyMinutes: time?.birth_time_uncertainty_minutes,
    birthTimeRangeStart: time?.birth_time_range_start, birthTimeRangeEnd: time?.birth_time_range_end },
  { subjectType: 'self', explicitRepair: true });
}
export async function repairCanonicalChartRecord(userId: string, chartId?: number | null) {
  if (!chartId) return repairCanonicalChartForUser(userId);
  const chart = await natalChartV2Repository.getById(chartId);
  if (!chart || String(chart.user_id) !== String(userId)) return null;
  if (isSelfChart(chart)) return repairCanonicalChartForUser(userId);
  return getOrCreateCanonicalNatalChart(fromRecord(userId, chart), { subjectType: 'saved_person', chartId, explicitRepair: true });
}
