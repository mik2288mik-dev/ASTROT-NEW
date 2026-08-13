import { stableHash } from '../personalForecastContract';
import {
  getPersonalForecastEditorialVisualLibrary,
  getPersonalForecastPaperTemplateLibrary,
} from './personalEditorialAllowlist';
import {
  DIARY_VISUAL_FAMILY_WEIGHTS,
  type DiaryEligibleAsset,
  type DiaryPaperTemplateAsset,
  type DiaryVisualDisplayWeight,
  type DiaryVisualFamily,
  type DiaryVisualRarity,
} from './editorialTypes';

export const DIARY_TODAY_VISUAL_ENGINE_VERSION = 'diary-today-editorial-v4';

export const DIARY_LAYOUTS = [
  'editorial_right',
  'editorial_left',
  'quote_first',
  'visual_overlap',
  'editorial_clean',
] as const;

export type DiaryLayout = (typeof DIARY_LAYOUTS)[number];
export type DiaryVisualRenderSize = 'small' | 'medium' | 'hero';

export type DiaryTodayVisualPlan = {
  version: string;
  layout: DiaryLayout;
  asset: DiaryEligibleAsset | null;
  paperTemplate: DiaryPaperTemplateAsset | null;
};

const FAMILY_ORDER = Object.keys(DIARY_VISUAL_FAMILY_WEIGHTS) as DiaryVisualFamily[];
const ASSETS_BY_FAMILY = Object.fromEntries(FAMILY_ORDER.map((family) => [
  family,
  getPersonalForecastEditorialVisualLibrary()
    .filter((asset) => asset.diaryFamily === family)
    .sort((left, right) => left.id.localeCompare(right.id)),
])) as Record<DiaryVisualFamily, DiaryEligibleAsset[]>;
const PAPER_TEMPLATES = [...getPersonalForecastPaperTemplateLibrary()]
  .sort((left, right) => left.id.localeCompare(right.id));
const ASSET_COHORT_COUNT = 3;
const ASSET_COHORT_BY_ID = new Map<string, number>(FAMILY_ORDER.flatMap((family) => (
  ASSETS_BY_FAMILY[family].map((asset, index) => [asset.id, index % ASSET_COHORT_COUNT] as const)
)));

