import fs from 'fs';
import path from 'path';
import {
  getPersonalEditorialAssetLibrary,
  getPersonalPaperTemplateLibrary,
  resolveDiaryTodayVisualPlan,
  selectNatalEditorialSticker,
  selectPersonalEditorialAsset,
  selectSynastryEditorialSticker,
} from '../lib/personalForecastVisuals';
import {
  getZodiacLegacyAssetLibrary,
  selectZodiacLegacyAsset,
} from '../lib/zodiacLegacyVisuals';

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_ROOT = path.join(ROOT, 'public');
const PERSONAL_PREFIX = '/assets/personal-editorial/';
const PAPER_PREFIX = '/assets/personal-paper-templates/';
const LEGACY_PREFIX = '/assets/zodiac-legacy-special/';
const REMOVED_NEWSPAPER_PREFIX = '/assets/forecast-feed/editorial-stickers/';

function publicPath(assetPath: string): string {
  return path.join(PUBLIC_ROOT, assetPath.replace(/^\//u, ''));
}

function dateKey(dayOffset: number): string {
  return new Date(Date.UTC(2026, 0, 1 + dayOffset)).toISOString().slice(0, 10);
}

describe('visual asset product boundaries', () => {
  it('keeps personal editorial and paper sources physically separate from zodiac legacy', () => {
    const personal = getPersonalEditorialAssetLibrary();
    const paper = getPersonalPaperTemplateLibrary();
    const zodiacLegacy = getZodiacLegacyAssetLibrary();

    expect(personal).toHaveLength(309);
    expect(personal.every((asset) => asset.path.startsWith(PERSONAL_PREFIX))).toBe(true);
    expect(personal.every((asset) => !asset.path.startsWith(LEGACY_PREFIX))).toBe(true);
    expect(personal.every((asset) => !asset.path.startsWith(REMOVED_NEWSPAPER_PREFIX))).toBe(true);
    expect(new Set(personal.map((asset) => asset.source))).toEqual(new Set([
      'editorial-v2',
      'cat',
      'capybara',
      'object',
    ]));

    expect(paper).toHaveLength(19);
    expect(paper.every((asset) => asset.path.startsWith(PAPER_PREFIX))).toBe(true);
    expect(paper.every((asset) => (
      asset.hasEmbeddedText === false
      && asset.safeTextArea.length === 4
      && asset.safeTextArea[0] < asset.safeTextArea[2]
      && asset.safeTextArea[1] < asset.safeTextArea[3]
    ))).toBe(true);

    expect(zodiacLegacy).toHaveLength(48);
    expect(zodiacLegacy.filter((asset) => asset.category === 'psychedelic')).toHaveLength(24);
    expect(zodiacLegacy.filter((asset) => asset.category === 'funny-animal')).toHaveLength(24);
    expect(zodiacLegacy.every((asset) => asset.path.startsWith(LEGACY_PREFIX))).toBe(true);
    expect(zodiacLegacy.every((asset) => asset.collection === 'zodiac-legacy-special')).toBe(true);
  });

  it('never auto-selects embedded copy or zodiac legacy for personal periods', () => {
    const selected = (['day', 'week', 'month'] as const).flatMap((period) => (
      Array.from({ length: 600 }, (_, index) => selectPersonalEditorialAsset({
        period,
        periodKey: `${period}-${index}`,
        userId: `personal-${index}`,
      })).filter((asset): asset is NonNullable<typeof asset> => Boolean(asset))
    ));

    expect(selected.length).toBeGreaterThan(0);
    expect(selected.every((asset) => asset.path.startsWith(PERSONAL_PREFIX))).toBe(true);
    expect(selected.every((asset) => asset.hasEmbeddedText === false)).toBe(true);
    expect(selected.every((asset) => !asset.path.startsWith(LEGACY_PREFIX))).toBe(true);
  });

  it('keeps Today stable, adjacent days distinct, and runtime paper text available', () => {
    const input = {
      userId: 'stable-reader',
      periodKey: '2026-08-13',
      contractVersion: 'personal-visual-boundary-v1',
    };
    expect(resolveDiaryTodayVisualPlan(input)).toEqual(resolveDiaryTodayVisualPlan(input));

    const plans = Array.from({ length: 120 }, (_, day) => resolveDiaryTodayVisualPlan({
      ...input,
      periodKey: dateKey(day),
    }));
    for (let day = 0; day < plans.length; day += 1) {
      const plan = plans[day];
      expect(plan.paperTemplate?.path.startsWith(PAPER_PREFIX)).toBe(true);
      if (plan.asset) {
        expect(plan.asset.path.startsWith(PERSONAL_PREFIX)).toBe(true);
        expect(plan.asset.hasEmbeddedText).toBe(false);
      }
      if (day > 0 && plan.asset && plans[day - 1].asset) {
        expect(plan.asset.id).not.toBe(plans[day - 1].asset?.id);
      }
    }

    const paperNote = fs.readFileSync(path.join(
      ROOT,
      'components/PersonalForecastFeed/EditorialPaperNote.tsx',
    ), 'utf8');
    expect(paperNote).toContain('<p>{text}</p>');
    expect(paperNote).toContain('safeTextArea');
  });

  it('keeps natal and synastry inside the personal source', () => {
    const natal = Array.from({ length: 500 }, (_, index) => selectNatalEditorialSticker({
      chartKey: `chart-${index}`,
      userId: `natal-${index}`,
    })).filter((asset): asset is NonNullable<typeof asset> => Boolean(asset));
    const synastry = Array.from({ length: 500 }, (_, index) => selectSynastryEditorialSticker({
      screenKey: 'compatibility',
      contentKey: `pair-${index}`,
      context: index % 2 ? 'love' : 'friendship',
      slot: index,
    })).filter((asset): asset is NonNullable<typeof asset> => Boolean(asset));

    expect(natal.length).toBeGreaterThan(0);
    expect(synastry.length).toBeGreaterThan(0);
    for (const asset of [...natal, ...synastry]) {
      expect(asset.path.startsWith(PERSONAL_PREFIX)).toBe(true);
      expect(asset.path.startsWith(LEGACY_PREFIX)).toBe(false);
      expect(asset.path.startsWith(REMOVED_NEWSPAPER_PREFIX)).toBe(false);
      expect(asset.hasEmbeddedText).toBe(false);
    }
  });

  it('lets zodiac select only explicitly approved legacy categories', () => {
    const approved = new Set(getZodiacLegacyAssetLibrary().map((asset) => asset.id));
    const selected = Array.from({ length: 2_000 }, (_, index) => selectZodiacLegacyAsset({
      sign: index % 2 ? 'aries' : 'libra',
      contentKey: `zodiac-${index}`,
      userId: `reader-${index}`,
    })).filter((asset): asset is NonNullable<typeof asset> => Boolean(asset));

    expect(selected.length).toBeGreaterThan(0);
    expect(selected.every((asset) => approved.has(asset.id))).toBe(true);
    expect(selected.every((asset) => (
      asset.category === 'psychedelic' || asset.category === 'funny-animal'
    ))).toBe(true);
    expect(selected.every((asset) => asset.path.startsWith(LEGACY_PREFIX))).toBe(true);
  });

  it('lists only existing files and leaves no restorable old manifest/catalog', () => {
    const assets = [
      ...getPersonalEditorialAssetLibrary(),
      ...getPersonalPaperTemplateLibrary(),
      ...getZodiacLegacyAssetLibrary(),
    ];
    expect(assets.every((asset) => fs.existsSync(publicPath(asset.path)))).toBe(true);
    expect(new Set(assets.map((asset) => asset.path)).size).toBe(assets.length);

    for (const oldPath of [
      'public/assets/forecast-feed/editorial-stickers',
      'public/foni',
      'lib/personalForecastVisuals/main.manifest.json',
      'lib/personalForecastVisuals/synastry.manifest.json',
      'lib/personalForecastVisuals/zodiac.manifest.json',
      'docs/design/newspaper-stickers/main-scenes.json',
      'docs/design/newspaper-stickers/psychedelic-humor-scenes.json',
      'docs/design/newspaper-stickers/synastry-scenes.json',
      'docs/design/newspaper-stickers/zodiac-scenes.json',
      'scripts/build-newspaper-manifests.mjs',
      'scripts/audit-newspaper-catalogs.mjs',
    ]) {
      expect(fs.existsSync(path.join(ROOT, oldPath))).toBe(false);
    }
  });
});
