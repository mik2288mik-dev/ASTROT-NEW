import { isNativeAndroidRuntime } from './nativeRuntime';

export type MobileBuildIdentity = {
  appVersion?: string;
  versionCode?: number;
  platform?: 'android' | 'web';
  distributionChannel?: string;
};

type MobileBuildMarker = {
  versionName?: unknown;
  versionCode?: unknown;
  channel?: unknown;
};

const CHANNELS = new Set(['telegram', 'rustore', 'google_play', 'development']);
const VALUE_LIMITS = {
  appVersion: 32,
  distributionChannel: 32,
} as const;

let cachedBuildIdentity: Promise<MobileBuildIdentity> | null = null;

function normalizedSingleLine(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const normalized = String(value).trim().replace(/\s+/gu, ' ');
  if (!normalized || normalized.length > maxLength || /[\u0000-\u001F\u007F]/u.test(normalized)) {
    return undefined;
  }
  return normalized;
}

function normalizedChannel(value: unknown): string | undefined {
  const channel = normalizedSingleLine(value, VALUE_LIMITS.distributionChannel)?.toLowerCase();
  return channel && CHANNELS.has(channel) ? channel : undefined;
}

export function normalizeMobileBuildIdentity(
  marker: MobileBuildMarker | null,
  options: { android: boolean; fallbackChannel?: unknown },
): MobileBuildIdentity {
  const appVersion = normalizedSingleLine(marker?.versionName, VALUE_LIMITS.appVersion);
  const rawVersionCode = normalizedSingleLine(marker?.versionCode, 24);
  const versionCode = rawVersionCode && /^\d+$/u.test(rawVersionCode)
    ? Number(rawVersionCode)
    : undefined;
  const safeVersionCode = Number.isSafeInteger(versionCode) && Number(versionCode) > 0
    ? versionCode
    : undefined;
  const distributionChannel = normalizedChannel(marker?.channel)
    || normalizedChannel(options.fallbackChannel);

  return {
    ...(appVersion ? { appVersion } : {}),
    ...(safeVersionCode ? { versionCode: safeVersionCode } : {}),
    platform: options.android ? 'android' : 'web',
    ...(distributionChannel ? { distributionChannel } : {}),
  };
}

async function loadBuildIdentity(): Promise<MobileBuildIdentity> {
  const options = {
    android: isNativeAndroidRuntime(),
    fallbackChannel: process.env.NEXT_PUBLIC_DISTRIBUTION_CHANNEL,
  };
  try {
    const response = await fetch('/nebo-mobile-build.json', { cache: 'no-store' });
    if (!response.ok) return normalizeMobileBuildIdentity(null, options);
    const marker = await response.json() as MobileBuildMarker;
    return normalizeMobileBuildIdentity(marker, options);
  } catch {
    return normalizeMobileBuildIdentity(null, options);
  }
}

export async function getMobileBuildIdentity(): Promise<MobileBuildIdentity> {
  cachedBuildIdentity ||= loadBuildIdentity();
  return cachedBuildIdentity;
}
