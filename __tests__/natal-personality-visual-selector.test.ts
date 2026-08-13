import { selectNatalEditorialSticker } from '../lib/personalForecastVisuals';

const NATAL_SAFE_CATEGORIES = new Set([
  'animals',
  'graphic',
  'mascots',
  'objects',
  'surreal',
]);

describe('natal personality visual selector', () => {
  it('selects only text-free editorial-v2 assets from the natal allowlist', () => {
    const firstInput = { chartKey: 'saved:42:fingerprint', userId: 'reader-7' };
    const first = selectNatalEditorialSticker(firstInput);

    expect(selectNatalEditorialSticker(firstInput)).toEqual(first);

    const results = Array.from({ length: 1200 }, (_, index) => (
      selectNatalEditorialSticker({
        chartKey: `chart-${index}`,
        userId: `reader-${index}`,
      })
    ));
    const selected = results.filter((asset): asset is NonNullable<typeof asset> => !!asset);

    expect(results.some((asset) => asset === null)).toBe(true);
    expect(selected.length).toBeGreaterThan(0);
    expect(new Set(selected.map((asset) => asset.id)).size).toBeGreaterThan(20);

    for (const asset of selected) {
      const metadata = asset as typeof asset & {
        sourceCategory?: string;
        hasEmbeddedText?: boolean;
      };

      expect(asset.collection).toBe('editorial-v2');
      expect(asset.path).toMatch(/^\/stickers\/editorial-v2\//);
      expect(NATAL_SAFE_CATEGORIES.has(metadata.sourceCategory || '')).toBe(true);
      expect(metadata.hasEmbeddedText).toBe(false);
      expect(asset.path).not.toMatch(/\/(?:fixed_text|newspaper|psychedelic)\//);
      expect(asset.path).not.toMatch(/^\/assets\/forecast-feed\/editorial-stickers\//);
    }
  });
});
