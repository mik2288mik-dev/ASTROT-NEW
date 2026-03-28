/**
 * Config-driven presets for server-rendered Lumia notification cards (non-AI).
 */

export const GENERATED_PRESET_IDS = ['morning-soft', 'day-energy', 'evening-moon'] as const;
export type GeneratedCardPresetId = (typeof GENERATED_PRESET_IDS)[number];

export type CardPresetConfig = {
  id: GeneratedCardPresetId;
  label: { ru: string; en: string };
  /** SVG gradient stop colors (top → bottom feel) */
  gradientTop: string;
  gradientMid: string;
  gradientBottom: string;
  /** Accent line / small caps */
  accentColor: string;
  titleColor: string;
  subtitleColor: string;
  bodyColor: string;
  brandColor: string;
  /** Decorative corner glow */
  glowColor: string;
  glowOpacity: number;
};

export const NOTIFICATION_CARD_PRESETS: Record<GeneratedCardPresetId, CardPresetConfig> = {
  'morning-soft': {
    id: 'morning-soft',
    label: { ru: 'Утро — мягкий свет', en: 'Morning — soft light' },
    gradientTop: '#1a1f2e',
    gradientMid: '#252b3d',
    gradientBottom: '#1e2433',
    accentColor: '#c4b5fd',
    titleColor: '#f4f4f5',
    subtitleColor: '#a1a1aa',
    bodyColor: '#d4d4d8',
    brandColor: '#BFA1FF',
    glowColor: '#a78bfa',
    glowOpacity: 0.22,
  },
  'day-energy': {
    id: 'day-energy',
    label: { ru: 'День — энергия', en: 'Day — energy' },
    gradientTop: '#1c1917',
    gradientMid: '#292524',
    gradientBottom: '#1c1917',
    accentColor: '#fbbf24',
    titleColor: '#fafaf9',
    subtitleColor: '#a8a29e',
    bodyColor: '#e7e5e4',
    brandColor: '#BFA1FF',
    glowColor: '#f59e0b',
    glowOpacity: 0.18,
  },
  'evening-moon': {
    id: 'evening-moon',
    label: { ru: 'Вечер — луна', en: 'Evening — moon' },
    gradientTop: '#0f172a',
    gradientMid: '#1e1b4b',
    gradientBottom: '#0c1222',
    accentColor: '#93c5fd',
    titleColor: '#f1f5f9',
    subtitleColor: '#94a3b8',
    bodyColor: '#cbd5e1',
    brandColor: '#BFA1FF',
    glowColor: '#6366f1',
    glowOpacity: 0.2,
  },
};

export function isValidGeneratedPreset(id: string | null | undefined): id is GeneratedCardPresetId {
  return !!id && GENERATED_PRESET_IDS.includes(id as GeneratedCardPresetId);
}

export function getPresetOrDefault(id: string | null | undefined): CardPresetConfig {
  if (isValidGeneratedPreset(id)) {
    return NOTIFICATION_CARD_PRESETS[id];
  }
  return NOTIFICATION_CARD_PRESETS['morning-soft'];
}
