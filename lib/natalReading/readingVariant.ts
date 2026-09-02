export type NatalReadingVariant = 'auto' | 'catalog' | 'classic';
export type NatalReadingRenderer = Exclude<NatalReadingVariant, 'auto'>;

export const NATAL_READING_VARIANT_EVENT = 'nebo:natal-reading-variant-change';

const STORAGE_PREFIX = 'nebo:admin:natal-reading-variant:v1';
const DEFAULT_VARIANT: NatalReadingVariant = 'auto';

export type NatalReadingVariantStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

type NatalReadingVariantEventDetail = {
  userId: string;
  variant: NatalReadingVariant;
};

export function isNatalReadingVariant(value: unknown): value is NatalReadingVariant {
  return value === 'auto' || value === 'catalog' || value === 'classic';
}

function ownerKey(userId: unknown): string {
  return String(userId ?? '').trim();
}

function storageKey(userId: unknown): string {
  return `${STORAGE_PREFIX}:${encodeURIComponent(ownerKey(userId))}`;
}

function browserStorage(): NatalReadingVariantStorage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readNatalReadingVariant(
  userId: unknown,
  isAdmin: boolean,
  storage: NatalReadingVariantStorage | null = browserStorage(),
): NatalReadingVariant {
  if (!isAdmin) return DEFAULT_VARIANT;
  const owner = ownerKey(userId);
  if (!owner || !storage) return DEFAULT_VARIANT;
  try {
    const stored = storage.getItem(storageKey(owner));
    return isNatalReadingVariant(stored) ? stored : DEFAULT_VARIANT;
  } catch {
    return DEFAULT_VARIANT;
  }
}

export function writeNatalReadingVariant(
  userId: unknown,
  isAdmin: boolean,
  variant: NatalReadingVariant,
  storage: NatalReadingVariantStorage | null = browserStorage(),
): NatalReadingVariant {
  if (!isAdmin || !isNatalReadingVariant(variant)) return DEFAULT_VARIANT;
  const owner = ownerKey(userId);
  if (!owner) return DEFAULT_VARIANT;
  try {
    storage?.setItem(storageKey(owner), variant);
  } catch {
    // The switch remains active for the current React session when storage is unavailable.
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<NatalReadingVariantEventDetail>(
      NATAL_READING_VARIANT_EVENT,
      { detail: { userId: owner, variant } },
    ));
  }
  return variant;
}

export function subscribeNatalReadingVariant(
  userId: unknown,
  isAdmin: boolean,
  listener: (variant: NatalReadingVariant) => void,
): () => void {
  if (typeof window === 'undefined' || !isAdmin) return () => undefined;
  const owner = ownerKey(userId);
  if (!owner) return () => undefined;
  const key = storageKey(owner);
  const onVariant = (event: Event) => {
    const detail = (event as CustomEvent<NatalReadingVariantEventDetail>).detail;
    if (detail?.userId === owner && isNatalReadingVariant(detail.variant)) {
      listener(detail.variant);
    }
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === key && isNatalReadingVariant(event.newValue)) {
      listener(event.newValue);
    }
  };
  window.addEventListener(NATAL_READING_VARIANT_EVENT, onVariant);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(NATAL_READING_VARIANT_EVENT, onVariant);
    window.removeEventListener('storage', onStorage);
  };
}

export function resolveNatalReadingRenderer(
  variant: NatalReadingVariant,
  _catalogCached: boolean,
): NatalReadingRenderer {
  if (variant === 'classic') return 'classic';
  return 'catalog';
}
