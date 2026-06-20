import type { FeatureAccessConfig, FeatureKey } from './accessMatrix';
import { getFeatureAccessConfig } from './accessMatrix';

export type LumiaContentType =
  | 'push_daily'
  | 'action_timing'
  | 'day_card'
  | 'sign_daily_horoscope'
  | 'sign_weekly_horoscope'
  | 'sign_monthly_horoscope'
  | 'sign_compatibility'
  | 'blind_spot'
  | 'personal_daily'
  | 'natal_section'
  | 'deep_report';

export type LumiaModelTier = 'fast' | 'main' | 'deep';
export type ContentCacheScope = 'shared' | 'user_chart' | 'chart_version';
export type ContentCacheTtl = '24h' | '7d' | '30d' | 'forever' | 'forever_until_chart_changes';
export type GenerationPolicy = 'once_per_day' | 'once_per_week' | 'once_per_chart_version' | 'explicit_only';
export type ContentPlacement = 'push' | 'home' | 'horoscope' | 'natal' | 'synastry' | 'report';
export type NatalSectionKey =
  | 'basic_identity'
  | 'love'
  | 'career'
  | 'anger'
  | 'shadow'
  | 'talents'
  | 'money'
  | 'family'
  | 'how_others_see_you';

export type ContentPolicy = {
  type: LumiaContentType;
  featureKey: FeatureKey;
  modelTier: LumiaModelTier;
  words: { min: number; max: number };
  cacheTtl: ContentCacheTtl;
  cacheScope: ContentCacheScope;
  promptVersion: string;
  purpose: string;
  style: string;
  placements: ContentPlacement[];
  generationPolicy: GenerationPolicy;
  batchSize?: number;
};

const CONTENT_MATRIX: Record<LumiaContentType, ContentPolicy> = {
  push_daily: {
    type: 'push_daily', featureKey: 'daily_sign_horoscope', modelTier: 'fast', words: { min: 10, max: 15 },
    cacheTtl: '24h', cacheScope: 'shared', promptVersion: 'push_daily.v2', purpose: 'Первая точка касания дня',
    style: 'Одна мысль, без лирики и списков.', placements: ['push'], generationPolicy: 'once_per_day',
  },
  action_timing: {
    type: 'action_timing', featureKey: 'action_timing_generic', modelTier: 'fast', words: { min: 20, max: 35 },
    cacheTtl: '24h', cacheScope: 'shared', promptVersion: 'action_timing.v1', purpose: 'Лучший момент для разговора, отдыха, денег или работы',
    style: 'Конкретный совет с коротким объяснением.', placements: ['home'], generationPolicy: 'once_per_day',
  },
  day_card: {
    type: 'day_card', featureKey: 'daily_sign_horoscope', modelTier: 'fast', words: { min: 35, max: 50 },
    cacheTtl: '24h', cacheScope: 'shared', promptVersion: 'day_card.v2', purpose: 'Карточка дня на главной',
    style: 'Текст должен целиком помещаться в одну карточку.', placements: ['home'], generationPolicy: 'once_per_day',
  },
  sign_daily_horoscope: {
    type: 'sign_daily_horoscope', featureKey: 'daily_sign_horoscope', modelTier: 'fast', words: { min: 60, max: 80 },
    cacheTtl: '24h', cacheScope: 'shared', promptVersion: 'sign_daily_horoscope.v3', purpose: 'Общий гороскоп по знаку на день',
    style: 'Один фокус дня, без перечисления любви, денег и здоровья.', placements: ['horoscope'], generationPolicy: 'once_per_day', batchSize: 12,
  },
  sign_weekly_horoscope: {
    type: 'sign_weekly_horoscope', featureKey: 'weekly_sign_horoscope', modelTier: 'fast', words: { min: 100, max: 140 },
    cacheTtl: '7d', cacheScope: 'shared', promptVersion: 'sign_weekly_horoscope.v3', purpose: 'Общий гороскоп по знаку на неделю',
    style: 'Один главный сюжет недели и два коротких совета.', placements: ['horoscope'], generationPolicy: 'once_per_week', batchSize: 12,
  },
  sign_monthly_horoscope: {
    type: 'sign_monthly_horoscope', featureKey: 'weekly_sign_horoscope', modelTier: 'fast', words: { min: 110, max: 150 },
    cacheTtl: '30d', cacheScope: 'shared', promptVersion: 'sign_monthly_horoscope.v1', purpose: 'Общий гороскоп по знаку на месяц',
    style: 'Один главный сюжет месяца и два коротких совета.', placements: ['horoscope'], generationPolicy: 'once_per_week', batchSize: 12,
  },
  sign_compatibility: {
    type: 'sign_compatibility', featureKey: 'zodiac_compatibility', modelTier: 'fast', words: { min: 120, max: 180 },
    cacheTtl: 'forever', cacheScope: 'shared', promptVersion: 'sign_compatibility.v2', purpose: 'Бесплатная совместимость двух знаков',
    style: 'Три коротких практичных блока: что тянет, где сложно, как общаться; без фатализма и без счёта совместимости.', placements: ['synastry'], generationPolicy: 'explicit_only',
  },
  blind_spot: {
    type: 'blind_spot', featureKey: 'blind_spot', modelTier: 'main', words: { min: 80, max: 110 },
    cacheTtl: '7d', cacheScope: 'user_chart', promptVersion: 'blind_spot.v2', purpose: 'Что ты можешь не замечать',
    style: 'Конкретно, без обвинений, мягко, но точно.', placements: ['home', 'natal'], generationPolicy: 'once_per_week',
  },
  personal_daily: {
    type: 'personal_daily', featureKey: 'personal_daily', modelTier: 'main', words: { min: 90, max: 130 },
    cacheTtl: '24h', cacheScope: 'user_chart', promptVersion: 'personal_daily.v2', purpose: 'Личный прогноз на день',
    style: 'Главное сегодня, отношения/люди, действие и риск дня, плюс короткое объяснение по карте; без воды.', placements: ['home', 'horoscope'], generationPolicy: 'once_per_day',
  },
  natal_section: {
    type: 'natal_section', featureKey: 'natal_basic', modelTier: 'main', words: { min: 150, max: 200 },
    cacheTtl: 'forever_until_chart_changes', cacheScope: 'chart_version', promptVersion: 'natal_section.v2', purpose: 'Отдельный раздел натальной карты',
    style: 'Цельный практичный разбор одной темы карты.', placements: ['natal'], generationPolicy: 'once_per_chart_version',
  },
  deep_report: {
    type: 'deep_report', featureKey: 'deep_report', modelTier: 'deep', words: { min: 800, max: 1500 },
    cacheTtl: 'forever_until_chart_changes', cacheScope: 'chart_version', promptVersion: 'deep_report.v3', purpose: 'Полный натальный, синастрический или годовой отчёт',
    style: 'Полный структурированный отчёт; никогда не генерировать при старте приложения.', placements: ['report', 'natal', 'synastry'], generationPolicy: 'explicit_only',
  },
};

