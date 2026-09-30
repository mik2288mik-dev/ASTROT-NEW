import { createHash } from 'node:crypto';
import { canonicalNatalChart } from './fixtures/canonicalNatalChart';
import type { ReadingContext } from '../lib/natalReading/apiHelper';
const mockQuery = jest.fn(); const mockGet = jest.fn();
jest.mock('../lib/db', () => ({ getPool: () => ({ query: (...args: unknown[]) => mockQuery(...args) }), db: { content_interpretations: { getByChart: (...args: unknown[]) => mockGet(...args) } } }));
jest.mock('../lib/natalReading/apiHelper', () => ({ saveReading: jest.fn() }));
import { getCachedNatalUnifiedReading, natalUnifiedReadingCacheOptions, natalUnifiedReadingInputHash } from '../lib/natalReading/unifiedApi';
import { NATAL_UNIFIED_READING_CONTRACT_VERSION, NATAL_COPY_REVISION } from '../lib/natalReading/unifiedReading';
import { NATAL_INTERPRETATION_VERSION } from '../lib/natalInterpretation';

function ctx(): ReadingContext { return { user: { id: '42' }, chartId: 9, chartData: canonicalNatalChart(), profile: { id: '42', language: 'ru' } } as unknown as ReadingContext; }
function content() { return { schemaVersion: 'natal-unified-reading-v1', contractVersion: NATAL_UNIFIED_READING_CONTRACT_VERSION,
  interpretationVersion: NATAL_INTERPRETATION_VERSION, tier: 'premium', story: [{ id: 'story:1', text: 'Сохранённый текст остаётся тем же.', meaningIds: ['m1'] }],
  topics: [{ key: 'general', title: 'В целом', blocks: [{ id: 'topic:1', text: 'Сохранённый текст темы.', meaningIds: ['m1'] }] }], meaningIds: ['m1'], evidenceIds: ['e1'] }; }
function legacyHash(context: ReadingContext, promptVersion: string) {
  const chart = context.chartData as ReturnType<typeof canonicalNatalChart>;
  return createHash('sha256').update(JSON.stringify({ chart: { schemaVersion: chart.schemaVersion, calculationVersion: chart.calculationVersion,
    birth: { localDate: chart.birth.localDate, localTime: chart.birth.localTime, place: chart.birth.place, latitude: chart.birth.latitude,
      longitude: chart.birth.longitude, timezone: chart.birth.timezone, time: chart.birth.time, interval: chart.birth.interval },
    positions: chart.positions, angles: chart.angles, houses: chart.houses, aspects: chart.aspects, chartQuality: chart.chartQuality,
    calculationMetadata: { ...chart.calculationMetadata, calculatedAt: undefined } }, language: 'ru', contractVersion: NATAL_UNIFIED_READING_CONTRACT_VERSION, promptVersion })).digest('hex');
}
describe('saved natal text is independent of editorial versions', () => {
  beforeEach(() => { jest.resetAllMocks(); mockQuery.mockResolvedValue({ rows: [{ cache_key: 'natal.unified-reading.v3.core-15.canonical.ru' }] }); });
  it('reads a full report written with an older voice', async () => {
    const context = ctx(); const cached = { content: content(), promptVersion: `${NATAL_UNIFIED_READING_CONTRACT_VERSION}.writer.v3.core-15`, inputHash: '' };
    cached.inputHash = legacyHash(context, cached.promptVersion); mockGet.mockResolvedValue(cached);
    expect(await getCachedNatalUnifiedReading(context, 'free')).toBe(cached);
  });
  it('reads a current birth identity despite a different provenance label', async () => {
    const context = ctx(); const cached = { content: content(), promptVersion: 'old-provenance', inputHash: natalUnifiedReadingInputHash(context) }; mockGet.mockResolvedValue(cached);
    expect(await getCachedNatalUnifiedReading(context, 'premium')).toBe(cached);
  });
  it('does not serve another birth revision or another language', async () => {
    const context = ctx(); const cached = { content: content(), promptVersion: 'old', inputHash: natalUnifiedReadingInputHash(context) }; mockGet.mockResolvedValue(cached);
    context.chartData!.birth!.localDate = '2000-02-02';
    expect(await getCachedNatalUnifiedReading(context, 'premium')).toBeNull();
    const en = ctx(); en.profile.language = 'en'; expect(await getCachedNatalUnifiedReading(en, 'premium')).toBeNull();
  });
  it('keeps one full cache for Free and Premium and a separate saved row per birth revision', () => {
    const context = ctx(); const original = natalUnifiedReadingCacheOptions(context, 'free');
    expect(original).toEqual(natalUnifiedReadingCacheOptions(context, 'premium'));
    const copy = JSON.parse(JSON.stringify(context)); copy.chartData.calculationMetadata.calculatedAt = '2099-01-01';
    expect(natalUnifiedReadingInputHash(copy)).toBe(original.inputHash);
    copy.chartData.birth.localDate = '2001-01-01';
    expect(natalUnifiedReadingCacheOptions(copy, 'free').cacheKey).not.toBe(original.cacheKey);
  });
  it('serves the old report while a replacement is absent, but never treats it as completed new copy', async () => {
    const context = ctx();
    const old = { content: content(), inputHash: natalUnifiedReadingInputHash(context) };
    mockGet.mockResolvedValue(old);
    expect(await getCachedNatalUnifiedReading(context, 'premium')).toBe(old);
    expect(await getCachedNatalUnifiedReading(context, 'premium', NATAL_COPY_REVISION)).toBeNull();
  });
  it('prefers the completed replacement even when an older matching row comes first', async () => {
    const context = ctx();
    const old = { content: content(), inputHash: natalUnifiedReadingInputHash(context) };
    const next = { ...old, content: { ...content(), copyRevision: NATAL_COPY_REVISION } };
    mockQuery.mockResolvedValue({ rows: [{ cache_key: 'old' }, { cache_key: 'new' }] });
    mockGet.mockImplementation(async (_chart, _tier, _surface, _variant, key) => key === 'old' ? old : next);
    expect(await getCachedNatalUnifiedReading(context, 'premium')).toBe(next);
    expect(await getCachedNatalUnifiedReading(context, 'premium', NATAL_COPY_REVISION)).toBe(next);
  });
  it('keeps the latest saved text when the current replacement is absent', async () => {
    const context = ctx();
    const earliest = { content: content(), inputHash: natalUnifiedReadingInputHash(context) };
    const latest = { ...earliest, content: { ...content(), copyRevision: 'previous-approved-copy' } };
    mockQuery.mockImplementation(async (sql: string) => ({ rows: /ORDER BY updated_at DESC, id DESC/.test(sql)
      ? [{ cache_key: 'latest' }, { cache_key: 'earliest' }]
      : [{ cache_key: 'earliest' }, { cache_key: 'latest' }] }));
    mockGet.mockImplementation(async (_chart, _tier, _surface, _variant, key) => key === 'latest' ? latest : earliest);
    expect(await getCachedNatalUnifiedReading(context, 'premium')).toBe(latest);
    expect(await getCachedNatalUnifiedReading(context, 'free')).toBe(latest);
    expect(await getCachedNatalUnifiedReading(context, 'premium', NATAL_COPY_REVISION)).toBeNull();
  });
});