export function clampDiaryVisualSize(
  layoutSize: DiaryVisualRenderSize,
  displayWeight: DiaryVisualDisplayWeight,
): DiaryVisualRenderSize {
  if (displayWeight === 'light') return 'small';
  if (displayWeight === 'medium' && layoutSize === 'hero') return 'medium';
  return layoutSize;
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function epochDay(periodKey: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(periodKey);
  if (!match) throw new Error('DIARY_VISUAL_PERIOD_KEY_INVALID');
  const utc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const canonical = new Date(utc).toISOString().slice(0, 10);
  if (canonical !== periodKey) throw new Error('DIARY_VISUAL_PERIOD_KEY_INVALID');
  return Math.floor(utc / 86_400_000);
}

function stablePermutation<T extends string>(items: readonly T[], seed: string): T[] {
  return [...items].sort((left, right) => (
    stableHash(`${seed}|${left}`) - stableHash(`${seed}|${right}`)
    || left.localeCompare(right)
  ));
}

const ACTIVE_FAMILY_ORDER = FAMILY_ORDER.filter((family) => ASSETS_BY_FAMILY[family].length > 0);
const ACTIVE_FAMILY_WEIGHT = ACTIVE_FAMILY_ORDER.reduce(
  (sum, family) => sum + DIARY_VISUAL_FAMILY_WEIGHTS[family],
  0,
);

function selectFamily(seed: string): DiaryVisualFamily {
  const bucket = stableHash(`${seed}|family`) % ACTIVE_FAMILY_WEIGHT;
  let cursor = 0;
  for (const family of ACTIVE_FAMILY_ORDER) {
    cursor += DIARY_VISUAL_FAMILY_WEIGHTS[family];
    if (bucket < cursor) return family;
  }
  return ACTIVE_FAMILY_ORDER[0] || 'mascot';
}

function fitsLayout(asset: DiaryEligibleAsset, layout: DiaryLayout): boolean {
  if (layout !== 'editorial_left' && layout !== 'editorial_right') return true;
  return asset.orientation !== 'landscape'
    && asset.displayWeight !== 'hero'
    && asset.composition !== 'wide'
    && asset.composition !== 'strip';
}

function rarityWeight(rarity: DiaryVisualRarity): number {
  if (rarity === 'common') return 6;
  if (rarity === 'occasional') return 2;
  return 1;
}

function weightedByRarity<T extends { selectionRarity: DiaryVisualRarity }>(
  assets: readonly T[],
): T[] {
  return assets.flatMap((asset) => (
    Array.from({ length: rarityWeight(asset.selectionRarity) }, () => asset)
  ));
}

function selectAsset(input: {
  family: DiaryVisualFamily;
  layout: DiaryLayout;
  day: number;
  identitySeed: string;
}): DiaryEligibleAsset | null {
  const cohort = positiveModulo(input.day, ASSET_COHORT_COUNT);
  const fitsActiveCohort = (asset: DiaryEligibleAsset) => (
    fitsLayout(asset, input.layout)
    && ASSET_COHORT_BY_ID.get(asset.id) === cohort
    && (!('hasEmbeddedText' in asset) || asset.hasEmbeddedText === false)
  );
  const familyPool = ASSETS_BY_FAMILY[input.family].filter(fitsActiveCohort);
  const pool = familyPool.length
    ? familyPool
    : ACTIVE_FAMILY_ORDER.flatMap((family) => ASSETS_BY_FAMILY[family])
      .filter(fitsActiveCohort);
  if (!pool.length) return null;
  const weightedPool = weightedByRarity(pool);
  const assetOffset = stableHash(
    `${input.identitySeed}|${input.family}|asset-offset`,
  ) % weightedPool.length;
  const ringDay = Math.floor(input.day / ASSET_COHORT_COUNT);
  return weightedPool[positiveModulo(ringDay + assetOffset, weightedPool.length)] || null;
}

function selectPaperTemplate(input: {
  day: number;
  identitySeed: string;
}): DiaryPaperTemplateAsset | null {
  const cohort = positiveModulo(input.day, ASSET_COHORT_COUNT);
  const pool = PAPER_TEMPLATES.filter((_, index) => index % ASSET_COHORT_COUNT === cohort);
  if (!pool.length) return null;
  const weightedPool = weightedByRarity(pool);
  const offset = stableHash(`${input.identitySeed}|paper-template-offset`) % weightedPool.length;
  const ringDay = Math.floor(input.day / ASSET_COHORT_COUNT);
  return weightedPool[positiveModulo(ringDay + offset, weightedPool.length)] || null;
}

/**
 * Stateless visual plan for Today. Calendar position rotates the layout and
 * the asset ring, while user and contract identity offset both. This makes a
 * reopened day stable and prevents adjacent-day repeats without persisted
 * visual history.
 */
export function resolveDiaryTodayVisualPlan(input: {
  userId: string;
  periodKey: string;
  contractVersion: string;
}): DiaryTodayVisualPlan {
  const userId = input.userId.trim() || 'guest';
  const contractVersion = input.contractVersion.trim();
  if (!contractVersion) throw new Error('DIARY_VISUAL_CONTRACT_VERSION_REQUIRED');
  const day = epochDay(input.periodKey);
  const identitySeed = [
    DIARY_TODAY_VISUAL_ENGINE_VERSION,
    userId,
    contractVersion,
  ].join('|');
  const layouts = stablePermutation(DIARY_LAYOUTS, `${identitySeed}|layouts`);
  const layoutOffset = stableHash(`${identitySeed}|layout-offset`) % layouts.length;
  const layout = layouts[positiveModulo(day + layoutOffset, layouts.length)];
  const paperTemplate = selectPaperTemplate({ day, identitySeed });

  const dailySeed = [identitySeed, input.periodKey].join('|');
  const family = selectFamily(dailySeed);
  const asset = selectAsset({ family, layout, day, identitySeed });
  return {
    version: DIARY_TODAY_VISUAL_ENGINE_VERSION,
    layout,
    asset,
    paperTemplate,
  };
}

export { DIARY_VISUAL_FAMILY_WEIGHTS };
