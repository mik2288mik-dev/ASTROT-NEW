import type { PoolClient } from 'pg';
import { getPool } from './db';
import { logger } from './logger';
import {
  deliverSupportTicketChannel,
  parseSupportMetadata,
  parseSupportTicketPayload,
  type SupportDeliveryChannel,
} from './supportDelivery';

const SUPPORT_OUTBOX_MAX_ATTEMPTS = 10;
const SUPPORT_OUTBOX_LEASE_MINUTES = 10;
const SUPPORT_OUTBOX_MAX_BATCH = 100;
const SUPPORT_OUTBOX_MAX_BACKOFF_SECONDS = 6 * 60 * 60;

type SupportOutboxRow = {
  id: number | string;
  ticket_id: number | string;
  channel: SupportDeliveryChannel;
  attempts: number | string;
};

export type SupportOutboxProcessingResult = {
  claimed: number;
  sent: number;
  retried: number;
  dead: number;
  staleRecovered: number;
};

function boundedLimit(value: number): number {
  if (!Number.isFinite(value)) return 20;
  return Math.max(1, Math.min(SUPPORT_OUTBOX_MAX_BATCH, Math.trunc(value)));
}

function retryDelaySeconds(attempt: number): number {
  return Math.min(
    SUPPORT_OUTBOX_MAX_BACKOFF_SECONDS,
    30 * (2 ** Math.max(0, attempt - 1)),
  );
}

function outboxLog(
  level: 'info' | 'warn',
  metadata: Record<string, string | number>,
): void {
  logger[level]({
    scope: 'support',
    event: 'support_delivery_outbox',
    metadata,
  });
}

/** Enqueue both owner channels inside the ticket transaction. No ticket text or PII is copied. */
export async function enqueueSupportDeliveryOutbox(
  client: Pick<PoolClient, 'query'>,
  ticketId: number,
): Promise<void> {
  if (!Number.isSafeInteger(ticketId) || ticketId < 1) {
    throw new Error('SUPPORT_TICKET_ID_INVALID');
  }
  await client.query(
    `INSERT INTO support_delivery_outbox (ticket_id, channel)
     SELECT $1, channel
     FROM (VALUES ('email'), ('telegram')) AS channels(channel)
     ON CONFLICT (ticket_id, channel) DO NOTHING`,
    [ticketId],
  );
}

