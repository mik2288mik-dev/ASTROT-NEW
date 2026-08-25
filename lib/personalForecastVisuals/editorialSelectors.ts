import { stableHash } from '../personalForecastContract';
import personalManifest from './personal.manifest.json';
import paperTemplateManifest from './paper-templates.manifest.json';
import {
  DIARY_VISUAL_FAMILY_WEIGHTS,
  type DiaryEligibleAsset,
  type DiaryPaperTemplateAsset,
  type DiaryVisualFamily,
  type DiaryVisualRarity,
  type EditorialTone,
  type EditorialTopic,
  type PersonalEditorialAsset,
  type PersonalEditorialSource,
} from './editorialTypes';

export const PERSONAL_VISUAL_MANIFEST_VERSION = 'personal-editorial-v1';

export const EDITORIAL_PLACEMENT_POLICY = {
  diary: { visiblePercent: 40, maxPauses: 2 },
  natal: { visiblePercent: 65 },
} as const;

const NATAL_EDITORIAL_VISUAL_VERSION = 'natal-personality-editorial-v2-v1';
const NATAL_EDITORIAL_SAFE_CATEGORIES = new Set([
  'animals',
  'graphic',
  'mascots',
  'objects',
  'surreal',
]);

type RawPersonalAsset = Omit<
  PersonalEditorialAsset,
  'topics' | 'sourceRarity' | 'slug' | 'titleRu' | 'shape' | 'print' | 'composition'
> & {
  topics: string[];
  rarity: 'common' | 'uncommon' | 'rare';
};

type RawPaperTemplate = Omit<DiaryPaperTemplateAsset, 'selectionRarity' | 'sourceRarity'> & {
  rarity: 'common' | 'uncommon' | 'rare';
  safeTextArea: number[];
};

