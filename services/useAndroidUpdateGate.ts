import { useCallback, useEffect, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { createAndroidUpdateGate, type AndroidUpdatePolicy } from '../lib/androidUpdatePolicy';
import { fetchAndroidUpdatePolicy, readCachedAndroidUpdatePolicy } from './androidUpdates';
import { getClientRuntimeMetadata } from './clientRuntimeMetadata';
import { isNativeAndroidRuntime } from './nativeRuntime';

export function useAndroidUpdateGate() {
  const [gate] = useState(createAndroidUpdateGate);
  const [state, setState] = useState(gate.getState);

  useEffect(() => {
    if (!isNativeAndroidRuntime()) return;
    let disposed = false;
    let refreshRunning = false;
    let listener: { remove(): Promise<void> } | undefined;
    let installedVersionCode: number | undefined;
    const apply = (policy: AndroidUpdatePolicy | null) => {
      if (disposed || !policy) return;
      gate.applyPolicy(policy, installedVersionCode);
      setState(gate.getState());
    };
    const refresh = async () => {
      if (disposed || refreshRunning) return;
      refreshRunning = true;
      try { apply(await fetchAndroidUpdatePolicy()); }
      catch { /* Keep the last confirmed policy across offline starts/resumes. */ }
      finally { refreshRunning = false; }
    };
    void getClientRuntimeMetadata().then((metadata) => {
      if (disposed || metadata.distributionChannel !== 'rustore') return;
      installedVersionCode = metadata.versionCode;
      apply(readCachedAndroidUpdatePolicy());
      void refresh();
      void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) void refresh();
      }).then((handle) => {
        if (disposed) void handle.remove();
        else listener = handle;
      }).catch(() => undefined);
      window.addEventListener('online', refresh);
    }).catch(() => undefined);
    return () => {
      disposed = true;
      window.removeEventListener('online', refresh);
      void listener?.remove();
    };
  }, [gate]);

  const allowNavigation = useCallback((destination: string) => {
    const allowed = gate.allowNavigation(destination);
    if (!allowed) setState(gate.getState());
    return allowed;
  }, [gate]);
  const dismiss = useCallback(() => { gate.dismiss(); setState(gate.getState()); }, [gate]);
  return { ...state, allowNavigation, dismiss };
}
