/**
 * One shared reading for a linked pair, on a real PostgreSQL (PGlite) with the
 * production compatibility engine. The model is replaced by the test writer.
 */
import samples from './fixtures/readingSamples.json';
import { compatibilityStoryFromPrompt } from './fixtures/compatibilityStory';

const pglitePath = process.env.NEBO_ACTIVITY_TEST_PGLITE_PATH;
const postgres = pglitePath ? describe : describe.skip;
let database: any;

function adapt(result: any) {
  return { rows: result?.rows || [], rowCount: (result?.rows?.length || 0) || (result?.affectedRows ?? 0) };
}
async function run(sql: string, params?: unknown[]) {
  if (params === undefined && sql.trim().split(';').filter((part) => part.trim()).length > 1) {
    const results = await database.exec(sql);
    return adapt(results[results.length - 1]);
  }
  return adapt(await database.query(sql, params));
}
const mockPool: any = { query: run, connect: async () => ({ query: run, release: () => undefined }) };

const ALINA = '1';
const ARTEM = '-2';
const mockUsers: Record<string, any> = {};
const mockCharts: Record<string, any> = {};
const mockPremium: Record<string, boolean> = {};
const mockWriter = jest.fn(async (input: { instructions: string; input: string }) => ({
  content: JSON.stringify(compatibilityStoryFromPrompt(JSON.parse(input.input))),
}));

jest.mock('../lib/db', () => ({
  getPool: () => mockPool,
  db: {
    users: { get: async (id: string) => mockUsers[id] || null },
    natal_charts: { getPrimary: async (id: string) => mockCharts[id] || null },
  },
}));
jest.mock('../lib/contentArchitecture', () => ({
  getPremiumEntitlementState: async (id: string) => ({ isPremium: mockPremium[id] === true }),
}));
jest.mock('../lib/openaiResponses', () => ({
  getOpenAIResponsesClient: () => ({}),
  createLunaStructuredResponse: (input: any) => mockWriter(input),
}));

import { PEOPLE_SCHEMA_SQL } from '../lib/people/schema';
import { describeReadingChanges, getPairReading } from '../lib/people/pairReading';

function sample(id: string) {
  return (samples as any).people.find((person: any) => person.id === id);
}

function chartRow(person: any, overrides: Record<string, unknown> = {}) {
  return {
    id: person.id === 'alina' ? 101 : 102,
    input_hash: `hash-${person.id}`,
    chart_data: person.chart,
    sun_sign: person.chart.sun?.sign || null,
    birth_date: person.profile.birthDate,
    birth_time: person.profile.birthTime,
    birth_place: person.profile.birthPlace,
    ...overrides,
  };
}

