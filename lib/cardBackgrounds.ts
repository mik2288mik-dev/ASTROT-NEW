import type { CSSProperties } from 'react';
import manifest from '../docs/design/card-background-system/card-background-manifest.json';
import type { PersonalDailySection } from '../types';

export type CardBackgroundCategory = 'hero' | 'personal' | 'universal' | 'strips';
export type UniversalCardTheme = 'natal' | 'compatibility' | 'zodiac' | 'matrix' | 'more';
export type DailyQuestionTheme = 'advantage' | 'conversation' | 'attention';

export type CardBackgroundAsset = {
  id: string;
  path: string;
  category: CardBackgroundCategory;
  theme: string;
  size: { width: number; height: number };
  text_side: 'left' | 'right' | 'center';
  main_object_position: string;
  background_position: string;
  season: string;
  enabled: boolean;
  description: string;
};

type CardBackgroundStyle = CSSProperties & {
  '--card-bg-image': string;
  '--card-bg-position': string;
};

const ASSETS = (manifest.assets as CardBackgroundAsset[]).filter((asset) => asset.enabled);

/**
 * Separate product family: same saturated editorial illustration language,
 * but no cats. Each product has three original variants and rotates stably.
 */
const PRODUCT_ASSETS: CardBackgroundAsset[] = [
  ...(['01', '02', '03'] as const).map((variant) => ({
    id: `product_natal_${variant}`,
    path: `/assets/card-backgrounds/products/natal_${variant}.svg`,
    category: 'universal' as const,
    theme: 'natal',
    size: { width: 1600, height: 900 },
    text_side: 'left' as const,
    main_object_position: 'right',
    background_position: 'center',
    season: 'base',
    enabled: true,
    description: 'Насыщенная рисованная архитектурная сцена и графика карты без животных.',
  })),
  ...(['01', '02', '03'] as const).map((variant) => ({
    id: `product_compatibility_${variant}`,
    path: `/assets/card-backgrounds/products/compatibility_${variant}.svg`,
    category: 'universal' as const,
    theme: 'compatibility',
    size: { width: 1600, height: 900 },
    text_side: 'left' as const,
    main_object_position: 'right',
    background_position: 'center',
    season: 'base',
    enabled: true,
    description: 'Парная рисованная композиция в насыщенной палитре без животных и сердечек.',
  })),
  ...(['01', '02', '03'] as const).map((variant) => ({
    id: `product_matrix_${variant}`,
    path: `/assets/card-backgrounds/products/matrix_${variant}.svg`,
    category: 'universal' as const,
    theme: 'matrix',
    size: { width: 1600, height: 900 },
    text_side: 'left' as const,
    main_object_position: 'right',
    background_position: 'center',
    season: 'base',
    enabled: true,
    description: 'Модульная рисованная система с сеткой, узлами и насыщенными цветами.',
  })),
];

function questionAsset(
  id: string,
  theme: DailyQuestionTheme,
  path: string,
  backgroundPosition: string,
  description: string,
): CardBackgroundAsset {
  return {
    id,
    path,
    category: 'personal',
    theme: `question_${theme}`,
    size: path.includes('/hero/')
      ? { width: 1200, height: 1320 }
      : { width: 1600, height: 800 },
    text_side: 'center',
    main_object_position: 'background',
    background_position: backgroundPosition,
    season: 'base',
    enabled: true,
    description,
  };
}

/**
 * Premium questions are part of Today, so they reuse the approved editorial
 * Today artwork instead of the temporary abstract SVG set. The same file is
 * shown in the preview and in the full-screen story.
 */
