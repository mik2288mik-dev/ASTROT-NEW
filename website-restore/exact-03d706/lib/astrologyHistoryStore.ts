import { getPool } from './db';

export type AstrologyHistorySurface = 'natal' | 'forecast' | 'synastry' | 'question';
export type BirthTimeStatus = 'exact' | 'approximate' | 'unknown';
export type ArtifactValidationStatus =
  | 'valid'
  | 'deterministic_fallback'
  | 'legacy_unvalidated';
export type AstrologyMessageRole = 'user' | 'assistant';
export type PersonalizationFactScope = 'account' | 'chart';
export type PersonalizationFactOperation = 'assert' | 'retract';
export type PersonalizationFactProvenance =
  | 'user_statement'
  | 'verified_profile'
  | 'calculation';

type QueryResultLike = { rows: any[] };

export type AstrologyHistoryDatabase = {
  query: (text: string, values?: readonly unknown[]) => Promise<QueryResultLike>;
};

export class AstrologyHistoryScopeError extends Error {
  readonly code = 'ASTROLOGY_HISTORY_SCOPE_MISMATCH';

  constructor() {
    super('ASTROLOGY_HISTORY_SCOPE_MISMATCH');
    this.name = 'AstrologyHistoryScopeError';
  }
}

export type StoredCalculationSnapshot = {
  id: number;
  userId: string;
  subjectChartId: number;
  counterpartChartId: number | null;
  natalChartRevisionId: number | null;
  counterpartNatalChartRevisionId: number | null;
  surface: AstrologyHistorySurface;
  period: string | null;
  periodKey: string | null;
  inputHash: string;
  calculationVersion: string;
  semanticVersion: string | null;
  ephemerisSource: string;
  houseSystem: string | null;
  birthTimeStatus: BirthTimeStatus;
  calculationPayload: unknown;
  evidencePayload: unknown;
  provenance: Record<string, unknown>;
  schemaVersion: string;
  calculatedAt: string;
  createdAt: string;
};

export type StoredGeneratedArtifact = {
  id: number;
  userId: string;
  subjectChartId: number;
  counterpartChartId: number | null;
  calculationSnapshotId: number | null;
  surface: AstrologyHistorySurface;
  variant: string;
  period: string | null;
  periodKey: string | null;
  language: 'ru' | 'en';
  contentPayload: unknown;
  semanticFingerprints: string[];
  provider: string;
  modelId: string;
  promptVersion: string;
  voiceVersion: string;
  semanticVersion: string;
  contractVersion: string;
  validationStatus: ArtifactValidationStatus;
  generationAttempts: number;
  inputHash: string;
  provenance: Record<string, unknown>;
  schemaVersion: string;
  isFactualEvidence: false;
  createdAt: string;
};

export type StoredAstrologyThread = {
  id: number;
  userId: string;
  subjectChartId: number;
  counterpartChartId: number | null;
  threadKind: string;
  title: string | null;
  provenance: Record<string, unknown>;
  schemaVersion: string;
  createdAt: string;
};

export type StoredAstrologyMessage = {
  id: number;
  threadId: number;
  userId: string;
  subjectChartId: number;
  counterpartChartId: number | null;
  role: AstrologyMessageRole;
  contentText: string;
  contentPayload: unknown;
  generatedArtifactId: number | null;
  provenance: Record<string, unknown>;
  schemaVersion: string;
  createdAt: string;
};

export type StoredPersonalizationFact = {
  id: number;
  userId: string;
  chartId: number | null;
  scope: PersonalizationFactScope;
  factKey: string;
  factValue: unknown;
  operation: PersonalizationFactOperation;
  provenanceType: PersonalizationFactProvenance;
  provenance: Record<string, unknown>;
  sourceMessageId: number | null;
  calculationSnapshotId: number | null;
  provenanceVersion: string;
  schemaVersion: string;
  recordedAt: string;
  createdAt: string;
};

/**
 * Generated output is deliberately reduced to continuity metadata. There is no
 * prose/content field in this type or in the query that builds it.
 */
export type ArtifactContinuity = {
  id: number;
  calculationSnapshotId: number | null;
  surface: AstrologyHistorySurface;
  variant: string;
  period: string | null;
  periodKey: string | null;
  semanticFingerprints: string[];
  validationStatus: ArtifactValidationStatus;
  createdAt: string;
};

