import { getPool } from './db';

export const LEGAL_ACKNOWLEDGEMENT_BODY_LIMIT_BYTES = 8 * 1024;

export const LEGAL_DOCUMENT_TYPES = [
  'personal_data',
  'terms',
  'entertainment_notice',
] as const;

export type LegalDocumentType = typeof LEGAL_DOCUMENT_TYPES[number];
export type LegalAcknowledgementAction = 'accepted' | 'withdrawn';

/**
 * Server-owned versions. Change a value when the corresponding legal text changes
 * in a way that requires a fresh acknowledgement.
 */
export const CURRENT_LEGAL_DOCUMENT_VERSIONS: Readonly<Record<LegalDocumentType, string>> =
  Object.freeze({
    personal_data: '2026-08-31',
    terms: '2026-08-31',
    entertainment_notice: '2026-08-31',
  });

const DOCUMENT_TYPE_SET = new Set<string>(LEGAL_DOCUMENT_TYPES);
const POST_KEYS = new Set([
  'documentType',
  'action',
  'source',
  'language',
  'appVersionName',
  'appVersionCode',
  'distributionChannel',
]);
const DELETE_KEYS = new Set([
  'documentType',
  'source',
  'language',
  'appVersionName',
  'appVersionCode',
  'distributionChannel',
]);
const SLUG_PATTERN = /^[a-z0-9][a-z0-9._:-]*$/;
const VERSION_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._+-]*$/;

export interface LegalAcknowledgementMetadata {
  source: string;
  language: 'ru' | 'en' | null;
  appVersionName: string | null;
  appVersionCode: number | null;
  distributionChannel: string | null;
}

export interface LegalAcknowledgementMutation extends LegalAcknowledgementMetadata {
  documentType: LegalDocumentType;
  action: LegalAcknowledgementAction;
}

export interface LegalAcknowledgementLatestRow {
  documentType: unknown;
  documentVersion: unknown;
  action: unknown;
  createdAt: unknown;
}

export interface LegalDocumentStatus {
  documentType: LegalDocumentType;
  requiredVersion: string;
  accepted: boolean;
  latestAction: LegalAcknowledgementAction | null;
  latestDocumentVersion: string | null;
  latestCreatedAt: string | null;
}

export class LegalAcknowledgementInputError extends Error {
  readonly status = 400;
  readonly code = 'LEGAL_ACKNOWLEDGEMENT_INVALID';

  constructor(message: string) {
    super(message);
    this.name = 'LegalAcknowledgementInputError';
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertAllowedKeys(body: Record<string, unknown>, allowed: Set<string>): void {
  const unexpected = Object.keys(body).find((key) => !allowed.has(key));
  if (unexpected) {
    throw new LegalAcknowledgementInputError(`Unexpected field: ${unexpected}`);
  }
}

function readRequiredSlug(
  value: unknown,
  field: string,
  maxLength: number,
): string {
  if (typeof value !== 'string') {
    throw new LegalAcknowledgementInputError(`${field} is required`);
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength || !SLUG_PATTERN.test(normalized)) {
    throw new LegalAcknowledgementInputError(`${field} is invalid`);
  }
  return normalized;
}

function readOptionalSlug(
  value: unknown,
  field: string,
  maxLength: number,
): string | null {
  if (value === undefined || value === null) return null;
  return readRequiredSlug(value, field, maxLength);
}

function readLanguage(value: unknown): 'ru' | 'en' | null {
  if (value === undefined || value === null) return null;
  if (value !== 'ru' && value !== 'en') {
    throw new LegalAcknowledgementInputError('language is invalid');
  }
  return value;
}

function readAppVersionName(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    throw new LegalAcknowledgementInputError('appVersionName is invalid');
  }
  const normalized = value.trim();
  if (
    !normalized
    || normalized.length > 64
    || !VERSION_NAME_PATTERN.test(normalized)
  ) {
    throw new LegalAcknowledgementInputError('appVersionName is invalid');
  }
  return normalized;
}

function readAppVersionCode(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 2_100_000_000) {
    throw new LegalAcknowledgementInputError('appVersionCode is invalid');
  }
  return Number(value);
}