postgres('shared pair reading', () => {
  let linkId: string;

  beforeAll(async () => {
    const { PGlite } = require(pglitePath!);
    database = new PGlite();
    await database.exec(`
      CREATE TABLE users (id BIGINT PRIMARY KEY, name TEXT, gender TEXT);
      CREATE TABLE natal_charts (id BIGSERIAL PRIMARY KEY, user_id BIGINT, birth_date DATE, birth_time TIME, birth_place TEXT);
      INSERT INTO users VALUES (${ALINA}, 'Алина', 'female'), (${ARTEM}, 'Артём', 'male');
      ${PEOPLE_SCHEMA_SQL}
      INSERT INTO people_links (user_low_id, user_high_id, relationship_context, created_by_user_id)
        VALUES (${ARTEM}, ${ALINA}, 'relationship', ${ALINA});
    `);
    linkId = String((await run('SELECT id FROM people_links')).rows[0].id);
    await run(`INSERT INTO people_link_members (link_id, user_id) VALUES (${linkId}, ${ALINA}), (${linkId}, ${ARTEM})`);
    mockUsers[ALINA] = { id: ALINA, name: 'Алина Петрова', gender: 'female' };
    mockUsers[ARTEM] = { id: ARTEM, name: 'Артём', gender: 'male' };
  }, 60000);
  afterAll(async () => { await database?.close(); });
  beforeEach(() => { mockWriter.mockClear(); });

  it('waits for the person who has not added birth details yet', async () => {
    mockCharts[ALINA] = chartRow(sample('alina'));
    delete mockCharts[ARTEM];
    const result = await getPairReading({ viewerId: ALINA, linkId, language: 'ru', generate: true, pool: mockPool });
    expect(result).toMatchObject({ status: 'missing_data', missing: ['partner'], reading: null });
    expect(mockWriter).not.toHaveBeenCalled();
  });

  it('shows the calculated answers but no story when neither has Premium', async () => {
    mockCharts[ARTEM] = chartRow(sample('artem'));
    const result = await getPairReading({ viewerId: ALINA, linkId, language: 'ru', generate: true, pool: mockPool });
    expect(result.status).toBe('locked');
    expect(result.preview?.questions.length).toBeGreaterThan(0);
    expect(result.reading).toBeNull();
    expect(mockWriter).not.toHaveBeenCalled();
  });

  it('writes one text for both when one of them has Premium, and never again on reopening', async () => {
    mockPremium[ARTEM] = true;
    // Both open it at the same moment: still a single model call.
    const [forAlina, forArtem] = await Promise.all([
      getPairReading({ viewerId: ALINA, linkId, language: 'ru', generate: true, pool: mockPool }),
      getPairReading({ viewerId: ARTEM, linkId, language: 'ru', generate: true, pool: mockPool }),
    ]);
    expect(mockWriter).toHaveBeenCalledTimes(1);
    expect(forAlina).toMatchObject({ status: 'ready', premiumFrom: 'partner', me: { name: 'Алина' }, partner: { name: 'Артём' } });
    expect(forArtem).toMatchObject({ status: 'ready', premiumFrom: 'me' });
    expect(forAlina.readingKey).toBe(forArtem.readingKey);
    expect(forAlina.reading).toEqual(forArtem.reading);
    expect(forAlina.reading?.storyParagraphs?.length).toBeGreaterThan(0);
    // The writer was told that both read the same text.
    expect(mockWriter.mock.calls[0][0].instructions).toContain('одновременно читают оба человека');

    const again = await getPairReading({ viewerId: ALINA, linkId, language: 'ru', generate: true, pool: mockPool });
    expect(again.reading).toEqual(forAlina.reading);
    expect(again.updateNotes).toEqual([]);
    expect(mockWriter).toHaveBeenCalledTimes(1);
  });

  it('writes one new version when someone corrects their data and says what changed', async () => {
    const before = await getPairReading({ viewerId: ALINA, linkId, language: 'ru', generate: false, pool: mockPool });
    mockCharts[ARTEM] = chartRow(sample('artem'), { input_hash: 'hash-artem-2', birth_time: '18:50' });
    const forAlina = await getPairReading({ viewerId: ALINA, linkId, language: 'ru', generate: true, pool: mockPool });
    expect(mockWriter).toHaveBeenCalledTimes(1);
    expect(forAlina.readingKey).not.toBe(before.readingKey);
    expect(forAlina.updateNotes).toEqual(['Артём: обновлено (время рождения).']);
    const forArtem = await getPairReading({ viewerId: ARTEM, linkId, language: 'ru', generate: true, pool: mockPool });
    expect(forArtem.updateNotes).toEqual(['Твои данные: обновлено (время рождения).']);
    expect(forArtem.reading).toEqual(forAlina.reading);
    expect(mockWriter).toHaveBeenCalledTimes(1);
    // The note is shown once.
    expect((await getPairReading({ viewerId: ALINA, linkId, language: 'ru', generate: false, pool: mockPool })).updateNotes).toEqual([]);
    expect((await run('SELECT COUNT(*)::int AS count FROM people_pair_readings')).rows[0].count).toBe(2);
  });

  it('describes a changed relationship type in plain words', () => {
    const person = { name: 'Артём', date: '1987-08-05', time: '18:20', place: 'Москва', timeQuality: 'exact' as const };
    expect(describeReadingChanges(
      { low: person, high: person, context: 'relationship' },
      { low: person, high: person, context: 'friendship' },
      'low',
      'ru',
    )).toEqual(['Тип связи теперь «Дружба».']);
  });
});
