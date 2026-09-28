export const NATAL_INTERPRETATION_DEBUG_EVENT = 'nebo:natal-interpretation-debug-change';
const STORAGE_KEY = 'nebo:admin:natal-interpretation-debug:v1';

export function readNatalInterpretationDebug(isAdmin: boolean): boolean {
  if (!isAdmin || typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeNatalInterpretationDebug(
  isAdmin: boolean,
  enabled: boolean,
): boolean {
  if (!isAdmin) return false;
  if (typeof window !== 'undefined') {
    try {
      if (enabled) window.localStorage.setItem(STORAGE_KEY, '1');
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {}
    window.dispatchEvent(new CustomEvent(
      NATAL_INTERPRETATION_DEBUG_EVENT,
      { detail: { enabled } },
    ));
  }
  return enabled;
}

export function subscribeNatalInterpretationDebug(
  isAdmin: boolean,
  listener: (enabled: boolean) => void,
): () => void {
  if (!isAdmin || typeof window === 'undefined') return () => undefined;
  const onCustom = (event: Event) => {
    const detail = (event as CustomEvent<{ enabled?: boolean }>).detail;
    listener(detail?.enabled === true);
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    listener(event.newValue === '1');
  };
  window.addEventListener(NATAL_INTERPRETATION_DEBUG_EVENT, onCustom);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(NATAL_INTERPRETATION_DEBUG_EVENT, onCustom);
    window.removeEventListener('storage', onStorage);
  };
}
