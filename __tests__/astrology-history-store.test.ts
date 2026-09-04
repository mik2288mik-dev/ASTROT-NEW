jest.mock('../lib/db', () => ({
  getPool: jest.fn(),
}));

import { readFileSync } from 'fs';
import { join } from 'path';
import {
  AstrologyHistoryScopeError,
  appendAstrologyMessage,
  appendCalculationSnapshot,
  appendGeneratedArtifact,
  appendPersonalizationFact,
  createAstrologyThread,
  getAstrologyHistoryContext,
  type AstrologyHistoryDatabase,
} from '../lib/astrologyHistoryStore';

function databaseWith(
  responder: (sql: string, values?: readonly unknown[]) => { rows: any[] },
) {
  const queries: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const database = {
    query: jest.fn(async (sql: string, values?: readonly unknown[]) => {
      queries.push({ sql, values });
      return responder(sql, values);
    }),
  } as AstrologyHistoryDatabase;
  return { database, queries };
}

const createdAt = '2026-08-02T12:00:00.000Z';

function calculationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 101,
    user_id: '9001',
    subject_chart_id: 7,
    counterpart_chart_id: null,
    surface: 'forecast',
    period: 'day',
    period_key: '2026-08-02',
    input_hash: 'input-v4',
    calculation_version: 'swiss-v4',
    semantic_version: 'semantic-v1',
    ephemeris_source: 'swisseph',
    house_system: 'placidus',
    birth_time_status: 'exact',
    calculation_payload: { transitCount: 3 },
    evidence_payload: [{ id: 'e1' }],
    provenance: { source: 'server' },
    schema_version: 'history-v1',
    calculated_at: createdAt,
    created_at: createdAt,
    ...overrides,
  };
}

function artifactRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 202,
    user_id: '9001',
    subject_chart_id: 7,
    counterpart_chart_id: null,
    calculation_snapshot_id: 101,
    surface: 'forecast',
    variant: 'daily',
    period: 'day',
    period_key: '2026-08-02',
    language: 'ru',
    content_payload: { headline: 'Display-only generated sentence' },
    semantic_fingerprints: ['communication:pressure'],
    provider: 'openai',
    model_id: 'configured-model',
    prompt_version: 'forecast-v4',
    voice_version: 'voice-v2',
    semantic_version: 'semantic-v1',
    contract_version: 'forecast-v4',
    validation_status: 'valid',
    generation_attempts: 1,
    input_hash: 'input-v4',
    provenance: {},
    schema_version: 'history-v1',
    is_factual_evidence: false,
    created_at: createdAt,
    ...overrides,
  };
}

