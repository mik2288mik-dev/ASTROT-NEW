import { useEffect } from 'react';
import { NATIVE_BACK_EVENT, type NativeBackEventDetail } from './nativeBack';

/** Nested screens consume the same back event as the edge swipe and Android back. */
export function useScreenBack(enabled: boolean, onBack: () => void): void {
  useEffect(() => {
    if (!enabled) return;
    const handleBack = (event: Event) => {
      const detail = (event as CustomEvent<NativeBackEventDetail>).detail;
      if (detail?.handled) return;
      if (detail) detail.handled = true;
      event.stopImmediatePropagation();
      onBack();
    };
    window.addEventListener(NATIVE_BACK_EVENT, handleBack);
    return () => window.removeEventListener(NATIVE_BACK_EVENT, handleBack);
  }, [enabled, onBack]);
}
