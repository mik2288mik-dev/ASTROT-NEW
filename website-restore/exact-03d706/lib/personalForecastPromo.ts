export const PERSONAL_FORECAST_PROMO_PRODUCTS = [
  'natal',
  'compatibility',
  'zodiac',
] as const;

export type PersonalForecastPromoProduct =
  (typeof PERSONAL_FORECAST_PROMO_PRODUCTS)[number];

export const PERSONAL_FORECAST_PROMO_FORMATS = [
  'wide',
  'inset',
  'square',
  'media',
  'album',
] as const;

export type PersonalForecastPromoFormat =
  (typeof PERSONAL_FORECAST_PROMO_FORMATS)[number];

export type PersonalForecastPromoSection = {
  id: string;
  kind: string;
  fixedKey?: string | null;
  importance: number;
  hasStrongAstro?: boolean;
};

export type PersonalForecastPromoPlacement = {
  id: string;
  product: PersonalForecastPromoProduct;
  format: PersonalForecastPromoFormat;
  placementType: 'mandatory' | 'contextual';
  afterSectionId: string;
  afterSectionIndex: number;
};

export type PersonalForecastPromoResolverInput = {
  sections: readonly PersonalForecastPromoSection[];
  userId: string;
  period: string;
  periodKey: string;
};

const COMPATIBILITY_ANCHORS = new Set([
  'love',
  'home',
  'home_family',
  'friends',
  'friends_social',
]);

const NATAL_ANCHORS = new Set([
  'mood',
  'mood_energy',
  'work_money',
]);

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function normalizedFixedKey(section: PersonalForecastPromoSection): string {
  return String(section.fixedKey || '').trim().toLowerCase();
}

export function isPersonalForecastPromoAnchor(
  product: PersonalForecastPromoProduct,
  section: PersonalForecastPromoSection,
): boolean {
  const fixedKey = normalizedFixedKey(section);
  if (product === 'compatibility') {
    return section.kind === 'fixed' && COMPATIBILITY_ANCHORS.has(fixedKey);
  }
  if (product === 'natal') {
    return section.kind === 'fixed' && NATAL_ANCHORS.has(fixedKey);
  }
  return section.kind === 'astro_accent' && section.hasStrongAstro === true;
}

function chooseAnchor(
  product: PersonalForecastPromoProduct,
  sections: readonly PersonalForecastPromoSection[],
  seed: string,
): { section: PersonalForecastPromoSection; index: number } | null {
  const candidates = sections
    .map((section, index) => ({ section, index }))
    .filter(({ section }) => isPersonalForecastPromoAnchor(product, section));

  candidates.sort((left, right) => {
    const leftImportance = Number.isFinite(left.section.importance)
      ? left.section.importance
      : 0;
    const rightImportance = Number.isFinite(right.section.importance)
      ? right.section.importance
      : 0;
    if (rightImportance !== leftImportance) return rightImportance - leftImportance;

    const leftTie = stableHash(`${seed}|${product}|${left.section.id}`);
    const rightTie = stableHash(`${seed}|${product}|${right.section.id}`);
    if (leftTie !== rightTie) return leftTie - rightTie;
    return left.index - right.index;
  });

  return candidates[0] || null;
}

function formatOrder(seed: string): PersonalForecastPromoFormat[] {
  return [...PERSONAL_FORECAST_PROMO_FORMATS].sort((left, right) => {
    const leftHash = stableHash(`${seed}|format|${left}`);
    const rightHash = stableHash(`${seed}|format|${right}`);
    if (leftHash !== rightHash) return leftHash - rightHash;
    return left.localeCompare(right);
  });
}

function assertValidSections(sections: readonly PersonalForecastPromoSection[]): void {
  const ids = new Set<string>();
  for (const section of sections) {
    const id = String(section.id || '').trim();
    if (!id) throw new Error('PERSONAL_FORECAST_PROMO_SECTION_ID_REQUIRED');
    if (ids.has(id)) throw new Error(`PERSONAL_FORECAST_PROMO_SECTION_ID_DUPLICATE:${id}`);
    ids.add(id);
  }
}

/**
 * Resolves two paired product promos and one later Zodiac transition.
 * Zodiac follows the strongest astro-accent when one exists; otherwise it
 * stays near the end of the feed. Products and visual formats never repeat.
 */
export function resolvePersonalForecastPromotions(
  input: PersonalForecastPromoResolverInput,
): PersonalForecastPromoPlacement[] {
  assertValidSections(input.sections);
  const seed = [
    String(input.userId || '').trim() || 'guest',
    String(input.period || '').trim(),
    String(input.periodKey || '').trim(),
  ].join('|');

  const mandatoryProducts = [
    'compatibility',
    'natal',
  ] as const satisfies readonly PersonalForecastPromoProduct[];

  const selected: Array<{
    product: PersonalForecastPromoProduct;
    placementType: 'mandatory' | 'contextual';
    section: PersonalForecastPromoSection;
    index: number;
  }> = mandatoryProducts.map((product) => {
    const anchor = chooseAnchor(product, input.sections, seed);
    if (!anchor) {
      throw new Error(`PERSONAL_FORECAST_PROMO_ANCHOR_MISSING:${product}`);
    }
    return {
      product,
      placementType: 'mandatory' as const,
      ...anchor,
    };
  });

  const zodiacAnchor = chooseAnchor('zodiac', input.sections, seed)
    || {
      section: input.sections[input.sections.length - 1],
      index: input.sections.length - 1,
    };
  selected.push({
    product: 'zodiac',
    placementType: 'contextual',
    ...zodiacAnchor,
  });

  selected.sort((left, right) => {
    if (left.index !== right.index) return left.index - right.index;
    return PERSONAL_FORECAST_PROMO_PRODUCTS.indexOf(left.product)
      - PERSONAL_FORECAST_PROMO_PRODUCTS.indexOf(right.product);
  });

  const formats = formatOrder(seed);
  return selected.map((item, index) => ({
    id: `personal-forecast-promo:${input.period}:${input.periodKey}:${item.product}:${item.section.id}`,
    product: item.product,
    format: formats[index],
    placementType: item.placementType,
    afterSectionId: item.section.id,
    afterSectionIndex: item.index,
  }));
}

export const resolvePersonalForecastPromoPlacements =
  resolvePersonalForecastPromotions;
