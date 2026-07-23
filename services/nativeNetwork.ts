import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';

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

async function initializeNativeNetworkStatus(): Promise<void> {
  if (!isNativePlatform() || initialization) return initialization || Promise.resolve();

  initialization = (async () => {
    const status = await Network.getStatus();
    connected = status.connected;
    await Network.addListener('networkStatusChange', (nextStatus) => {
      connected = nextStatus.connected;
    });
  })().catch((error) => {
    initialization = null;
    throw error;
  });

  return initialization;
}

export async function assertNativeNetworkAvailable(): Promise<void> {
  if (!isNativePlatform()) return;
  await initializeNativeNetworkStatus();
  if (connected === false) throw new NativeNetworkError();
}
