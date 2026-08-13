import zodiacLegacyManifest from './zodiac-legacy-special.manifest.json';

export type ZodiacLegacyCategory = 'psychedelic' | 'funny-animal';
export type ZodiacLegacyAsset = {
  id: string;
  path: `/assets/zodiac-legacy-special/${string}.webp`;
  width: number;
  height: number;
  aspectRatio: number;
  orientation: 'landscape' | 'portrait' | 'square';
  collection: 'zodiac-legacy-special';
  category: ZodiacLegacyCategory;
  fileName: string;
  bytes: number;
  sha256: string;
};

type ZodiacLegacyManifest = {
  schemaVersion: 1;
  kind: 'zodiac-legacy-special';
  items: ZodiacLegacyAsset[];
};

const manifest = zodiacLegacyManifest as ZodiacLegacyManifest;

if (manifest.schemaVersion !== 1 || manifest.kind !== 'zodiac-legacy-special') {
  throw new Error('Unsupported Zodiac legacy asset manifest');
}

const ZODIAC_LEGACY_ASSETS = Object.freeze(manifest.items.map((asset) => {
  if (
    asset.collection !== 'zodiac-legacy-special'
    || !asset.path.startsWith('/assets/zodiac-legacy-special/')
    || (asset.category !== 'psychedelic' && asset.category !== 'funny-animal')
  ) {
    throw new Error(`Invalid Zodiac legacy asset: ${asset.id}`);
  }
  return Object.freeze(asset);
}));

const ASSETS_BY_CATEGORY: Readonly<Record<ZodiacLegacyCategory, readonly ZodiacLegacyAsset[]>> = {
  psychedelic: ZODIAC_LEGACY_ASSETS.filter((asset) => asset.category === 'psychedelic'),
  'funny-animal': ZODIAC_LEGACY_ASSETS.filter((asset) => asset.category === 'funny-animal'),
};

const SELECTOR_VERSION = 'zodiac-legacy-special-v1';
const VISIBLE_PERCENT = 60;
const PSYCHEDELIC_PERCENT_OF_VISIBLE = 18;

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function stablePick<T extends { id: string }>(items: readonly T[], seed: string): T | null {
  if (!items.length) return null;
  const ordered = [...items].sort((left, right) => left.id.localeCompare(right.id));
  return ordered[stableHash(seed) % ordered.length] ?? null;
}

export function getZodiacLegacyAssetLibrary(): readonly ZodiacLegacyAsset[] {
  return ZODIAC_LEGACY_ASSETS;
}

export function selectZodiacLegacyAsset(input: {
  sign: string | null | undefined;
  contentKey: string;
  userId?: string | null;
}): ZodiacLegacyAsset | null {
  const sign = input.sign?.trim().toLowerCase();
  if (!sign || !input.contentKey.trim()) return null;

  const seed = [
    SELECTOR_VERSION,
    sign,
    input.contentKey,
    input.userId || 'guest',
  ].join('|');
  if (stableHash(`${seed}|visible`) % 100 >= VISIBLE_PERCENT) return null;

  const category: ZodiacLegacyCategory = (
    stableHash(`${seed}|category`) % 100 < PSYCHEDELIC_PERCENT_OF_VISIBLE
      ? 'psychedelic'
      : 'funny-animal'
  );
  return stablePick(ASSETS_BY_CATEGORY[category], `${seed}|asset`);
}
