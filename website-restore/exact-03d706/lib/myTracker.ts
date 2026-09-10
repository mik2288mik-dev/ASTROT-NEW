import { createHash, randomUUID, timingSafeEqual } from 'crypto';
import { getPool } from './db';
import { enqueueNeboOpsEvent, isNeboOpsEnabled, wakeNeboOpsDelivery } from './neboOps';

export type MyTrackerConfig = { appId: string; postbackSecret: string };
export type MyTrackerAttribution = {
  analyticsUserId: string;
  appId: string;
  profileId: string | null;
  trafficSource: string | null;
  trafficType: string | null;
  campaignId: string | null;
  campaignTitle: string | null;
  trackingLinkId: string | null;
  trackingLinkTitle: string | null;
  attributionType: string | null;
  attributionAt: string;
  eventAt: string | null;
};
export type MyTrackerAttributionResult = 'accepted' | 'duplicate' | 'stale' | 'unknown_user' | 'disabled';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MACRO_PATTERN = /[{}]|%7[bd]/i;
const CONTROL_PATTERN = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g;

export class MyTrackerPayloadError extends Error {
  constructor(public code: string) {
    super(code);
    this.name = 'MyTrackerPayloadError';
  }
}

export function getMyTrackerConfig(env: NodeJS.ProcessEnv = process.env): MyTrackerConfig | null {
  if (env.MYTRACKER_ENABLED !== '1') return null;
  const appId = (env.MYTRACKER_APP_ID || '').trim();
  const postbackSecret = (env.MYTRACKER_POSTBACK_SECRET || '').trim();
  if (!/^[1-9]\d{0,15}$/.test(appId) || !Number.isSafeInteger(Number(appId))) return null;
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(postbackSecret)
    || /^(?:replace-with|your[_-])/i.test(postbackSecret) || postbackSecret.includes('_REQUIRED')) return null;
  return { appId, postbackSecret };
}

/** This is our shared endpoint secret, not a MyTracker HMAC signature. */
export function isMyTrackerPostbackAuthorized(secret: unknown, config = getMyTrackerConfig()): boolean {
  if (!config || typeof secret !== 'string' || secret.length > 256) return false;
  return timingSafeEqual(
    createHash('sha256').update(secret).digest(),
    createHash('sha256').update(config.postbackSecret).digest(),
  );
}