export type AstrologyHistoryContext = {
  calculations: StoredCalculationSnapshot[];
  explicitFacts: StoredPersonalizationFact[];
  userMessages: Array<Pick<
    StoredAstrologyMessage,
    'id' | 'threadId' | 'contentText' | 'contentPayload' | 'createdAt'
  >>;
  artifactContinuity: ArtifactContinuity[];
};

export type AppendCalculationSnapshotInput = {
  userId: string;
  subjectChartId: number;
  counterpartChartId?: number | null;
  /** Original saved calculations consumed by generation, even if birth data changed meanwhile. */
  natalSourceChart?: unknown;
  counterpartNatalSourceChart?: unknown;
  surface: AstrologyHistorySurface;
  period?: string | null;
  periodKey?: string | null;
  inputHash: string;
  calculationVersion: string;
  semanticVersion?: string | null;
  ephemerisSource: string;
  houseSystem?: string | null;
  birthTimeStatus: BirthTimeStatus;
  calculationPayload: unknown;
  evidencePayload: unknown;
  provenance?: Record<string, unknown>;
  schemaVersion: string;
  calculatedAt?: string | Date;
};

export type AppendGeneratedArtifactInput = {
  userId: string;
  subjectChartId: number;
  counterpartChartId?: number | null;
  calculationSnapshotId?: number | null;
  surface: AstrologyHistorySurface;
  variant: string;
  period?: string | null;
  periodKey?: string | null;
  language: 'ru' | 'en';
  contentPayload: unknown;
  semanticFingerprints?: string[];
  provider: string;
  modelId: string;
  promptVersion: string;
  voiceVersion: string;
  semanticVersion: string;
  contractVersion: string;
  validationStatus: ArtifactValidationStatus;
  generationAttempts: 0 | 1 | 2;
  inputHash: string;
  provenance?: Record<string, unknown>;
  schemaVersion: string;
};

export type CreateAstrologyThreadInput = {
  userId: string;
  subjectChartId: number;
  counterpartChartId?: number | null;
  threadKind: string;
  title?: string | null;
  provenance?: Record<string, unknown>;
  schemaVersion: string;
};

export type AppendAstrologyMessageInput = {
  userId: string;
  threadId: number;
  role: AstrologyMessageRole;
  contentText: string;
  contentPayload?: unknown;
  generatedArtifactId?: number | null;
  provenance?: Record<string, unknown>;
  schemaVersion: string;
};

export type AppendPersonalizationFactInput = {
  userId: string;
  chartId?: number | null;
  scope: PersonalizationFactScope;
  factKey: string;
  factValue?: unknown;
  operation?: PersonalizationFactOperation;
  provenanceType: PersonalizationFactProvenance;
  provenance?: Record<string, unknown>;
  sourceMessageId?: number | null;
  calculationSnapshotId?: number | null;
  provenanceVersion: string;
  schemaVersion: string;
  recordedAt?: string | Date;
};

export type GetAstrologyHistoryContextInput = {
  userId: string;
  subjectChartId: number;
  counterpartChartId?: number | null;
  surface?: AstrologyHistorySurface;
  calculationLimit?: number;
  factLimit?: number;
  messageLimit?: number;
  artifactLimit?: number;
};

function database(override?: AstrologyHistoryDatabase): AstrologyHistoryDatabase {
  return override || (getPool() as unknown as AstrologyHistoryDatabase);
}

function requiredText(value: unknown, field: string): string {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(`ASTROLOGY_HISTORY_INVALID_${field.toUpperCase()}`);
  return text;
}

function optionalText(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function positiveInteger(value: unknown, field: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`ASTROLOGY_HISTORY_INVALID_${field.toUpperCase()}`);
  }
  return parsed;
}

function boundedLimit(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(50, Math.floor(parsed)));
}

function jsonParameter(value: unknown, fallback: unknown): string {
  return JSON.stringify(value === undefined ? fallback : value);
}

function jsonObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function jsonValue(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function jsonStringArray(value: unknown): string[] {
  const decoded = jsonValue(value);
  if (!Array.isArray(decoded)) return [];
  return decoded
    .map((item) => String(item ?? '').trim())
    .filter(Boolean);
}

function iso(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value ?? ''));
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
}

function nullableId(value: unknown): number | null {
  return value == null ? null : Number(value);
}

