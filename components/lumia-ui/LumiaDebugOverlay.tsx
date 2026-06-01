import React, { useEffect, useState } from 'react';
import {
  captureLumiaHomeLayout,
  copyLumiaDebugDump,
  installLumiaDebugGlobal,
  isLumiaDebugEnabled,
  lumiaDebugLog,
} from '../../lib/lumiaDebug';

/** Debug UI only when `?lumiaDebug=1` — no floating preview in normal sessions. */
export function LumiaDebugOverlay() {
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState('LOG');

  useEffect(() => {
    installLumiaDebugGlobal();
    const nextEnabled = isLumiaDebugEnabled();
    setEnabled(nextEnabled);
    if (nextEnabled) {
      lumiaDebugLog('debug_overlay_mount');
      window.setTimeout(() => captureLumiaHomeLayout('debug_overlay_mount'), 120);
    }
  }, []);

  if (!enabled) return null;

  const copy = async () => {
    captureLumiaHomeLayout('debug_overlay_copy');
    try {
      await copyLumiaDebugDump();
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
