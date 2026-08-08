import { stableHash } from '../personalForecastContract';
import mainManifest from './main.manifest.json';
import synastryManifest from './synastry.manifest.json';
import zodiacManifest from './zodiac.manifest.json';
import type {
  EditorialMedium,
  EditorialTone,
  EditorialTopic,
  MainEditorialAsset,
  SynastryEditorialAsset,
  ZodiacEditorialAsset,
} from './editorialTypes';

export const NEWSPAPER_VISUAL_MANIFEST_VERSION = 'newspaper-v3-sparse';

export const EDITORIAL_PLACEMENT_POLICY = {
  diary: { visiblePercent: 40, psychedelicPercentOfVisible: 7 },
  zodiac: { visiblePercent: 60 },
  natal: { visiblePercent: 65, psychedelicPercentOfVisible: 1 },
  synastry: { psychedelicAllowed: false },
} as const;

const MAIN_ASSETS = mainManifest.items as MainEditorialAsset[];
const SYNASTRY_ASSETS = synastryManifest.items as SynastryEditorialAsset[];
const ZODIAC_ASSETS = zodiacManifest.items as ZodiacEditorialAsset[];

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

function diaryMedium(seed: string): EditorialMedium {
  const bucket = percentageBucket(`medium|${seed}`);
  if (bucket < EDITORIAL_PLACEMENT_POLICY.diary.psychedelicPercentOfVisible) {
    return 'psychedelic-humor';
  }
  if (bucket < 50) return 'photo';
  if (bucket < 76) return 'associative';
  if (bucket < 95) return 'surreal';
  return 'graphic';
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
}): MainEditorialAsset | null {
  const seed = ['diary', input.contentKey, input.userId || 'guest'].join('|');
  if (!isEligible(seed, EDITORIAL_PLACEMENT_POLICY.diary.visiblePercent)) return null;
  return selectMainEditorialSticker({
    screenKey: 'personal-forecast',
    contentKey: input.contentKey,
    userId: input.userId,
    topics: input.topics,
    allowedMedia: [diaryMedium(seed)],
  });
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
