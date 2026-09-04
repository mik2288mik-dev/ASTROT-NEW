const mockCalculate = jest.fn();
const mockCoordinates = jest.fn();
const mockWithUserLock = jest.fn();
const mockGetById = jest.fn();

jest.mock('../lib/db', () => ({ db: { users: { get: jest.fn() } } }));
jest.mock('../lib/birthProfileRepository', () => ({ birthProfileRepository: { get: jest.fn() } }));
jest.mock('../lib/natalChartV2Repository', () => ({ natalChartV2Repository: {
  withUserLock: (...args: unknown[]) => mockWithUserLock(...args),
  getById: (...args: unknown[]) => mockGetById(...args),
} }));
jest.mock('../lib/swisseph-calculator', () => ({
  calculateNatalChart: (...args: unknown[]) => mockCalculate(...args),
  resolveBirthCoordinates: (...args: unknown[]) => mockCoordinates(...args),
}));

import {
  createOrReuseCanonicalChart, ensureCanonicalPrimaryChart, getOrCreateCanonicalNatalChart,
  repairCanonicalChartRecord, updateCanonicalSavedChart, type ChartInput,
} from '../lib/natalChartPersistence';
import type { BirthTimeInput } from '../lib/birthTime';
import { canonicalNatalChart } from './fixtures/canonicalNatalChart';

const input: ChartInput = {
  userId: '42', name: 'Анна', birthDate: '1990-01-01', birthTime: '08:15',
  birthTimeMode: 'exact', birthPlace: 'Москва',
};
const coordinates = { lat: 55.75, lon: 37.62, timezone: 'Europe/Moscow' };

function calculation(date: string, place: string, time: BirthTimeInput, location = coordinates) {
  return canonicalNatalChart({ birthDate: date, birthPlace: place, time, coordinates: location });
}

