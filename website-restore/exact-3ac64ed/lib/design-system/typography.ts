/**
 * App design system — Typography
 * Approved font family: Manrope everywhere in the product UI.
 * All size values are pixel numbers; lineHeight is a pixel value.
 */

export interface TypeStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  /** Optional letter-spacing in em */
  letterSpacing?: number;
}

export const fontFamily = {
  sans: 'Manrope, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  display: 'Manrope, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
} as const;

export const typography = {
  /** Hero card headline — 28/32, ExtraBold */
  display: {
    fontFamily: fontFamily.display,
    fontSize: 28,
    fontWeight: 800,
    lineHeight: 32,
    letterSpacing: -0.035,
  } satisfies TypeStyle,

  /** Card titles — 20/24, Bold */
  title: {
    fontFamily: fontFamily.display,
    fontSize: 20,
    fontWeight: 700,
    lineHeight: 24,
    letterSpacing: -0.025,
  } satisfies TypeStyle,

  /** Section headings — 18/22, SemiBold */
  subtitle: {
    fontFamily: fontFamily.sans,
    fontSize: 18,
    fontWeight: 600,
    lineHeight: 22,
    letterSpacing: -0.02,
  } satisfies TypeStyle,

  /** Descriptions and reading text — 14/20, Medium */
  body: {
    fontFamily: fontFamily.sans,
    fontSize: 14,
    fontWeight: 500,
    lineHeight: 20,
    letterSpacing: -0.005,
  } satisfies TypeStyle,

  /** Dates, labels and metadata — 12/16, Regular */
  caption: {
    fontFamily: fontFamily.sans,
    fontSize: 12,
    fontWeight: 400,
    lineHeight: 16,
  } satisfies TypeStyle,
} as const;

export type Typography = typeof typography;
export type TypeScale = keyof Typography;