/** The SDK receives only this random identifier, never an account or provider ID. */
export async function getOrCreateMyTrackerUserId(userId: string): Promise<string | null> {
  const config = getMyTrackerConfig();
  if (!config) return null;
  if (!/^-?[1-9]\d{0,18}$/.test(userId)) throw new MyTrackerPayloadError('MYTRACKER_ACCOUNT_INVALID');
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL statement_timeout = '2s'");
    await client.query("SET LOCAL lock_timeout = '500ms'");
    await client.query(
      `INSERT INTO mytracker_users (user_id, analytics_user_id, app_id)
       VALUES ($1, $2::uuid, $3)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId, randomUUID(), config.appId],
    );
    const identity = await client.query(
      'SELECT analytics_user_id FROM mytracker_users WHERE user_id = $1 AND app_id = $2',
      [userId, config.appId],
    );
    const analyticsUserId = identity.rows[0]?.analytics_user_id;
    await client.query('COMMIT');
    return typeof analyticsUserId === 'string' && UUID_PATTERN.test(analyticsUserId) ? analyticsUserId : null;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

function boundedText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string' || MACRO_PATTERN.test(value)) return null;
  const result = value.replace(CONTROL_PATTERN, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
  return result || null;
}

function boundedIdentifier(value: unknown): string | null {
  const candidate = typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : value;
  return typeof candidate === 'string' && /^[A-Za-z0-9_.:-]{1,128}$/.test(candidate) ? candidate : null;
}

function unixTimestamp(value: unknown, now: Date, code: string, required: boolean): string | null {
  if (!required && (value === undefined || value === null || value === '')) return null;
  const input = typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : value;
  if (typeof input !== 'string' || !/^[1-9]\d{0,11}$/.test(input)) throw new MyTrackerPayloadError(code);
  const seconds = Number(input);
  const milliseconds = seconds * 1_000;
  if (!Number.isSafeInteger(milliseconds) || milliseconds > now.getTime()) throw new MyTrackerPayloadError(code);
  const date = new Date(milliseconds);
  if (!Number.isFinite(date.getTime())) throw new MyTrackerPayloadError(code);
  return date.toISOString();
}

/** Query names are ours; map user_id to MyTracker's documented {mt_event_user_id}. */
export function parseMyTrackerAttribution(
  input: Record<string, unknown>,
  appId: string,
  now = new Date(),
): MyTrackerAttribution {
  if (!Number.isFinite(now.getTime())) throw new MyTrackerPayloadError('MYTRACKER_TIME_INVALID');
  const suppliedAppId = typeof input.app_id === 'number' && Number.isSafeInteger(input.app_id)
    ? String(input.app_id) : input.app_id;
  if (typeof suppliedAppId !== 'string' || suppliedAppId !== appId) throw new MyTrackerPayloadError('MYTRACKER_APP_MISMATCH');
  if (typeof input.user_id !== 'string' || !UUID_PATTERN.test(input.user_id)) {
    throw new MyTrackerPayloadError('MYTRACKER_USER_ID_INVALID');
  }
  const trafficSource = boundedText(input.traffic_source, 100);
  const trafficType = boundedText(input.traffic_type, 100);
  // A traffic category alone does not establish the source. Never infer an
  // organic source from empty or unexpanded partner macros.
  if (!trafficSource) throw new MyTrackerPayloadError('MYTRACKER_ATTRIBUTION_MISSING');
  return {
    analyticsUserId: input.user_id.toLowerCase(), appId,
    profileId: boundedIdentifier(input.profile_id), trafficSource, trafficType,
    campaignId: boundedIdentifier(input.campaign_id), campaignTitle: boundedText(input.campaign_title, 160),
    trackingLinkId: boundedIdentifier(input.tracking_link_id), trackingLinkTitle: boundedText(input.tracking_link_title, 160),
    attributionType: boundedText(input.attribution_type, 100),
    attributionAt: unixTimestamp(input.attribution_ts, now, 'MYTRACKER_ATTRIBUTION_TIME_INVALID', true)!,
    eventAt: unixTimestamp(input.event_ts, now, 'MYTRACKER_EVENT_TIME_INVALID', false),
  };
}

export async function recordMyTrackerAttribution(
  input: Record<string, unknown>,
  now = new Date(),
): Promise<MyTrackerAttributionResult> {
  const config = getMyTrackerConfig();
  if (!config) return 'disabled';
  const attribution = parseMyTrackerAttribution(input, config.appId, now);
  // A repeated event timestamp does not change the underlying attribution facts.
  const { eventAt: _eventAt, ...facts } = attribution;
  const payloadHash = createHash('sha256').update(JSON.stringify(facts)).digest('hex');
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL statement_timeout = '5s'");
    await client.query("SET LOCAL lock_timeout = '1s'");
    const result = await client.query(
      `SELECT user_id, attribution_at, event_at, payload_hash
       FROM mytracker_users
       WHERE analytics_user_id = $1::uuid AND app_id = $2
       FOR UPDATE`,
      [attribution.analyticsUserId, config.appId],
    );
    const identity = result.rows[0];
    if (!identity) {
      await client.query('COMMIT');
      return 'unknown_user';
    }
    if (identity.payload_hash === payloadHash) {
      await client.query('COMMIT');
      return 'duplicate';
    }
    const storedAttributionAt = identity.attribution_at ? new Date(identity.attribution_at).getTime() : null;
    const incomingAttributionAt = Date.parse(attribution.attributionAt);
    const storedEventAt = identity.event_at ? new Date(identity.event_at).getTime() : null;
    const incomingEventAt = attribution.eventAt ? Date.parse(attribution.eventAt) : null;
    if ((storedAttributionAt !== null && storedAttributionAt > incomingAttributionAt)
      || (storedAttributionAt === incomingAttributionAt && storedEventAt !== null
        && (incomingEventAt === null || incomingEventAt < storedEventAt))) {
      await client.query('COMMIT');
      return 'stale';
    }
    await client.query(
      `UPDATE mytracker_users
       SET profile_id = $2, traffic_source = $3, traffic_type = $4,
           campaign_id = $5, campaign_title = $6, tracking_link_id = $7, tracking_link_title = $8,
           attribution_type = $9, attribution_at = $10::timestamptz, event_at = $11::timestamptz,
           payload_hash = $12, updated_at = NOW()
       WHERE user_id = $1`,
      [identity.user_id, attribution.profileId, attribution.trafficSource, attribution.trafficType,
        attribution.campaignId, attribution.campaignTitle, attribution.trackingLinkId, attribution.trackingLinkTitle,
        attribution.attributionType, attribution.attributionAt, attribution.eventAt, payloadHash],
    );
    const eventKey = `mytracker:attribution:${payloadHash}`;
    await enqueueNeboOpsEvent(client, {
      eventKey, eventType: 'attribution_received',
      userId: String(identity.user_id), occurredAt: new Date(attribution.attributionAt),
      payload: {
        attributionSource: attribution.trafficSource, attributionTrafficType: attribution.trafficType,
        attributionCampaign: attribution.campaignTitle, attributionCampaignId: attribution.campaignId,
        attributionMethod: attribution.attributionType, attributionAt: attribution.attributionAt,
      },
    });
    if (isNeboOpsEnabled()) {
      // Generic business events may preserve their transaction after an outbox
      // failure. Attribution must remain retryable until its notice is durable.
      const queued = await client.query('SELECT 1 FROM nebo_ops_outbox WHERE event_key = $1 LIMIT 1', [eventKey]);
      if (!queued.rowCount) throw new Error('MYTRACKER_NOTIFICATION_NOT_QUEUED');
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
  wakeNeboOpsDelivery();
  return 'accepted';
}
