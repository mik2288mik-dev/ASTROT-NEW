/**
 * Цвет ясного неба по высоте Солнца над горизонтом (градусы).
 * Опорные точки сняты с фотографий чистого неба: ночь, астрономические и
 * гражданские сумерки, рассвет/закат, утро/вечер, полдень. Между ними — плавно.
 */
export type Rgb = [number, number, number];
export type SkyPalette = {
  /** Цвета сверху вниз: зенит, середина, низ, у горизонта. */
  colors: [Rgb, Rgb, Rgb, Rgb];
  /** 0..1 — насколько видны звёзды. */
  stars: number;
  /** Свечение Солнца у края карточки; null, когда Солнце глубоко под горизонтом. */
  glow: { color: Rgb; alpha: number; y: number } | null;
};

type Key = { alt: number; colors: [Rgb, Rgb, Rgb, Rgb]; stars: number; glow: Rgb; glowAlpha: number };

const KEYS: Key[] = [
  { alt: -18, colors: [[3, 6, 15], [8, 18, 43], [18, 35, 71], [28, 46, 82]], stars: 1, glow: [255, 140, 90], glowAlpha: 0 },
  { alt: -10, colors: [[9, 18, 48], [24, 38, 86], [64, 66, 116], [112, 86, 118]], stars: 0.6, glow: [255, 140, 90], glowAlpha: 0.14 },
  { alt: -4, colors: [[27, 47, 102], [86, 88, 148], [200, 118, 110], [248, 168, 120]], stars: 0.12, glow: [255, 150, 90], glowAlpha: 0.45 },
  { alt: 2, colors: [[40, 80, 150], [108, 138, 198], [226, 168, 140], [255, 198, 150]], stars: 0, glow: [255, 190, 130], glowAlpha: 0.5 },
  { alt: 12, colors: [[30, 90, 190], [68, 134, 218], [134, 182, 234], [196, 220, 244]], stars: 0, glow: [255, 250, 230], glowAlpha: 0.4 },
  { alt: 35, colors: [[22, 82, 184], [58, 126, 214], [120, 172, 230], [186, 212, 240]], stars: 0, glow: [255, 252, 236], glowAlpha: 0.35 },
];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

export function skyPaletteForSunAltitude(altitude: number): SkyPalette {
  const alt = Number.isFinite(altitude) ? altitude : -30;
  let lo = KEYS[0];
  let hi = KEYS[KEYS.length - 1];
  if (alt <= lo.alt) hi = lo;
  else if (alt >= hi.alt) lo = hi;
  else {
    for (let i = 0; i < KEYS.length - 1; i++) {
      if (alt >= KEYS[i].alt && alt <= KEYS[i + 1].alt) { lo = KEYS[i]; hi = KEYS[i + 1]; break; }
    }
  }
  const t = hi.alt === lo.alt ? 0 : (alt - lo.alt) / (hi.alt - lo.alt);
  const colors = lo.colors.map((color, index) => mix(color, hi.colors[index], t)) as SkyPalette['colors'];
  const glowAlpha = lerp(lo.glowAlpha, hi.glowAlpha, t);
  return {
    colors,
    stars: Math.max(0, Math.min(1, lerp(lo.stars, hi.stars, t))),
    // Низкое Солнце светит снизу, высокое — сверху.
    glow: glowAlpha > 0.02 ? { color: mix(lo.glow, hi.glow, t), alpha: glowAlpha, y: Math.max(-0.15, Math.min(1.05, 1.05 - alt / 30)) } : null,
  };
}

/** Примерные координаты наблюдателя по часовому поясу телефона (без запроса геолокации). */
export function approximateObserver(timeZone: string | undefined, offsetMinutes: number): { latitude: number; longitude: number } {
  const known: Record<string, [number, number]> = {
    'Europe/Moscow': [55.75, 37.62],
    'Europe/Kaliningrad': [54.71, 20.51],
    'Europe/Samara': [53.2, 50.15],
    'Asia/Yekaterinburg': [56.84, 60.6],
    'Asia/Omsk': [54.99, 73.37],
    'Asia/Novosibirsk': [55.03, 82.92],
    'Asia/Krasnoyarsk': [56.01, 92.85],
    'Asia/Irkutsk': [52.29, 104.3],
    'Asia/Yakutsk': [62.03, 129.73],
    'Asia/Vladivostok': [43.12, 131.89],
    'Asia/Magadan': [59.56, 150.8],
    'Asia/Kamchatka': [53.04, 158.65],
  };
  const hit = timeZone ? known[timeZone] : undefined;
  if (hit) return { latitude: hit[0], longitude: hit[1] };
  return { latitude: 55, longitude: Math.max(-180, Math.min(180, -offsetMinutes / 4)) };
}