describe('canonical natal calculation persistence', () => {
  let charts: any[];
  let revisions: any[];
  let profile: any;
  let premium: boolean;
  let nextId: number;
  let queue: Promise<unknown>;
  let repo: any;

  function save(userId: string, payload: any, subjectType: string, existing?: any) {
    if (existing) revisions.push({ input_hash: existing.input_hash, chart_data: existing.chart_data });
    const row = {
      id: existing?.id ?? nextId++, user_id: userId, subject_type: subjectType,
      is_primary: subjectType === 'self', archived_at: null, name: payload.name,
      birth_date: payload.birthDate, birth_time: payload.birthTime ?? null, birth_place: payload.birthPlace,
      birth_time_mode: payload.birthTimeMode, birth_time_uncertainty_minutes: payload.birthTimeUncertaintyMinutes,
      birth_time_range_start: payload.birthTimeRangeStart, birth_time_range_end: payload.birthTimeRangeEnd,
      latitude: payload.chartData.latitude, longitude: payload.chartData.longitude, timezone: payload.chartData.timezone,
      input_hash: payload.inputHash, chart_data: payload.chartData,
    };
    charts = [...charts.filter((item) => item.id !== row.id), row];
    revisions.push({ input_hash: row.input_hash, chart_data: row.chart_data });
    return row;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'info').mockImplementation(() => {});
    charts = []; revisions = []; profile = null; premium = false; nextId = 1; queue = Promise.resolve();
    repo = {
      getAll: jest.fn(async () => charts.filter((chart) => chart.archived_at == null)),
      getBirthProfile: jest.fn(async () => charts.find((chart) => chart.subject_type === 'self')),
      getCalculations: jest.fn(async () => revisions), isPremium: jest.fn(async () => premium),
      updateName: jest.fn(async (id: number, name: string) => { const chart = charts.find((row) => row.id === id); chart.name = name; return chart; }),
      persistPrimary: jest.fn(async (userId: string, payload: any) => save(userId, payload, 'self', charts.find((row) => row.subject_type === 'self'))),
      create: jest.fn(async (userId: string, payload: any) => save(userId, payload, 'saved_person')),
      repairSaved: jest.fn(async (userId: string, id: number, payload: any) => save(userId, payload, 'saved_person', charts.find((row) => row.id === id))),
      syncPrimaryProfile: jest.fn(async (_userId: string, data: any) => { profile = data; }),
      setIdentityMetadata: jest.fn(async (id: number, _type: string, label: string) => {
        const chart = charts.find((row) => row.id === id); chart.relation_label = label; return chart;
      }),
    };
    mockWithUserLock.mockImplementation((_userId: string, work: (value: any) => Promise<unknown>) => {
      const result = queue.then(async () => {
        const previous = structuredClone({ charts, revisions, profile });
        try { return await work(repo); }
        catch (error) { ({ charts, revisions, profile } = previous); throw error; }
      });
      queue = result.catch(() => {});
      return result;
    });
    mockGetById.mockImplementation(async (id: number) => charts.find((chart) => chart.id === id));
    mockCoordinates.mockImplementation(async (_place: string, supplied: any) => ({ ...coordinates, ...supplied }));
    mockCalculate.mockImplementation(async (_name: string, date: string, _time: string, place: string, options: any) => calculation(date, place, options.birthTime, options.coordinates));
  });
  afterEach(() => jest.restoreAllMocks());

  it('calculates once across 100 concurrent repeat opens and force flags, reading the repository each time', async () => {
    const first = await ensureCanonicalPrimaryChart(input);
    const results = await Promise.all(Array.from({ length: 100 }, () => ensureCanonicalPrimaryChart({ ...input, forceRecalculate: true })));
    expect(mockCalculate).toHaveBeenCalledTimes(1);
    expect(mockCoordinates).toHaveBeenCalledTimes(1);
    expect(repo.persistPrimary).toHaveBeenCalledTimes(1);
    expect(charts).toHaveLength(1);
    expect(results.every((result) => result.chart.id === first.chart.id && result.source === 'cache')).toBe(true);
    expect(repo.getAll).toHaveBeenCalledTimes(101);
  });

  it('serializes simultaneous first creation so all requests receive one saved chart', async () => {
    const result = await Promise.all(Array.from({ length: 12 }, () => ensureCanonicalPrimaryChart(input)));
    expect(mockCalculate).toHaveBeenCalledTimes(1);
    expect(new Set(result.map((entry) => entry.chart.id)).size).toBe(1);
  });

  it('renames a person and accepts normalized birth input or old calculator metadata without recalculation', async () => {
    const first = await ensureCanonicalPrimaryChart(input);
    first.chart.chart_data.calculationVersion = 'swisseph-previous-release';
    const reused = await ensureCanonicalPrimaryChart({ ...input, name: 'Анна Иванова', birthTime: '08:15:00', birthPlace: '  москва  ' });
    expect(reused.chart.id).toBe(first.chart.id);
    expect(reused.chart.name).toBe('Анна Иванова');
    expect(mockCalculate).toHaveBeenCalledTimes(1);
    expect(mockCoordinates).toHaveBeenCalledTimes(1);
  });

  it.each([
    { birthDate: '1991-01-01' }, { birthTime: '09:15' }, { birthPlace: 'Казань' },
    { coordinates: { ...coordinates, lat: 55.76 } },
    { birthTimeMode: 'approximate' as const, birthTimeUncertaintyMinutes: 30 },
    { coordinates: { ...coordinates, timezone: 'Europe/Samara' } },
  ])('saves one new calculation only for changed birth input: %j', async (change) => {
    const first = await ensureCanonicalPrimaryChart(input);
    const changed = await ensureCanonicalPrimaryChart({ ...input, ...change });
    const repeat = await ensureCanonicalPrimaryChart({ ...input, ...change });
    expect(mockCalculate).toHaveBeenCalledTimes(2);
    expect(changed.chart.id).toBe(first.chart.id);
    expect(changed.chart.input_hash).not.toBe(first.chart.input_hash);
    expect(repeat.source).toBe('cache');
    expect(charts).toHaveLength(1);
    const reverted = await ensureCanonicalPrimaryChart({ ...input, coordinates });
    expect(reverted.chart.input_hash).toBe(first.chart.input_hash);
    expect(mockCalculate).toHaveBeenCalledTimes(2);
  });

  it.each([
    { birthTime: '', birthTimeMode: 'unknown' as const },
    { birthTimeMode: 'approximate' as const, birthTimeUncertaintyMinutes: 30 },
    { birthTime: '', birthTimeMode: 'range' as const, birthTimeRangeStart: '08:00', birthTimeRangeEnd: '09:00' },
  ])('persists the complete original result and honest time precision: %j', async (change) => {
    const result = await ensureCanonicalPrimaryChart({ ...input, ...change });
    const payload = repo.persistPrimary.mock.calls[0][1];
    const original = await mockCalculate.mock.results[0].value;
    expect(payload.chartData).toBe(original);
    expect(result.chart.chart_data).toBe(original);
    expect(result.chart.birth_time_mode).toBe(change.birthTimeMode);
    if (change.birthTimeMode === 'unknown') {
      expect(result.chart.birth_time).toBeNull();
      expect(original.angles.ascendant).toBeNull();
      expect(original.houses).toEqual([]);
    }
    await ensureCanonicalPrimaryChart({ ...input, ...change });
    expect(mockCalculate).toHaveBeenCalledTimes(1);
  });

  it('shares numeric calculation across distinct people without merging their identities', async () => {
    premium = true;
    const self = await ensureCanonicalPrimaryChart(input);
    const one = await createOrReuseCanonicalChart({ ...input, name: 'Иван' });
    const two = await createOrReuseCanonicalChart({ ...input, name: 'Пётр' });
    expect(new Set([self.chart.id, one.chart.id, two.chart.id]).size).toBe(3);
    expect(one.chart.input_hash).toBe(self.chart.input_hash);
    expect(two.chart.chart_data).toBe(self.chart.chart_data);
    expect(mockCalculate).toHaveBeenCalledTimes(1);
  });

  it('ignores client-supplied chart data and persists only the server calculation', async () => {
    await ensureCanonicalPrimaryChart(input);
    const untrusted = canonicalNatalChart({ birthDate: '1999-01-01' });
    const saved = await createOrReuseCanonicalChart({ ...input, name: 'Партнёр', birthDate: '1991-01-01', chartData: untrusted });

    expect(mockCalculate).toHaveBeenCalledTimes(2);
    expect(saved.chart.chart_data).not.toBe(untrusted);
    expect(saved.chart.chart_data.birth.localDate).toBe('1991-01-01');
    expect(repo.create.mock.calls[0][1].chartData).toBe(saved.chart.chart_data);
  });

  it('enforces Free quota before Swiss, but permits reuse and editing of the first saved person', async () => {
    await ensureCanonicalPrimaryChart(input);
    const saved = await createOrReuseCanonicalChart({ ...input, name: 'Иван', birthDate: '1991-01-01' });
    await createOrReuseCanonicalChart({ ...input, name: 'Иван', birthDate: '1991-01-01' });
    await expect(createOrReuseCanonicalChart({ ...input, name: 'Пётр', birthDate: '1992-01-01' })).rejects.toMatchObject({ code: 'CHART_LIMIT_REACHED' });
    expect(mockCalculate).toHaveBeenCalledTimes(2);
    const edited = await updateCanonicalSavedChart(input.userId, saved.chart.id, { ...input, name: 'Иван', birthDate: '1993-01-01' });
    expect(edited.chart.id).toBe(saved.chart.id);
    expect(charts).toHaveLength(2);
    expect(mockCalculate).toHaveBeenCalledTimes(3);
  });

  it('keeps the old chart and profile when Swiss or persistence fails', async () => {
    const first = await ensureCanonicalPrimaryChart(input);
    const oldProfile = structuredClone(profile);
    repo.syncPrimaryProfile.mockClear();
    mockCalculate.mockRejectedValueOnce(new Error('Swiss unavailable'));
    await expect(ensureCanonicalPrimaryChart({ ...input, birthDate: '1991-01-01' })).rejects.toThrow('Swiss unavailable');
    expect(charts[0].input_hash).toBe(first.chart.input_hash);
    expect(profile).toEqual(oldProfile);
    expect(repo.syncPrimaryProfile).not.toHaveBeenCalled();
    repo.persistPrimary.mockRejectedValueOnce(new Error('Database unavailable'));
    await expect(ensureCanonicalPrimaryChart({ ...input, birthDate: '1991-01-01' })).rejects.toThrow('Database unavailable');
    expect(charts[0].input_hash).toBe(first.chart.input_hash);
    expect(profile).toEqual(oldProfile);
    expect(repo.syncPrimaryProfile).not.toHaveBeenCalled();
  });

  it('requires explicit maintenance for damaged unchanged chart data', async () => {
    await ensureCanonicalPrimaryChart(input);
    charts[0].chart_data = { birth: charts[0].chart_data.birth };
    await expect(ensureCanonicalPrimaryChart(input)).rejects.toMatchObject({ code: 'CHART_REPAIR_REQUIRED' });
    expect(mockCalculate).toHaveBeenCalledTimes(1);
    const repaired = await getOrCreateCanonicalNatalChart(input, { subjectType: 'self', explicitRepair: true });
    expect(repaired.source).toBe('repaired');
    expect(charts).toHaveLength(1);
    expect(mockCalculate).toHaveBeenCalledTimes(2);
  });

  it('does not accept another owner chart for explicit repair', async () => {
    const self = await ensureCanonicalPrimaryChart(input);
    await expect(repairCanonicalChartRecord('999', self.chart.id)).resolves.toBeNull();
    expect(mockCalculate).toHaveBeenCalledTimes(1);
  });

  it.each(['missing_hash', 'damaged_coordinates'])('requires explicit repair for %s even when the caller supplies coordinates', async (damage) => {
    await ensureCanonicalPrimaryChart({ ...input, coordinates });
    if (damage === 'missing_hash') charts[0].input_hash = null;
    else charts[0].chart_data = {};

    await expect(ensureCanonicalPrimaryChart({ ...input, coordinates })).rejects.toMatchObject({ code: 'CHART_REPAIR_REQUIRED' });
    expect(mockCalculate).toHaveBeenCalledTimes(1);
  });

  it('never expires a stored calculation because its calculatedAt is old', async () => {
    const saved = await ensureCanonicalPrimaryChart(input);
    saved.chart.chart_data.calculationMetadata.calculatedAt = '2000-01-01T00:00:00.000Z';
    const reused = await ensureCanonicalPrimaryChart({ ...input, coordinates: {} });
    expect(reused.source).toBe('cache');
    expect(mockCalculate).toHaveBeenCalledTimes(1);
    expect(mockCoordinates).toHaveBeenCalledTimes(1);
  });
});
