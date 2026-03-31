/**
 * When `NEXT_PUBLIC_FORECAST_LEGACY_FALLBACK` is `0`, `false`, or `off` (case-insensitive),
 * client code does not call `/api/astrology/daily-horoscope` after `content/forecast/daily` fails.
 * Default: legacy bridge enabled (empty/unset = on) for gradual rollout.
 */
export function isForecastLegacyFallbackEnabled(): boolean {
  if (typeof process === 'undefined' || !process.env) return true;
  const raw = process.env.NEXT_PUBLIC_FORECAST_LEGACY_FALLBACK;
  if (raw == null || String(raw).trim() === '') return true;
  const v = String(raw).trim().toLowerCase();
  return v !== '0' && v !== 'false' && v !== 'off' && v !== 'no';
}
