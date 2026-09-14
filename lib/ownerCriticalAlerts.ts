import { getPool } from './db';
import { getNeboOpsConfig, renderNeboOpsMessage, sendNeboOpsText } from './neboOps';
import { parseSupportMetadata, type SupportDiagnostics } from './supportDelivery';

const FINANCIAL_EVENT_TYPES = [
  'payment_confirmed',
  'trial_started',
  'subscription_grace',
  'subscription_cancelled',
  'subscription_expired',
  'subscription_resumed',
  'payment_refunded',
] as const;

const SUPPORT_CATEGORY_LABELS: Record<string, string> = {
  problem: 'Ошибка',
  idea: 'Пожелание',
  payment: 'Оплата',
  question: 'Вопрос',
  other: 'Другое',
};

const MAX_FINANCIAL_ATTEMPTS = 12;
const MAX_SUPPORT_ATTEMPTS = 10;
const FIRST_FILTERED_AT_UTC = '2026-09-05 00:00:00';

let running = false;

type FinancialRow = {
  id: string | number;
  event_type: string;
  user_id: string | null;
  payload_json: Record<string, unknown>;
  occurred_at: Date | string;
  attempts: number | string;
};

type OwnerUserSummary = {
  name?: string | null;
  language?: string | null;
  auth_provider?: string | null;
  created_at?: Date | string | null;
  premium_until?: Date | string | null;
  has_premium?: boolean;
};

type SupportRow = {
  outbox_id: string | number;
  ticket_id: string | number;
  user_id: string | number | null;
  created_at: Date | string;
  tags: unknown;
  attempts: number | string;
};

export type OwnerCriticalAlertResult = {
  financialSent: number;
  supportSent: number;
};

function boundedLimit(value: number): number {
  if (!Number.isFinite(value)) return 20;
  return Math.max(1, Math.min(50, Math.trunc(value)));
}

function supportVersionText(diagnostics: SupportDiagnostics | null): string {
  if (diagnostics?.appVersion && diagnostics?.versionCode) {
    return `${diagnostics.appVersion} (${diagnostics.versionCode})`;
  }
  return diagnostics?.appVersion || diagnostics?.versionCode || 'не указана';
}