function mapCalculationSnapshot(row: any): StoredCalculationSnapshot {
  return {
    id: Number(row.id),
    userId: String(row.user_id),
    subjectChartId: Number(row.subject_chart_id),
    counterpartChartId: nullableId(row.counterpart_chart_id),
    natalChartRevisionId: nullableId(row.natal_chart_revision_id),
    counterpartNatalChartRevisionId: nullableId(row.counterpart_natal_chart_revision_id),
    surface: row.surface as AstrologyHistorySurface,
    period: optionalText(row.period),
    periodKey: optionalText(row.period_key),
    inputHash: String(row.input_hash),
    calculationVersion: String(row.calculation_version),
    semanticVersion: optionalText(row.semantic_version),
    ephemerisSource: String(row.ephemeris_source),
    houseSystem: optionalText(row.house_system),
    birthTimeStatus: row.birth_time_status as BirthTimeStatus,
    calculationPayload: jsonValue(row.calculation_payload),
    evidencePayload: jsonValue(row.evidence_payload),
    provenance: jsonObject(jsonValue(row.provenance)),
    schemaVersion: String(row.schema_version),
    calculatedAt: iso(row.calculated_at),
    createdAt: iso(row.created_at),
  };
}

function mapGeneratedArtifact(row: any): StoredGeneratedArtifact {
  return {
    id: Number(row.id),
    userId: String(row.user_id),
    subjectChartId: Number(row.subject_chart_id),
    counterpartChartId: nullableId(row.counterpart_chart_id),
    calculationSnapshotId: nullableId(row.calculation_snapshot_id),
    surface: row.surface as AstrologyHistorySurface,
    variant: String(row.variant),
    period: optionalText(row.period),
    periodKey: optionalText(row.period_key),
    language: row.language === 'en' ? 'en' : 'ru',
    contentPayload: jsonValue(row.content_payload),
    semanticFingerprints: jsonStringArray(row.semantic_fingerprints),
    provider: String(row.provider),
    modelId: String(row.model_id),
    promptVersion: String(row.prompt_version),
    voiceVersion: String(row.voice_version),
    semanticVersion: String(row.semantic_version),
    contractVersion: String(row.contract_version),
    validationStatus: row.validation_status as ArtifactValidationStatus,
    generationAttempts: Number(row.generation_attempts),
    inputHash: String(row.input_hash),
    provenance: jsonObject(jsonValue(row.provenance)),
    schemaVersion: String(row.schema_version),
    isFactualEvidence: false,
    createdAt: iso(row.created_at),
  };
}

function mapThread(row: any): StoredAstrologyThread {
  return {
    id: Number(row.id),
    userId: String(row.user_id),
    subjectChartId: Number(row.subject_chart_id),
    counterpartChartId: nullableId(row.counterpart_chart_id),
    threadKind: String(row.thread_kind),
    title: optionalText(row.title),
    provenance: jsonObject(jsonValue(row.provenance)),
    schemaVersion: String(row.schema_version),
    createdAt: iso(row.created_at),
  };
}

function mapMessage(row: any): StoredAstrologyMessage {
  return {
    id: Number(row.id),
    threadId: Number(row.thread_id),
    userId: String(row.user_id),
    subjectChartId: Number(row.subject_chart_id),
    counterpartChartId: nullableId(row.counterpart_chart_id),
    role: row.role as AstrologyMessageRole,
    contentText: String(row.content_text),
    contentPayload: jsonValue(row.content_payload),
    generatedArtifactId: nullableId(row.generated_artifact_id),
    provenance: jsonObject(jsonValue(row.provenance)),
    schemaVersion: String(row.schema_version),
    createdAt: iso(row.created_at),
  };
}

function mapFact(row: any): StoredPersonalizationFact {
  return {
    id: Number(row.id),
    userId: String(row.user_id),
    chartId: nullableId(row.chart_id),
    scope: row.scope as PersonalizationFactScope,
    factKey: String(row.fact_key),
    factValue: jsonValue(row.fact_value),
    operation: row.operation as PersonalizationFactOperation,
    provenanceType: row.provenance_type as PersonalizationFactProvenance,
    provenance: jsonObject(jsonValue(row.provenance)),
    sourceMessageId: nullableId(row.source_message_id),
    calculationSnapshotId: nullableId(row.calculation_snapshot_id),
    provenanceVersion: String(row.provenance_version),
    schemaVersion: String(row.schema_version),
    recordedAt: iso(row.recorded_at),
    createdAt: iso(row.created_at),
  };
}

