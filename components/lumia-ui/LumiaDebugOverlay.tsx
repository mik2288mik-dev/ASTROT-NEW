import React, { useEffect, useState } from 'react';
import {
  captureLumiaHomeLayout,
  copyLumiaDebugDump,
  getLumiaDebugDump,
  installLumiaDebugGlobal,
  isLumiaDebugEnabled,
  lumiaDebugLog,
} from '../../lib/lumiaDebug';

export function LumiaDebugOverlay() {
  const [enabled, setEnabled] = useState(false);
  const [dump, setDump] = useState('');
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
      const text = await copyLumiaDebugDump();
      setDump(text);
      setStatus('COPIED');
      window.setTimeout(() => setStatus('LOG'), 1200);
    } catch {
      setDump(getLumiaDebugDump());
      setStatus('COPY FAIL');
    }
  };

  return (
    <div className="lumia-debug-overlay" aria-live="polite">
      <button type="button" className="lumia-debug-button" onClick={copy}>
        {status}
      </button>
      {dump ? (
        <textarea
          className="lumia-debug-dump"
          readOnly
          value={dump}
          onFocus={(event) => event.currentTarget.select()}
          aria-label="Lumia debug log"
        />
      ) : null}
    </div>
  );
}
