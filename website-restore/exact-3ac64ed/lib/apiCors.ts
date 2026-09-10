export const API_CORS_ALLOW_METHODS = 'GET,POST,PUT,PATCH,DELETE,OPTIONS';
export const API_CORS_ALLOW_HEADERS = 'Content-Type,Authorization,X-Telegram-Init-Data,X-Nebo-Trace-Id';

const DEFAULT_NATIVE_ORIGINS = [
  'https://localhost',
  'capacitor://localhost',
];

type HeaderReader = {
  get(name: string): string | null;
};

function firstForwardedValue(value: string | null): string {
  return String(value || '').split(',')[0]?.trim() || '';
}

export function normalizeApiOrigin(value: string | null | undefined): string {
  const raw = String(value || '').trim().replace(/\/+$/, '');
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    return `${parsed.protocol.toLowerCase()}//${parsed.host.toLowerCase()}`;
  } catch {
    return raw.toLowerCase();
  }
}

export function configuredNativeOrigins(value = process.env.NATIVE_APP_ORIGINS || ''): Set<string> {
  return new Set(
    [
      ...DEFAULT_NATIVE_ORIGINS,
      ...value.split(','),
    ]
      .map((origin) => normalizeApiOrigin(origin))
      .filter(Boolean)
  );
}

export function isAllowedNativeOrigin(origin: string, value?: string): boolean {
  return configuredNativeOrigins(value).has(normalizeApiOrigin(origin));
}

export function getForwardedApiOrigin(headers: HeaderReader, fallbackOrigin?: string): string {
  const forwardedProto = firstForwardedValue(headers.get('x-forwarded-proto'));
  const forwardedHost = firstForwardedValue(headers.get('x-forwarded-host')) || firstForwardedValue(headers.get('host'));
  if (!forwardedHost) return normalizeApiOrigin(fallbackOrigin);

  let fallbackProto = 'https';
  try {
    fallbackProto = new URL(String(fallbackOrigin || '')).protocol.replace(':', '') || fallbackProto;
  } catch {
    // Railway normally supplies x-forwarded-proto; HTTPS is the safe public fallback.
  }

  return normalizeApiOrigin(`${forwardedProto || fallbackProto}://${forwardedHost}`);
}

export function isSameApiOrigin(
  origin: string,
  candidates: Array<string | null | undefined>
): boolean {
  const normalizedOrigin = normalizeApiOrigin(origin);
  if (!normalizedOrigin) return false;
  return candidates.some((candidate) => normalizeApiOrigin(candidate) === normalizedOrigin);
}
