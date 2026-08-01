export type EditorialMedium =
  | 'photo'
  | 'associative'
  | 'surreal'
  | 'graphic'
  | 'psychedelic-humor';

export type EditorialTopic =
  | 'general'
  | 'love'
  | 'mood'
  | 'home_family'
  | 'friends'
  | 'work_money'
  | 'opportunities'
  | 'decisions'
  | 'communication'
  | 'study'
  | 'creativity'
  | 'movement'
  | 'rest'
  | 'moon'
  | 'mercury';

export type EditorialTone = 'neutral' | 'quiet' | 'warm' | 'active' | 'tense' | 'strange';
export type EditorialOrientation = 'landscape' | 'portrait' | 'square';

export type EditorialAssetBase = {
  id: string;
  path: `/assets/forecast-feed/editorial-stickers/${string}.webp`;
  width: number;
  height: number;
  orientation: EditorialOrientation;
  slug: string;
  titleRu: string;
  shape: string;
  print: string;
  composition: string;
};

export type MainEditorialAsset = EditorialAssetBase & {
  collection: 'main';
  medium: EditorialMedium;
  topics: readonly EditorialTopic[];
  tone: EditorialTone;
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
  | MainEditorialAsset
  | SynastryEditorialAsset
  | ZodiacEditorialAsset;
