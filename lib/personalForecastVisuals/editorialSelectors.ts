import { stableHash } from '../personalForecastContract';
import mainManifest from './main.manifest.json';
import synastryManifest from './synastry.manifest.json';
import zodiacManifest from './zodiac.manifest.json';
import type {
  EditorialMedium,
  EditorialTone,
  EditorialTopic,
  DiaryEditorialAsset,
  DiaryEligibleAsset,
  DiaryVisualFamily,
  DiaryVisualRarity,
  MainEditorialAsset,
  SynastryEditorialAsset,
  ZodiacEditorialAsset,
} from './editorialTypes';
import { DIARY_VISUAL_FAMILY_WEIGHTS } from './editorialTypes';
import {
  EDITORIAL_V2_PAPER_TEMPLATES,
  EDITORIAL_V2_REVIEW_EXCLUDED_IDS,
  EDITORIAL_V2_TODAY_ASSETS,
} from './editorialV2Manifest';

export const NEWSPAPER_VISUAL_MANIFEST_VERSION = 'newspaper-v4-diary-universe';

export const EDITORIAL_PLACEMENT_POLICY = {
  diary: { visiblePercent: 40, maxPauses: 2 },
  zodiac: { visiblePercent: 60 },
  natal: { visiblePercent: 65, psychedelicPercentOfVisible: 1 },
  synastry: { psychedelicAllowed: false },
} as const;

const MAIN_ASSETS = mainManifest.items as MainEditorialAsset[];
const SYNASTRY_ASSETS = synastryManifest.items as SynastryEditorialAsset[];
const ZODIAC_ASSETS = zodiacManifest.items as ZodiacEditorialAsset[];

const DIARY_MASCOT_SLUGS = `
capy_flashlight_stand_thinking capy_mug_sit_calm capy_flashlight_run_thinking
capy_lights_stand_happy capy_flashlight_point_thinking capy_key_stand_calm
capy_flashlight_peek_thinking capy_key_sit_calm capy_compass_stand_happy
capy_key_pawup_calm capy_compass_run_happy capy_hoodie_wave_calm
capy_compass_run_calm capy_coffee_sit_chill capy_hoodie_peek_happy
capy_coffee_sit_calm capy_hoodie_peek_chill capy_cocoa_sit_calm
capy_hoodie_peek_calm capy_calendar_run_happy capy_gift_sit_hype
capy_bubbletea_sit_calm capy_gamepad_sit_hype capy_book_sit_calm
capy_gamepad_sit_cheer capy_basketball_point_chill capy_gamepad_peek_hype
capy_gamepad_pawup_hype capy_flowers_stand_calm capy_flask_sit_calm
capy_thermos_sit_calm capy_tablet_stand_thinking capy_tablet_sit_thinking
capy_tablet_sit_calm capy_tablet_peek_thinking cat_clipboard_stand_thinking
cat_clipboard_stand_calm cat_bottle_peek_surprise cat_beanie_wave_hype
cat_console_sit_hype cat_coffee_sit_calm cat_cookie_pawup_hype
cat_cookie_point_hype cat_umbrella_run_happy cat_umbrella_pawup_happy
cat_skate_pawup_hype cat_present_stand_hype cat_plant_pawup_hype
cat_plant_pawup_happy cat_planner_sit_calm cat_phone_wave_happy
cat_phone_peek_calm cat_phone_pawup_happy cat_notebook_sit_calm
cat_notebook_peek_thinking cat_notebook_peek_calm cat_letter_stand_happy
cat_laptop_sit_calm cat_laptop_point_hype cat_lantern_stand_happy
cat_lantern_pawup_calm cat_key_stand_calm cat_hoodie_wave_hype
cat_hoodie_peek_surprise cat_hoodie_peek_hype cat_hoodie_peek_happy
cat_hoodie_peek_chill cat_hoodie_peek_calm cat_hoodie_pawup_happy
cat_heart_stand_happy cat_heart_sit_happy cat_gift_stand_hype
cat_gift_stand_happy cat_gift_stand_calm cat_gift_peek_hype
cat_gift_peek_happy cat_giftbox_stand_hype cat_gameboy_sit_hype
cat_duck_stand_happy cat_duck_run_happy capy_stopwatch_run_hype
capy_plant_stand_calm capy_palette_stand_thinking
`.trim().split(/\s+/);

