import crypto from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { getPool } from './db';
import { getTraceId } from './correlation';

export type RecordTechnicalErrorParams = {
  endpoint: string;
  httpStatus?: number;
  errorCode: string;
  message: string;
  stackTrace?: string | null;
  appVersion?: string | null;
  platform?: string | null;
  userId?: string | number | null;
  requestId?: string | null;
};

export function computeErrorFingerprint(endpoint: string, errorCode: string, message: string): string {
  // Normalize message (remove numbers, UUIDs, IDs) so identical errors group together
  const normalizedMsg = message
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<UUID>')
    .replace(/\b\d+\b/g, '<NUM>')
    .slice(0, 200);

  const raw = `${endpoint}:${errorCode}:${normalizedMsg}`;
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32);
}

export async function recordTechnicalError(params: RecordTechnicalErrorParams): Promise<void> {
  try {
    const pool = getPool();
    const fingerprint = computeErrorFingerprint(params.endpoint, params.errorCode, params.message);
    const cleanUserId = params.userId && /^-?\d+$/.test(String(params.userId)) ? String(params.userId) : null;

    await pool.query(
      `INSERT INTO app_technical_errors (
        fingerprint, endpoint, http_status, error_code, message,
        stack_trace, app_version, platform, occurrences_count, affected_users_count,
        first_seen_at, last_seen_at, sample_request_id, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $9, 'new')
      ON CONFLICT (fingerprint) DO UPDATE SET
        occurrences_count = app_technical_errors.occurrences_count + 1,
        last_seen_at = CURRENT_TIMESTAMP,
        sample_request_id = COALESCE(EXCLUDED.sample_request_id, app_technical_errors.sample_request_id),
        stack_trace = COALESCE(EXCLUDED.stack_trace, app_technical_errors.stack_trace),
        http_status = COALESCE(EXCLUDED.http_status, app_technical_errors.http_status),
        app_version = COALESCE(EXCLUDED.app_version, app_technical_errors.app_version),
        platform = COALESCE(EXCLUDED.platform, app_technical_errors.platform),
        status = CASE WHEN app_technical_errors.status = 'resolved' THEN 'new' ELSE app_technical_errors.status END`,
      [
        fingerprint,
        params.endpoint.slice(0, 255),
        params.httpStatus ?? null,
        params.errorCode.slice(0, 64),
        params.message.slice(0, 1000),
        params.stackTrace ? params.stackTrace.slice(0, 3000) : null,
        params.appVersion ? params.appVersion.slice(0, 32) : null,
        params.platform ? params.platform.slice(0, 32) : null,
        params.requestId || null,
      ]
    );
  } catch (err: any) {
    console.error('[recordTechnicalError] failed to record technical error:', err?.message);
  }
}
