import { useCallback, useEffect, useRef, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { createAndroidUpdateGate, type AndroidUpdatePolicy } from '../lib/androidUpdatePolicy';
import { checkForAndroidUpdate, fetchAndroidUpdatePolicy, readCachedAndroidUpdatePolicy } from './androidUpdates';
import { getClientRuntimeMetadata } from './clientRuntimeMetadata';
import { isNativeAndroidRuntime } from './nativeRuntime';

export function useAndroidUpdateGate() {
  const [gate] = useState(createAndroidUpdateGate);
  const [state, setState] = useState(gate.getState);
  const [storeUpdateOpen, setStoreUpdateOpen] = useState(false);
  const storeUpdateDismissed = useRef(false);

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
      try {
        await Promise.all([
          fetchAndroidUpdatePolicy().then(apply).catch(() => {
            // Keep the last confirmed policy across offline starts/resumes.
          }),
          checkForAndroidUpdate().then((available) => {
            if (!disposed) setStoreUpdateOpen(available && !storeUpdateDismissed.current);
          }).catch(() => {
            // An unavailable store must not interrupt app startup.
          }),
        ]);
      }
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
  const dismiss = useCallback(() => {
    gate.dismiss();
    setState(gate.getState());
    storeUpdateDismissed.current = true;
    setStoreUpdateOpen(false);
  }, [gate]);
  return { ...state, promptOpen: state.promptOpen || storeUpdateOpen, allowNavigation, dismiss };
}
