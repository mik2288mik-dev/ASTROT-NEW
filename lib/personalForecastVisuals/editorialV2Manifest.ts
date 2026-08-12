import editorialV2Manifest from '../../public/stickers/editorial-v2/manifest.json';
import {
  DIARY_VISUAL_FAMILY_WEIGHTS,
  type DiaryEligibleAsset,
  type DiaryPaperTemplateAsset,
  type DiaryVisualFamily,
  type DiaryVisualRarity,
  type DiaryVisualDisplayWeight,
  type EditorialOrientation,
  type EditorialTone,
  type EditorialTopic,
  type EditorialV2Category,
  type EditorialV2VisualAsset,
} from './editorialTypes';

type EditorialV2ManifestRarity = 'common' | 'uncommon' | 'rare';
type EditorialV2ManifestCategory = EditorialV2Category | 'paper_templates';

type RawEditorialV2Asset = {
  id: string;
  path: string;
  category: EditorialV2ManifestCategory;
  width: number;
  height: number;
  aspectRatio: number;
  orientation: EditorialOrientation;
  tone: EditorialTone;
  topics: string[];
  visualWeight: DiaryVisualDisplayWeight;
  rarity: EditorialV2ManifestRarity;
  hasEmbeddedText: boolean;
  productionSelectable?: boolean;
  reviewReason?: string;
  paperTemplate?: {
    safeTextArea: number[];
    paperTone: 'light' | 'dark';
    format: 'horizontal' | 'vertical';
    textLength: 'short' | 'medium';
    hasTape: boolean;
    hasClip: boolean;
    hasPin: boolean;
    canRotate: boolean;
  };
};

const RAW_ASSETS = editorialV2Manifest.assets as RawEditorialV2Asset[];

const TOPICS_BY_MANIFEST_TOPIC: Record<string, readonly EditorialTopic[]> = {
  balance: ['decisions', 'mood'],
  calm: ['mood', 'rest'],
  celebration: ['mood', 'friends'],
  coffee: ['food', 'rest'],
  confidence: ['mood', 'opportunities'],
  creativity: ['creativity'],
  drink: ['food'],
  energy: ['mood', 'movement'],
  food: ['food'],
  friendship: ['friends'],
  games: ['friends', 'rest'],
  home: ['home'],
  luck: ['opportunities'],
  movement: ['movement'],
  music: ['music'],
  pause: ['rest'],
  relationships: ['love', 'friends'],
  rest: ['rest'],
  sleep: ['rest'],
  study: ['study', 'learning'],
  travel: ['movement', 'opportunities'],
  work: ['work_money'],
};

function selectionRarity(rarity: EditorialV2ManifestRarity): DiaryVisualRarity {
  return rarity === 'uncommon' ? 'occasional' : rarity;
}

function topicsFor(rawTopics: readonly string[]): readonly EditorialTopic[] {
  return [...new Set<EditorialTopic>([
    'general',
    ...rawTopics.flatMap((topic) => TOPICS_BY_MANIFEST_TOPIC[topic] || []),
  ])];
}

function familyFor(category: EditorialV2Category): DiaryVisualFamily {
  if (category === 'mascots') return 'mascot';
  if (category === 'objects' || category === 'food_drink' || category === 'funny') {
    return 'object';
  }
  if (category === 'animals') return 'animal';
  if (category === 'surreal') return 'surreal';
  if (category === 'psychedelic') return 'psychedelic-humor';
  return 'graphic';
}

function visualAsset(raw: RawEditorialV2Asset): DiaryEligibleAsset {
  const category = raw.category as EditorialV2Category;
  const diaryFamily = familyFor(category);
  const normalizedRarity = selectionRarity(raw.rarity);
  const asset: EditorialV2VisualAsset = {
    id: `editorial-v2:${raw.id}`,
    sourceId: raw.id,
    path: raw.path as EditorialV2VisualAsset['path'],
    width: raw.width,
    height: raw.height,
    aspectRatio: raw.aspectRatio,
    orientation: raw.orientation,
    slug: raw.id,
    titleRu: raw.id.replace(/_/g, ' '),
    shape: 'free-cutout',
    print: 'transparent-webp',
    composition: raw.orientation === 'landscape'
      ? 'wide'
      : category === 'tape'
        ? 'strip'
        : 'single-object',
    collection: 'editorial-v2',
    medium: 'illustrated-sticker',
    topics: topicsFor(raw.topics),
    tone: raw.tone,
    sourceCategory: category,
    hasEmbeddedText: raw.hasEmbeddedText,
    sourceRarity: raw.rarity,
    displayWeight: raw.visualWeight,
  };
  return {
    ...asset,
    diaryFamily,
    selectionRarity: normalizedRarity,
    familyWeight: DIARY_VISUAL_FAMILY_WEIGHTS[diaryFamily],
    displayWeight: raw.visualWeight,
    rarity: normalizedRarity,
    visualWeight: DIARY_VISUAL_FAMILY_WEIGHTS[diaryFamily],
  };
}

function paperTemplate(raw: RawEditorialV2Asset): DiaryPaperTemplateAsset {
  const metadata = raw.paperTemplate;
  if (!metadata || metadata.safeTextArea.length !== 4) {
    throw new Error(`EDITORIAL_V2_PAPER_TEMPLATE_INVALID:${raw.id}`);
  }
  return {
    id: `editorial-v2-paper:${raw.id}`,
    sourceId: raw.id,
    path: raw.path as DiaryPaperTemplateAsset['path'],
    width: raw.width,
    height: raw.height,
    aspectRatio: raw.aspectRatio,
    orientation: raw.orientation,
    tone: raw.tone,
    sourceRarity: raw.rarity,
    selectionRarity: selectionRarity(raw.rarity),
    displayWeight: raw.visualWeight,
    hasEmbeddedText: false,
    safeTextArea: metadata.safeTextArea as [number, number, number, number],
    paperTone: metadata.paperTone,
    format: metadata.format,
    textLength: metadata.textLength,
    hasTape: metadata.hasTape,
    hasClip: metadata.hasClip,
    hasPin: metadata.hasPin,
    canRotate: metadata.canRotate,
  };
}

const SELECTABLE_ASSETS = RAW_ASSETS.filter((asset) => asset.productionSelectable !== false);

export const EDITORIAL_V2_REVIEW_EXCLUDED_IDS = RAW_ASSETS
  .filter((asset) => asset.productionSelectable === false)
  .map((asset) => asset.id)
  .sort();

export const EDITORIAL_V2_TODAY_ASSETS: readonly DiaryEligibleAsset[] = SELECTABLE_ASSETS
  .filter((asset) => asset.category !== 'paper_templates')
  .map(visualAsset);

export const EDITORIAL_V2_PAPER_TEMPLATES: readonly DiaryPaperTemplateAsset[] = SELECTABLE_ASSETS
  .filter((asset) => asset.category === 'paper_templates')
  .map(paperTemplate);