const DIARY_OBJECT_SLUGS = `
watch tote thermos_pink thermos_green tablet sunglasses sneakers plant phone pen
notebook laptop lamp keychain keyboard headphones_purple headphones_black hairbrush
glasses gamepad coffee candle camera alarmclock
`.trim().split(/\s+/);

const DIARY_TOPIC_TOKENS: ReadonlyArray<{
  topic: EditorialTopic;
  tokens: readonly string[];
}> = [
  { topic: 'love', tokens: ['heart', 'gift', 'giftbox', 'present', 'flowers'] },
  { topic: 'friends', tokens: ['bubbletea', 'coffee', 'cocoa', 'mug', 'duck', 'gamepad', 'gameboy', 'console'] },
  { topic: 'home_family', tokens: ['plant', 'candle', 'lamp', 'thermos', 'tote'] },
  { topic: 'work_money', tokens: ['laptop', 'keyboard', 'clipboard', 'planner', 'notebook', 'pen', 'tablet', 'watch', 'calendar'] },
  { topic: 'communication', tokens: ['phone', 'letter', 'camera', 'headphones', 'glasses'] },
  { topic: 'decisions', tokens: ['key', 'keychain', 'compass', 'flashlight', 'lantern'] },
  { topic: 'opportunities', tokens: ['calendar', 'alarmclock', 'stopwatch', 'compass'] },
  { topic: 'study', tokens: ['book', 'notebook', 'pen', 'flask', 'tablet'] },
  { topic: 'creativity', tokens: ['palette', 'camera'] },
  { topic: 'movement', tokens: ['basketball', 'skate', 'sneakers', 'umbrella', 'run'] },
  { topic: 'rest', tokens: ['coffee', 'cocoa', 'mug', 'book', 'candle', 'hoodie', 'hairbrush'] },
  { topic: 'mood', tokens: ['happy', 'calm', 'chill', 'hype', 'cheer', 'surprise', 'thinking'] },
];

function diaryTopics(slug: string): readonly EditorialTopic[] {
  return [
    'general' as const,
    ...DIARY_TOPIC_TOKENS
      .filter(({ tokens }) => tokens.some((token) => slug.includes(token)))
      .map(({ topic }) => topic),
  ];
}

function diaryTone(slug: string): EditorialTone {
  if (/(?:thinking|surprise|flashlight|compass|key)/.test(slug)) return 'strange';
  if (/(?:hype|cheer|run|basketball|skate|sneakers|stopwatch)/.test(slug)) return 'active';
  if (/(?:happy|gift|heart|flowers|present|duck)/.test(slug)) return 'warm';
  if (/(?:calm|chill|coffee|cocoa|mug|book|plant|candle)/.test(slug)) return 'quiet';
  return 'neutral';
}

function diaryAsset(
  slug: string,
  collection: DiaryEditorialAsset['collection'],
): DiaryEditorialAsset {
  const object = collection === 'diary-object';
  return {
    id: `${collection}:${slug}`,
    path: object ? `/stickers/objects/${slug}.webp` : `/stickers/${slug}.webp`,
    width: 1254,
    height: 1254,
    orientation: 'square',
    slug,
    titleRu: slug.replace(/_/g, ' '),
    shape: 'free-cutout',
    print: 'transparent-webp',
    composition: object ? 'single-object' : 'single-character',
    collection,
    medium: 'illustrated-sticker',
    topics: diaryTopics(slug),
    tone: diaryTone(slug),
  };
}

const DIARY_MASCOT_ASSETS = DIARY_MASCOT_SLUGS.map((slug) => (
  diaryAsset(slug, 'diary-mascot')
));
const DIARY_OBJECT_ASSETS = DIARY_OBJECT_SLUGS.map((slug) => (
  diaryAsset(slug, 'diary-object')
));
const DIARY_ASSETS: readonly DiaryEditorialAsset[] = [
  ...DIARY_MASCOT_ASSETS,
  ...DIARY_OBJECT_ASSETS,
];