function throwWhenMissing<T>(rows: T[]): T {
  if (!rows[0]) throw new AstrologyHistoryScopeError();
  return rows[0];
}

export async function appendCalculationSnapshot(
  input: AppendCalculationSnapshotInput,
  override?: AstrologyHistoryDatabase,
): Promise<StoredCalculationSnapshot> {
  const db = database(override);
  const result = await db.query(
    `INSERT INTO astrology_calculation_snapshots (
       user_id, subject_chart_id, counterpart_chart_id, surface, period, period_key,
       input_hash, calculation_version, semantic_version, ephemeris_source,
       house_system, birth_time_status, calculation_payload, evidence_payload,
       provenance, schema_version, calculated_at,
       natal_chart_revision_id, counterpart_natal_chart_revision_id
     )
     SELECT
       $1, subject.id, counterpart.id, $4, $5, $6, $7, $8, $9, $10,
       $11, $12, $13::jsonb, $14::jsonb, $15::jsonb, $16, COALESCE($17::timestamptz, CURRENT_TIMESTAMP),
       subject_revision.id, counterpart_revision.id
     FROM natal_charts AS subject
     LEFT JOIN natal_charts AS counterpart ON counterpart.id = $3::bigint
     LEFT JOIN LATERAL (
       SELECT id FROM natal_chart_revisions
       WHERE chart_id = subject.id AND chart_data = $18::jsonb
       ORDER BY id DESC LIMIT 1
     ) AS subject_revision ON TRUE
     LEFT JOIN LATERAL (
       SELECT id FROM natal_chart_revisions
       WHERE chart_id = counterpart.id AND chart_data = $19::jsonb
       ORDER BY id DESC LIMIT 1
     ) AS counterpart_revision ON TRUE
     WHERE subject.id = $2
       AND subject.user_id = $1
       AND subject.archived_at IS NULL
       AND (
         $3::bigint IS NULL
         OR (counterpart.user_id = $1 AND counterpart.archived_at IS NULL)
       )
     RETURNING *`,
    [
      requiredText(input.userId, 'user_id'),
      positiveInteger(input.subjectChartId, 'subject_chart_id'),
      input.counterpartChartId == null
        ? null
        : positiveInteger(input.counterpartChartId, 'counterpart_chart_id'),
      input.surface,
      optionalText(input.period),
      optionalText(input.periodKey),
      requiredText(input.inputHash, 'input_hash'),
      requiredText(input.calculationVersion, 'calculation_version'),
      optionalText(input.semanticVersion),
      requiredText(input.ephemerisSource, 'ephemeris_source'),
      optionalText(input.houseSystem),
      input.birthTimeStatus,
      jsonParameter(input.calculationPayload, {}),
      jsonParameter(input.evidencePayload, []),
      jsonParameter(input.provenance, {}),
      requiredText(input.schemaVersion, 'schema_version'),
      input.calculatedAt ? iso(input.calculatedAt) : null,
      input.natalSourceChart == null ? null : jsonParameter(input.natalSourceChart, null),
      input.counterpartNatalSourceChart == null ? null : jsonParameter(input.counterpartNatalSourceChart, null),
    ],
  );
  return mapCalculationSnapshot(throwWhenMissing(result.rows));
}

