export type EditorialTopic =
  | 'animals'
  | 'city'
  | 'daily_life'
  | 'food'
  | 'general'
  | 'home'
  | 'love'
  | 'mood'
  | 'home_family'
  | 'friends'
  | 'work_money'
  | 'opportunities'
  | 'decisions'
  | 'communication'
  | 'study'
  | 'learning'
  | 'creativity'
  | 'movement'
  | 'music'
  | 'nature'
  | 'rest'
  | 'sport'
  | 'moon'
  | 'mercury';

export type EditorialTone =
  | 'neutral'
  | 'quiet'
  | 'warm'
  | 'active'
  | 'tense'
  | 'strange'
  | 'calm'
  | 'cheerful'
  | 'lightly_sad'
  | 'playful';

export type EditorialOrientation = 'landscape' | 'portrait' | 'square';
export type DiaryVisualDisplayWeight = 'light' | 'medium' | 'hero';
export type DiaryVisualRarity = 'common' | 'occasional' | 'rare';
export type PersonalEditorialSource = 'editorial-v2' | 'cat' | 'capybara' | 'object';

export type EditorialAssetBase = {
  id: string;
  path: `/${string}.webp`;
  width: number;
  height: number;
  aspectRatio: number;
  orientation: EditorialOrientation;
};

export type PersonalEditorialAsset = EditorialAssetBase & {
  collection: 'personal-editorial';
  medium: 'illustrated-sticker';
  sourceId: string;
  source: PersonalEditorialSource;
  sourceCategory: string;
  topics: readonly EditorialTopic[];
  tone: EditorialTone;
  displayWeight: DiaryVisualDisplayWeight;
  sourceRarity: 'common' | 'uncommon' | 'rare';
  hasEmbeddedText: boolean;
  productionSelectable: boolean;
  reviewReason: string | null;
  bytes: number;
  sha256: string;
  slug: string;
  titleRu: string;
  shape: string;
  print: string;
  composition: string;
};

export const DIARY_VISUAL_FAMILY_WEIGHTS = {
  mascot: 30,
  object: 24,
  animal: 8,
  graphic: 24,
  surreal: 9,
  psychedelic: 5,
} as const;

export type DiaryVisualFamily = keyof typeof DIARY_VISUAL_FAMILY_WEIGHTS;

export type DiaryEligibleAsset = PersonalEditorialAsset & {
  diaryFamily: DiaryVisualFamily;
  selectionRarity: DiaryVisualRarity;
  familyWeight: number;
  /** @deprecated Use selectionRarity. */
  rarity: DiaryVisualRarity;
  /** @deprecated Use familyWeight. */
  visualWeight: number;
};

export type DiaryPaperTemplateAsset = EditorialAssetBase & {
  collection: 'personal-paper-template';
  sourceId: string;
  tone: EditorialTone;
  sourceRarity: 'common' | 'uncommon' | 'rare';
  selectionRarity: DiaryVisualRarity;
  displayWeight: DiaryVisualDisplayWeight;
  hasEmbeddedText: false;
  safeTextArea: readonly [number, number, number, number];
  paperTone: 'light' | 'dark';
  format: 'horizontal' | 'vertical';
  textLength: 'short' | 'medium';
  hasTape: boolean;
  hasClip: boolean;
  hasPin: boolean;
  canRotate: boolean;
  bytes: number;
  sha256: string;
};

export type EditorialStickerAsset = PersonalEditorialAsset;