function formatMoscow(value: Date | string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'время не указано';
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

async function sendFilteredFinancialAlerts(limit: number): Promise<number> {
  const pool = getPool();
  const rows = await pool.query<FinancialRow>(
    `SELECT id, event_type, user_id, payload_json, occurred_at, attempts
     FROM nebo_ops_outbox
     WHERE status = 'dead'
       AND last_error_code = 'OWNER_SCOPE_FILTERED'
       AND event_type = ANY($1::TEXT[])
       AND attempts < $2
       AND next_attempt_at <= NOW()
     ORDER BY occurred_at, id
     LIMIT $3`,
    [FINANCIAL_EVENT_TYPES, MAX_FINANCIAL_ATTEMPTS, limit],
  );

  let sentCount = 0;
  for (const row of rows.rows) {
    let user: OwnerUserSummary | undefined;
    if (row.user_id) {
      const userResult = await pool.query<OwnerUserSummary>(
        `SELECT u.name, u.language, u.auth_provider, u.created_at,
                GREATEST(u.premium_until, p.active_until AT TIME ZONE 'UTC') AS premium_until,
                COALESCE(GREATEST(u.premium_until, p.active_until AT TIME ZONE 'UTC') > NOW(), FALSE) AS has_premium
         FROM users u
         LEFT JOIN LATERAL (
           SELECT MAX(ends_at) AS active_until
           FROM premium_entitlements
           WHERE user_id = u.id AND status = 'active' AND ends_at > (NOW() AT TIME ZONE 'UTC')
         ) p ON TRUE
         WHERE u.id = $1`,
        [row.user_id],
      );
      user = userResult.rows[0];
      if (!user) {
        await pool.query(
          `DELETE FROM nebo_ops_outbox
           WHERE id = $1 AND status = 'dead' AND last_error_code = 'OWNER_SCOPE_FILTERED'`,
          [row.id],
        );
        continue;
      }
    }

    const delivery = await sendNeboOpsText(renderNeboOpsMessage(row, user));
    if (delivery.ok) {
      await pool.query(
        `UPDATE nebo_ops_outbox
         SET status = 'sent', sent_at = NOW(), telegram_message_id = $2,
             locked_at = NULL, lease_token = NULL, last_error_code = NULL, updated_at = NOW()
         WHERE id = $1 AND status = 'dead' AND last_error_code = 'OWNER_SCOPE_FILTERED'`,
        [row.id, delivery.messageId],
      );
      sentCount += 1;
      continue;
    }

    const delaySeconds = Math.max(1, Math.min(3600, Number(delivery.retryAfterSeconds || 60)));
    await pool.query(
      `UPDATE nebo_ops_outbox
       SET attempts = attempts + $2,
           next_attempt_at = NOW() + $3 * INTERVAL '1 second',
           updated_at = NOW()
       WHERE id = $1 AND status = 'dead' AND last_error_code = 'OWNER_SCOPE_FILTERED'`,
      [row.id, delivery.deferred ? 0 : 1, delaySeconds],
    );
    break;
  }
  return sentCount;
}

async function sendMissedSupportAlerts(limit: number): Promise<number> {
  const pool = getPool();
  const rows = await pool.query<SupportRow>(
    `SELECT o.id AS outbox_id, o.ticket_id, o.attempts,
            t.user_id, t.tags, t.created_at AT TIME ZONE 'UTC' AS created_at
     FROM support_delivery_outbox o
     JOIN support_tickets t ON t.id = o.ticket_id
     WHERE o.channel = 'telegram'
       AND o.status = 'dead'
       AND o.delivered_at IS NULL
       AND o.attempts < $1
       AND o.next_attempt_at <= CURRENT_TIMESTAMP
       AND t.created_at >= TIMESTAMP '${FIRST_FILTERED_AT_UTC}'
     ORDER BY t.created_at, o.id
     LIMIT $2`,
    [MAX_SUPPORT_ATTEMPTS, limit],
  );

  let sentCount = 0;
  for (const row of rows.rows) {
    const metadata = parseSupportMetadata(row.tags);
    const diagnostics = metadata?.diagnostics || null;
    const category = metadata?.category || 'other';
    const lines = [
      `✉️ Новое обращение NEBO #${row.ticket_id}`,
      ...(row.user_id !== null && row.user_id !== undefined
        ? [`🙋 Пользователь: ID ${String(row.user_id)}`]
        : []),
      `📂 Категория: ${SUPPORT_CATEGORY_LABELS[category] || 'Другое'}`,
      `📱 Версия: ${supportVersionText(diagnostics)}`,
      `🏪 Канал: ${diagnostics?.distributionChannel || 'не указан'}`,
      `🕒 ${formatMoscow(row.created_at)} МСК`,
    ];

    const delivery = await sendNeboOpsText(lines.join('\n'));
    if (delivery.ok) {
      await pool.query(
        `UPDATE support_delivery_outbox
         SET status = 'sent', processing_started_at = NULL,
             delivered_at = CURRENT_TIMESTAMP, last_error_code = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND channel = 'telegram' AND status = 'dead'`,
        [row.outbox_id],
      );
      sentCount += 1;
      continue;
    }

    const delaySeconds = Math.max(1, Math.min(3600, Number(delivery.retryAfterSeconds || 60)));
    await pool.query(
      `UPDATE support_delivery_outbox
       SET attempts = attempts + $2,
           next_attempt_at = CURRENT_TIMESTAMP + ($3::INTEGER * INTERVAL '1 second'),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND channel = 'telegram' AND status = 'dead'`,
      [row.outbox_id, delivery.deferred ? 0 : 1, delaySeconds],
    );
    break;
  }
  return sentCount;
}

/**
 * Restores only owner-critical Telegram alerts that the 5 September owner-scope
 * filter retired. Ordinary screen/action noise remains filtered.
 *
 * Existing durable queues stay the source of truth. Successfully recovered rows
 * are marked sent, so missed payments/support are delivered once and future rows
 * keep the existing rate-limited Telegram sender.
 */
export async function processOwnerCriticalAlerts(limit = 20): Promise<OwnerCriticalAlertResult> {
  const result: OwnerCriticalAlertResult = { financialSent: 0, supportSent: 0 };
  if (running || !getNeboOpsConfig()) return result;
  running = true;
  try {
    const bounded = boundedLimit(limit);
    result.financialSent = await sendFilteredFinancialAlerts(bounded);
    result.supportSent = await sendMissedSupportAlerts(bounded);
    return result;
  } finally {
    running = false;
  }
}