async function claimDueRows(
  limit: number,
  ticketId?: number,
  channel?: SupportDeliveryChannel,
): Promise<{ rows: SupportOutboxRow[]; staleRecovered: number }> {
  const pool = getPool();
  const client = await pool.connect();
  let staleRecovered = 0;
  try {
    await client.query('BEGIN');
    const stale = await client.query(
      `UPDATE support_delivery_outbox
       SET status = CASE WHEN attempts >= $1 THEN 'dead' ELSE 'failed' END,
           processing_started_at = NULL,
           next_attempt_at = CURRENT_TIMESTAMP,
           last_error_code = 'PROCESSING_LEASE_EXPIRED',
           updated_at = CURRENT_TIMESTAMP
       WHERE status = 'processing'
         AND (
           processing_started_at IS NULL
           OR processing_started_at <= CURRENT_TIMESTAMP - INTERVAL '${SUPPORT_OUTBOX_LEASE_MINUTES} minutes'
         )`,
      [SUPPORT_OUTBOX_MAX_ATTEMPTS],
    );
    staleRecovered = Number(stale.rowCount || 0);

    const due = await client.query<SupportOutboxRow>(
      `SELECT id, ticket_id, channel, attempts
       FROM support_delivery_outbox
       WHERE status IN ('pending', 'failed')
         AND attempts < $1
         AND next_attempt_at <= CURRENT_TIMESTAMP
         AND ($3::BIGINT IS NULL OR ticket_id = $3::BIGINT)
         AND ($4::TEXT IS NULL OR channel = $4::TEXT)
       ORDER BY next_attempt_at, id
       FOR UPDATE SKIP LOCKED
       LIMIT $2`,
      [SUPPORT_OUTBOX_MAX_ATTEMPTS, boundedLimit(limit), ticketId ?? null, channel ?? null],
    );

    const rows: SupportOutboxRow[] = [];
    for (const row of due.rows) {
      const claimed = await client.query<SupportOutboxRow>(
        `UPDATE support_delivery_outbox
         SET status = 'processing',
             attempts = attempts + 1,
             processing_started_at = CURRENT_TIMESTAMP,
             last_error_code = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND status IN ('pending', 'failed')
         RETURNING id, ticket_id, channel, attempts`,
        [row.id],
      );
      if (claimed.rows[0]) rows.push(claimed.rows[0]);
    }
    await client.query('COMMIT');
    return { rows, staleRecovered };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function loadCanonicalTicket(ticketId: number) {
  const result = await getPool().query(
    `SELECT t.tags, t.user_id, t.created_at AT TIME ZONE 'UTC' AS created_at, first_message.body
     FROM support_tickets t
     JOIN LATERAL (
       SELECT m.body
       FROM support_messages m
       WHERE m.ticket_id = t.id
         AND m.author_type = 'user'
         AND m.internal = FALSE
       ORDER BY m.created_at ASC, m.id ASC
       LIMIT 1
     ) AS first_message ON TRUE
     WHERE t.id = $1`,
    [ticketId],
  );
  const row = result.rows[0];
  const metadata = parseSupportMetadata(row?.tags);
  if (!row || !metadata || typeof row.body !== 'string') {
    throw new Error('SUPPORT_CANONICAL_TICKET_INVALID');
  }
  const payload = parseSupportTicketPayload({
    category: metadata.category,
    message: row.body,
    replyEmail: metadata.replyEmail,
    diagnostics: metadata.diagnostics,
  });
  return { ...payload, userId: String(row.user_id), createdAt: row.created_at as Date | string };
}

async function markSent(id: number): Promise<void> {
  await getPool().query(
    `UPDATE support_delivery_outbox
     SET status = 'sent', processing_started_at = NULL,
         delivered_at = CURRENT_TIMESTAMP, last_error_code = NULL,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND status = 'processing'`,
    [id],
  );
}

function providerRetryDelaySeconds(value?: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(1, Math.min(86_400, Math.ceil(value)))
    : 5;
}

async function markDeferred(id: number, attempt: number, retryAfterSeconds?: number): Promise<void> {
  // Claiming reserves an attempt, but a busy gateway or an existing cooldown
  // never calls Telegram. Restore that attempt even at the final retry limit.
  await getPool().query(
    `UPDATE support_delivery_outbox
     SET status = 'pending', processing_started_at = NULL,
         attempts = GREATEST(0, attempts - 1),
         next_attempt_at = CURRENT_TIMESTAMP + ($2::INTEGER * INTERVAL '1 second'),
         last_error_code = 'SUPPORT_DELIVERY_DEFERRED', updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND status = 'processing' AND attempts = $3`,
    [id, providerRetryDelaySeconds(retryAfterSeconds), attempt],
  );
}

async function markFailure(
  id: number,
  attempt: number,
  errorCode: string,
  retryAfterSeconds?: number,
): Promise<'retried' | 'dead'> {
  if (attempt >= SUPPORT_OUTBOX_MAX_ATTEMPTS) {
    await getPool().query(
      `UPDATE support_delivery_outbox
       SET status = 'dead', processing_started_at = NULL,
           last_error_code = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND status = 'processing'`,
      [id, errorCode],
    );
    return 'dead';
  }
  await getPool().query(
    `UPDATE support_delivery_outbox
     SET status = 'failed', processing_started_at = NULL,
         next_attempt_at = CURRENT_TIMESTAMP + ($2::INTEGER * INTERVAL '1 second'),
         last_error_code = $3, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND status = 'processing'`,
    [id, Math.max(retryDelaySeconds(attempt), providerRetryDelaySeconds(retryAfterSeconds)), errorCode],
  );
  return 'retried';
}

/**
 * Claims due support deliveries and sends one provider channel per row.
 * Ticket text/email are loaded only from the canonical ticket at delivery time.
 */
export async function processSupportDeliveryOutbox(
  limit = 20,
  ticketId?: number,
  channel?: SupportDeliveryChannel,
): Promise<SupportOutboxProcessingResult> {
  if (ticketId !== undefined && (!Number.isSafeInteger(ticketId) || ticketId < 1)) {
    throw new Error('SUPPORT_TICKET_ID_INVALID');
  }
  if (channel !== undefined && channel !== 'email' && channel !== 'telegram') {
    throw new Error('SUPPORT_CHANNEL_INVALID');
  }
  const claimed = await claimDueRows(limit, ticketId, channel);
  const summary: SupportOutboxProcessingResult = {
    claimed: claimed.rows.length,
    sent: 0,
    retried: 0,
    dead: 0,
    staleRecovered: claimed.staleRecovered,
  };

  for (const row of claimed.rows) {
    const id = Number(row.id);
    const canonicalTicketId = Number(row.ticket_id);
    const attempt = Number(row.attempts);
    const channel = row.channel;
    let errorCode = 'SUPPORT_DELIVERY_FAILED';
    let retryAfterSeconds: number | undefined;
    try {
      const payload = await loadCanonicalTicket(canonicalTicketId);
      const delivery = await deliverSupportTicketChannel(
        { ticketId: canonicalTicketId, ...payload },
        channel,
      );
      if (delivery.result === 'sent') {
        await markSent(id);
        summary.sent += 1;
        outboxLog('info', { id, ticketId: canonicalTicketId, channel, status: 'sent', attempt });
        continue;
      }
      if (delivery.result === 'suppressed') {
        await getPool().query(
          `UPDATE support_delivery_outbox
           SET status = 'dead', processing_started_at = NULL,
               last_error_code = 'OWNER_SCOPE_FILTERED', updated_at = CURRENT_TIMESTAMP
           WHERE id = $1 AND status = 'processing' AND attempts = $2`,
          [id, attempt],
        );
        summary.dead += 1;
        outboxLog('info', { id, ticketId: canonicalTicketId, channel, status: 'suppressed', attempt });
        continue;
      }
      if (delivery.deferred) {
        await markDeferred(id, attempt, delivery.retryAfterSeconds);
        summary.retried += 1;
        outboxLog('info', {
          id, ticketId: canonicalTicketId, channel, status: 'deferred', attempt: Math.max(0, attempt - 1),
        });
        continue;
      }
      retryAfterSeconds = delivery.retryAfterSeconds;
      errorCode = delivery.result === 'unconfigured'
        ? 'SUPPORT_CHANNEL_UNCONFIGURED'
        : 'SUPPORT_PROVIDER_FAILED';
    } catch {
      errorCode = 'SUPPORT_CANONICAL_OR_DELIVERY_FAILED';
    }

    const outcome = await markFailure(id, attempt, errorCode, retryAfterSeconds);
    summary[outcome] += 1;
    outboxLog('warn', {
      id,
      ticketId: canonicalTicketId,
      channel,
      status: outcome,
      attempt,
      errorCode,
    });
  }

  return summary;
}