describe('durable astrology history foundation', () => {
  it('installs one idempotent history migration and deterministic chart roles', () => {
    const migration = readFileSync(
      join(process.cwd(), 'lib/migrations.ts'),
      'utf8',
    );

    expect(migration).toContain("mvp_041_astrology_history_foundation");
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS astrology_calculation_snapshots');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS generated_artifacts');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS astrology_threads');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS astrology_messages');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS personalization_facts');
    expect(migration).toContain("CHECK (subject_type IN ('self', 'saved_person'))");
    expect(migration).toContain('ROW_NUMBER() OVER');
    expect(migration).toContain('idx_natal_charts_one_active_self');
    expect(migration).toContain('generated_artifacts_display_only CHECK (is_factual_evidence = FALSE)');
    expect(migration).toContain('await mvp041AstrologyHistoryFoundation(migrationDb)');
  });

  it('appends scoped calculations and display-only artifacts', async () => {
    const mock = databaseWith((sql) => {
      if (sql.includes('INSERT INTO astrology_calculation_snapshots')) {
        return { rows: [calculationRow()] };
      }
      if (sql.includes('INSERT INTO generated_artifacts')) {
        return { rows: [artifactRow()] };
      }
      return { rows: [] };
    });

    const calculation = await appendCalculationSnapshot({
      userId: '9001',
      subjectChartId: 7,
      surface: 'forecast',
      period: 'day',
      periodKey: '2026-08-02',
      inputHash: 'input-v4',
      calculationVersion: 'swiss-v4',
      semanticVersion: 'semantic-v1',
      ephemerisSource: 'swisseph',
      houseSystem: 'placidus',
      birthTimeStatus: 'exact',
      calculationPayload: { transitCount: 3 },
      evidencePayload: [{ id: 'e1' }],
      schemaVersion: 'history-v1',
    }, mock.database);
    const artifact = await appendGeneratedArtifact({
      userId: '9001',
      subjectChartId: 7,
      calculationSnapshotId: calculation.id,
      surface: 'forecast',
      variant: 'daily',
      period: 'day',
      periodKey: '2026-08-02',
      language: 'ru',
      contentPayload: { headline: 'Display-only generated sentence' },
      semanticFingerprints: ['communication:pressure', 'communication:pressure'],
      provider: 'openai',
      modelId: 'configured-model',
      promptVersion: 'forecast-v4',
      voiceVersion: 'voice-v2',
      semanticVersion: 'semantic-v1',
      contractVersion: 'forecast-v4',
      validationStatus: 'valid',
      generationAttempts: 1,
      inputHash: 'input-v4',
      schemaVersion: 'history-v1',
    }, mock.database);

    expect(calculation.evidencePayload).toEqual([{ id: 'e1' }]);
    expect(artifact.isFactualEvidence).toBe(false);
    const artifactInsert = mock.queries.find(({ sql }) =>
      sql.includes('INSERT INTO generated_artifacts'));
    expect(artifactInsert?.sql).toContain('FALSE');
    expect(artifactInsert?.sql).toContain('snapshot.user_id = $1');
    expect(artifactInsert?.values?.[10]).toBe('["communication:pressure"]');
  });

  it('binds history to the original natal snapshots even after the current charts change', async () => {
    const subject = { birth: { localDate: '1990-01-01' }, calculationVersion: 'swiss-v2' };
    const counterpart = { birth: { localDate: '1992-01-01' }, calculationVersion: 'swiss-v2' };
    const mock = databaseWith(() => ({ rows: [calculationRow({
      natal_chart_revision_id: 12,
      counterpart_natal_chart_revision_id: 18,
    })] }));

    const saved = await appendCalculationSnapshot({
      userId: '9001', subjectChartId: 7, counterpartChartId: 9,
      surface: 'synastry', inputHash: 'ai-pair-hash', calculationVersion: 'comparison-v1',
      ephemerisSource: 'swisseph', birthTimeStatus: 'exact',
      calculationPayload: {}, evidencePayload: [], schemaVersion: 'history-v1',
      natalSourceChart: subject, counterpartNatalSourceChart: counterpart,
    }, mock.database);

    expect(saved.natalChartRevisionId).toBe(12);
    expect(saved.counterpartNatalChartRevisionId).toBe(18);
    expect(mock.queries[0].values?.slice(17)).toEqual([JSON.stringify(subject), JSON.stringify(counterpart)]);
    expect(mock.queries[0].sql).toContain('chart_id = subject.id AND chart_data = $18::jsonb');
    expect(mock.queries[0].sql).toContain('chart_id = counterpart.id AND chart_data = $19::jsonb');
    expect(mock.queries[0].sql).not.toContain('input_hash = subject.input_hash');
  });

  it('inherits chart scope from an owned thread when appending a message', async () => {
    const threadRow = {
      id: 303,
      user_id: '9001',
      subject_chart_id: 7,
      counterpart_chart_id: null,
      thread_kind: 'forecast_question',
      title: 'Question',
      provenance: {},
      schema_version: 'history-v1',
      created_at: createdAt,
    };
    const messageRow = {
      id: 404,
      thread_id: 303,
      user_id: '9001',
      subject_chart_id: 7,
      counterpart_chart_id: null,
      role: 'user',
      content_text: 'What should I focus on?',
      content_payload: null,
      generated_artifact_id: null,
      provenance: { source: 'app' },
      schema_version: 'history-v1',
      created_at: createdAt,
    };
    const mock = databaseWith((sql) => {
      if (sql.includes('INSERT INTO astrology_threads')) return { rows: [threadRow] };
      if (sql.includes('INSERT INTO astrology_messages')) return { rows: [messageRow] };
      return { rows: [] };
    });

    const thread = await createAstrologyThread({
      userId: '9001',
      subjectChartId: 7,
      threadKind: 'forecast_question',
      title: 'Question',
      schemaVersion: 'history-v1',
    }, mock.database);
    const message = await appendAstrologyMessage({
      userId: '9001',
      threadId: thread.id,
      role: 'user',
      contentText: 'What should I focus on?',
      provenance: { source: 'app' },
      schemaVersion: 'history-v1',
    }, mock.database);

    expect(message.subjectChartId).toBe(7);
    const messageInsert = mock.queries.find(({ sql }) =>
      sql.includes('INSERT INTO astrology_messages'));
    expect(messageInsert?.sql).toContain('thread.user_id = $1');
    expect(messageInsert?.sql).toContain('thread.subject_chart_id');
  });

  it('returns bounded factual context without generated prose', async () => {
    const artifactSql: string[] = [];
    const mock = databaseWith((sql) => {
      if (sql.includes('FROM natal_charts AS subject')) {
        return { rows: [{ id: 7 }] };
      }
      if (sql.includes('FROM astrology_calculation_snapshots')) {
        return { rows: [calculationRow()] };
      }
      if (sql.includes('FROM latest')) {
        return {
          rows: [{
            id: 505,
            user_id: '9001',
            chart_id: 7,
            scope: 'chart',
            fact_key: 'preferred_pace',
            fact_value: 'slow',
            operation: 'assert',
            provenance_type: 'user_statement',
            provenance: {},
            source_message_id: 404,
            calculation_snapshot_id: null,
            provenance_version: 'explicit-v1',
            schema_version: 'history-v1',
            recorded_at: createdAt,
            created_at: createdAt,
          }],
        };
      }
      if (sql.includes('FROM astrology_messages')) {
        return {
          rows: [{
            id: 404,
            thread_id: 303,
            content_text: 'I prefer a slower pace.',
            content_payload: null,
            created_at: createdAt,
          }],
        };
      }
      if (sql.includes('FROM generated_artifacts')) {
        artifactSql.push(sql);
        return { rows: [artifactRow()] };
      }
      return { rows: [] };
    });

    const context = await getAstrologyHistoryContext({
      userId: '9001',
      subjectChartId: 7,
      surface: 'forecast',
      calculationLimit: 500,
      factLimit: 500,
      messageLimit: 500,
      artifactLimit: 500,
    }, mock.database);

    expect(context.calculations).toHaveLength(1);
    expect(context.explicitFacts[0]?.factKey).toBe('preferred_pace');
    expect(context.userMessages[0]?.contentText).toBe('I prefer a slower pace.');
    expect(context.artifactContinuity[0]).toEqual({
      id: 202,
      calculationSnapshotId: 101,
      surface: 'forecast',
      variant: 'daily',
      period: 'day',
      periodKey: '2026-08-02',
      semanticFingerprints: ['communication:pressure'],
      validationStatus: 'valid',
      createdAt,
    });
    expect(context.artifactContinuity[0]).not.toHaveProperty('contentPayload');
    expect(artifactSql[0]).not.toContain('content_payload');
    expect(mock.queries.filter(({ values }) => values?.includes(50))).toHaveLength(4);
  });

  it('rejects cross-scope writes and generated prose as fact provenance', async () => {
    const empty = databaseWith(() => ({ rows: [] }));
    await expect(appendCalculationSnapshot({
      userId: '9001',
      subjectChartId: 999,
      surface: 'forecast',
      inputHash: 'input-v4',
      calculationVersion: 'swiss-v4',
      ephemerisSource: 'swisseph',
      birthTimeStatus: 'unknown',
      calculationPayload: {},
      evidencePayload: [],
      schemaVersion: 'history-v1',
    }, empty.database)).rejects.toBeInstanceOf(AstrologyHistoryScopeError);

    const queryCountBeforeInvalidFact = empty.queries.length;
    await expect(appendPersonalizationFact({
      userId: '9001',
      chartId: 7,
      scope: 'chart',
      factKey: 'bad_source',
      factValue: 'Generated prose is not evidence',
      provenanceType: 'generated_artifact' as never,
      provenanceVersion: 'bad-v1',
      schemaVersion: 'history-v1',
    }, empty.database)).rejects.toThrow('ASTROLOGY_HISTORY_INVALID_FACT_PROVENANCE');
    expect(empty.queries).toHaveLength(queryCountBeforeInvalidFact);
  });
});
