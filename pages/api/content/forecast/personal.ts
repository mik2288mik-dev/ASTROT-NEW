import type { NextApiRequest, NextApiResponse } from 'next';
import { getPremiumEntitlementState } from '../../../../lib/contentArchitecture';
import { generationInProgressPayload } from '../../../../lib/contentGenerationLock';
import {
  ensurePersonalForecast,
  getCompatibleStalePersonalForecast,
  getCachedPersonalForecast,
} from '../../../../lib/personalForecastCache';
import {
  buildForecastLockedPreview,
  createUnavailablePersonalForecast,
  getPersonalForecastPeriodKey,
  getPersonalForecastPeriodAccess,
  normalizeForecastTimezone,
  slicePersonalForecastForAccess,
  type PersonalForecastAccessPayload,
  type PersonalForecastPeriod,
} from '../../../../lib/personalForecastContract';
import { getPersonalForecastGenerationDiagnosticCode } from '../../../../lib/personalForecastGeneration';
import {
  projectPersonalForecastForWire,
  resolvePersonalForecastWireVersion,
} from '../../../../lib/personalForecastWireCompatibility';
import {
  buildPersonalForecastPrewarmProfile,
  queuePersonalForecastPrewarm,
} from '../../../../lib/personalForecastPrewarm';
import { requireAppUser } from '../../../../lib/auth/appAuth';
import { birthProfileRepository } from '../../../../lib/birthProfileRepository';
import { db } from '../../../../lib/db';
import { diagnosticErrorCode } from '../../../../lib/diagnosticTrace';
import { startServerOperationalDiagnostic } from '../../../../lib/serverOperationalDiagnostics';
import { AdminAuthError, handleAdminError } from '../../../../lib/adminAuth';

export const config = { maxDuration: 180 };

function readSingleQueryValue(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    for (const candidate of value) {
      if (typeof candidate === 'string') {
        const normalized = candidate.trim();
        if (normalized.length > 0) return normalized;
      }
    }
  }
  return '';
}

function readPeriod(req: NextApiRequest): PersonalForecastPeriod | null {
  const normalized = (req.method === 'GET'
    ? readSingleQueryValue(req.query.period)
    : String(req.body?.period || '').trim()).toLowerCase();
  if (normalized === 'today') return 'day';
  return (['day', 'week', 'month'] as const).includes(normalized as PersonalForecastPeriod)
    ? normalized as PersonalForecastPeriod
    : null;
}

function readPeriodKey(req: NextApiRequest): string {
  return req.method === 'GET'
    ? readSingleQueryValue(req.query.periodKey)
    : String(req.body?.periodKey || '').trim();
}

function readRegenerate(req: NextApiRequest): boolean {
  return req.method === 'POST' && req.body?.regenerate === true;
}