const DIARY_VISUAL_FAMILY_ORDER = Object.keys(
  DIARY_VISUAL_FAMILY_WEIGHTS,
) as DiaryVisualFamily[];

function diaryVisualFamily(
  asset: DiaryEditorialAsset | MainEditorialAsset,
): DiaryVisualFamily {
  if (asset.collection === 'diary-mascot') return 'mascot';
  if (asset.collection === 'diary-object') return 'object';
  if (asset.medium === 'psychedelic-humor') return 'psychedelic-humor';
  if (asset.medium === 'photo' && asset.topics.includes('animals')) return 'animal';
  if (asset.medium === 'photo') return 'editorial';
  if (
    asset.medium === 'associative'
    || asset.medium === 'surreal'
    || asset.medium === 'graphic'
  ) {
    return asset.medium;
  }
  return 'editorial';
}

function diaryVisualRarity(family: DiaryVisualFamily): DiaryVisualRarity {
  if (family === 'psychedelic-humor') return 'rare';
  if (family === 'associative' || family === 'surreal') return 'occasional';
  return 'common';
}

function withDiaryEligibility(
  asset: DiaryEditorialAsset | MainEditorialAsset,
): DiaryEligibleAsset {
  const family = diaryVisualFamily(asset);
  return {
    ...asset,
    diaryFamily: family,
    selectionRarity: diaryVisualRarity(family),
    familyWeight: DIARY_VISUAL_FAMILY_WEIGHTS[family],
    displayWeight: 'medium',
    rarity: diaryVisualRarity(family),
    visualWeight: DIARY_VISUAL_FAMILY_WEIGHTS[family],
  };
}

const DIARY_ELIGIBLE_ASSETS: readonly DiaryEligibleAsset[] = [
  ...DIARY_ASSETS,
  ...MAIN_ASSETS,
].map(withDiaryEligibility);

const DIARY_TODAY_VISUAL_ASSETS: readonly DiaryEligibleAsset[] = [
  ...DIARY_ELIGIBLE_ASSETS,
  ...EDITORIAL_V2_TODAY_ASSETS,
];

const MEDIUM_CYCLE: readonly EditorialMedium[] = [
  'photo', 'photo', 'photo', 'photo', 'photo', 'photo', 'photo', 'photo', 'photo',
  'associative', 'associative', 'associative', 'associative', 'associative', 'associative', 'associative',
  'surreal', 'surreal', 'surreal',
  'graphic',
  'psychedelic-humor', 'psychedelic-humor', 'psychedelic-humor', 'psychedelic-humor',
  'psychedelic-humor', 'psychedelic-humor', 'psychedelic-humor', 'psychedelic-humor',
  'psychedelic-humor', 'psychedelic-humor', 'psychedelic-humor', 'psychedelic-humor',
  'psychedelic-humor', 'psychedelic-humor', 'psychedelic-humor', 'psychedelic-humor',
  'psychedelic-humor', 'psychedelic-humor', 'psychedelic-humor', 'psychedelic-humor',
];

function pickStable<T extends { id: string }>(items: readonly T[], seed: string): T | null {
  if (!items.length) return null;
  const ordered = [...items].sort((left, right) => left.id.localeCompare(right.id));
  return ordered[stableHash(seed) % ordered.length] || null;
}

function percentageBucket(seed: string): number {
  return stableHash(`${NEWSPAPER_VISUAL_MANIFEST_VERSION}|${seed}`) % 100;
}

function isEligible(seed: string, visiblePercent: number): boolean {
  return percentageBucket(`eligibility|${seed}`) < visiblePercent;
}

function diaryFamilyForSeed(seed: string): DiaryVisualFamily {
  const bucket = stableHash(`${NEWSPAPER_VISUAL_MANIFEST_VERSION}|diary-family|${seed}`) % 100;
  let cursor = 0;
  for (const family of DIARY_VISUAL_FAMILY_ORDER) {
    cursor += DIARY_VISUAL_FAMILY_WEIGHTS[family];
    if (bucket < cursor) return family;
  }
  return 'editorial';
}

function natalMedium(seed: string): EditorialMedium {
  const bucket = percentageBucket(`medium|${seed}`);
  if (bucket < EDITORIAL_PLACEMENT_POLICY.natal.psychedelicPercentOfVisible) {
    return 'psychedelic-humor';
  }
  return bucket < 70 ? 'associative' : 'surreal';
}

