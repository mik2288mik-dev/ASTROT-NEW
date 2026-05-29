import type { ContentSurface, ContentVariant } from '../types';
import { getMoscowTodayKey } from './date-utils';
import { FORECAST_FULL_DAY_STARS_COST } from './starsPricing';
import { ASK_LUMIA_STARS_COST } from './questionContent';
import { SYNASTRY_EXTENDED_STARS_COST } from './synastryExtended';
import {
  HUMAN_DAILY_STARS_COST,
  HUMAN_PAID_STARS_COST,
  humanDailyCacheKey,
  humanPaidCacheKey,
  isHumanDailySectionKey,
  isHumanPaidSectionKey,
  type HumanDailySectionKey,
  type HumanPaidSectionKey,
} from './natalHumanShared';
import { buildForecastFullDayUnlockCacheKey } from './forecastFullDay';

export const PREMIUM_WEEK_STARS = 250;
export const PREMIUM_WEEK_DAYS = 7;

export type StarsInvoiceType =
  | 'premium_week'
  | 'forecast_full_day'
  | 'ask_lumia_one_off'
  | 'synastry_full'
  | 'natal_human_section'
  | 'natal_human_daily';

export type ParsedStarsInvoicePayload = {
  userId: string;
  type: StarsInvoiceType;
  contentSurface: ContentSurface | null;
  contentVariant: ContentVariant | null;
  chartId: number | null;
  cacheKey: string | null;
  starsAmount: number;
  nonce: string | null;
  raw: Record<string, unknown>;
};

const SURFACE_SHORT: Record<string, ContentSurface> = {
  f: 'forecast',
  q: 'question',
  s: 'synastry',
  n: 'natal',
  forecast: 'forecast',
  question: 'question',
  synastry: 'synastry',
  natal: 'natal',
};

const VARIANT_SHORT: Record<string, ContentVariant> = {
  f: 'full',
  o: 'one_off',
  l: 'living',
  full: 'full',
  one_off: 'one_off',
  living: 'living',
};

const TYPE_ALIASES: Record<string, StarsInvoiceType> = {
  pw: 'premium_week',
  premium_week: 'premium_week',
  ffd: 'forecast_full_day',
  forecast_full_day: 'forecast_full_day',
  alo: 'ask_lumia_one_off',
  ask_lumia_one_off: 'ask_lumia_one_off',
  sf: 'synastry_full',
  synastry_full: 'synastry_full',
  nhs: 'natal_human_section',
  natal_human_section: 'natal_human_section',
  nhd: 'natal_human_daily',
  natal_human_daily: 'natal_human_daily',
};

export function getStarsAmountForInvoiceType(type: StarsInvoiceType): number {
  switch (type) {
    case 'premium_week':
      return PREMIUM_WEEK_STARS;
    case 'forecast_full_day':
      return FORECAST_FULL_DAY_STARS_COST;
    case 'ask_lumia_one_off':
      return ASK_LUMIA_STARS_COST;
    case 'synastry_full':
      return SYNASTRY_EXTENDED_STARS_COST;
    case 'natal_human_section':
      return HUMAN_PAID_STARS_COST;
    case 'natal_human_daily':
      return HUMAN_DAILY_STARS_COST;
    default:
      return 0;
  }
}

export function resolveContentTarget(type: StarsInvoiceType): {
  contentSurface: ContentSurface | null;
  contentVariant: ContentVariant | null;
} {
  switch (type) {
    case 'forecast_full_day':
      return { contentSurface: 'forecast', contentVariant: 'full' };
    case 'ask_lumia_one_off':
      return { contentSurface: 'question', contentVariant: 'one_off' };
    case 'synastry_full':
      return { contentSurface: 'synastry', contentVariant: 'full' };
    case 'natal_human_section':
      return { contentSurface: 'natal', contentVariant: 'full' };
    case 'natal_human_daily':
      return { contentSurface: 'natal', contentVariant: 'living' };
    default:
      return { contentSurface: null, contentVariant: null };
  }
}

export function parseInvoicePayload(rawPayload: string): ParsedStarsInvoicePayload | null {
  try {
    const raw = JSON.parse(rawPayload) as Record<string, unknown>;
    const userId = String(raw.u ?? raw.userId ?? '').trim();
    const typeRaw = String(raw.t ?? raw.type ?? '').trim();
    const type = TYPE_ALIASES[typeRaw];
    if (!userId || !type) return null;

    const surfaceRaw = raw.s ?? raw.contentSurface;
    const variantRaw = raw.v ?? raw.contentVariant;
    const target = resolveContentTarget(type);
    const contentSurface = surfaceRaw != null
      ? (SURFACE_SHORT[String(surfaceRaw)] ?? target.contentSurface)
      : target.contentSurface;
    const contentVariant = variantRaw != null
      ? (VARIANT_SHORT[String(variantRaw)] ?? target.contentVariant)
      : target.contentVariant;

    const chartIdRaw = raw.i ?? raw.chartId;
    const chartId = chartIdRaw == null || chartIdRaw === ''
      ? null
      : Number(chartIdRaw);

    const cacheKeyRaw = raw.k ?? raw.cacheKey;
    const cacheKey = cacheKeyRaw == null || cacheKeyRaw === ''
      ? null
      : String(cacheKeyRaw);

    const amountRaw = raw.a ?? raw.starsAmount;
    const starsAmount = Number(amountRaw ?? getStarsAmountForInvoiceType(type));

    return {
      userId,
      type,
      contentSurface,
      contentVariant,
      chartId: Number.isFinite(chartId as number) ? Number(chartId) : null,
      cacheKey,
      starsAmount,
      nonce: raw.n != null ? String(raw.n) : raw.nonce != null ? String(raw.nonce) : null,
      raw,
    };
  } catch {
    return null;
  }
}

