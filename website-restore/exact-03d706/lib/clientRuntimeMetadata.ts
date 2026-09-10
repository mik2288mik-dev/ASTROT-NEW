/** Operational client facts only; never a source of account identity or authorization. */
export type ClientRuntimeMetadata = {
  runtime?: 'native' | 'web' | 'telegram';
  distributionChannel?: 'rustore' | 'google_play' | 'telegram' | 'development';
  deviceManufacturer?: string;
  deviceModel?: string;
  osName?: 'Android' | 'iOS' | 'Windows' | 'macOS' | 'Linux';
  osVersion?: string;
  appVersion?: string;
  versionCode?: number;
  sdk?: number;
};
export const CLIENT_RUNTIME_HEADER = 'x-nebo-client';
const MAX_HEADER_LENGTH = 2048;

function hardwareText(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const clean = value.trim();
  if (!clean || clean.length > max || !/^[\p{L}\p{N}][\p{L}\p{N} ._()+/-]*$/u.test(clean)
    || /(?:https?|token|secret|password|unknown|null|undefined)/i.test(clean)) return undefined;
  return clean;
}
export function sanitizeClientRuntimeMetadata(input: unknown): ClientRuntimeMetadata {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const source = input as Record<string, unknown>;
  const result: ClientRuntimeMetadata = {};
  if (['native', 'web', 'telegram'].includes(String(source.runtime))) result.runtime = source.runtime as ClientRuntimeMetadata['runtime'];
  if (['rustore', 'google_play', 'telegram', 'development'].includes(String(source.distributionChannel))) {
    result.distributionChannel = source.distributionChannel as ClientRuntimeMetadata['distributionChannel'];
  }
  if (['Android', 'iOS', 'Windows', 'macOS', 'Linux'].includes(String(source.osName))) result.osName = source.osName as ClientRuntimeMetadata['osName'];
  for (const name of ['deviceManufacturer', 'deviceModel', 'osVersion'] as const) {
    const value = hardwareText(source[name], name === 'deviceModel' ? 80 : 40);
    if (value) result[name] = value;
  }
  if (typeof source.appVersion === 'string' && /^\d[\dA-Za-z.+-]{0,31}$/.test(source.appVersion)) result.appVersion = source.appVersion;
  for (const name of ['versionCode', 'sdk'] as const) {
    const value = source[name];
    if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0
      && value <= (name === 'sdk' ? 999 : 2_147_483_647)) result[name] = value;
  }
  return result;
}

/** Infer only facts explicitly present in the UA; never infer an app store from it. */
function userAgentMetadata(value: string): ClientRuntimeMetadata {
  const result: ClientRuntimeMetadata = {};
  const ua = value.slice(0, 1000);
  if (/Android/i.test(ua)) {
    result.osName = 'Android';
    result.osVersion = /Android\s+(\d+(?:\.\d+){0,3})/i.exec(ua)?.[1];
    const model = /Android[^;)]*;\s*(?:[a-z]{2}(?:[-_][A-Z]{2})?;\s*)?([^;)]+?)\s+Build\//i.exec(ua)?.[1];
    if (model && model !== 'K') result.deviceModel = model;
  } else if (/iPhone|iPad/i.test(ua)) {
    result.osName = 'iOS';
    result.osVersion = /(?:CPU (?:iPhone )?OS|iPhone OS)\s+(\d+(?:_\d+){0,3})/i.exec(ua)?.[1]?.replace(/_/g, '.');
  } else if (/Windows/i.test(ua)) result.osName = 'Windows';
  else if (/Macintosh|Mac OS/i.test(ua)) result.osName = 'macOS';
  else if (/Linux/i.test(ua)) result.osName = 'Linux';
  return sanitizeClientRuntimeMetadata(result);
}

export function readClientRuntimeMetadata(
  headers: Record<string, string | string[] | undefined>,
  trustedRuntime: 'native' | 'web' | 'telegram',
): ClientRuntimeMetadata {
  const single = (name: string) => {
    const value = headers[name];
    return typeof value === 'string' ? value : '';
  };
  const fallback = userAgentMetadata(single('user-agent'));
  let claimed: ClientRuntimeMetadata = {};
  // Only native transports send this header. Web callers cannot relabel themselves as a RuStore APK.
  if (trustedRuntime === 'native') {
    const encoded = single(CLIENT_RUNTIME_HEADER);
    if (encoded && encoded.length <= MAX_HEADER_LENGTH) {
      try { claimed = sanitizeClientRuntimeMetadata(JSON.parse(decodeURIComponent(encoded))); } catch { /* Old APK or malformed metadata. */ }
    }
  }
  return { ...fallback, ...claimed, runtime: trustedRuntime,
    ...(trustedRuntime === 'telegram' ? { distributionChannel: 'telegram' as const } : {}) };
}
