import { requestRuStoreApiToken } from './rustorePayments';
import { getPool } from './db';
import { enqueueNeboOpsEvent, wakeNeboOpsDelivery } from './neboOps';

/**
 * New RuStore reviews for the owner bot. RuStore API, method «Получение отзывов»:
 * GET public-api.rustore.ru/public/v1/application/{packageName}/comment (newest first).
 * Uses the same API key as the payment checks.
 */
const REVIEWS_ORIGIN = 'https://public-api.rustore.ru';
const FRESH_DAYS = 3;

export type RuStoreReview = {
  commentId: number;
  userName: string;
  appRating: number;
  commentText: string;
  commentDateIso: string;
  appVersionName?: string;
  deviceInfo?: { device?: string; model?: string; osVersion?: string };
};

/** Last check in this process: shown in the server status and in reports (average rating, number of ratings). */
const state: { checkedAt: string | null; ok: boolean | null; error: string | null; rating: number | null; reviews: number | null } = {
  checkedAt: null, ok: null, error: null, rating: null, reviews: null,
};
export function getRuStoreReviewsStatus() {
  return { ...state };
}

export function ruStoreReviewsConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.RUSTORE_KEY_ID && env.RUSTORE_PRIVATE_KEY_BASE64 && env.RUSTORE_PACKAGE_NAME);
}

async function get(path: string): Promise<any> {
  const token = await requestRuStoreApiToken();
  const response = await fetch(`${REVIEWS_ORIGIN}${path}`, {
    headers: { 'Public-Token': token, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.code !== 'OK') throw new Error(`RUSTORE_REVIEWS_HTTP_${response.status}:${String(payload?.message || '').slice(0, 80)}`);
  return payload.body;
}

/** Queues reviews from the last few days that the bot has not reported yet. */
export async function queueNewRuStoreReviews(): Promise<number> {
  if (!ruStoreReviewsConfigured()) return 0;
  const packageName = encodeURIComponent(String(process.env.RUSTORE_PACKAGE_NAME));
  state.checkedAt = new Date().toISOString();
  try {
    const [reviews, statistic] = await Promise.all([
      get(`/public/v1/application/${packageName}/comment?page=0&size=50`),
      get(`/public/v1/application/${packageName}/comment/statistic`).catch(() => null),
    ]);
    const list = (Array.isArray(reviews) ? reviews : []) as RuStoreReview[];
    if (statistic && typeof statistic === 'object') {
      const rating = Number((statistic as any).averageUserRating);
      state.rating = Number.isFinite(rating) ? rating : null;
      const total = Number((statistic as any).totalRatings);
      state.reviews = Number.isFinite(total) ? total : null;
    }
    const freshAfter = Date.now() - FRESH_DAYS * 86_400_000;
    let queued = 0;
    const pool = getPool();
    for (const review of list) {
      const at = Date.parse(review.commentDateIso);
      if (!Number.isFinite(at) || at < freshAfter || !Number.isSafeInteger(review.commentId)) continue;
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await enqueueNeboOpsEvent(client, {
          eventKey: `rustore-review:${review.commentId}`,
          eventType: 'review',
          occurredAt: new Date(at),
          payload: {
            rating: Number(review.appRating),
            reviewAuthor: review.userName,
            reviewText: review.commentText,
            appVersion: review.appVersionName,
            deviceModel: [review.deviceInfo?.device, review.deviceInfo?.model].filter(Boolean).join(' '),
            osVersion: review.deviceInfo?.osVersion,
          },
        });
        await client.query('COMMIT');
        queued++;
      } catch {
        await client.query('ROLLBACK').catch(() => undefined);
      } finally {
        client.release();
      }
    }
    state.ok = true;
    state.error = null;
    if (queued) wakeNeboOpsDelivery();
    return queued;
  } catch (error) {
    state.ok = false;
    state.error = error instanceof Error ? error.message.replace(/\d{5,}:[A-Za-z0-9_-]{20,}/g, '<token>').slice(0, 160) : 'UNKNOWN';
    return 0;
  }
}
