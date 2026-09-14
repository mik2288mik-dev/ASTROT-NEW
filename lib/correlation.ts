import { randomUUID } from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';

export const TRACE_HEADER = 'x-request-id';
export const CORRELATION_HEADER = 'x-correlation-id';

/**
 * Извлекает или генерирует уникальный trace ID для сквозного отслеживания операции.
 */
export function getTraceId(req?: NextApiRequest | null): string {
  if (!req) return randomUUID();
  const headerVal = req.headers?.[TRACE_HEADER] || req.headers?.[CORRELATION_HEADER] || req.headers?.['x-trace-id'];
  if (headerVal) {
    const raw = Array.isArray(headerVal) ? headerVal[0] : headerVal;
    const clean = String(raw || '').trim();
    if (clean && clean.length >= 8 && clean.length <= 80 && /^[a-zA-Z0-9_.:-]+$/.test(clean)) {
      return clean;
    }
  }
  return randomUUID();
}

/**
 * Проставляет trace ID в заголовки ответа.
 */
export function attachTraceHeader(res: NextApiResponse, traceId: string): void {
  try {
    if (!res.headersSent) {
      res.setHeader(TRACE_HEADER, traceId);
    }
  } catch {
    // Ignore header errors if stream already started
  }
}
