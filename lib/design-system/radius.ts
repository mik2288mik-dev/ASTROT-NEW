/**
 * LUMIA Design System — Border Radius
 * All values are pixel numbers.
 */

// ─── Primitive scale ──────────────────────────────────────────────────────────

export const radii = {
  sm:  12,
  md:  16,
  lg:  24,
  xl:  32,
  /** Fully rounded (pills, avatars) */
  full: 9999,
} as const;

// ─── Semantic tokens ──────────────────────────────────────────────────────────

export const radius = {
  /** Small chips, tags on plan cards */
  tag:     radii.sm,   // 12
  /** Standard content cards (Horoscope reading, Personal Daily entry) */
  card:    radii.md,   // 16
  /** Large plan cards (2×2 grid hero-size) */
  planCard: 20,
  /** Hero card ("Сегодня для вас") */
  hero:    radii.lg,   // 24
  /** Mode segment switcher container */
  segment: radii.md,   // 16
  /** Active pill inside segment switcher */
  pill:    12,
  /** Button with rounded ends */
  button:  radii.full, // 9999
  /** Avatar, icon circle */
  avatar:  radii.full, // 9999
} as const;

export type Radius = typeof radius;
