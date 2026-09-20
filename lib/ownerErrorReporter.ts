import { createHash, randomUUID } from 'crypto';
import type { PoolClient } from 'pg';
import { getPool } from './db';
import type { LogEvent } from './logger';
import { enqueueNeboOpsEvent, isNeboOpsEnabled, wakeNeboOpsDelivery } from './neboOps';

const REPORT_WINDOW_MS = 5 * 60 * 1000;
const lastReported = new Map<string, number>();

function safeCode(value: unknown, limit = 80): string {
  const text = typeof value === 'string' ? value.trim() : '';
  return /^[A-Za-z0-9_.:-]{1,80}$/.test(text) ? text.slice(0, limit) : '';
}

function safeText(value: unknown, limit = 120): string {
  return typeof value === 'string'
    ? value.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, ' ')
      .replace(/\s+/g, ' ').trim().slice(0, limit)
    : '';
}

function fingerprint(event: LogEvent): string {
  return createHash('sha256')
    .update([
      safeCode(event.scope),
      safeCode(event.event),
      safeCode(event.errorCode),
      safeCode(event.status),
      safeCode(event.surface),
      safeCode(event.source),
    ].join('|'))
    .digest('hex')
    .slice(0, 24);
}

function safeMetadata(metadata: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!metadata) return {};
  const result: Record<string, unknown> = {};
  for (const key of ['side', 'stage', 'httpStatus', 'nodeEnv', 'blocks', 'tier', 'requestedTier', 'resolvedTier', 'modelTier', 'swisseph', 'algorithmic', 'mixed', 'unavailable']) {
    const value = metadata[key];
    if (typeof value === 'boolean' || typeof value === 'number') result[key] = value;
    else {
      const text = safeText(value, 100);
      if (text) result[key] = text;
    }
  }
  return result;
}

export function queueOwnerTechnicalError(event: LogEvent): void {
  if (!isNeboOpsEnabled()) return;
  if (event.scope === 'mobile_operational_diagnostics') return;

  const fp = fingerprint(event);
  const now = Date.now();
  const last = lastReported.get(fp) || 0;
  if (now - last < REPORT_WINDOW_MS) return;
  lastReported.set(fp, now);

  const task = async () => {
    let client: PoolClient | null = null;
    try {
      client = await getPool().connect();
      await client.query('BEGIN');
      await client.query("SET LOCAL statement_timeout = '5s'");
      const serverVersion = String(
        process.env.RAILWAY_GIT_COMMIT_SHA || process.env.NEBO_DEPLOY_MARKER || '',
      ).trim();
      await enqueueNeboOpsEvent(client, {
        eventKey: `technical:${fp}:${Math.floor(now / REPORT_WINDOW_MS)}:${randomUUID()}`,
        eventType: 'technical_error',
        occurredAt: new Date(now),
        payload: {
          scope: safeCode(event.scope),
          diagnosticEvent: safeCode(event.event),
          status: safeCode(event.status),
          errorCode: safeCode(event.errorCode),
          surface: safeCode(event.surface),
          source: safeCode(event.source),
          traceId: safeCode(event.traceId, 64),
          durationMs: typeof event.durationMs === 'number' && Number.isFinite(event.durationMs)
            ? Math.max(0, Math.round(event.durationMs))
            : undefined,
          serverVersion: /^[0-9a-f]{7,40}$/i.test(serverVersion) ? serverVersion : undefined,
          metadata: safeMetadata(event.metadata),
        },
      });
      await client.query('COMMIT');
      wakeNeboOpsDelivery();
    } catch {
      if (client) await client.query('ROLLBACK').catch(() => undefined);
    } finally {
      client?.release();
    }
  };

  void task().catch(() => undefined);
}
