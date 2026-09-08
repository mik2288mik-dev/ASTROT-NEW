/** Product telemetry contains codes and measured intervals, never user-authored text. */
export const ACTIVITY_HEARTBEAT_MS = 30_000;
export const ACTIVITY_IDLE_MS = 120_000;
export const ACTIVITY_VISIT_GAP_MS = 30 * 60_000;
export const MAX_ACTIVITY_CREDIT_MS = 45_000;
export const ACTIVITY_SCREENS = [
  'dashboard', 'horoscope', 'chart', 'synastry', 'menu', 'settings', 'charts',
  'people', 'future', 'matrix', 'questions', 'premium', 'paywall', 'onboarding',
  'encyclopedia', 'support', 'saved', 'natal', 'compatibility', 'personal_forecast',
] as const;
export type ActivityScreen = typeof ACTIVITY_SCREENS[number];
export function activityScreen(value: unknown): ActivityScreen | null {
  return typeof value === 'string' && (ACTIVITY_SCREENS as readonly string[]).includes(value)
    ? value as ActivityScreen : null;
}
export function activityId(value: unknown): string | null {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value : null;
}
export type ActivityPulse = {
  sessionId: string;
  eventId: string;
  sequence: number;
  totalActiveMs: number;
  screen: ActivityScreen | null;
  state: 'active' | 'idle' | 'hidden' | 'closed';
};
export function sanitizeActivityPulse(value: unknown): ActivityPulse | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const p = value as Record<string, unknown>;
  const sessionId = activityId(p.sessionId);
  const eventId = activityId(p.eventId);
  if (!sessionId || !eventId || !Number.isSafeInteger(p.sequence) || Number(p.sequence) < 0
    || Number(p.sequence) > 1_000_000 || !Number.isSafeInteger(p.totalActiveMs)
    || Number(p.totalActiveMs) < 0 || Number(p.totalActiveMs) > 7 * 86_400_000
    || !['active', 'idle', 'hidden', 'closed'].includes(String(p.state))) return null;
  return { sessionId, eventId, sequence: Number(p.sequence), totalActiveMs: Number(p.totalActiveMs),
    screen: activityScreen(p.screen), state: p.state as ActivityPulse['state'] };
}
/** Server wall time bounds browser claims; retries and stale/out-of-order pulses add no time. */
export function creditedActivityMs(pulse: ActivityPulse, previous: {
  sequence: number; totalActiveMs: number; receivedAt: number;
} | null, now: number): number {
  if (!previous || pulse.sequence <= previous.sequence) return 0;
  return Math.floor(Math.max(0, Math.min(pulse.totalActiveMs - previous.totalActiveMs,
    now - previous.receivedAt, MAX_ACTIVITY_CREDIT_MS)));
}
/** Pure foreground clock. Long throttled timer gaps never become hours of invented activity. */
export function foregroundIntervalMs(from: number, to: number, lastInteraction: number, foreground: boolean): number {
  if (!foreground) return 0;
  return Math.max(0, Math.min(MAX_ACTIVITY_CREDIT_MS, Math.min(to, lastInteraction + ACTIVITY_IDLE_MS) - from));
}
