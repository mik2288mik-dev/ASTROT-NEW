import { Capacitor, registerPlugin } from '@capacitor/core';
import { isNativeAndroidRuntime } from './nativeRuntime';

/**
 * Asks for a RuStore rating at a good moment: the person has come back on at
 * least three different days and has just seen today's forecast. Rare by design:
 * at most once per 30 days, three times in total, never again after a review.
 */
interface RuStoreReviewBridge {
  requestReview(): Promise<{ shown: boolean; reason?: string }>;
}
const RuStoreReview = registerPlugin<RuStoreReviewBridge>('RuStoreReview');

type ReviewState = { days: string[]; askedAt: number; asks: number; reviewed: boolean };
const KEY = 'nebo.rustore-review.v1';
const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_VISIT_DAYS = 3;
const ASK_EVERY_MS = 30 * DAY_MS;
const MAX_ASKS = 3;
const ASK_DELAY_MS = 6_000;
let scheduled = false;

function available(): boolean {
  try {
    return typeof window !== 'undefined' && isNativeAndroidRuntime() && Capacitor.isPluginAvailable('RuStoreReview');
  } catch {
    return false;
  }
}

function read(): ReviewState {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (value && Array.isArray(value.days)) {
      return {
        days: value.days.filter((day: unknown) => typeof day === 'string').slice(-10),
        askedAt: Number(value.askedAt) || 0,
        asks: Number(value.asks) || 0,
        reviewed: value.reviewed === true,
      };
    }
  } catch {
    // Storage can be unavailable; the rating prompt is optional.
  }
  return { days: [], askedAt: 0, asks: 0, reviewed: false };
}

function write(state: ReviewState): void {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* optional */ }
}

function today(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** Pure decision, exported for tests. */
export function shouldAskForReview(state: ReviewState, nowMs: number): boolean {
  return !state.reviewed
    && state.days.length >= MIN_VISIT_DAYS
    && state.asks < MAX_ASKS
    && nowMs - state.askedAt >= ASK_EVERY_MS;
}

/** Call when the person has just seen today's forecast. */
export function noteForecastSeenForReview(now = new Date()): void {
  if (!available()) return;
  const state = read();
  const day = today(now);
  if (!state.days.includes(day)) state.days = [...state.days, day].slice(-10);
  write(state);
  if (scheduled || !shouldAskForReview(state, now.getTime())) return;
  scheduled = true;
  window.setTimeout(() => {
    const latest = read();
    if (!shouldAskForReview(latest, Date.now())) return;
    write({ ...latest, askedAt: Date.now(), asks: latest.asks + 1 });
    void RuStoreReview.requestReview()
      .then((result) => {
        // RuStore reports an existing review as a failure; stop asking in that case too.
        if (result.shown || result.reason === 'RuStoreReviewExists') write({ ...read(), reviewed: true });
      })
      .catch(() => undefined);
  }, ASK_DELAY_MS);
}
