import type { NatalChartData, PlanetPosition, UserProfile } from '../../types';

const ZODIAC_RU: Record<string, string> = {
  Aries: 'Овен',
  Taurus: 'Телец',
  Gemini: 'Близнецы',
  Cancer: 'Рак',
  Leo: 'Лев',
  Virgo: 'Дева',
  Libra: 'Весы',
  Scorpio: 'Скорпион',
  Sagittarius: 'Стрелец',
  Capricorn: 'Козерог',
  Aquarius: 'Водолей',
  Pisces: 'Рыбы',
};

const ZODIAC_RU_SET = new Set(Object.values(ZODIAC_RU));

function ruSign(sign?: string | null): string {
  if (!sign) return '—';
  const trimmed = String(sign).trim();
  if (ZODIAC_RU_SET.has(trimmed)) return trimmed;
  return ZODIAC_RU[trimmed] || trimmed;
}

function fmtDegree(deg?: number | null): string {
  if (typeof deg !== 'number' || !Number.isFinite(deg)) return '';
  const whole = Math.floor(deg);
  const minutes = Math.round((deg - whole) * 60);
  return `${String(whole).padStart(2, '0')}°${String(minutes).padStart(2, '0')}'`;
}

function planetEntry(name: string, p: PlanetPosition | null | undefined) {
  if (!p) return null;
  return {
    name,
    sign: ruSign(p.sign),
    house: p.house != null ? Number(p.house) : null,
    deg: fmtDegree(p.degree),
    retro: !!p.retrograde,
  };
}

export type SerializedChartForPrompt = {
  name: string;
  birthdate: string;
  birthtime: string;
  birthplace: string;
  asc: { sign: string; deg: string };
  mc: { sign: string; deg: string };
  planets: ReturnType<typeof planetEntry>[];
  houses: { num: number; sign: string }[];
  signature: { sun: string; moon: string; rising: string };
};

/** Convert internal NatalChartData → the compact JSON the prompts expect. */
export function serializeChartForPrompt(
  profile: UserProfile,
  data: NatalChartData
): SerializedChartForPrompt {
  const planets: ReturnType<typeof planetEntry>[] = [
    planetEntry('Солнце', data.sun),
    planetEntry('Луна', data.moon),
    planetEntry('Меркурий', data.mercury),
    planetEntry('Венера', data.venus),
    planetEntry('Марс', data.mars),
    planetEntry('Юпитер', data.jupiter),
    planetEntry('Сатурн', data.saturn),
    planetEntry('Уран', data.uranus),
    planetEntry('Нептун', data.neptune),
    planetEntry('Плутон', data.pluto),
    planetEntry('Хирон', data.chiron),
  ].filter(Boolean);

  const houses = (data.houses || []).map((h) => ({
    num: h.house,
    sign: ruSign(h.sign),
  }));

  // MC = 10th house cusp (when houses are present)
  const tenth = houses.find((h) => h.num === 10);
  const mcSign = tenth?.sign || ruSign(data.rising?.sign);
  const mcDeg =
    typeof data.houses?.find((h) => h.house === 10)?.degree === 'number'
      ? fmtDegree(data.houses!.find((h) => h.house === 10)!.degree)
      : '';

  return {
    name: profile.name || 'Друг',
    birthdate: profile.birthDate || '',
    birthtime: profile.birthTime || '',
    birthplace: profile.birthPlace || '',
    asc: {
      sign: ruSign(data.rising?.sign),
      deg: fmtDegree(data.rising?.degree),
    },
    mc: { sign: mcSign, deg: mcDeg },
    planets,
    houses,
    signature: {
      sun: ruSign(data.sun?.sign),
      moon: ruSign(data.moon?.sign),
      rising: ruSign(data.rising?.sign),
    },
  };
}
