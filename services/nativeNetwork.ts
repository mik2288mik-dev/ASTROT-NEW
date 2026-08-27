import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';

const NETWORK_STATUS_TIMEOUT_MS = 1_500;

let connected: boolean | null = null;
let initialization: Promise<void> | null = null;

export class NativeNetworkError extends Error {
  readonly code = 'NETWORK_OFFLINE';

  constructor() {
    super('No network connection. Try again when you are online.');
    this.name = 'NativeNetworkError';
  }
}

function isNativePlatform(): boolean {
  return typeof window !== 'undefined' && Capacitor.isNativePlatform();
}

async function getStatusWithinBudget(): Promise<Awaited<ReturnType<typeof Network.getStatus>> | null> {
  const statusPromise = Network.getStatus();
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), NETWORK_STATUS_TIMEOUT_MS);
  });

  try {
    const status = await Promise.race([statusPromise, timeout]);
    if (status === null) {
      // Some vendor WebViews/bridges can stall a Capacitor plugin call during
      // cold start. Do not let an advisory connectivity probe block the real
      // HTTPS request; update the cached state later if the bridge recovers.
      void statusPromise.then((lateStatus) => {
        connected = lateStatus.connected;
      }).catch(() => undefined);
    }
    return status;
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}

async function initializeNativeNetworkStatus(): Promise<void> {
  if (!isNativePlatform() || initialization) return initialization || Promise.resolve();

  initialization = (async () => {
    const status = await getStatusWithinBudget();
    if (status !== null) connected = status.connected;

    // Listener registration is also advisory. Never await it on the startup
    // request path: the fetch timeout is the authoritative network boundary.
    void Network.addListener('networkStatusChange', (nextStatus) => {
      connected = nextStatus.connected;
    }).catch(() => undefined);
  })().catch(() => {
    // Fail open if the native connectivity plugin itself is unavailable. The
    // actual HTTPS fetch still has its own AbortController timeout.
    connected = null;
  });

  return initialization;
}

export async function assertNativeNetworkAvailable(): Promise<void> {
  if (!isNativePlatform()) return;
  await initializeNativeNetworkStatus();
  if (connected === false) throw new NativeNetworkError();
}
