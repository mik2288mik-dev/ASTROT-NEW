import React, { useEffect, useState } from 'react';
import {
  captureAppHomeLayout,
  copyAppDebugDump,
  installAppDebugGlobal,
  isAppDebugEnabled,
  appDebugLog,
} from '../../lib/appDebug';

/** Debug UI only when `?appDebug=1` — no floating preview in normal sessions. */
export function AppDebugOverlay() {
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState('LOG');

  useEffect(() => {
    installAppDebugGlobal();
    const nextEnabled = isAppDebugEnabled();
    setEnabled(nextEnabled);
    if (nextEnabled) {
      appDebugLog('debug_overlay_mount');
      window.setTimeout(() => captureAppHomeLayout('debug_overlay_mount'), 120);
    }
  }, []);

  if (!enabled) return null;

  const copy = async () => {
    captureAppHomeLayout('debug_overlay_copy');
    try {
      await copyAppDebugDump();
      setStatus('COPIED');
      window.setTimeout(() => setStatus('LOG'), 1200);
    } catch {
      setStatus('FAIL');
      window.setTimeout(() => setStatus('LOG'), 1200);
    }
  };

  return (
    <div className="lumia-debug-overlay" aria-live="polite">
      <button type="button" className="lumia-debug-button" onClick={copy}>
        {status}
      </button>
    </div>
  );
}