export async function appendGeneratedArtifact(
  input: AppendGeneratedArtifactInput,
  override?: AstrologyHistoryDatabase,
): Promise<StoredGeneratedArtifact> {
  const db = database(override);
  const fingerprints = Array.from(new Set(
    (input.semanticFingerprints || []).map((value) => value.trim()).filter(Boolean),
  ));
  const result = await db.query(
    `INSERT INTO generated_artifacts (
       user_id, subject_chart_id, counterpart_chart_id, calculation_snapshot_id,
       surface, variant, period, period_key, language, content_payload,
       semantic_fingerprints, provider, model_id, prompt_version, voice_version,
       semantic_version, contract_version, validation_status, generation_attempts,
       input_hash, provenance, schema_version, is_factual_evidence
     )
     SELECT
       $1, subject.id, counterpart.id, $4, $5, $6, $7, $8, $9,
       $10::jsonb, $11::jsonb, $12, $13, $14, $15, $16, $17, $18,
       $19, $20, $21::jsonb, $22, FALSE
     FROM natal_charts AS subject
     LEFT JOIN natal_charts AS counterpart ON counterpart.id = $3::bigint
     WHERE subject.id = $2
       AND subject.user_id = $1
       AND subject.archived_at IS NULL
       AND (
         $3::bigint IS NULL
         OR (counterpart.user_id = $1 AND counterpart.archived_at IS NULL)
       )
       AND (
         $4::bigint IS NULL
         OR EXISTS (
           SELECT 1
           FROM astrology_calculation_snapshots AS snapshot
           WHERE snapshot.id = $4
             AND snapshot.user_id = $1
             AND snapshot.subject_chart_id = subject.id
             AND snapshot.counterpart_chart_id IS NOT DISTINCT FROM counterpart.id
         )
       )
     RETURNING *`,
    [
      requiredText(input.userId, 'user_id'),
      positiveInteger(input.subjectChartId, 'subject_chart_id'),
      input.counterpartChartId == null
        ? null
        : positiveInteger(input.counterpartChartId, 'counterpart_chart_id'),
      input.calculationSnapshotId == null
        ? null
        : positiveInteger(input.calculationSnapshotId, 'calculation_snapshot_id'),
      input.surface,
      requiredText(input.variant, 'variant'),
      optionalText(input.period),
      optionalText(input.periodKey),
      input.language,
      jsonParameter(input.contentPayload, {}),
      jsonParameter(fingerprints, []),
      requiredText(input.provider, 'provider'),
      requiredText(input.modelId, 'model_id'),
      requiredText(input.promptVersion, 'prompt_version'),
      requiredText(input.voiceVersion, 'voice_version'),
      requiredText(input.semanticVersion, 'semantic_version'),
      requiredText(input.contractVersion, 'contract_version'),
      input.validationStatus,
      input.generationAttempts,
      requiredText(input.inputHash, 'input_hash'),
      jsonParameter(input.provenance, {}),
      requiredText(input.schemaVersion, 'schema_version'),
    ],
  );
  return mapGeneratedArtifact(throwWhenMissing(result.rows));
}

export async function createAstrologyThread(
  input: CreateAstrologyThreadInput,
  override?: AstrologyHistoryDatabase,
): Promise<StoredAstrologyThread> {
  const db = database(override);
  const result = await db.query(
    `INSERT INTO astrology_threads (
       user_id, subject_chart_id, counterpart_chart_id, thread_kind, title,
       provenance, schema_version
     )
     SELECT $1, subject.id, counterpart.id, $4, $5, $6::jsonb, $7
     FROM natal_charts AS subject
     LEFT JOIN natal_charts AS counterpart ON counterpart.id = $3::bigint
     WHERE subject.id = $2
       AND subject.user_id = $1
       AND subject.archived_at IS NULL
       AND (
         $3::bigint IS NULL
         OR (counterpart.user_id = $1 AND counterpart.archived_at IS NULL)
       )
     RETURNING *`,
    [
      requiredText(input.userId, 'user_id'),
      positiveInteger(input.subjectChartId, 'subject_chart_id'),
      input.counterpartChartId == null
        ? null
        : positiveInteger(input.counterpartChartId, 'counterpart_chart_id'),
      requiredText(input.threadKind, 'thread_kind'),
      optionalText(input.title),
      jsonParameter(input.provenance, {}),
      requiredText(input.schemaVersion, 'schema_version'),
    ],
  );
  return mapThread(throwWhenMissing(result.rows));
}