const TOPICS_BY_SOURCE_TOPIC: Record<string, readonly EditorialTopic[]> = {
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

function normalizeTopics(topics: readonly string[]): readonly EditorialTopic[] {
  return [...new Set<EditorialTopic>([
    'general',
    ...topics.flatMap((topic) => TOPICS_BY_SOURCE_TOPIC[topic] || []),
  ])];
}

function selectionRarity(rarity: 'common' | 'uncommon' | 'rare'): DiaryVisualRarity {
  return rarity === 'uncommon' ? 'occasional' : rarity;
}

function familyFor(asset: RawPersonalAsset): DiaryVisualFamily {
  if (asset.source === 'cat' || asset.source === 'capybara' || asset.sourceCategory === 'mascots') {
    return 'mascot';
  }
  if (
    asset.source === 'object'
    || asset.sourceCategory === 'objects'
    || asset.sourceCategory === 'food_drink'
    || asset.sourceCategory === 'funny'
  ) {
    return 'object';
  }
  if (asset.sourceCategory === 'animals') return 'animal';
  if (asset.sourceCategory === 'surreal') return 'surreal';
  if (asset.sourceCategory === 'psychedelic') return 'psychedelic';
  return 'graphic';
}

function hydratePersonalAsset(raw: RawPersonalAsset): DiaryEligibleAsset {
  const diaryFamily = familyFor(raw);
  const rarity = selectionRarity(raw.rarity);
  return {
    ...raw,
    topics: normalizeTopics(raw.topics),
    sourceRarity: raw.rarity,
    slug: raw.sourceId,
    titleRu: raw.sourceId.replace(/[_-]/g, ' '),
    shape: 'free-cutout',
    print: 'transparent-webp',
    composition: raw.orientation === 'landscape'
      ? 'wide'
      : raw.sourceCategory === 'tape'
        ? 'strip'
        : 'single-object',
    diaryFamily,
    selectionRarity: rarity,
    familyWeight: DIARY_VISUAL_FAMILY_WEIGHTS[diaryFamily],
    rarity,
    visualWeight: DIARY_VISUAL_FAMILY_WEIGHTS[diaryFamily],
  };
}

function hydratePaperTemplate(raw: RawPaperTemplate): DiaryPaperTemplateAsset {
  if (raw.safeTextArea.length !== 4) {
    throw new Error(`PERSONAL_PAPER_TEMPLATE_INVALID:${raw.id}`);
  }
  return {
    ...raw,
    safeTextArea: raw.safeTextArea as [number, number, number, number],
    sourceRarity: raw.rarity,
    selectionRarity: selectionRarity(raw.rarity),
  };
}

const PERSONAL_ASSETS = Object.freeze(
  (personalManifest.items as RawPersonalAsset[])
    .map(hydratePersonalAsset)
    .sort((left, right) => left.id.localeCompare(right.id)),
);
const AUTO_SELECTABLE_PERSONAL_ASSETS = PERSONAL_ASSETS.filter((asset) => (
  asset.hasEmbeddedText === false && asset.productionSelectable
));
const NATAL_EDITORIAL_ASSETS = AUTO_SELECTABLE_PERSONAL_ASSETS.filter((asset) => (
  asset.source === 'editorial-v2'
  && NATAL_EDITORIAL_SAFE_CATEGORIES.has(asset.sourceCategory)
));
const PAPER_TEMPLATES = Object.freeze(
  (paperTemplateManifest.items as RawPaperTemplate[])
    .map(hydratePaperTemplate)
    .sort((left, right) => left.id.localeCompare(right.id)),
);

function pickStable<T extends { id: string }>(items: readonly T[], seed: string): T | null {
  if (!items.length) return null;
  const ordered = [...items].sort((left, right) => left.id.localeCompare(right.id));
  return ordered[stableHash(seed) % ordered.length] || null;
}

function isVisible(seed: string, visiblePercent: number): boolean {
  return stableHash(`${PERSONAL_VISUAL_MANIFEST_VERSION}|visible|${seed}`) % 100 < visiblePercent;
}

function filterPersonalPool(input: {
  topics?: readonly EditorialTopic[];
  allowedTones?: readonly EditorialTone[];
  allowedSources?: readonly PersonalEditorialSource[];
  allowedSourceCategories?: readonly string[];
  excludeIds?: readonly string[];
  excludeSourceCategories?: readonly string[];
  excludeSourceIdFragments?: readonly string[];
  requireTopicMatch?: boolean;
}): readonly DiaryEligibleAsset[] {
  const excluded = new Set(input.excludeIds || []);
  const allowedSources = new Set(input.allowedSources || []);
  const allowedSourceCategories = new Set(input.allowedSourceCategories || []);
  const excludedSourceCategories = new Set(input.excludeSourceCategories || []);
  const excludedSourceIdFragments = (input.excludeSourceIdFragments || [])
    .map((fragment) => fragment.toLowerCase());
  const base = AUTO_SELECTABLE_PERSONAL_ASSETS.filter((asset) => (
    !excluded.has(asset.id)
    && (!allowedSources.size || allowedSources.has(asset.source))
    && (!allowedSourceCategories.size || allowedSourceCategories.has(asset.sourceCategory))
    && !excludedSourceCategories.has(asset.sourceCategory)
    && !excludedSourceIdFragments.some((fragment) => asset.sourceId.toLowerCase().includes(fragment))
  ));
  const topics = input.topics?.length
    ? base.filter((asset) => asset.topics.some((topic) => input.topics!.includes(topic)))
    : base;
  if (input.requireTopicMatch && input.topics?.length && !topics.length) return [];
  const tones = input.allowedTones?.length
    ? topics.filter((asset) => input.allowedTones!.includes(asset.tone))
    : topics;
  return tones.length ? tones : topics.length ? topics : base;
}

export function selectPersonalEditorialAsset(input: {
  period: 'day' | 'week' | 'month';
  periodKey: string;
  userId?: string | null;
  topics?: readonly EditorialTopic[];
  allowedTones?: readonly EditorialTone[];
  allowedSources?: readonly PersonalEditorialSource[];
  allowedSourceCategories?: readonly string[];
  excludeIds?: readonly string[];
  excludeSourceCategories?: readonly string[];
  excludeSourceIdFragments?: readonly string[];
  requireTopicMatch?: boolean;
  slot?: number;
  forceVisible?: boolean;
}): DiaryEligibleAsset | null {
  const seed = [
    input.period,
    input.periodKey,
    input.userId || 'guest',
    String(input.slot ?? 0),
  ].join('|');
  if (!input.forceVisible && !isVisible(seed, EDITORIAL_PLACEMENT_POLICY.diary.visiblePercent)) {
    return null;
  }
  return pickStable(
    filterPersonalPool(input),
    `${PERSONAL_VISUAL_MANIFEST_VERSION}|personal|${seed}`,
  );
}

export function selectNatalEditorialSticker(input: {
  chartKey: string;
  userId?: string | null;
}): PersonalEditorialAsset | null {
  const seed = [input.chartKey, input.userId || 'guest'].join('|');
  const visibilityBucket = stableHash([
    NATAL_EDITORIAL_VISUAL_VERSION,
    'eligibility',
    seed,
  ].join('|')) % 100;
  if (visibilityBucket >= EDITORIAL_PLACEMENT_POLICY.natal.visiblePercent) return null;
  return pickStable(NATAL_EDITORIAL_ASSETS, [
    NATAL_EDITORIAL_VISUAL_VERSION,
    seed,
  ].join('|'));
}

export function selectSynastryEditorialSticker(input: {
  screenKey: string;
  contentKey: string;
  context: 'love' | 'friendship' | 'family' | 'work';
  dynamic?: string | null;
  dynamics?: readonly string[];
  userId?: string | null;
  slot?: number;
  excludeIds?: readonly string[];
}): PersonalEditorialAsset | null {
  const topicsByContext: Record<typeof input.context, readonly EditorialTopic[]> = {
    love: ['love'],
    friendship: ['friends'],
    family: ['home_family'],
    work: ['work_money'],
  };
  const seed = [
    'synastry',
    input.screenKey,
    input.contentKey,
    input.context,
    [...(input.dynamics || (input.dynamic ? [input.dynamic] : []))].sort().join(','),
    input.userId || 'guest',
    String(input.slot ?? 0),
  ].join('|');
  return pickStable(
    filterPersonalPool({
      topics: topicsByContext[input.context],
      excludeIds: input.excludeIds,
    }),
    `${PERSONAL_VISUAL_MANIFEST_VERSION}|${seed}`,
  );
}

export function getPersonalEditorialAssetLibrary(): readonly DiaryEligibleAsset[] {
  return PERSONAL_ASSETS;
}

export function getPersonalAutoSelectableAssetLibrary(): readonly DiaryEligibleAsset[] {
  return AUTO_SELECTABLE_PERSONAL_ASSETS;
}

export function getPersonalPaperTemplateLibrary(): readonly DiaryPaperTemplateAsset[] {
  return PAPER_TEMPLATES;
}
