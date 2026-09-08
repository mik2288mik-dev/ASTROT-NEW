/** Dedicated artwork for the new Zodiac screen. */
export const ZODIAC_ART_READY = new Set<string>(["aries","taurus","gemini","cancer","leo","virgo","libra","scorpio","sagittarius","capricorn","aquarius","pisces"]);
export const zodiacHeroArtwork = (sign: string) => `/assets/nebo-refined/zodiac-v1/${sign.toLowerCase()}.webp`;
