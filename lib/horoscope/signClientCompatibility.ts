import type { NextApiRequest } from 'next';
import { requireAppUser, type AppUserContext } from '../auth/appAuth';
import { readClientRuntimeMetadata, type ClientRuntimeMetadata } from '../clientRuntimeMetadata';
import { getPool } from '../db';
import { isReleasedAndroidSignHoroscopeClient, resolveSignHoroscopeWireVersion } from './signWireCompatibility';

const CACHE_TYPE = 'native_sign_reader';
const CACHE_VERSION = 'native-sign-reader-v1';
const V4 = 'sign-horoscope-reading-v4';
const V5 = 'sign-horoscope-reading-v5';

export function signSchemaForNativeBuild(metadata: ClientRuntimeMetadata): string | null {
  // The separate 1.0.4/vc8 artifact already bundles v5, unlike RuStore vc7.
  if (metadata.versionCode !== undefined && metadata.versionCode >= 8) return V5;
  const match = /^(\d+)\.(\d+)\.(\d+)(?:$|[.+-])/.exec(metadata.appVersion || '');
  if (!match) return null;
  const [, major, minor, patch] = match.map(Number);
  return major > 1 || (major === 1 && (minor > 0 || patch >= 5)) ? V5 : V4;
}

/** Bound to the authenticated session, so two devices on one account stay independent. */
export async function rememberNativeSignReader(req: NextApiRequest, auth: AppUserContext, forecastContract?: string): Promise<void> {
  if (auth.provider !== 'native' || !auth.sessionId) return;
  const fromForecast = forecastContract?.match(/^personal-forecast-feed-v(\d+)-/);
  const schemaVersion = fromForecast
    ? Number(fromForecast[1]) >= 32 ? V5 : V4
    : signSchemaForNativeBuild(readClientRuntimeMetadata(req.headers, 'native'));
  if (!schemaVersion) return;
  try {
    // Use the existing cache and its expiry job; no schema or auth-token changes.
    await getPool().query(
      `INSERT INTO content_cache
        (user_id, content_type, content_key, access_level, model_tier, prompt_version, payload, expires_at)
       VALUES ($1, $2, $3, 'free', 'fast', $4, $5::jsonb, (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + INTERVAL '365 days')
       ON CONFLICT (content_type, content_key, (COALESCE(date_key, DATE '0001-01-01')),
         (COALESCE(period_key, '')), (COALESCE(zodiac_sign, '')), (COALESCE(user_id, 0)),
         (COALESCE(chart_id, 0)), prompt_version)
       DO UPDATE SET payload = EXCLUDED.payload, expires_at = EXCLUDED.expires_at,
         updated_at = CURRENT_TIMESTAMP AT TIME ZONE 'UTC'`,
      [auth.userId, CACHE_TYPE, auth.sessionId, CACHE_VERSION, JSON.stringify({ schemaVersion })],
    );
  } catch {
    console.warn('[sign-reader] Session format could not be cached');
  }
}

export async function resolveSignHoroscopeRequestVersion(req: NextApiRequest, requested: unknown, authenticated?: AppUserContext): Promise<string | null> {
  const userAgent = String(req.headers['user-agent'] || '');
  const fallback = resolveSignHoroscopeWireVersion(requested, userAgent);
  if (requested !== undefined || !isReleasedAndroidSignHoroscopeClient(userAgent)) return fallback;
  try {
    // Daily content stays public; an anonymous legacy request needs no login.
    const auth = authenticated || (req.headers.authorization
      ? await requireAppUser(req, { allowGuest: true }) : null);
    if (auth?.provider !== 'native' || !auth.sessionId) return fallback;
    const fromHeader = signSchemaForNativeBuild(readClientRuntimeMetadata(req.headers, 'native'));
    if (fromHeader) return fromHeader;
    const result = await getPool().query(
      `SELECT payload FROM (
         SELECT payload, 0 AS priority FROM content_cache
         WHERE user_id = $1 AND content_type = $2 AND content_key = $3 AND prompt_version = $4
           AND expires_at > (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
         UNION ALL
         SELECT payload_json AS payload, 1 AS priority FROM nebo_ops_outbox
         WHERE user_id = $1 AND event_key = $5
       ) AS reader ORDER BY priority LIMIT 1`,
      [auth.userId, CACHE_TYPE, auth.sessionId, CACHE_VERSION, `auth:${auth.sessionId}`],
    );
    const payload = result.rows[0]?.payload;
    if (payload?.schemaVersion === V4 || payload?.schemaVersion === V5) return payload.schemaVersion;
    return signSchemaForNativeBuild(payload || {}) || fallback;
  } catch {
    console.warn('[sign-reader] Session format lookup unavailable; using legacy default');
    return fallback;
  }
}
