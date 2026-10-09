import { useCallback, useEffect, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { registerPlugin } from '@capacitor/core';
import { isNativeAndroidRuntime } from './nativeRuntime';

const nativeDiagnostics = registerPlugin<{
  getNetworkInfo(): Promise<{ vpnActive: boolean }>;
}>('NativeDiagnostics');

export function useAndroidVpnWarning() {
  const [vpnActive, setVpnActive] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (dismissed || !isNativeAndroidRuntime()) return;
    let disposed = false;
    let revision = 0;
    let listener: { remove(): Promise<void> } | undefined;

    const refresh = async () => {
      if (disposed) return;
      const request = ++revision;
      try {
        const result = await nativeDiagnostics.getNetworkInfo();
        if (!disposed && request === revision) setVpnActive(result.vpnActive === true);
      } catch {
        // An unavailable native check must not interrupt app startup.
        if (!disposed && request === revision) setVpnActive(false);
      }
    };

    void refresh();
    void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (disposed) return;
      if (isActive) void refresh();
      else {
        revision += 1;
        setVpnActive(false);
      }
    }).then((handle) => {
      if (disposed) void handle.remove();
      else listener = handle;
    }).catch(() => undefined);

    return () => {
      disposed = true;
      void listener?.remove();
    };
  }, [dismissed]);

  const dismiss = useCallback(() => setDismissed(true), []);
  return { open: vpnActive && !dismissed, dismiss };
}