export async function appendAstrologyMessage(
  input: AppendAstrologyMessageInput,
  override?: AstrologyHistoryDatabase,
): Promise<StoredAstrologyMessage> {
  const db = database(override);
  const result = await db.query(
    `INSERT INTO astrology_messages (
       thread_id, user_id, subject_chart_id, counterpart_chart_id, role,
       content_text, content_payload, generated_artifact_id, provenance, schema_version
     )
     SELECT
       thread.id, thread.user_id, thread.subject_chart_id, thread.counterpart_chart_id,
       $3, $4, $5::jsonb, artifact.id, $7::jsonb, $8
     FROM astrology_threads AS thread
     LEFT JOIN generated_artifacts AS artifact ON artifact.id = $6::bigint
     WHERE thread.id = $2
       AND thread.user_id = $1
       AND (
         $6::bigint IS NULL
         OR (
           $3 = 'assistant'
           AND artifact.user_id = thread.user_id
           AND artifact.subject_chart_id = thread.subject_chart_id
           AND artifact.counterpart_chart_id IS NOT DISTINCT FROM thread.counterpart_chart_id
         )
       )
     RETURNING *`,
    [
      requiredText(input.userId, 'user_id'),
      positiveInteger(input.threadId, 'thread_id'),
      input.role,
      requiredText(input.contentText, 'content_text'),
      input.contentPayload === undefined
        ? null
        : jsonParameter(input.contentPayload, null),
      input.generatedArtifactId == null
        ? null
        : positiveInteger(input.generatedArtifactId, 'generated_artifact_id'),
      jsonParameter(input.provenance, {}),
      requiredText(input.schemaVersion, 'schema_version'),
    ],
  );
  return mapMessage(throwWhenMissing(result.rows));
}

export async function appendPersonalizationFact(
  input: AppendPersonalizationFactInput,
  override?: AstrologyHistoryDatabase,
): Promise<StoredPersonalizationFact> {
  const operation = input.operation || 'assert';
  if (!['user_statement', 'verified_profile', 'calculation'].includes(input.provenanceType)) {
    throw new Error('ASTROLOGY_HISTORY_INVALID_FACT_PROVENANCE');
  }
  const chartId = input.chartId == null
    ? null
    : positiveInteger(input.chartId, 'chart_id');
  if ((input.scope === 'account') !== (chartId == null)) {
    throw new Error('ASTROLOGY_HISTORY_INVALID_FACT_SCOPE');
  }
  if (operation === 'assert' && input.factValue === undefined) {
    throw new Error('ASTROLOGY_HISTORY_FACT_VALUE_REQUIRED');
  }
  if (input.provenanceType === 'calculation' && input.calculationSnapshotId == null) {
    throw new Error('ASTROLOGY_HISTORY_CALCULATION_PROVENANCE_REQUIRED');
  }

  const db = database(override);
  const result = await db.query(
    `INSERT INTO personalization_facts (
       user_id, chart_id, scope, fact_key, fact_value, operation, provenance_type,
       provenance, source_message_id, calculation_snapshot_id, provenance_version,
       schema_version, recorded_at
     )
     SELECT
       $1, chart.id, $3, $4, $5::jsonb, $6, $7, $8::jsonb,
       source_message.id, snapshot.id, $11, $12,
       COALESCE($13::timestamptz, CURRENT_TIMESTAMP)
     FROM (SELECT 1) AS seed
     LEFT JOIN natal_charts AS chart ON chart.id = $2::bigint
     LEFT JOIN astrology_messages AS source_message ON source_message.id = $9::bigint
     LEFT JOIN astrology_calculation_snapshots AS snapshot ON snapshot.id = $10::bigint
     WHERE (
         ($3 = 'account' AND $2::bigint IS NULL)
         OR ($3 = 'chart' AND chart.user_id = $1)
       )
       AND (
         $9::bigint IS NULL
         OR (
           $7 = 'user_statement'
           AND source_message.user_id = $1
           AND source_message.role = 'user'
           AND (chart.id IS NULL OR source_message.subject_chart_id = chart.id)
         )
       )
       AND (
         $10::bigint IS NULL
         OR (
           $7 = 'calculation'
           AND snapshot.user_id = $1
           AND chart.id = snapshot.subject_chart_id
         )
       )
     RETURNING *`,
    [
      requiredText(input.userId, 'user_id'),
      chartId,
      input.scope,
      requiredText(input.factKey, 'fact_key'),
      input.factValue === undefined ? null : jsonParameter(input.factValue, null),
      operation,
      input.provenanceType,
      jsonParameter(input.provenance, {}),
      input.sourceMessageId == null
        ? null
        : positiveInteger(input.sourceMessageId, 'source_message_id'),
      input.calculationSnapshotId == null
        ? null
        : positiveInteger(input.calculationSnapshotId, 'calculation_snapshot_id'),
      requiredText(input.provenanceVersion, 'provenance_version'),
      requiredText(input.schemaVersion, 'schema_version'),
      input.recordedAt ? iso(input.recordedAt) : null,
    ],
  );
  return mapFact(throwWhenMissing(result.rows));
}