export function selectMainEditorialSticker(input: {
  screenKey: string;
  contentKey: string;
  userId?: string | null;
  slot?: number;
  topics?: readonly EditorialTopic[];
  allowedMedia?: readonly EditorialMedium[];
  allowedTones?: readonly EditorialTone[];
  excludeIds?: readonly string[];
}): MainEditorialAsset | null {
  const slot = input.slot ?? 0;
  const excluded = new Set(input.excludeIds || []);
  const allowedMedia = input.allowedMedia?.length
    ? input.allowedMedia
    : [MEDIUM_CYCLE[Math.abs(slot) % MEDIUM_CYCLE.length]];
  const base = MAIN_ASSETS.filter((asset) => !excluded.has(asset.id));
  const media = base.filter((asset) => allowedMedia.includes(asset.medium));
  const topics = input.topics?.length
    ? media.filter((asset) => asset.topics.some((topic) => input.topics!.includes(topic)))
    : media;
  const tones = input.allowedTones?.length
    ? topics.filter((asset) => input.allowedTones!.includes(asset.tone))
    : topics;
  const pool = tones.length
    ? tones
    : topics.length
      ? topics
      : media.length
        ? media
        : base;
  const seed = [
    NEWSPAPER_VISUAL_MANIFEST_VERSION,
    input.screenKey,
    input.contentKey,
    input.userId || 'guest',
    String(slot),
  ].join('|');
  return pickStable(pool, seed);
}

export function selectSynastryEditorialSticker(input: {
  screenKey: string;
  contentKey: string;
  context: 'love' | 'friendship' | 'family' | 'work';
  dynamic?: string | null;
  dynamics?: readonly string[];
  slot?: number;
  excludeIds?: readonly string[];
}): SynastryEditorialAsset | null {
  const excluded = new Set(input.excludeIds || []);
  const base = SYNASTRY_ASSETS.filter((asset) => !excluded.has(asset.id));
  const contextMatches = base.filter((asset) => asset.contexts.includes(input.context));
  const requestedDynamics = input.dynamics?.length
    ? input.dynamics
    : input.dynamic
      ? [input.dynamic]
      : [];
  const dynamicMatches = requestedDynamics.length
    ? contextMatches.filter((asset) => (
        asset.dynamics.some((dynamic) => requestedDynamics.includes(dynamic))
      ))
    : contextMatches;
  const pool = dynamicMatches.length
    ? dynamicMatches
    : contextMatches.length
      ? contextMatches
      : base;
  const seed = [
    NEWSPAPER_VISUAL_MANIFEST_VERSION,
    input.screenKey,
    input.contentKey,
    input.context,
    [...requestedDynamics].sort().join(',') || 'general',
    String(input.slot ?? 0),
  ].join('|');
  return pickStable(pool, seed);
}

export function getZodiacEditorialSticker(sign: string | null | undefined): ZodiacEditorialAsset | null {
  if (!sign) return null;
  const key = sign.trim().toLowerCase();
  return ZODIAC_ASSETS.find((asset) => asset.sign.toLowerCase() === key) || null;
}

export function selectDiaryEditorialSticker(input: {
  contentKey: string;
  userId?: string | null;
  topics?: readonly EditorialTopic[];
  allowedTones?: readonly EditorialTone[];
  excludeIds?: readonly string[];
  slot?: number;
  forceVisible?: boolean;
  eligibleAssets?: readonly DiaryEligibleAsset[];
}): DiaryEligibleAsset | null {
  const slot = input.slot ?? 0;
  const seed = ['diary', input.contentKey, input.userId || 'guest', String(slot)].join('|');
  if (!input.forceVisible && !isEligible(seed, EDITORIAL_PLACEMENT_POLICY.diary.visiblePercent)) {
    return null;
  }
  const excluded = new Set(input.excludeIds || []);
  const family = diaryFamilyForSeed(seed);
  const eligible = (input.eligibleAssets || DIARY_ELIGIBLE_ASSETS)
    .filter((asset) => !excluded.has(asset.id));
  const familyMatches = eligible.filter((asset) => asset.diaryFamily === family);
  const base = familyMatches.length ? familyMatches : eligible;
  const topicMatches = input.topics?.length
    ? base.filter((asset) => asset.topics.some((topic) => input.topics!.includes(topic)))
    : base;
  const toneMatches = input.allowedTones?.length
    ? topicMatches.filter((asset) => input.allowedTones!.includes(asset.tone))
    : topicMatches;
  const pool = toneMatches.length
    ? toneMatches
    : topicMatches.length
      ? topicMatches
      : base;
  return pickStable(pool, `${NEWSPAPER_VISUAL_MANIFEST_VERSION}|${seed}`);
}

