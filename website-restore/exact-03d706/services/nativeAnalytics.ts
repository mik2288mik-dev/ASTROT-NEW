import { Capacitor, registerPlugin } from '@capacitor/core';
import { isNativeAndroidRuntime } from './nativeRuntime';

type MyTrackerStatus = { enabled: boolean };
interface MyTrackerBridge {
  getStatus(): Promise<MyTrackerStatus>;
  identify(options: { analyticsUserId: string }): Promise<MyTrackerStatus>;
  reset(): Promise<MyTrackerStatus>;
}

const MyTracker = registerPlugin<MyTrackerBridge>('MyTracker');
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
let identityGeneration = 0;
let identityOperations: Promise<void> = Promise.resolve();

function pluginAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && isNativeAndroidRuntime()
      && typeof Capacitor.isPluginAvailable === 'function' && Capacitor.isPluginAvailable('MyTracker');
  } catch {
    return false;
  }
}

export function nativeAnalyticsGeneration(): number {
  return identityGeneration;
}

/** SDK discovery is bounded; an old APK or stalled bridge cannot hold session tracking open. */
export async function isNativeMyTrackerEnabled(): Promise<boolean> {
  if (!pluginAvailable()) return false;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      MyTracker.getStatus().then((status) => status.enabled === true).catch(() => false),
      new Promise<boolean>((resolve) => { timeout = setTimeout(() => resolve(false), 1_000); }),
    ]);
  } catch {
    return false;
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

/** Only accept the opaque UUID returned by the authenticated session endpoint. */
export function identifyNativeAnalytics(value: unknown, expectedGeneration: number): Promise<void> {
  if (typeof value !== 'string' || !UUID.test(value) || expectedGeneration !== identityGeneration) {
    return Promise.resolve();
  }
  const analyticsUserId = value.toLowerCase();
  identityOperations = identityOperations.catch(() => undefined).then(async () => {
    if (expectedGeneration !== identityGeneration || !pluginAvailable()) return;
    await MyTracker.identify({ analyticsUserId });
  }).catch(() => undefined);
  return identityOperations;
}

/** Invalidate pending account responses immediately, then serialize the native reset after prior writes. */
export function resetNativeAnalytics(): Promise<void> {
  identityGeneration += 1;
  identityOperations = identityOperations.catch(() => undefined).then(async () => {
    if (pluginAvailable()) await MyTracker.reset();
  }).catch(() => undefined);
  return identityOperations;
}
