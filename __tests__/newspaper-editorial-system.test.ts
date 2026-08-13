import fs from 'fs';
import path from 'path';
import {
  getPersonalEditorialAssetLibrary,
  getPersonalPaperTemplateLibrary,
  selectPersonalEditorialAsset,
} from '../lib/personalForecastVisuals';
import {
  getZodiacLegacyAssetLibrary,
  selectZodiacLegacyAsset,
} from '../lib/zodiacLegacyVisuals';
import { ZODIAC_LEGACY_ALLOWLIST } from '../lib/zodiacLegacyVisuals/zodiacLegacyAllowlist';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const exists = (file: string) => fs.existsSync(path.join(ROOT, file));

describe('separated editorial asset system', () => {
  it('keeps the personal, paper, and approved Zodiac sources physically distinct', () => {
    const personal = getPersonalEditorialAssetLibrary();
    const paper = getPersonalPaperTemplateLibrary();
    const zodiac = getZodiacLegacyAssetLibrary();

    expect(personal).toHaveLength(309);
    expect(paper).toHaveLength(19);
    expect(zodiac).toHaveLength(48);
    expect(personal.every((asset) => asset.path.startsWith('/assets/personal-editorial/')))
      .toBe(true);
    expect(paper.every((asset) => asset.path.startsWith('/assets/personal-paper-templates/')))
      .toBe(true);
    expect(zodiac.every((asset) => asset.path.startsWith('/assets/zodiac-legacy-special/')))
      .toBe(true);
    expect(new Set([...personal, ...paper, ...zodiac].map((asset) => asset.path)).size)
      .toBe(376);
  });

  it('uses an explicit typed allowlist for the two retained legacy categories', () => {
    expect(ZODIAC_LEGACY_ALLOWLIST).toHaveLength(48);
    expect(ZODIAC_LEGACY_ALLOWLIST.filter((asset) => asset.category === 'psychedelic'))
      .toHaveLength(24);
    expect(ZODIAC_LEGACY_ALLOWLIST.filter((asset) => asset.category === 'funny-animal'))
      .toHaveLength(24);
    expect(new Set(ZODIAC_LEGACY_ALLOWLIST.map((asset) => asset.id)).size).toBe(48);

    const published = getZodiacLegacyAssetLibrary();
    expect(new Set(published.map((asset) => asset.id))).toEqual(
      new Set(ZODIAC_LEGACY_ALLOWLIST.map((asset) => asset.id)),
    );
  });

  it('keeps selection deterministic without exposing Zodiac legacy to personal selection', () => {
    const personalInput = {
      period: 'week' as const,
      periodKey: '2026-W33',
      userId: 'stable-personal-reader',
      forceVisible: true,
    };
    const zodiacInput = {
      sign: 'aries',
      contentKey: '2026-W33',
      userId: 'stable-zodiac-reader',
    };

    expect(selectPersonalEditorialAsset(personalInput)).toEqual(
      selectPersonalEditorialAsset(personalInput),
    );
    expect(selectZodiacLegacyAsset(zodiacInput)).toEqual(selectZodiacLegacyAsset(zodiacInput));

    const personalSelections = Array.from({ length: 500 }, (_, index) => (
      selectPersonalEditorialAsset({
        ...personalInput,
        periodKey: `2026-W${index}`,
        userId: `personal-${index}`,
      })
    )).filter((asset): asset is NonNullable<typeof asset> => Boolean(asset));
    expect(personalSelections.every((asset) => (
      asset.path.startsWith('/assets/personal-editorial/')
      && !asset.path.startsWith('/assets/zodiac-legacy-special/')
      && asset.hasEmbeddedText === false
      && asset.productionSelectable === true
    ))).toBe(true);

    const personalSelectors = read('lib/personalForecastVisuals/editorialSelectors.ts');
    expect(personalSelectors).toContain('stableHash');
    expect(personalSelectors).not.toContain('Math.random');
    expect(personalSelectors).not.toContain('zodiac-legacy-special.manifest.json');
  });

  it('removes the retired newspaper catalogs and verifies every retained manifest path', () => {
    for (const retiredPath of [
      'public/assets/forecast-feed/editorial-stickers',
      'public/foni',
      'lib/personalForecastVisuals/main.manifest.json',
      'lib/personalForecastVisuals/synastry.manifest.json',
      'lib/personalForecastVisuals/zodiac.manifest.json',
      'docs/design/newspaper-stickers/main-scenes.json',
      'docs/design/newspaper-stickers/psychedelic-humor-scenes.json',
      'docs/design/newspaper-stickers/synastry-scenes.json',
      'docs/design/newspaper-stickers/zodiac-scenes.json',
    ]) {
      expect(exists(retiredPath)).toBe(false);
    }

    const retained = [
      ...getPersonalEditorialAssetLibrary(),
      ...getPersonalPaperTemplateLibrary(),
      ...getZodiacLegacyAssetLibrary(),
    ];
    expect(retained.every((asset) => exists(`public${asset.path}`))).toBe(true);
  });

  it('wires each source only into its intended active reading screens', () => {
    const horoscope = read('views/v2/HoroscopeReader.tsx');
    const natal = read('views/v2/NatalMagazine.tsx');
    const compatibility = read('views/v2/UnionRoom.tsx');
    const matrix = read('views/v2/MatrixRoom.tsx');
    const onboarding = read('views/Onboarding.tsx');

    expect(horoscope).toContain('selectZodiacLegacyAsset');
    expect(horoscope).not.toContain('selectPersonalEditorialAsset');
    expect(natal).toContain('selectNatalEditorialSticker');
    expect(compatibility).toContain('selectSynastryEditorialSticker');
    for (const source of [horoscope, compatibility]) {
      expect(source).toContain('EditorialSticker');
    }
    expect(natal).toContain('editorialSticker={natalSticker}');
    for (const source of [matrix, onboarding]) {
      expect(source).not.toContain('selectPersonalEditorialAsset');
      expect(source).not.toContain('selectZodiacLegacyAsset');
      expect(source).not.toContain('EditorialSticker');
    }
  });

  it('keeps editorial stickers mobile-sized and renders them as restrained accents', () => {
    const component = read('components/EditorialSticker.tsx');
    const styles = read('styles/newspaperVisual.css');

    expect(component).toContain("'--editorial-sticker-ratio'");
    expect(component).toContain('data-editorial-orientation');
    expect(styles).toContain('aspect-ratio: var(--editorial-sticker-ratio, auto)');
    expect(styles).toContain('width: clamp(5rem, 22vw, 7.5rem)');
    expect(styles).not.toContain('width: min(100%, 28rem)');
  });
});