const NATAL_SECTION_FEATURES: Record<NatalSectionKey, FeatureKey> = {
  basic_identity: 'natal_basic', love: 'natal_love', career: 'natal_career', anger: 'natal_anger',
  shadow: 'natal_shadow', talents: 'natal_talents', money: 'natal_money', family: 'natal_family',
  how_others_see_you: 'natal_how_others_see_you',
};

export function getContentPolicy(type: LumiaContentType): ContentPolicy {
  return CONTENT_MATRIX[type];
}

export function listContentMatrix(): ContentPolicy[] {
  return Object.values(CONTENT_MATRIX);
}

export function getContentAccess(type: LumiaContentType, options?: { personal?: boolean; natalSection?: NatalSectionKey }): FeatureAccessConfig {
  let featureKey = CONTENT_MATRIX[type].featureKey;
  if (type === 'action_timing' && options?.personal) featureKey = 'action_timing_personal';
  if (type === 'natal_section' && options?.natalSection) featureKey = NATAL_SECTION_FEATURES[options.natalSection];
  const access = getFeatureAccessConfig(featureKey);
  if (!access) throw new Error(`Missing accessMatrix entry for ${featureKey}`);
  return access;
}

export function getWordRangeInstruction(type: LumiaContentType): string {
  const { min, max } = getContentPolicy(type).words;
  return `Target length: ${min}-${max} words.`;
}

export function getCacheTtlMs(type: LumiaContentType): number | null {
  const ttl = getContentPolicy(type).cacheTtl;
  if (ttl === '24h') return 24 * 60 * 60 * 1000;
  if (ttl === '7d') return 7 * 24 * 60 * 60 * 1000;
  return null;
}


export type ContentCacheKeyParts = {
  contentKey?: string;
  dateKey?: string;
  periodKey?: string;
  zodiacSign?: string;
  userId?: string;
  chartId?: number | string;
  chartHash?: string;
};

/** Stable key used by content_cache or the legacy persistence adapters. */
export function buildContentCacheKey(type: LumiaContentType, parts: ContentCacheKeyParts): string {
  const values: Array<string | number | undefined> = [type];
  if (parts.contentKey) values.push(parts.contentKey);
  if (parts.dateKey) values.push(`date:${parts.dateKey}`);
  if (parts.periodKey) values.push(`period:${parts.periodKey}`);
  if (parts.zodiacSign) values.push(`sign:${parts.zodiacSign.toLowerCase()}`);
  if (parts.userId) values.push(`user:${parts.userId}`);
  if (parts.chartId != null) values.push(`chart:${parts.chartId}`);
  if (parts.chartHash) values.push(`hash:${parts.chartHash}`);
  return values.join('|');
}