export async function getAstrologyHistoryContext(
  input: GetAstrologyHistoryContextInput,
  override?: AstrologyHistoryDatabase,
): Promise<AstrologyHistoryContext> {
  const db = database(override);
  const userId = requiredText(input.userId, 'user_id');
  const subjectChartId = positiveInteger(input.subjectChartId, 'subject_chart_id');
  const counterpartChartId = input.counterpartChartId == null
    ? null
    : positiveInteger(input.counterpartChartId, 'counterpart_chart_id');

  const ownership = await db.query(
    `SELECT subject.id
     FROM natal_charts AS subject
     LEFT JOIN natal_charts AS counterpart ON counterpart.id = $3::bigint
     WHERE subject.id = $2
       AND subject.user_id = $1
       AND (
         $3::bigint IS NULL
         OR counterpart.user_id = $1
       )
     LIMIT 1`,
    [userId, subjectChartId, counterpartChartId],
  );
  throwWhenMissing(ownership.rows);

  const scopeParams = [
    userId,
    subjectChartId,
    counterpartChartId,
    input.surface || null,
  ] as const;
  const calculations = await db.query(
    `SELECT *
     FROM astrology_calculation_snapshots
     WHERE user_id = $1
       AND subject_chart_id = $2
       AND counterpart_chart_id IS NOT DISTINCT FROM $3::bigint
       AND ($4::text IS NULL OR surface = $4)
     ORDER BY created_at DESC, id DESC
     LIMIT $5`,
    [...scopeParams, boundedLimit(input.calculationLimit, 8)],
  );
  const facts = await db.query(
    `WITH latest AS (
       SELECT DISTINCT ON (scope, fact_key) *
       FROM personalization_facts
       WHERE user_id = $1
         AND (
           (scope = 'account' AND chart_id IS NULL)
           OR (scope = 'chart' AND chart_id = $2)
         )
       ORDER BY scope, fact_key, recorded_at DESC, id DESC
     )
     SELECT *
     FROM latest
     WHERE operation = 'assert'
     ORDER BY recorded_at DESC, id DESC
     LIMIT $3`,
    [userId, subjectChartId, boundedLimit(input.factLimit, 20)],
  );
  const messages = await db.query(
    `SELECT id, thread_id, content_text, content_payload, created_at
     FROM astrology_messages
     WHERE user_id = $1
       AND subject_chart_id = $2
       AND counterpart_chart_id IS NOT DISTINCT FROM $3::bigint
       AND role = 'user'
     ORDER BY created_at DESC, id DESC
     LIMIT $4`,
    [userId, subjectChartId, counterpartChartId, boundedLimit(input.messageLimit, 12)],
  );
  const artifacts = await db.query(
    `SELECT
       id, calculation_snapshot_id, surface, variant, period, period_key,
       semantic_fingerprints, validation_status, created_at
     FROM generated_artifacts
     WHERE user_id = $1
       AND subject_chart_id = $2
       AND counterpart_chart_id IS NOT DISTINCT FROM $3::bigint
       AND ($4::text IS NULL OR surface = $4)
     ORDER BY created_at DESC, id DESC
     LIMIT $5`,
    [...scopeParams, boundedLimit(input.artifactLimit, 20)],
  );

  return {
    calculations: calculations.rows.map(mapCalculationSnapshot),
    explicitFacts: facts.rows.map(mapFact),
    userMessages: messages.rows.map((row) => ({
      id: Number(row.id),
      threadId: Number(row.thread_id),
      contentText: String(row.content_text),
      contentPayload: jsonValue(row.content_payload),
      createdAt: iso(row.created_at),
    })),
    artifactContinuity: artifacts.rows.map((row) => ({
      id: Number(row.id),
      calculationSnapshotId: nullableId(row.calculation_snapshot_id),
      surface: row.surface as AstrologyHistorySurface,
      variant: String(row.variant),
      period: optionalText(row.period),
      periodKey: optionalText(row.period_key),
      semanticFingerprints: jsonStringArray(row.semantic_fingerprints),
      validationStatus: row.validation_status as ArtifactValidationStatus,
      createdAt: iso(row.created_at),
    })),
  };
}