const QUESTION_ASSETS: CardBackgroundAsset[] = [
  questionAsset(
    'question_advantage_01',
    'advantage',
    '/assets/card-backgrounds/hero/hero_01.webp',
    '68% 58%',
    'Яркая сцена Today у окна: спокойная точка силы и личное преимущество.',
  ),
  questionAsset(
    'question_advantage_02',
    'advantage',
    '/assets/card-backgrounds/personal/goals_01.webp',
    '69% 50%',
    'Цветные ступени и направление движения из ежедневной серии.',
  ),
  questionAsset(
    'question_advantage_03',
    'advantage',
    '/assets/card-backgrounds/hero/hero_05.webp',
    '70% 62%',
    'Фрагмент кота и выразительные цветные плоскости из мира Сегодня.',
  ),

  questionAsset(
    'question_conversation_01',
    'conversation',
    '/assets/card-backgrounds/personal/communication_01.webp',
    '70% 50%',
    'Два профиля и отражение для вопроса о важном разговоре.',
  ),
  questionAsset(
    'question_conversation_02',
    'conversation',
    '/assets/card-backgrounds/personal/friends_01.webp',
    '70% 50%',
    'Живая социальная сцена из ежедневной серии.',
  ),
  questionAsset(
    'question_conversation_03',
    'conversation',
    '/assets/card-backgrounds/personal/love_02.webp',
    '72% 50%',
    'Хвосты и тени создают интригу без буквальной иллюстрации разговора.',
  ),

  questionAsset(
    'question_attention_01',
    'attention',
    '/assets/card-backgrounds/hero/hero_04.webp',
    '68% 58%',
    'Кот среди крупных листьев и цветной архитектуры.',
  ),
  questionAsset(
    'question_attention_02',
    'attention',
    '/assets/card-backgrounds/personal/overview_01.webp',
    '70% 50%',
    'Наблюдательная сцена на ярких журналах для вопроса о внимании.',
  ),
  questionAsset(
    'question_attention_03',
    'attention',
    '/assets/card-backgrounds/personal/home_01.webp',
    '70% 52%',
    'Выразительная интерьерная сцена с частью кошачьей композиции.',
  ),
];

const PERSONAL_THEME_BY_SECTION: Record<Exclude<PersonalDailySection, 'overview'>, string> = {
  love: 'love',
  money: 'money',
  work: 'work',
  goals: 'goals',
  family: 'home_family',
  friendship: 'friends',
  energy: 'energy',
  communication: 'communication',
};

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function selectFrom(
  assets: CardBackgroundAsset[],
  category: CardBackgroundCategory,
  theme: string,
  userId: string,
  dateKey: string,
): CardBackgroundAsset | null {
  const candidates = assets.filter(
    (asset) => asset.enabled && asset.category === category && asset.theme === theme && asset.season === 'base',
  );
  if (!candidates.length) return null;
  const index = stableHash(`${userId || 'guest'}|${dateKey}|${category}|${theme}`) % candidates.length;
  return candidates[index] || candidates[0] || null;
}

function selectAsset(
  category: CardBackgroundCategory,
  theme: string,
  userId: string,
  dateKey: string,
): CardBackgroundAsset | null {
  return selectFrom(ASSETS, category, theme, userId, dateKey);
}

export function getHeroCardBackground(userId: string, dateKey: string): CardBackgroundAsset | null {
  return selectAsset('hero', 'personal_horoscope', userId, dateKey);
}

export function getPersonalCardBackground(
  section: PersonalDailySection,
  userId: string,
  dateKey: string,
): CardBackgroundAsset | null {
  if (section === 'overview') return getHeroCardBackground(userId, dateKey);
  return selectAsset('personal', PERSONAL_THEME_BY_SECTION[section], userId, dateKey);
}

export function getDailyQuestionCardBackground(
  theme: DailyQuestionTheme,
  userId: string,
  dateKey: string,
): CardBackgroundAsset | null {
  return selectFrom(QUESTION_ASSETS, 'personal', `question_${theme}`, userId, dateKey);
}

export function getUniversalCardBackground(
  theme: UniversalCardTheme,
  userId = 'guest',
  dateKey = 'base',
): CardBackgroundAsset | null {
  if (theme === 'natal' || theme === 'compatibility' || theme === 'matrix') {
    return selectFrom(PRODUCT_ASSETS, 'universal', theme, userId, dateKey);
  }
  return selectAsset('universal', theme, userId, dateKey);
}

export function getStripCardBackground(
  theme: 'advantage' | 'conversation',
): CardBackgroundAsset | null {
  return ASSETS.find(
    (asset) => asset.category === 'strips' && asset.theme === theme && asset.season === 'base',
  ) || null;
}

export function cardBackgroundStyle(asset: CardBackgroundAsset | null): CardBackgroundStyle | undefined {
  if (!asset) return undefined;
  return {
    '--card-bg-image': `url("${asset.path}")`,
    '--card-bg-position': asset.background_position || 'center',
  };
}