function readRegenerationAfter(req: NextApiRequest): string | null {
  if (req.method !== 'POST' || typeof req.body?.regenerationAfter !== 'string') {
    return null;
  }
  const timestamp = new Date(req.body.regenerationAfter).getTime();
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

const MAINTENANCE_FORECAST_BREAK = '\n\u2800\n\u2800\n';
const PREMIUM_MAINTENANCE_NOTICE = [
  'Техническое сообщение',
  'Мы обновляем базу данных, приложение может работать нестабильно. Работы на РФ серверах займут до 3 рабочих дней. Всем Premium-пользователям автоматически добавим 5 дополнительных дней Premium-доступа.',
  'Приносим извинения за неудобства.',
].join('\n');
const DEFAULT_PREMIUM_MAINTENANCE_NOTICE_UNTIL = Date.parse('2026-09-24T00:00:00+03:00');

function premiumMaintenanceNoticeEnabled(): boolean {
  if (process.env.NEBO_PREMIUM_MAINTENANCE_NOTICE_ENABLED === '0') return false;
  const configuredUntil = String(process.env.NEBO_PREMIUM_MAINTENANCE_NOTICE_UNTIL || '').trim();
  const until = configuredUntil ? Date.parse(configuredUntil) : DEFAULT_PREMIUM_MAINTENANCE_NOTICE_UNTIL;
  return Number.isFinite(until) && Date.now() < until;
}

function withPremiumMaintenanceNotice(
  forecast: Parameters<typeof slicePersonalForecastForAccess>[0],
  isPremium: boolean,
) {
  if (
    forecast.period !== 'day'
    || forecast.periodKey !== getPersonalForecastPeriodKey('day', new Date(), forecast.timezone)
    || !premiumMaintenanceNoticeEnabled()
    || forecast.overview.text.startsWith('Техническое сообщение')
  ) {
    return forecast;
  }

  const firstBlock = forecast.overview.contentBlocks[0];
  if (!firstBlock) return forecast;

  const contentBlocks = forecast.overview.contentBlocks.map((block, index) => (
    index === 0
      ? { ...block, text: `${PREMIUM_MAINTENANCE_NOTICE}${MAINTENANCE_FORECAST_BREAK}${block.text.trim()}` }
      : block
  ));
  const text = contentBlocks.map((block) => block.text.trim()).join('\\n\\n');

  return {
    ...forecast,
    overview: {
      ...forecast.overview,
      text,
      contentBlocks,
      lockedPreview: buildForecastLockedPreview(text, forecast.overview.premiumTeaser),
    },
  };
}

function responsePayload(
  forecast: Parameters<typeof slicePersonalForecastForAccess>[0],
  isPremium: boolean,
  source: PersonalForecastAccessPayload['source'],
  wireVersion: string,
) {
  const sliced = slicePersonalForecastForAccess(forecast, isPremium);
  const forecastWithNotice = withPremiumMaintenanceNotice(sliced.forecast, isPremium);
  return projectPersonalForecastForWire({
    forecast: forecastWithNotice,
    accessTier: isPremium ? 'premium' : 'free',
    lockedSectionIds: sliced.lockedSectionIds,
    periodLocked: sliced.periodLocked,
    source,
  }, wireVersion);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const diagnostic = startServerOperationalDiagnostic(req, res, 'personal_forecast');
  if (req.method !== 'GET' && req.method !== 'POST') {
    diagnostic.log('request', 'error', { httpStatus: 405, errorCode: 'METHOD_NOT_ALLOWED' });
    return res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
  }
  try {
  const auth = await requireAppUser(req, { allowGuest: true });
  const contractVersionInput = req.method === 'GET'
    ? req.query.contractVersion
    : (req.body?.contractVersion ?? req.query.contractVersion);
  const wireVersion = resolvePersonalForecastWireVersion(
    req.method === 'GET' ? (contractVersionInput === undefined ? undefined : readSingleQueryValue(contractVersionInput)) : contractVersionInput,
  );
  if (!wireVersion) {
    diagnostic.log('validation', 'error', { httpStatus: 400, errorCode: 'PERSONAL_FORECAST_CONTRACT_UNSUPPORTED' });
    return res.status(400).json({
      error: 'Unsupported personal forecast format. Update the application.',
      message: 'Обнови приложение, чтобы открыть личный прогноз.',
      code: 'PERSONAL_FORECAST_CONTRACT_UNSUPPORTED',
    });
  }
  const userId = String(auth.userId);
  const [user, birthSettings] = await Promise.all([
    db.users.get(userId, { hydratePrimaryChart: false }),
    birthProfileRepository.get(userId),
  ]);
  const profile = buildPersonalForecastPrewarmProfile(userId, user, birthSettings);
  if (!profile) {
    diagnostic.log('profile', 'error', { httpStatus: 409, errorCode: 'PERSONAL_FORECAST_PROFILE_REQUIRED' });
    return res.status(409).json({ error: 'Birth profile required', code: 'PERSONAL_FORECAST_PROFILE_REQUIRED' });
  }
  const period = readPeriod(req);
  if (!period) {
    diagnostic.log('validation', 'error', { httpStatus: 400, errorCode: 'PERSONAL_FORECAST_PERIOD_INVALID' });
    return res.status(400).json({
      error: 'Bad request',
      code: 'PERSONAL_FORECAST_PERIOD_INVALID',
    });
  }
  const timezone = normalizeForecastTimezone(profile.birthTimezone);
  const requestedPeriodKey = readPeriodKey(req);
  const periodKey = requestedPeriodKey
    || getPersonalForecastPeriodKey(period, new Date(), timezone);
  const entitlement = await getPremiumEntitlementState(userId);
  const accessTier = entitlement.isPremium ? 'premium' as const : 'free' as const;
  const periodAccess = getPersonalForecastPeriodAccess({ accessTier, period, periodKey, timezone });
  if (periodAccess === 'outside_horizon') {
    diagnostic.log('validation', 'error', { period, httpStatus: 400, errorCode: 'PERSONAL_FORECAST_PERIOD_KEY_INVALID' });
    return res.status(400).json({
      error: 'Personal forecast date is outside the available range',
      code: 'PERSONAL_FORECAST_PERIOD_KEY_INVALID',
    });
  }
  const regenerate = readRegenerate(req);
  const regenerationAfter = readRegenerationAfter(req);
  const cacheInput = { userId, profile, accessTier, period, periodKey };
  if (periodAccess === 'premium_required') {
    diagnostic.log('access', 'error', { period, httpStatus: 403, errorCode: 'PERSONAL_FORECAST_PREMIUM_REQUIRED' });
    return res.status(403).json({
      error: 'Premium required',
      code: 'PERSONAL_FORECAST_PREMIUM_REQUIRED',
    });
  }
  const queueRollingPrewarm = () => queuePersonalForecastPrewarm({
    userId,
    profile,
    accessTier: cacheInput.accessTier,
    reason: 'forecast_open',
  });

  try {
    if (!regenerate) {
      const cached = await getCachedPersonalForecast(cacheInput).catch((error) => {
        if (req.method === 'GET') throw error;
        diagnostic.error('cache_read', error, 'PERSONAL_FORECAST_CACHE_READ_FAILED', { period });
        return null;
      });
      if (cached) {
        const generatedAt = new Date(cached.forecast.meta.generatedAt).getTime();
        const minimumGeneratedAt = regenerationAfter
          ? new Date(regenerationAfter).getTime()
          : Number.NaN;
        if (
          !Number.isFinite(minimumGeneratedAt)
          || generatedAt > minimumGeneratedAt
        ) {
          queueRollingPrewarm();
          diagnostic.log('cache_read', 'cache_hit', { period, source: 'cache', httpStatus: 200 });
          return res.status(200).json(
            responsePayload(cached.forecast, entitlement.isPremium, 'cache', wireVersion),
          );
        }
      }
      const stale = regenerationAfter
        ? null
        : await getCompatibleStalePersonalForecast(cacheInput).catch((error) => {
          diagnostic.error('stale_read', error, 'PERSONAL_FORECAST_STALE_READ_FAILED', { period });
          return null;
        });
      if (stale) {
        void ensurePersonalForecast(cacheInput).catch((error) => {
          diagnostic.error('lazy_refresh', error, 'PERSONAL_FORECAST_LAZY_REFRESH_FAILED', { period });
        });
        queueRollingPrewarm();
        diagnostic.log('stale_read', 'cache_hit', { period, source: 'stale', httpStatus: 200 });
        return res.status(200).json(responsePayload(
          stale.forecast,
          entitlement.isPremium,
          'stale',
          wireVersion,
        ));
      }
    }
    if (req.method === 'GET') {
      // A JSON cache-miss response remains consumable by older Android APKs
      // whose native Response adapter cannot represent an empty HTTP 204.
      diagnostic.log('cache_read', 'cache_miss', { period, source: 'cache', httpStatus: 404 });
      return res.status(404).json({
        error: 'Personal forecast not ready',
        code: 'PERSONAL_FORECAST_NOT_READY',
      });
    }

    const generated = await ensurePersonalForecast(cacheInput, {
      forceRegenerate: regenerate,
      minimumGeneratedAt: regenerationAfter,
    });
    if (generated.status === 'in_progress') {
      diagnostic.log('generation', 'in_progress', { period, httpStatus: 202 });
      return res.status(202).json({
        ...generationInProgressPayload(generated.retryAfterMs),
        forecast: createUnavailablePersonalForecast(
          period,
          periodKey,
          timezone,
          profile.language,
          'generating',
          'PERSONAL_FORECAST_GENERATING',
        ),
      });
    }
    queueRollingPrewarm();
    diagnostic.log('generation', 'ok', {
      period,
      source: generated.fromCache ? 'cache' : 'generated',
      httpStatus: 200,
    });
    return res.status(200).json(responsePayload(
      generated.value,
      entitlement.isPremium,
      generated.fromCache ? 'cache' : 'generated',
      wireVersion,
    ));
  } catch (error) {
    const diagnosticCode = getPersonalForecastGenerationDiagnosticCode(error);
    diagnostic.error('generation', error, diagnosticCode, {
      period,
      errorCode: diagnosticCode,
      httpStatus: 503,
    });
    const staleFallback = await getCompatibleStalePersonalForecast(cacheInput).catch(() => null);
    if (staleFallback) {
      diagnostic.log('stale_read', 'cache_hit', { period, source: 'stale', httpStatus: 200 });
      return res.status(200).json(responsePayload(
        staleFallback.forecast,
        entitlement.isPremium,
        'stale',
        wireVersion,
      ));
    }

    return res.status(503).json({
      error: 'Personal forecast generating',
      code: diagnosticCode,
      forecast: createUnavailablePersonalForecast(
        period,
        periodKey,
        timezone,
        profile.language,
        'generating',
        diagnosticCode,
      ),
    });
  }
  } catch (error) {
    if (error instanceof AdminAuthError) {
      diagnostic.error('request', error, error.code, {
        httpStatus: error.status,
        errorCode: error.code,
      });
      return handleAdminError(res, error);
    }
    diagnostic.error('request', error, diagnosticErrorCode(error, 'PERSONAL_FORECAST_REQUEST_FAILED'), {
      httpStatus: 503,
    });
    return res.status(503).json({
      error: 'Personal forecast unavailable',
      code: diagnosticErrorCode(error, 'PERSONAL_FORECAST_REQUEST_FAILED'),
    });
  }
}
