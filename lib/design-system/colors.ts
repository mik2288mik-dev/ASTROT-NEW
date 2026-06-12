/**
 * LUMIA Design System — Colors
 * Source of truth: reference image (white bg, pastel plan cards, black tab bar)
 *
 * Rules:
 *  - No gradients, no glass, no neon, no dark themes here
 *  - Every value used in UI must trace back to this file
 */

// ─── Primitive palette ────────────────────────────────────────────────────────

const white  = '#FFFFFF' as const;
const black  = '#111111' as const;

const gray = {
  /** Pure white page background */
  0:   '#FFFFFF',
  /** Very light surface (hover states, disabled bg) */
  50:  '#F7F7F7',
  /** Card borders, dividers */
  100: '#EFEFEF',
  /** Muted borders */
  200: '#E0E0E0',
  /** Placeholder text */
  400: '#AAAAAA',
  /** Muted / caption text */
  500: '#8A8A8A',
  /** Secondary body text */
  700: '#3D3D3D',
  /** Primary headings */
  900: '#111111',
} as const;

const purple = {
  /** Hero card background — soft lavender */
  100: '#CBC6F5',
  /** Light purple bg for accent surfaces */
  200: '#EDE9FF',
  /** CTA buttons, Personal Daily icon, arrow */
  500: '#7B5CF6',
  /** Darker state (pressed) */
  600: '#6444E8',
} as const;

const yellow = {
  /** Plan card — Натальная карта */
  400: '#F7D040',
  /** Tag chip on yellow card */
  tag: 'rgba(255, 255, 255, 0.60)',
} as const;

const blue = {
  /** Plan card — Гороскоп */
  300: '#A6D4F7',
  /** Tag chip on blue card */
  tag: 'rgba(255, 255, 255, 0.60)',
} as const;

const mint = {
  /** Plan card — Ask Lumia */
  300: '#9FE0C6',
  /** Tag chip on mint card */
  tag: 'rgba(255, 255, 255, 0.60)',
} as const;

const pink = {
  /** Plan card — Совместимость */
  300: '#F7B3C6',
  /** Tag chip on pink card */
  tag: 'rgba(255, 255, 255, 0.60)',
} as const;

// ─── Semantic tokens ──────────────────────────────────────────────────────────

export const colors = {

  // ── Page ──────────────────────────────────────────────────────────────────
  background: gray[0],

  // ── Text ──────────────────────────────────────────────────────────────────
  text: {
    /** Main headings, card titles */
    primary:   gray[900],
    /** Body copy, descriptions */
    secondary: gray[700],
    /** Dates, captions, placeholders */
    muted:     gray[500],
    /** Text on dark/coloured surfaces */
    inverse:   white,
  },

  // ── Surfaces ──────────────────────────────────────────────────────────────
  surface: {
    /** Standard white card */
    card:    white,
    /** Page background */
    page:    gray[0],
    /** Hover / subtle tint */
    soft:    gray[50],
  },

  // ── Hero card ─────────────────────────────────────────────────────────────
  hero: {
    /** Hero card background — "Сегодня для вас" */
    bg:       purple[100],
    title:    gray[900],
    body:     gray[700],
  },

  // ── Plan cards (2×2 grid) ─────────────────────────────────────────────────
  plan: {
    /** Натальная карта */
    natal: {
      bg:  yellow[400],
      tag: yellow.tag,
    },
    /** Гороскоп */
    horoscope: {
      bg:  blue[300],
      tag: blue.tag,
    },
    /** Ask Lumia */
    oracle: {
      bg:  mint[300],
      tag: mint.tag,
    },
    /** Совместимость */
    synastry: {
      bg:  pink[300],
      tag: pink.tag,
    },
  },

  // ── Accent / CTA ──────────────────────────────────────────────────────────
  accent: {
    /** Primary CTA, Personal Daily icon + arrow */
    default: purple[500],
    /** Pressed state */
    pressed: purple[600],
    /** Light tint bg (chips, highlights) */
    soft:    purple[200],
  },

  // ── Borders & dividers ────────────────────────────────────────────────────
  border: {
    default: 'rgba(0, 0, 0, 0.07)',
    muted:   'rgba(0, 0, 0, 0.04)',
  },

  // ── Bottom Tab Bar ────────────────────────────────────────────────────────
  tabBar: {
    /** Overall pill container */
    bg:            black,
    /** Active tab pill inside */
    activePill:    white,
    /** Active icon + label */
    activeContent: gray[900],
    /** Inactive icon + label */
    inactive:      'rgba(255, 255, 255, 0.55)',
  },

  // ── Day Picker ────────────────────────────────────────────────────────────
  dayPicker: {
    activeBg:    black,
    activeText:  white,
    inactiveText: gray[500],
    dot:         white,
  },

  // ── Header search button ──────────────────────────────────────────────────
  searchBtn: {
    bg:     gray[50],
    icon:   gray[900],
    border: 'rgba(0, 0, 0, 0.07)',
  },

  // ── Shadows (box-shadow values as strings) ────────────────────────────────
  shadow: {
    /** Standard white card */
    card:     '0 4px 20px rgba(0, 0, 0, 0.07)',
    /** Lifted card (plan cards, hover) */
    elevated: '0 8px 32px rgba(0, 0, 0, 0.10)',
    /** Bottom tab bar upward shadow */
    tabBar:   '0 -4px 20px rgba(0, 0, 0, 0.08)',
  },

} as const;

export type Colors = typeof colors;
