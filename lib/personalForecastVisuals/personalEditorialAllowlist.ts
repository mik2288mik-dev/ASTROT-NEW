import {
  getPersonalAutoSelectableAssetLibrary,
  getPersonalPaperTemplateLibrary,
} from './editorialSelectors';
import type {
  DiaryEligibleAsset,
  DiaryPaperTemplateAsset,
} from './editorialTypes';

export function getPersonalForecastEditorialVisualLibrary(): readonly DiaryEligibleAsset[] {
  return getPersonalAutoSelectableAssetLibrary();
}

export function getPersonalForecastPaperTemplateLibrary(): readonly DiaryPaperTemplateAsset[] {
  return getPersonalPaperTemplateLibrary();
}

export function isPersonalForecastEditorialAsset(
  asset: DiaryEligibleAsset,
): boolean {
  return getPersonalAutoSelectableAssetLibrary().some((candidate) => candidate.id === asset.id);
}
