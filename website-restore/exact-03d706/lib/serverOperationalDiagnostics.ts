import { randomUUID } from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import type { PoolClient } from 'pg';
import {
  createDiagnosticTraceId,
  diagnosticErrorCode,
  diagnosticHttpStatus,
  type DiagnosticEventName,
  type DiagnosticFields,
  type DiagnosticStatus,
  NEBO_TRACE_HEADER,
  normalizeDiagnosticTraceId,
} from './diagnosticTrace';
import { logger } from './logger';
import { getPool } from './db';
import { enqueueNeboOpsEvent, isNeboOpsEnabled, wakeNeboOpsDelivery, type NeboOpsEvent } from './neboOps';

type ServerDiagnosticFields = Omit<DiagnosticFields, 'traceId' | 'side' | 'stage' | 'status'>;

const pendingOwnerDiagnostics = new Set<Promise<void>>();

function queueOwnerDiagnostic(input: NeboOpsEvent): void {
  const task = (async () => {
    let client: PoolClient | null = null;
    try {
      client = await getPool().connect();
      await client.query('BEGIN');
      await client.query("SET LOCAL statement_timeout = '5s'");
      await enqueueNeboOpsEvent(client, input);
      await client.query('COMMIT');
      wakeNeboOpsDelivery();
    } catch {
      if (client) await client.query('ROLLBACK').catch(() => undefined);
      console.warn('[nebo-ops] AI diagnostic could not be persisted');
    } finally {
      client?.release();
    }
  })().catch(() => {
    // A release/connection failure must never reject the API request or leave
    // an unhandled rejection in the long-running server.
    console.warn('[nebo-ops] AI diagnostic background delivery failed');
  }).finally(() => {
    pendingOwnerDiagnostics.delete(task);
  });
  pendingOwnerDiagnostics.add(task);
}

export type ServerOperationalDiagnostic = {
  traceId: string;
  log(
    stage: string,
    status: DiagnosticStatus,
    fields?: ServerDiagnosticFields,
  ): void;
  error(stage: string, error: unknown, fallback: string, fields?: ServerDiagnosticFields): void;
};

export function startServerOperationalDiagnostic(
  req: NextApiRequest,
  res: NextApiResponse,
  event: DiagnosticEventName,
  baseFields: ServerDiagnosticFields = {},
): ServerOperationalDiagnostic {
  const traceId = normalizeDiagnosticTraceId(req.headers[NEBO_TRACE_HEADER.toLowerCase()])
    || createDiagnosticTraceId(event);
  // Correlation headers may come from the client and cannot deduplicate reports.
  const reportId = randomUUID();
  let ownerErrorQueued = false;
  const startedAt = Date.now();
  res.setHeader(NEBO_TRACE_HEADER, traceId);

  const emit = (
    stage: string,
    status: DiagnosticStatus,
    fields: ServerDiagnosticFields = {},
    error = false,
  ) => {
    const durationMs = fields.durationMs ?? Date.now() - startedAt;
    const payload = {
      scope: 'mobile_operational_diagnostics',
      event,
      traceId,
      status,
      durationMs,
      errorCode: fields.errorCode,
      metadata: {
        side: 'server',
        stage,
        ...baseFields,
        ...fields,
        durationMs: undefined,
        errorCode: undefined,
      },
    };
    if (error || status === 'error' || status === 'timeout') logger.error(payload);
    else if (status === 'cancelled') logger.warn(payload);
    else logger.info(payload);

    if (ownerErrorQueued || !isNeboOpsEnabled()) return;
    if (event !== 'personal_forecast' && event !== 'natal_question') return;
    if (status !== 'error' && status !== 'timeout') return;
    if (stage !== 'generation' && stage !== 'lazy_refresh' && stage !== 'request') return;
    const diagnosticFields = { ...baseFields, ...fields };
    const httpStatus = diagnosticFields.httpStatus;
    const hasHttpStatus = typeof httpStatus === 'number' && Number.isInteger(httpStatus)
      && httpStatus >= 100 && httpStatus <= 599;
    // Quota, access, validation and policy rejections are ordinary client
    // outcomes. Without an HTTP status, only a generation-stage failure is final.
    if (hasHttpStatus ? httpStatus < 500 : stage === 'request') return;
    ownerErrorQueued = true;
    const safeErrorCode = typeof diagnosticFields.errorCode === 'string'
      && /^[A-Za-z0-9_.:-]{1,80}$/.test(diagnosticFields.errorCode)
      ? diagnosticFields.errorCode
      : status === 'timeout' ? 'AI_GENERATION_TIMEOUT' : 'AI_GENERATION_FAILED';
    const serverCommit = String(process.env.RAILWAY_GIT_COMMIT_SHA || '').trim();
    queueOwnerDiagnostic({
      eventKey: `ai:${reportId}`,
      eventType: 'ai_error',
      occurredAt: new Date(),
      payload: {
        operation: event,
        stage,
        reportId,
        traceId,
        errorCode: safeErrorCode,
        ...(hasHttpStatus ? { httpStatus } : {}),
        durationMs: Number.isFinite(durationMs) ? Math.max(0, Math.round(durationMs)) : 0,
        ...(['day', 'week', 'month'].includes(String(diagnosticFields.period)) ? { period: diagnosticFields.period } : {}),
        ...(/^[0-9a-f]{7,40}$/i.test(serverCommit) ? { serverVersion: serverCommit } : {}),
      },
    });
  };

  emit('request', 'start', { durationMs: 0 });
  return {
    traceId,
    log: (stage, status, fields) => emit(stage, status, fields),
    error: (stage, error, fallback, fields = {}) => emit(stage, 'error', {
      ...fields,
      httpStatus: fields.httpStatus ?? diagnosticHttpStatus(error),
      errorCode: fields.errorCode || diagnosticErrorCode(error, fallback),
    }, true),
  };
}
