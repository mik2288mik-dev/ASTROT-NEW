/**
 * Liquid Glass refraction maps for the floating chrome (tab bar and its drop).
 * Chromium applies them through `backdrop-filter: url(#id)`; WebKit falls back to the plain blur.
 */
export type LiquidGlassSize = { w: number; h: number; r: number; e: number };

/** A displacement map: red and blue ramps across a rounded rect with a soft neutral middle. */
export function liquidGlassMap({ w, h, r, e }: LiquidGlassSize): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>`
    + '<linearGradient id="r" x1="100%" y1="0%" x2="0%" y2="0%"><stop offset="0%" stop-color="#000"/><stop offset="100%" stop-color="#f00"/></linearGradient>'
    + '<linearGradient id="b" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#000"/><stop offset="100%" stop-color="#00f"/></linearGradient>'
    + `<filter id="f" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${e / 2.2}"/></filter></defs>`
    + `<rect width="${w}" height="${h}" fill="#000"/><rect width="${w}" height="${h}" rx="${r}" fill="url(#r)"/>`
    + `<rect width="${w}" height="${h}" rx="${r}" fill="url(#b)" style="mix-blend-mode:difference"/>`
    + `<rect x="${e}" y="${e}" width="${w - 2 * e}" height="${h - 2 * e}" rx="${Math.max(1, r - e)}" fill="rgb(128,128,128)" filter="url(#f)"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Channel-split displacement scales: red, green and blue bend a little differently, like real glass. */
export const LIQUID_GLASS_SCALES = {
  bar: [-70, -64, -59],
  drop: [-90, -83, -76],
} as const;