export type BuildInvoiceInput = {
  userId: string;
  type: StarsInvoiceType;
  chartId?: number | null;
  cacheKey?: string | null;
  date?: string | null;
  sectionKey?: string | null;
};

export function buildInvoicePayload(input: BuildInvoiceInput): {
  payload: Record<string, unknown>;
  starsAmount: number;
  title: string;
  description: string;
  label: string;
  contentSurface: ContentSurface | null;
  contentVariant: ContentVariant | null;
  cacheKey: string | null;
  chartId: number | null;
} {
  const userId = String(input.userId).trim();
  const type = input.type;
  const starsAmount = getStarsAmountForInvoiceType(type);
  const target = resolveContentTarget(type);
  let cacheKey = input.cacheKey != null ? String(input.cacheKey).trim() || null : null;
  let chartId = input.chartId != null ? Number(input.chartId) : null;
  if (!Number.isFinite(chartId as number)) chartId = null;

  if (type === 'forecast_full_day') {
    const dateKey = input.date?.trim() || getMoscowTodayKey();
    cacheKey = buildForecastFullDayUnlockCacheKey(dateKey);
  }

  if (type === 'natal_human_section') {
    const sectionKey = String(input.sectionKey || '').trim();
    if (!isHumanPaidSectionKey(sectionKey)) {
      throw new Error('INVALID_HUMAN_PAID_SECTION');
    }
    cacheKey = humanPaidCacheKey(sectionKey as HumanPaidSectionKey);
  }

  if (type === 'natal_human_daily') {
    const sectionKey = String(input.sectionKey || '').trim();
    const dateKey = input.date?.trim() || getMoscowTodayKey();
    if (!isHumanDailySectionKey(sectionKey)) {
      throw new Error('INVALID_HUMAN_DAILY_SECTION');
    }
    cacheKey = humanDailyCacheKey(dateKey, sectionKey as HumanDailySectionKey);
  }

  if (type === 'synastry_full' && !cacheKey) {
    throw new Error('CACHE_KEY_REQUIRED');
  }

  const payload: Record<string, unknown> = {
    u: userId,
    t: type,
    a: starsAmount,
    n: Date.now(),
  };

  if (target.contentSurface) payload.s = target.contentSurface;
  if (target.contentVariant) payload.v = target.contentVariant;
  if (cacheKey) payload.k = cacheKey;
  if (chartId != null) payload.i = chartId;

  const serialized = JSON.stringify(payload);
  if (serialized.length > 128) {
    throw new Error('PAYLOAD_TOO_LONG');
  }

  const productCopy = getInvoiceCopy(type, starsAmount);

  return {
    payload,
    starsAmount,
    ...productCopy,
    contentSurface: target.contentSurface,
    contentVariant: target.contentVariant,
    cacheKey,
    chartId,
  };
}

function getInvoiceCopy(type: StarsInvoiceType, starsAmount: number) {
  switch (type) {
    case 'premium_week':
      return {
        title: 'Lumia Premium',
        description: `Full access for ${PREMIUM_WEEK_DAYS} days`,
        label: 'Premium 1 Week',
      };
    case 'forecast_full_day':
      return {
        title: 'Full day forecast',
        description: 'One-off unlock for morning, day and evening layers',
        label: `${starsAmount} Stars`,
      };
    case 'ask_lumia_one_off':
      return {
        title: 'Ask Lumia',
        description: 'One deep answer via Ask Lumia',
        label: `${starsAmount} Stars`,
      };
    case 'synastry_full':
      return {
        title: 'Full synastry',
        description: 'One-off full compatibility reading',
        label: `${starsAmount} Stars`,
      };
    case 'natal_human_section':
      return {
        title: 'Natal section',
        description: 'One-off natal reading section unlock',
        label: `${starsAmount} Stars`,
      };
    case 'natal_human_daily':
      return {
        title: 'Daily natal layer',
        description: 'One-off personal daily natal layer',
        label: `${starsAmount} Stars`,
      };
    default:
      return {
        title: 'Lumia unlock',
        description: 'One-off content unlock',
        label: `${starsAmount} Stars`,
      };
  }
}

export function isContentUnlockInvoiceType(type: StarsInvoiceType): boolean {
  return type !== 'premium_week';
}
