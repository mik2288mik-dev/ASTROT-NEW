import rawManifest from './promoBannerManifest.json';

export const PROMO_BANNER_CATEGORIES = [
  'compatibility',
  'natal',
  'zodiac',
] as const;

export type PromoBannerCategory = (typeof PROMO_BANNER_CATEGORIES)[number];
export type PromoBannerLayout = 'standalone' | 'tile' | 'wide';

export type PromoBannerResponsiveVersion = {
  filename: string;
  width: number;
  height: number;
};

export type PromoBannerAsset = {
  id: string;
  filename: string;
  category: PromoBannerCategory;
  targetRoute: string;
  width: number;
  height: number;
  responsiveVersions: {
    mobile: PromoBannerResponsiveVersion;
    desktop: PromoBannerResponsiveVersion;
  };
};

type PromoBannerSessionState = {
  dayKey: string;
  assignments: Record<string, string>;
};

const SESSION_STORAGE_KEY = 'personal-forecast-promo-banners:v1';
let memorySession: PromoBannerSessionState | null = null;
const manifest = rawManifest as {
  version: number;
  assets: PromoBannerAsset[];
};

const MIN_BANNER_ASPECT_RATIO = 1.15;

function assetAspectRatio(asset: PromoBannerAsset): number {
  return asset.responsiveVersions.mobile.width
    / asset.responsiveVersions.mobile.height;
}

export const PROMO_BANNER_MANIFEST_VERSION = manifest.version;
export const PROMO_BANNER_MANIFEST: readonly PromoBannerAsset[] =
  manifest.assets.filter(
    (asset) => assetAspectRatio(asset) >= MIN_BANNER_ASPECT_RATIO,
  );

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function readSession(dayKey: string): PromoBannerSessionState {
  if (typeof window === 'undefined') {
    if (memorySession?.dayKey === dayKey) return memorySession;
    memorySession = { dayKey, assignments: {} };
    return memorySession;
  }
  try {
    const stored = JSON.parse(
      window.sessionStorage.getItem(SESSION_STORAGE_KEY) || 'null',
    ) as PromoBannerSessionState | null;
    if (stored?.dayKey === dayKey && stored.assignments) return stored;
  } catch {
    // A blocked or malformed session store must not break navigation.
  }
  return { dayKey, assignments: {} };
}

function writeSession(state: PromoBannerSessionState): void {
  memorySession = state;
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // The deterministic fallback still works when storage is unavailable.
  }
}

export function getPromoBannersByCategory(
  category: PromoBannerCategory,
): readonly PromoBannerAsset[] {
  return PROMO_BANNER_MANIFEST.filter((asset) => asset.category === category);
}

export function selectPromoBanner(input: {
  category: PromoBannerCategory;
  userId: string;
  dayKey: string;
  placementKey: string;
  layout?: PromoBannerLayout;
}): PromoBannerAsset {
  const categoryAssets = getPromoBannersByCategory(input.category);
  if (!categoryAssets.length) {
    throw new Error(`PROMO_BANNER_CATEGORY_EMPTY:${input.category}`);
  }
  const layout = input.layout || 'standalone';
  const preferredAssets = categoryAssets.filter((asset) => {
    const ratio = assetAspectRatio(asset);
    if (layout === 'tile') return ratio <= 1.55;
    if (layout === 'wide') return ratio >= 1.55;
    return true;
  });
  const assets = preferredAssets.length ? preferredAssets : categoryAssets;

  const assignmentKey = [
    input.userId || 'guest',
    input.dayKey,
    input.placementKey,
    input.category,
    layout,
  ].join('|');
  const state = readSession(input.dayKey);
  const assignedId = state.assignments[assignmentKey];
  const assigned = assignedId
    ? assets.find((asset) => asset.id === assignedId)
    : null;
  if (assigned) return assigned;

  const reservedIds = new Set(Object.values(state.assignments));
  const epochDay = Math.floor(
    Date.parse(`${input.dayKey}T00:00:00Z`) / 86_400_000,
  );
  const userOffset = stableHash(`${input.userId}|${input.category}`)
    % assets.length;
  const dailyStart = ((epochDay + userOffset) % assets.length + assets.length)
    % assets.length;

  let selected = assets[dailyStart];
  for (let offset = 0; offset < assets.length; offset += 1) {
    const candidate = assets[(dailyStart + offset) % assets.length];
    if (!reservedIds.has(candidate.id)) {
      selected = candidate;
      break;
    }
  }

  state.assignments[assignmentKey] = selected.id;
  writeSession(state);
  return selected;
}