function readDocumentType(value: unknown): LegalDocumentType {
  if (typeof value !== 'string' || !DOCUMENT_TYPE_SET.has(value)) {
    throw new LegalAcknowledgementInputError('documentType is invalid');
  }
  return value as LegalDocumentType;
}

function readMetadata(body: Record<string, unknown>): LegalAcknowledgementMetadata {
  return {
    source: readRequiredSlug(body.source, 'source', 64),
    language: readLanguage(body.language),
    appVersionName: readAppVersionName(body.appVersionName),
    appVersionCode: readAppVersionCode(body.appVersionCode),
    distributionChannel: readOptionalSlug(body.distributionChannel, 'distributionChannel', 32),
  };
}

export function isLegalAcknowledgementBodyTooLarge(body: unknown): boolean {
  try {
    return Buffer.byteLength(JSON.stringify(body ?? null), 'utf8')
      > LEGAL_ACKNOWLEDGEMENT_BODY_LIMIT_BYTES;
  } catch {
    return true;
  }
}

export function parseLegalAcknowledgementPost(body: unknown): LegalAcknowledgementMutation {
  if (!isPlainObject(body)) {
    throw new LegalAcknowledgementInputError('Request body must be a JSON object');
  }
  assertAllowedKeys(body, POST_KEYS);

  const documentType = readDocumentType(body.documentType);
  const action = body.action;
  if (action !== 'accepted' && action !== 'withdrawn') {
    throw new LegalAcknowledgementInputError('action is invalid');
  }
  if (action === 'withdrawn' && documentType !== 'personal_data') {
    throw new LegalAcknowledgementInputError('Only personal_data can be withdrawn');
  }

  return {
    documentType,
    action,
    ...readMetadata(body),
  };
}

export function parseLegalAcknowledgementDelete(body: unknown): LegalAcknowledgementMutation {
  if (!isPlainObject(body)) {
    throw new LegalAcknowledgementInputError('Request body must be a JSON object');
  }
  assertAllowedKeys(body, DELETE_KEYS);

  const documentType = readDocumentType(body.documentType);
  if (documentType !== 'personal_data') {
    throw new LegalAcknowledgementInputError('Only personal_data can be withdrawn');
  }

  return {
    documentType,
    action: 'withdrawn',
    ...readMetadata(body),
  };
}

function dateToIso(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value !== 'string' || !value) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

export function buildLegalDocumentStatuses(
  rows: readonly LegalAcknowledgementLatestRow[],
): LegalDocumentStatus[] {
  const latestByType = new Map<LegalDocumentType, LegalAcknowledgementLatestRow>();
  for (const row of rows) {
    if (typeof row?.documentType !== 'string' || !DOCUMENT_TYPE_SET.has(row.documentType)) continue;
    const documentType = row.documentType as LegalDocumentType;
    if (!latestByType.has(documentType)) latestByType.set(documentType, row);
  }

  return LEGAL_DOCUMENT_TYPES.map((documentType) => {
    const latest = latestByType.get(documentType);
    const latestAction = latest?.action === 'accepted' || latest?.action === 'withdrawn'
      ? latest.action
      : null;
    const latestDocumentVersion = typeof latest?.documentVersion === 'string'
      ? latest.documentVersion
      : null;
    const requiredVersion = CURRENT_LEGAL_DOCUMENT_VERSIONS[documentType];

    return {
      documentType,
      requiredVersion,
      accepted: latestAction === 'accepted' && latestDocumentVersion === requiredVersion,
      latestAction,
      latestDocumentVersion,
      latestCreatedAt: dateToIso(latest?.createdAt),
    };
  });
}

export async function getLegalDocumentStatusesForUser(
  userId: string,
): Promise<LegalDocumentStatus[]> {
  const result = await getPool().query(
    `SELECT DISTINCT ON (document_type)
       document_type AS "documentType",
       document_version AS "documentVersion",
       action,
       created_at AS "createdAt"
     FROM user_legal_acknowledgements
     WHERE user_id = $1
     ORDER BY document_type, created_at DESC, id DESC`,
    [userId],
  );

  return buildLegalDocumentStatuses(result.rows);
}
