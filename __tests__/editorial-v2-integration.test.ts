import fs from 'fs';
import path from 'path';
import editorialV2Manifest from '../lib/personalForecastVisuals/editorial-v2-source.manifest.json';
import {
  getPersonalEditorialAssetLibrary,
  getPersonalPaperTemplateLibrary,
  resolveDiaryTodayVisualPlan,
} from '../lib/personalForecastVisuals';

const ROOT = path.resolve(__dirname, '..');
const BRAND_REVIEW_IDS = new Set([
  'object_camera_retro_black_silver_01',
  'object_camera_retro_silver_01',
  'object_instant_camera_retro_sunset_01',
  'object_laptop_dream_job_notes_01',
  'object_laptop_silver_01',
  'object_sneaker_white_single_01',
  'object_sneakers_gray_pair_01',
]);

function dateKey(dayOffset: number): string {
  const date = new Date(Date.UTC(2026, 0, 1 + dayOffset));
  return date.toISOString().slice(0, 10);
}

describe('editorial-v2 Today integration', () => {
  it('keeps all files but marks exactly seven brand-review assets non-selectable', () => {
    expect(editorialV2Manifest.assets).toHaveLength(221);
    for (const asset of editorialV2Manifest.assets) {
      const expectedRoot = asset.category === 'paper_templates'
        ? '/assets/personal-paper-templates/'
        : '/assets/personal-editorial/editorial-v2/';
      expect(asset.path).toBe(`${expectedRoot}${asset.id}.webp`);
      expect(asset.aspectRatio).toBeCloseTo(asset.width / asset.height, 4);
      if (asset.orientation === 'portrait') expect(asset.aspectRatio).toBeLessThan(0.85);
      if (asset.orientation === 'square') {
        expect(asset.aspectRatio).toBeGreaterThanOrEqual(0.85);
        expect(asset.aspectRatio).toBeLessThanOrEqual(1.18);
      }
      if (asset.orientation === 'landscape') expect(asset.aspectRatio).toBeGreaterThan(1.18);
      expect(fs.existsSync(path.join(ROOT, 'public', asset.path.replace(/^\//, '')))).toBe(true);
    }
    const excluded = editorialV2Manifest.assets.filter(
      (asset) => asset.productionSelectable === false,
    );
    expect(new Set(excluded.map((asset) => asset.id))).toEqual(BRAND_REVIEW_IDS);
    expect(excluded.every((asset) => asset.reviewReason === 'brand_like_marks')).toBe(true);
    for (const asset of excluded) {
      expect(fs.existsSync(path.join(ROOT, 'public', asset.path.replace(/^\//, '')))).toBe(true);
    }
  });

  it('publishes the 309 personal assets and 19 separate runtime note templates', () => {
    const personalLibrary = getPersonalEditorialAssetLibrary();
    const templates = getPersonalPaperTemplateLibrary();
    const editorialV2Assets = personalLibrary.filter((asset) => asset.source === 'editorial-v2');

    expect(personalLibrary).toHaveLength(309);
    expect(templates).toHaveLength(19);
    expect(editorialV2Assets).toHaveLength(202);
    expect(personalLibrary.filter((asset) => asset.source === 'cat')).toHaveLength(45);
    expect(personalLibrary.filter((asset) => asset.source === 'capybara')).toHaveLength(38);
    expect(personalLibrary.filter((asset) => asset.source === 'object')).toHaveLength(24);
    expect(editorialV2Assets.every((asset) => (
      asset.collection === 'personal-editorial'
      && ['light', 'medium', 'hero'].includes(asset.displayWeight)
      && ['common', 'occasional', 'rare'].includes(asset.rarity)
      && fs.existsSync(path.join(ROOT, 'public', asset.path.replace(/^\//, '')))
    ))).toBe(true);
    expect(personalLibrary.filter((asset) => asset.hasEmbeddedText)).toHaveLength(54);
    expect(new Set(personalLibrary.filter(
      (asset) => asset.productionSelectable === false,
    ).map((asset) => asset.sourceId))).toEqual(BRAND_REVIEW_IDS);
    expect(templates.every((template) => (
      template.hasEmbeddedText === false
      && template.safeTextArea.length === 4
      && template.safeTextArea[0] < template.safeTextArea[2]
      && template.safeTextArea[1] < template.safeTextArea[3]
    ))).toBe(true);
  });

  it('keeps layout-compatible assets and deterministic adjacent-day rotation', () => {
    const plans = Array.from({ length: 365 }, (_, day) => resolveDiaryTodayVisualPlan({
      userId: 'editorial-v2-reader',
      periodKey: dateKey(day),
      contractVersion: 'contract-editorial-v2',
    }));
    expect(resolveDiaryTodayVisualPlan({
      userId: 'editorial-v2-reader',
      periodKey: dateKey(42),
      contractVersion: 'contract-editorial-v2',
    })).toEqual(plans[42]);
    expect(plans.some((plan) => plan.asset?.source === 'editorial-v2')).toBe(true);

    for (let day = 0; day < plans.length; day += 1) {
      const plan = plans[day];
      expect(plan.paperTemplate).not.toBeNull();
      expect(plan.asset).not.toBeNull();
      if (plan.layout === 'editorial_left' || plan.layout === 'editorial_right') {
        expect(plan.asset?.orientation).not.toBe('landscape');
        expect(plan.asset?.displayWeight).not.toBe('hero');
      }
      if (day > 0) {
        expect(plan.paperTemplate?.id).not.toBe(plans[day - 1].paperTemplate?.id);
        if (plan.asset && plans[day - 1].asset) {
          expect(plan.asset.id).not.toBe(plans[day - 1].asset?.id);
        }
      }
    }
  });

  it('keeps embedded-copy assets in the library but out of generic automatic selection', () => {
    const embeddedCopyAssets = getPersonalEditorialAssetLibrary().filter(
      (asset) => asset.hasEmbeddedText,
    );
    const plans = Array.from({ length: 365 }, (_, day) => resolveDiaryTodayVisualPlan({
      userId: 'editorial-v2-reader-without-copy-metadata',
      periodKey: dateKey(day),
      contractVersion: 'contract-editorial-v2',
    }));

    expect(embeddedCopyAssets).toHaveLength(54);
    expect(plans.some((plan) => plan.asset?.source === 'editorial-v2')).toBe(true);
    expect(plans.every((plan) => (
      !plan.asset
      || (plan.asset.hasEmbeddedText === false && plan.asset.productionSelectable === true)
    ))).toBe(true);
  });

  it('renders live note text within manifest safe-area coordinates', () => {
    const component = fs.readFileSync(path.join(
      ROOT,
      'components/PersonalForecastFeed/EditorialPaperNote.tsx',
    ), 'utf8');
    const styles = fs.readFileSync(path.join(ROOT, 'styles/personalForecastFeed.css'), 'utf8');
    expect(component).toContain('template?: DiaryPaperTemplateAsset | null');
    expect(component).toContain('<img');
    expect(component).toContain('<p>{text}</p>');
    expect(component).toContain("'--paper-note-safe-left'");
    expect(styles).toContain('var(--paper-note-safe-left)');
    expect(component).toContain('data-paper-tone={template?.paperTone}');
    expect(styles).toContain("[data-paper-tone='dark']");
    expect(component).not.toContain('dangerouslySetInnerHTML');
  });
});
