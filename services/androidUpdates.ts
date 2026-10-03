import { registerPlugin } from '@capacitor/core';
import { apiFetchUnauthenticated } from './apiClient';
import { parseAndroidUpdatePolicy, type AndroidUpdatePolicy } from '../lib/androidUpdatePolicy';

const nativeUpdates = registerPlugin<{
  startUpdate(): Promise<{ status: 'started' | 'cancelled' }>;
  openStore(): Promise<void>;
}>('RuStoreUpdate');
const CACHE_KEY = 'nebo.android.update-policy.v1';

export function readCachedAndroidUpdatePolicy(): AndroidUpdatePolicy | null {
  try { return parseAndroidUpdatePolicy(JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')); }
  catch { return null; }
}

export async function fetchAndroidUpdatePolicy(): Promise<AndroidUpdatePolicy> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await apiFetchUnauthenticated('/api/app/update-policy', { signal: controller.signal });
    if (!response.ok) throw new Error('Update policy unavailable');
    const policy = parseAndroidUpdatePolicy(await response.json());
    if (!policy) throw new Error('Invalid update policy');
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(policy)); } catch { /* Storage may be unavailable. */ }
    return policy;
  } finally { clearTimeout(timeout); }
}

export async function startAndroidUpdate(): Promise<'started' | 'cancelled' | 'store'> {
  try { return (await nativeUpdates.startUpdate()).status; }
  catch { await nativeUpdates.openStore(); return 'store'; }
}
