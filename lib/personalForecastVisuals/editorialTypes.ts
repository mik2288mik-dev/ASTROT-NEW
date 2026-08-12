export type EditorialMedium =
  | 'photo'
  | 'associative'
  | 'surreal'
  | 'graphic'
  | 'psychedelic-humor';

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

export type EditorialAssetBase = {
  id: string;
  path:
    | `/assets/forecast-feed/editorial-stickers/${string}.webp`
    | `/stickers/${string}.webp`;
  width: number;
  height: number;
  orientation: EditorialOrientation;
  slug: string;
  titleRu: string;
  shape: string;
  print: string;
  composition: string;
};

export type DiaryEditorialAsset = EditorialAssetBase & {
  collection: 'diary-mascot' | 'diary-object';
  medium: 'illustrated-sticker';
  topics: readonly EditorialTopic[];
  tone: EditorialTone;
};

export type MainEditorialAsset = EditorialAssetBase & {
  collection: 'main';
  medium: EditorialMedium;
  topics: readonly EditorialTopic[];
  tone: EditorialTone;
};

export type EditorialV2Category =
  | 'animals'
  | 'clips_pins'
  | 'doodles'
  | 'fixed_text'
  | 'food_drink'
  | 'funny'
  | 'graphic'
  | 'mascots'
  | 'newspaper'
  | 'objects'
  | 'psychedelic'
  | 'surreal'
  | 'tape';

export type EditorialV2VisualAsset = EditorialAssetBase & {
  collection: 'editorial-v2';
  medium: 'illustrated-sticker';
  topics: readonly EditorialTopic[];
  tone: EditorialTone;
  sourceId: string;
  sourceCategory: EditorialV2Category;
  aspectRatio: number;
  hasEmbeddedText: boolean;
  sourceRarity: 'common' | 'uncommon' | 'rare';
  displayWeight: DiaryVisualDisplayWeight;
};

export type DiaryPaperTemplateAsset = {
  id: string;
  sourceId: string;
  path: `/stickers/editorial-v2/paper_templates/${string}.webp`;
  width: number;
  height: number;
  aspectRatio: number;
  orientation: EditorialOrientation;
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
};

export type SynastryEditorialAsset = EditorialAssetBase & {
  collection: 'synastry';
  contexts: readonly ('love' | 'friendship' | 'family' | 'work')[];
  dynamics: readonly string[];
  tone: string;
};

export type ZodiacEditorialAsset = EditorialAssetBase & {
  collection: 'zodiac';
  sign: string;
  character: readonly string[];
  tone: string;
};

export type EditorialStickerAsset =
  | DiaryEditorialAsset
  | MainEditorialAsset
  | EditorialV2VisualAsset
  | SynastryEditorialAsset
  | ZodiacEditorialAsset;

export const DIARY_VISUAL_FAMILY_WEIGHTS = {
  mascot: 22,
  object: 16,
  animal: 12,
  editorial: 20,
  graphic: 10,
  associative: 10,
  surreal: 7,
  'psychedelic-humor': 3,
} as const;

export type DiaryVisualFamily = keyof typeof DIARY_VISUAL_FAMILY_WEIGHTS;
export type DiaryVisualRarity = 'common' | 'occasional' | 'rare';

/**
 * The complete app-approved visual universe eligible for Diary/Today. The
 * source asset keeps its editorial metadata; these three fields describe how
 * often and in which visual lane it participates in Today.
 */
export type DiaryEligibleAsset = (
  DiaryEditorialAsset | MainEditorialAsset | EditorialV2VisualAsset
) & {
  diaryFamily: DiaryVisualFamily;
  selectionRarity: DiaryVisualRarity;
  familyWeight: number;
  displayWeight: DiaryVisualDisplayWeight;
  /** @deprecated Use selectionRarity. */
  rarity: DiaryVisualRarity;
  /** @deprecated Use familyWeight. */
  visualWeight: number;
};
