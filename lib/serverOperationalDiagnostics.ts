import type { NextApiRequest, NextApiResponse } from 'next';
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

type ServerDiagnosticFields = Omit<DiagnosticFields, 'traceId' | 'side' | 'stage' | 'status'>;

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
