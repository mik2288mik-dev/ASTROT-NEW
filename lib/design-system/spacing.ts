/**
 * LUMIA Design System — Spacing
 * Base unit: 4px. All values are pixel numbers (apply via px() or template literal).
 */

// ─── Primitive scale ──────────────────────────────────────────────────────────

export const space = {
  1:  4,
  2:  8,
  3:  12,
  4:  16,
  6:  24,
  8:  32,
} as const;

// ─── Semantic layout tokens ───────────────────────────────────────────────────

export const spacing = {
  /** Horizontal page inset (left/right padding of scroll container) */
  pageX:       space[4],   // 16
  /** Vertical gap between major sections */
  sectionGap:  space[6],   // 24
  /** Vertical gap between cards within a section */
  cardGap:     space[3],   // 12
  /** Internal padding of a card */
  cardPadding: space[4],   // 16 — outer pad; plan cards use 20px (cardPaddingLg)
  /** Internal padding of large plan cards */
  cardPaddingLg: 20,
  /** Gap between grid columns (plan cards 2×2) */
  gridGap:     space[2],   // 8
  /** Small inline gap (icon → label, tag → tag) */
  inlineGap:   space[2],   // 8
  /** Minimum touch target height */
  touchTarget: 44,
  /** Bottom tab bar height (inner pill, without safe area) */
  tabBarH:     56,
} as const;

export type Spacing = typeof spacing;