export function selectZodiacEditorialSticker(input: {
  sign: string | null | undefined;
  contentKey: string;
  userId?: string | null;
}): ZodiacEditorialAsset | null {
  const key = input.sign?.trim().toLowerCase();
  if (!key) return null;
  const seed = ['zodiac', key, input.contentKey, input.userId || 'guest'].join('|');
  if (!isEligible(seed, EDITORIAL_PLACEMENT_POLICY.zodiac.visiblePercent)) return null;
  return getZodiacEditorialSticker(key);
}

export function selectNatalEditorialSticker(input: {
  chartKey: string;
  userId?: string | null;
}): MainEditorialAsset | null {
  const seed = ['natal', input.chartKey, input.userId || 'guest'].join('|');
  if (!isEligible(seed, EDITORIAL_PLACEMENT_POLICY.natal.visiblePercent)) return null;
  return selectMainEditorialSticker({
    screenKey: 'natal-reading',
    contentKey: input.chartKey,
    userId: input.userId,
    topics: ['general', 'mood', 'decisions'],
    allowedMedia: [natalMedium(seed)],
    allowedTones: ['neutral', 'quiet', 'warm', 'strange'],
  });
}

/** Synastry is deliberately confined to the calm dedicated collection. */
export function selectCalmSynastryEditorialSticker(
  input: Parameters<typeof selectSynastryEditorialSticker>[0],
): SynastryEditorialAsset | null {
  return selectSynastryEditorialSticker(input);
}

export function getNewspaperVisualCounts() {
  return {
    main: MAIN_ASSETS.length,
    synastry: SYNASTRY_ASSETS.length,
    zodiac: ZODIAC_ASSETS.length,
  } as const;
}

export function getDiaryEditorialStickerCounts() {
  return {
    mascot: DIARY_MASCOT_ASSETS.length,
    objects: DIARY_OBJECT_ASSETS.length,
    main: MAIN_ASSETS.length,
    total: DIARY_ELIGIBLE_ASSETS.length,
    byMedium: {
      photo: MAIN_ASSETS.filter((asset) => asset.medium === 'photo').length,
      associative: MAIN_ASSETS.filter((asset) => asset.medium === 'associative').length,
      surreal: MAIN_ASSETS.filter((asset) => asset.medium === 'surreal').length,
      graphic: MAIN_ASSETS.filter((asset) => asset.medium === 'graphic').length,
      'psychedelic-humor': MAIN_ASSETS.filter(
        (asset) => asset.medium === 'psychedelic-humor',
      ).length,
      'illustrated-sticker': DIARY_ASSETS.length,
    },
  } as const;
}

export function getDiaryEditorialStickerLibrary(): readonly DiaryEligibleAsset[] {
  return DIARY_ELIGIBLE_ASSETS;
}

export function getDiaryTodayVisualLibrary(): readonly DiaryEligibleAsset[] {
  return DIARY_TODAY_VISUAL_ASSETS;
}

export function getDiaryPaperTemplateLibrary() {
  return EDITORIAL_V2_PAPER_TEMPLATES;
}

export function getDiaryTodayVisualCounts() {
  return {
    legacy: DIARY_ELIGIBLE_ASSETS.length,
    editorialV2: EDITORIAL_V2_TODAY_ASSETS.length,
    paperTemplates: EDITORIAL_V2_PAPER_TEMPLATES.length,
    excludedForReview: EDITORIAL_V2_REVIEW_EXCLUDED_IDS.length,
    total: DIARY_TODAY_VISUAL_ASSETS.length,
  } as const;
}
