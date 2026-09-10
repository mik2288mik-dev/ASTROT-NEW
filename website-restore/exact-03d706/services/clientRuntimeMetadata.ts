import { Capacitor, registerPlugin } from '@capacitor/core';
import { sanitizeClientRuntimeMetadata, type ClientRuntimeMetadata } from '../lib/clientRuntimeMetadata';
import { getMobileBuildIdentity } from './mobileBuildIdentity';
import { isNativeAndroidRuntime } from './nativeRuntime';

const METADATA_TIMEOUT_MS = 1000;
let pendingMetadata: Promise<ClientRuntimeMetadata> | null = null;

function isAvailable(): boolean {
  try { return typeof window !== 'undefined' && isNativeAndroidRuntime(); }
  catch { return false; }
}

function bridge<T extends object>(name: string): T | null {
  if (typeof registerPlugin !== 'function') return null;
  if (typeof Capacitor?.isPluginAvailable === 'function' && !Capacitor.isPluginAvailable(name)) return null;
  return registerPlugin<T>(name);
}

async function loadMetadata(): Promise<ClientRuntimeMetadata> {
  const base = sanitizeClientRuntimeMetadata({
    runtime: 'native',
    osName: 'Android',
    distributionChannel: process.env.NEXT_PUBLIC_DISTRIBUTION_CHANNEL,
  });
  let build: ClientRuntimeMetadata = {};
  let installedApp: ClientRuntimeMetadata = {};
  let native: ClientRuntimeMetadata = {};
  let timeout: ReturnType<typeof setTimeout> | undefined;

  // None of these sources contains account data. Older APKs may lack the new method.
  const sources = [
    Promise.resolve().then(async () => {
      const diagnostics = bridge<{ getRuntimeInfo(): Promise<unknown> }>('NativeDiagnostics');
      if (typeof diagnostics?.getRuntimeInfo === 'function') {
        native = sanitizeClientRuntimeMetadata(await diagnostics.getRuntimeInfo());
      }
    }).catch(() => undefined),
    Promise.resolve().then(async () => {
      const app = bridge<{ getInfo(): Promise<{ version?: unknown; build?: unknown }> }>('App');
      if (typeof app?.getInfo === 'function') {
        const info = await app.getInfo();
        installedApp = sanitizeClientRuntimeMetadata({ appVersion: info.version, versionCode: info.build });
      }
    }).catch(() => undefined),
    Promise.resolve().then(async () => {
      build = sanitizeClientRuntimeMetadata(await getMobileBuildIdentity());
    }).catch(() => undefined),
  ];

  try {
    await Promise.race([
      Promise.all(sources),
      new Promise<void>((resolve) => { timeout = setTimeout(resolve, METADATA_TIMEOUT_MS); }),
    ]);
    return sanitizeClientRuntimeMetadata({ ...base, ...build, ...installedApp, ...native });
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

export function getClientRuntimeMetadata(): Promise<ClientRuntimeMetadata> {
  if (!isAvailable()) return Promise.resolve({});
  pendingMetadata ||= loadMetadata().catch(() => ({}));
  return pendingMetadata;
}

export async function getClientRuntimeHeader(): Promise<string | null> {
  try {
    const metadata = sanitizeClientRuntimeMetadata(await getClientRuntimeMetadata());
    return Object.keys(metadata).length ? encodeURIComponent(JSON.stringify(metadata)) : null;
  } catch { return null; }
}
