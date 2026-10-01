import type { NextApiHandler, NextApiRequest, NextApiResponse } from 'next';
import { CLIENT_RUNTIME_HEADER, readClientRuntimeMetadata } from './clientRuntimeMetadata';
import { recordTechnicalError } from './errorLogger';
import { isReleasedAndroidSignHoroscopeClient } from './horoscope/signWireCompatibility';

/** Same failure from the same kind of device is written at most once a minute. */
const THROTTLE_MS = 60_000;
const lastRecorded = new Map<string, number>();

/** Statuses that are an ordinary product answer, not a failure worth tracking. */
const EXPECTED_STATUSES = new Set([401, 403, 405]);

export type RequestTelemetryInput = {
  endpoint: string;
  httpStatus: number;
  errorCode: string;
  /** Request facts that make the failure reproducible (period, sign, key). */
  detail?: string;
};

/** Platform as the server can see it: the released APK talks through native Android HTTP. */
export function describeRequestClient(req: NextApiRequest): { platform: string; appVersion: string | null; device: string } {
  const userAgent = String(req.headers?.['user-agent'] || '');
  // Only the native app sends the runtime header; here it is a telemetry label, never identity.
  const metadata = readClientRuntimeMetadata(req.headers || {}, req.headers?.[CLIENT_RUNTIME_HEADER] ? 'native' : 'web');
  const platform = metadata.runtime === 'native' || isReleasedAndroidSignHoroscopeClient(userAgent)
    ? 'android-apk'
    : metadata.osName === 'Android' ? 'android-web'
      : metadata.osName === 'iOS' ? 'ios-web'
        : userAgent ? 'web' : 'unknown';
  const device = [metadata.osName, metadata.osVersion, metadata.deviceModel].filter(Boolean).join(' ') || 'unknown device';
  return { platform, appVersion: metadata.appVersion || null, device };
}

export function recordRequestFailure(req: NextApiRequest, input: RequestTelemetryInput, now = Date.now()): void {
  const client = describeRequestClient(req);
  const message = `${input.errorCode}${input.detail ? ` ${input.detail}` : ''} | ${client.device}`;
  const throttleKey = `${input.endpoint}|${input.errorCode}|${client.platform}|${client.device}`;
  const previous = lastRecorded.get(throttleKey);
  if (previous && now - previous < THROTTLE_MS) return;
  lastRecorded.set(throttleKey, now);
  if (lastRecorded.size > 2_000) lastRecorded.clear();
  void recordTechnicalError({
    endpoint: input.endpoint,
    httpStatus: input.httpStatus,
    errorCode: input.errorCode,
    message,
    platform: client.platform,
    appVersion: client.appVersion,
  });
}

function requestDetail(req: NextApiRequest): string {
  const source = (req.method === 'GET' ? req.query : req.body) || {};
  return ['sign', 'date', 'periodKey', 'language']
    .map((name) => (source[name] ? `${name}=${String(source[name]).slice(0, 24)}` : ''))
    .filter(Boolean)
    .join(' ');
}

/**
 * Records every failed or stale answer of a content endpoint in
 * app_technical_errors, so a reader's "it did not open" can be traced to the
 * exact code, period and device. The handler's own behaviour is unchanged.
 */
export function withRequestTelemetry(endpoint: string, handler: NextApiHandler): NextApiHandler {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const json = res.json.bind(res);
    res.json = (body: any) => {
      const status = res.statusCode;
      if (status >= 400 && !EXPECTED_STATUSES.has(status)) {
        recordRequestFailure(req, {
          endpoint,
          httpStatus: status,
          errorCode: String(body?.code || body?.error || `HTTP_${status}`),
          detail: requestDetail(req),
        });
      } else if (status < 300 && body?.stale === true) {
        recordRequestFailure(req, {
          endpoint,
          httpStatus: status,
          errorCode: 'SERVED_STALE',
          detail: `${requestDetail(req)} served=${String(body?.reading?.periodKey || '')}`,
        });
      }
      return json(body);
    };
    try {
      return await handler(req, res);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      recordRequestFailure(req, {
        endpoint,
        httpStatus: 500,
        errorCode: 'UNHANDLED',
        detail: `${requestDetail(req)} ${message.slice(0, 200)}`,
      });
      if (!res.headersSent) res.status(500).send({ error: 'INTERNAL_ERROR', code: 'INTERNAL_ERROR' });
    }
  };
}
