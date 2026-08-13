import {
  getDiaryEditorialStickerLibrary,
  getDiaryPaperTemplateLibrary,
  getDiaryTodayVisualLibrary,
} from './editorialSelectors';
import type {
  DiaryEligibleAsset,
  DiaryPaperTemplateAsset,
  EditorialV2VisualAsset,
} from './editorialTypes';

function isPersonalMascotOrObject(asset: DiaryEligibleAsset): boolean {
  if (asset.collection === 'diary-object') return true;
  return asset.collection === 'diary-mascot' && /^(?:cat|capy)_/u.test(asset.slug);
}

function isApprovedEditorialV2Asset(
  asset: DiaryEligibleAsset,
): asset is EditorialV2VisualAsset & DiaryEligibleAsset {
  return asset.collection === 'editorial-v2'
    && asset.hasEmbeddedText === false
    && asset.sourceCategory !== 'fixed_text'
    && asset.sourceCategory !== 'newspaper';
}

const PERSONAL_FORECAST_EDITORIAL_ASSETS = Object.freeze([
  ...getDiaryEditorialStickerLibrary().filter(isPersonalMascotOrObject),
  ...getDiaryTodayVisualLibrary().filter(isApprovedEditorialV2Asset),
]);

const PERSONAL_FORECAST_PAPER_TEMPLATES = Object.freeze(
  getDiaryPaperTemplateLibrary().filter((template) => (
    template.hasEmbeddedText === false
    && template.path.startsWith('/stickers/editorial-v2/paper_templates/')
  )),
);

export function getPersonalForecastEditorialVisualLibrary(): readonly DiaryEligibleAsset[] {
  return PERSONAL_FORECAST_EDITORIAL_ASSETS;
}

export function getPersonalForecastPaperTemplateLibrary(): readonly DiaryPaperTemplateAsset[] {
  return PERSONAL_FORECAST_PAPER_TEMPLATES;
}

export function isPersonalForecastEditorialAsset(
  asset: DiaryEligibleAsset,
): boolean {
  return PERSONAL_FORECAST_EDITORIAL_ASSETS.some((candidate) => candidate.id === asset.id);
}
