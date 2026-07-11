/**
 * App design system — Typography
 * Font family: Manrope (already loaded in project)
 * All size values are pixel numbers; lh is unitless line-height ratio.
 */

// ─── Type definitions ─────────────────────────────────────────────────────────

export interface TypeStyle {
  fontFamily: string;
  fontSize:   number;
  fontWeight: number;
  lineHeight: number;
  /** Optional letter-spacing in em */
  letterSpacing?: number;
}

// ─── Font family ──────────────────────────────────────────────────────────────

export const fontFamily = {
  sans: 'Manrope, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
} as const;

// ─── Scale ────────────────────────────────────────────────────────────────────

export const typography = {
  /**
   * Display — Hero card headline, page titles
   * Example: "Сегодня для вас"
   */
  display: {
    fontFamily:  fontFamily.sans,
    fontSize:    28,
    fontWeight:  700,
    lineHeight:  1.15,
  } satisfies TypeStyle,

  /**
   * Title — Section headings, card titles
   * Example: "Ваш план", "Натальная карта"
   */
  title: {
    fontFamily:  fontFamily.sans,
    fontSize:    22,
    fontWeight:  700,
    lineHeight:  1.2,
  } satisfies TypeStyle,

  /**
   * Subtitle — Sub-headings, plan card descriptions header
   * Example: "Что сегодня важно"
   */
  subtitle: {
    fontFamily:  fontFamily.sans,
    fontSize:    17,
    fontWeight:  600,
    lineHeight:  1.35,
  } satisfies TypeStyle,

  /**
   * Body — Main body copy, card descriptions
   * Example: reading paragraphs, card text
   */
  body: {
    fontFamily:  fontFamily.sans,
    fontSize:    14,
    fontWeight:  400,
    lineHeight:  1.55,
  } satisfies TypeStyle,

  /**
   * Caption — Tags, dates, labels, muted metadata
   * Example: "Натальная карта" tag chip, day picker labels
   */
  caption: {
    fontFamily:   fontFamily.sans,
    fontSize:     11,
    fontWeight:   500,
    lineHeight:   1.4,
    letterSpacing: 0.01,
  } satisfies TypeStyle,
} as const;

export type Typography = typeof typography;
export type TypeScale  = keyof Typography;
