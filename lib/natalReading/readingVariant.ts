export type NatalReadingVariant = 'auto' | 'catalog' | 'legacy';

export const NATAL_READING_VARIANT_CHANGED_EVENT = 'nebo:natal-reading-variant-changed';
export const NATAL_CATALOG_FAILURE_EVENT = 'nebo:natal-catalog-failure';

const STORAGE_PREFIX = 'nebo:natal-reading-variant:v1';

export type NatalReadingVariantChangedDetail = {
  userId: string;
  variant: NatalReadingVariant;
};

export type NatalCatalogFailureDetail = {
  userId: string;
  chartId?: number;
  kind: 'category' | 'answer';
  itemKey: string;
  code: string;
};

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}:${encodeURIComponent(String(userId || '').trim() || 'anonymous')}`;
}

export function isNatalReadingVariant(value: unknown): value is NatalReadingVariant {
  return value === 'auto' || value === 'catalog' || value === 'legacy';
}

export function readStoredNatalReadingVariant(userId: string): NatalReadingVariant {
  if (typeof window === 'undefined') return 'auto';
  try {
    const value = window.localStorage.getItem(storageKey(userId));
    return isNatalReadingVariant(value) ? value : 'auto';
  } catch {
    return 'auto';
  }
}

export function readNatalReadingVariant(
  userId: string,
  isAdmin: boolean | null | undefined,
): NatalReadingVariant {
  return isAdmin ? readStoredNatalReadingVariant(userId) : 'auto';
}

export function writeNatalReadingVariant(
  userId: string,
  variant: NatalReadingVariant,
): void {
  if (typeof window === 'undefined') return;
  const normalizedUserId = String(userId || '').trim();
  try {
    window.localStorage.setItem(storageKey(normalizedUserId), variant);
  } catch {
    // The current session still receives the change event below.
  }
  window.dispatchEvent(new CustomEvent<NatalReadingVariantChangedDetail>(
    NATAL_READING_VARIANT_CHANGED_EVENT,
    { detail: { userId: normalizedUserId, variant } },
  ));
}

export function natalCatalogErrorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = String((error as { code?: unknown }).code || '').trim();
    if (code) return code;
  }
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return 'NATAL_CATALOG_UNKNOWN_FAILURE';
}

export function dispatchNatalCatalogFailure(
  detail: Omit<NatalCatalogFailureDetail, 'code'> & { error: unknown },
): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<NatalCatalogFailureDetail>(
    NATAL_CATALOG_FAILURE_EVENT,
    {
      detail: {
        userId: String(detail.userId || '').trim(),
        chartId: detail.chartId,
        kind: detail.kind,
        itemKey: detail.itemKey,
        code: natalCatalogErrorCode(detail.error),
      },
    },
  ));
}

export function natalReadingVariantLabel(
  variant: NatalReadingVariant,
  language: 'ru' | 'en' = 'ru',
): string {
  if (language === 'en') {
    if (variant === 'catalog') return 'New';
    if (variant === 'legacy') return 'Previous';
    return 'Auto';
  }
  if (variant === 'catalog') return 'Новый';
  if (variant === 'legacy') return 'Предыдущий';
  return 'Авто';
}
