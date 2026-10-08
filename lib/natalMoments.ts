import type { NatalBodyKey, NatalChartDataV2 } from './natalChartV2Types';
import { aspectMeaningRu } from './natalInterpretation/aspectMeanings';
import { BODY_LABELS, HOUSE_AREAS_RU } from './natalInterpretation/meanings';
import type { NatalInterpretationEvidence } from './natalInterpretation/types';

/**
 * «Фишки карты»: short, checkable facts computed from the stored chart.
 * Every moment states something that is literally true about the chart and
 * explains it in plain words. Nothing here calls a model or the server.
 */

type AstronomyEngine = typeof import('astronomy-engine');

export type NatalElement = 'fire' | 'earth' | 'air' | 'water';
export type MomentTone = 'day' | 'evening' | 'sunset' | 'neutral';

export type MomentVisual =
  | { kind: 'number'; value: string }
  | { kind: 'moon'; illumination: number; waxing: boolean }
  | { kind: 'sun' }
  | { kind: 'retrograde' }
  | { kind: 'elements'; counts: Record<NatalElement, number>; planets: Record<NatalElement, string[]> };

export type NatalMoment = {
  id: string;
  kicker: string;
  headline: string;
  body: string;
  tone: MomentTone;
  visual: MomentVisual;
};

export type BigThreeTile = {
  key: 'sun' | 'moon' | 'ascendant';
  label: string;
  role: string;
  sign: string;
  signLabel: string;
  trait: string;
};

export const MOMENT_PLANETS: readonly NatalBodyKey[] = [
  'sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto',
];

const SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
] as const;

export const SIGN_NOMINATIVE_RU: Record<string, string> = {
  Aries: 'Овен', Taurus: 'Телец', Gemini: 'Близнецы', Cancer: 'Рак', Leo: 'Лев', Virgo: 'Дева',
  Libra: 'Весы', Scorpio: 'Скорпион', Sagittarius: 'Стрелец', Capricorn: 'Козерог', Aquarius: 'Водолей', Pisces: 'Рыбы',
};

export const SIGN_LOCATIVE_RU: Record<string, string> = {
  Aries: 'Овне', Taurus: 'Тельце', Gemini: 'Близнецах', Cancer: 'Раке', Leo: 'Льве', Virgo: 'Деве',
  Libra: 'Весах', Scorpio: 'Скорпионе', Sagittarius: 'Стрельце', Capricorn: 'Козероге', Aquarius: 'Водолее', Pisces: 'Рыбах',
};

const SIGN_GENITIVE_RU: Record<string, string> = {
  Aries: 'Овна', Taurus: 'Тельца', Gemini: 'Близнецов', Cancer: 'Рака', Leo: 'Льва', Virgo: 'Девы',
  Libra: 'Весов', Scorpio: 'Скорпиона', Sagittarius: 'Стрельца', Capricorn: 'Козерога', Aquarius: 'Водолея', Pisces: 'Рыб',
};

/** Two-to-four-word theme of each sign, used wherever a sign needs a plain gloss. */
export const SIGN_TRAIT_RU: Record<string, string> = {
  Aries: 'напор и скорость',
  Taurus: 'спокойствие и надёжность',
  Gemini: 'любопытство и разговоры',
  Cancer: 'забота и свои люди',
  Leo: 'яркость и щедрость',
  Virgo: 'точность и польза',
  Libra: 'баланс и договорённости',
  Scorpio: 'глубина и серьёзность',
  Sagittarius: 'смысл и новое',
  Capricorn: 'порядок и результат',
  Aquarius: 'свобода и своё мнение',
  Pisces: 'чуткость и воображение',
};

export const ELEMENT_OF_SIGN: Record<string, NatalElement> = {
  Aries: 'fire', Leo: 'fire', Sagittarius: 'fire',
  Taurus: 'earth', Virgo: 'earth', Capricorn: 'earth',
  Gemini: 'air', Libra: 'air', Aquarius: 'air',
  Cancer: 'water', Scorpio: 'water', Pisces: 'water',
};

export const ELEMENT_ORDER: readonly NatalElement[] = ['water', 'earth', 'air', 'fire'];

export const ELEMENT_LABEL_RU: Record<NatalElement, string> = {
  fire: 'Огонь', earth: 'Земля', air: 'Воздух', water: 'Вода',
};

/** The three signs of each element, so the card can say where a count comes from. */
export const ELEMENT_SIGNS_RU: Record<NatalElement, string> = {
  fire: 'Овен, Лев, Стрелец',
  earth: 'Телец, Дева, Козерог',
  air: 'Близнецы, Весы, Водолей',
  water: 'Рак, Скорпион, Рыбы',
};

const ELEMENT_GENITIVE_RU: Record<NatalElement, string> = {
  fire: 'Огня', earth: 'Земли', air: 'Воздуха', water: 'Воды',
};

const ELEMENT_LEAD_RU: Record<NatalElement, string> = {
  water: 'Чувства и близкие у тебя на первом месте',
  earth: 'Ты опираешься на практичность и понятный результат',
  air: 'Тебе важны общение, идеи и обмен мнениями',
  fire: 'В тебе много энергии и желания действовать',
};

const ELEMENT_ABSENT_RU: Record<NatalElement, string> = {
  fire: 'Огня нет совсем: на одном порыве ты действуешь редко',
  earth: 'Земли нет совсем: быт и рутина даются через усилие',
  air: 'Воздуха нет совсем: разговоры ради разговоров быстро утомляют',
  water: 'Воды нет совсем: чувства ты скорее обдумываешь, чем показываешь',
};

const ELEMENT_LEAST_RU: Record<NatalElement, string> = {
  fire: 'Огня меньше всего: спонтанные порывы, не главное в тебе',
  earth: 'Земли меньше всего: быт и рутина, не самое сильное место',
  air: 'Воздуха меньше всего: пустые разговоры быстро утомляют',
  water: 'Воды меньше всего: чувства ты чаще обдумываешь, чем показываешь',
};

const RETROGRADE_RU: Partial<Record<NatalBodyKey, string>> = {
  mercury: 'Мысли чаще возвращаются к уже решённому: ты перепроверяешь, прежде чем сказать',
  venus: 'Симпатия проявляется не сразу: тебе нужно время, чтобы присмотреться к человеку',
  mars: 'Силы копятся внутри, прежде чем выйти наружу: ты не бросаешься в бой первым',
};

const PLANET_NAME_RU = (key: NatalBodyKey) => BODY_LABELS[key].ru;

function joinRu(items: string[]): string {
  if (items.length < 2) return items.join('');
  return `${items.slice(0, -1).join(', ')} и ${items[items.length - 1]}`;
}

function planetsWordRu(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'планета';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'планеты';
  return 'планет';
}

function hoursWordRu(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'час';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'часа';
  return 'часов';
}

function placed(chart: NatalChartDataV2): Array<{ key: NatalBodyKey; sign: string; longitude: number; house: number | null }> {
  return MOMENT_PLANETS.flatMap((key) => {
    const position = chart.positions?.[key];
    if (!position || !SIGNS.includes(position.sign as typeof SIGNS[number])) return [];
    return [{ key, sign: position.sign, longitude: position.longitude, house: position.house ?? null }];
  });
}

export function buildBigThree(chart: NatalChartDataV2): BigThreeTile[] {
  const tiles: BigThreeTile[] = [];
  const sun = chart.positions?.sun?.sign;
  const moon = chart.positions?.moon?.sign;
  const ascendant = chart.chartQuality?.ascendantReliable ? chart.angles?.ascendant?.sign : null;
  if (sun) tiles.push({ key: 'sun', label: 'Солнце', role: 'Как ты действуешь', sign: sun, signLabel: SIGN_NOMINATIVE_RU[sun] ?? sun, trait: SIGN_TRAIT_RU[sun] ?? '' });
  if (moon) tiles.push({ key: 'moon', label: 'Луна', role: 'Что тебе нужно', sign: moon, signLabel: SIGN_NOMINATIVE_RU[moon] ?? moon, trait: SIGN_TRAIT_RU[moon] ?? '' });
  if (ascendant) tiles.push({ key: 'ascendant', label: 'Асцендент', role: 'Первое впечатление', sign: ascendant, signLabel: SIGN_NOMINATIVE_RU[ascendant] ?? ascendant, trait: SIGN_TRAIT_RU[ascendant] ?? '' });
  return tiles;
}

export function countElements(chart: NatalChartDataV2): Record<NatalElement, number> {
  const counts: Record<NatalElement, number> = { fire: 0, earth: 0, air: 0, water: 0 };
  for (const item of placed(chart)) counts[ELEMENT_OF_SIGN[item.sign]] += 1;
  return counts;
}

function elementMoment(chart: NatalChartDataV2): NatalMoment | null {
  const counts = countElements(chart);
  const planets: Record<NatalElement, string[]> = { fire: [], earth: [], air: [], water: [] };
  for (const item of placed(chart)) planets[ELEMENT_OF_SIGN[item.sign]].push(PLANET_NAME_RU(item.key));
  const total = ELEMENT_ORDER.reduce((sum, element) => sum + counts[element], 0);
  if (total < 6) return null;
  const sorted = [...ELEMENT_ORDER].sort((a, b) => counts[b] - counts[a]);
  const top = sorted.filter((element) => counts[element] === counts[sorted[0]]);
  const bottom = sorted[sorted.length - 1];
  const headline = top.length === 1
    ? `Больше всего в тебе ${ELEMENT_GENITIVE_RU[top[0]]}`
    : `Поровну ${joinRu(top.map((element) => ELEMENT_GENITIVE_RU[element]))}`;
  const lead = top.length === 1 ? `${ELEMENT_LEAD_RU[top[0]]}. ` : '';
  const tail = top.includes(bottom)
    ? ''
    : counts[bottom] === 0 ? ELEMENT_ABSENT_RU[bottom] : ELEMENT_LEAST_RU[bottom];
  return {
    id: 'elements',
    kicker: 'Твои стихии',
    headline,
    body: `${lead}${tail}${tail ? '.' : ''}`.trim(),
    tone: 'neutral',
    visual: { kind: 'elements', counts, planets },
  };
}

function stelliumMoment(chart: NatalChartDataV2): NatalMoment | null {
  const bySign = new Map<string, NatalBodyKey[]>();
  for (const item of placed(chart)) bySign.set(item.sign, [...(bySign.get(item.sign) ?? []), item.key]);
  const best = [...bySign.entries()].filter(([, keys]) => keys.length >= 3).sort((a, b) => b[1].length - a[1].length)[0];
  if (!best) return null;
  const [sign, keys] = best;
  return {
    id: `stellium:${sign}`,
    kicker: 'Перевес в одном знаке',
    headline: `${keys.length} ${planetsWordRu(keys.length)} в ${SIGN_LOCATIVE_RU[sign]}`,
    body: `${joinRu(keys.map(PLANET_NAME_RU))} в одном знаке, так бывает не у всех. Тема ${SIGN_GENITIVE_RU[sign]} - ${SIGN_TRAIT_RU[sign]}, у тебя звучит громче обычного.`,
    tone: 'day',
    visual: { kind: 'number', value: String(keys.length) },
  };
}

function houseMoment(chart: NatalChartDataV2): NatalMoment | null {
  if (!chart.chartQuality?.housesReliable) return null;
  const byHouse = new Map<number, NatalBodyKey[]>();
  for (const item of placed(chart)) {
    if (item.house) byHouse.set(item.house, [...(byHouse.get(item.house) ?? []), item.key]);
  }
  const best = [...byHouse.entries()].filter(([, keys]) => keys.length >= 3).sort((a, b) => b[1].length - a[1].length)[0];
  if (!best) return null;
  const [house, keys] = best;
  const area = HOUSE_AREAS_RU[house];
  if (!area) return null;
  return {
    id: `house:${house}`,
    kicker: 'Где сосредоточена жизнь',
    headline: `${keys.length} ${planetsWordRu(keys.length)} в ${house} доме`,
    body: `${joinRu(keys.map(PLANET_NAME_RU))}. ${house} дом, это ${area}. Эта часть жизни у тебя в фокусе.`,
    tone: 'sunset',
    visual: { kind: 'number', value: String(house) },
  };
}

function sunEdgeMoment(chart: NatalChartDataV2): NatalMoment | null {
  const sun = chart.positions?.sun;
  if (!sun || !chart.chartQuality?.exactTime) return null;
  const perHour = Math.abs(sun.speedLongitude || 0.9856) / 24;
  const index = SIGNS.indexOf(sun.sign as typeof SIGNS[number]);
  if (index < 0 || perHour <= 0) return null;
  if (sun.degree < 1) {
    const hours = Math.max(1, Math.round(sun.degree / perHour));
    const previous = SIGNS[(index + 11) % 12];
    return {
      id: 'sun-edge:start',
      kicker: 'Самое начало знака',
      headline: hours >= 24
        ? `Солнце было в ${SIGN_LOCATIVE_RU[sun.sign]} всего сутки`
        : `Солнце было в ${SIGN_LOCATIVE_RU[sun.sign]} всего ${hours} ${hoursWordRu(hours)}`,
      body: `Это самые первые часы знака. Чуть раньше, и твоим знаком был бы ${SIGN_NOMINATIVE_RU[previous]}.`,
      tone: 'day',
      visual: { kind: 'number', value: `${Math.min(hours, 24)}ч` },
    };
  }
  if (sun.degree > 29) {
    const hours = Math.max(1, Math.round((30 - sun.degree) / perHour));
    const next = SIGNS[(index + 1) % 12];
    return {
      id: 'sun-edge:end',
      kicker: 'На границе знаков',
      headline: hours >= 24
        ? `До ${SIGN_GENITIVE_RU[next]} Солнцу оставались сутки`
        : `До ${SIGN_GENITIVE_RU[next]} Солнцу оставалось ${hours} ${hoursWordRu(hours)}`,
      body: `Это последние часы ${SIGN_GENITIVE_RU[sun.sign]}. Чуть позже, и твоим знаком был бы ${SIGN_NOMINATIVE_RU[next]}.`,
      tone: 'day',
      visual: { kind: 'number', value: `${Math.min(hours, 24)}ч` },
    };
  }
  return null;
}

const PLANET_ASPECT_KEYS = new Set<string>(MOMENT_PLANETS);

function tightAspectMoment(chart: NatalChartDataV2): NatalMoment | null {
  const candidates = (chart.aspects ?? [])
    .filter((aspect) => PLANET_ASPECT_KEYS.has(aspect.fromKey) && PLANET_ASPECT_KEYS.has(aspect.toKey) && aspect.orb < 1)
    .sort((a, b) => a.orb - b.orb);
  for (const aspect of candidates) {
    const meaning = aspectMeaningRu({
      id: aspect.id,
      kind: 'aspect',
      reliability: 'exact',
      aspectType: aspect.type,
      fromKey: aspect.fromKey,
      toKey: aspect.toKey,
      orb: aspect.orb,
    } as NatalInterpretationEvidence);
    if (!meaning) continue;
    const from = PLANET_NAME_RU(aspect.fromKey as NatalBodyKey);
    const to = PLANET_NAME_RU(aspect.toKey as NatalBodyKey);
    return {
      id: `aspect:${aspect.id}`,
      kicker: 'Почти точное совпадение',
      headline: `${from} и ${to}, самая точная связь`,
      body: meaning.text,
      tone: aspect.type === 'square' || aspect.type === 'opposition' ? 'sunset' : 'evening',
      visual: { kind: 'number', value: `${aspect.orb.toFixed(2).replace('.', ',')}°` },
    };
  }
  return null;
}

function retrogradeMoment(chart: NatalChartDataV2): NatalMoment | null {
  const keys = (['mercury', 'venus', 'mars'] as const).filter((key) => chart.positions?.[key]?.retrograde === true);
  if (!keys.length) return null;
  const names = keys.map(PLANET_NAME_RU);
  const verb = keys.length === 1 ? (keys[0] === 'venus' ? 'шла' : 'шёл') : 'шли';
  return {
    id: `retro:${keys.join(',')}`,
    kicker: 'Редкость дня рождения',
    headline: `${joinRu(names)} ${verb} назад`,
    body: `С Земли казалось, что ${keys.length === 1 ? 'планета движется' : 'они движутся'} в обратную сторону. ${RETROGRADE_RU[keys[0]] ?? ''}.`,
    tone: 'neutral',
    visual: { kind: 'retrograde' },
  };
}

/** Moments computable without extra libraries, in display order. */
export function buildChartMoments(chart: NatalChartDataV2): NatalMoment[] {
  return [
    sunEdgeMoment(chart),
    stelliumMoment(chart),
    elementMoment(chart),
    tightAspectMoment(chart),
    retrogradeMoment(chart),
    houseMoment(chart),
  ].filter((moment): moment is NatalMoment => moment !== null);
}

function formatDateRu(date: Date, timezone: string): string {
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
  let text: string;
  try {
    text = date.toLocaleDateString('ru-RU', { ...options, timeZone: timezone });
  } catch {
    text = date.toLocaleDateString('ru-RU', options);
  }
  return text.replace(/\s*г\.?$/u, '');
}

/** «на следующий день после», «за два дня до», «в тот же день, что и» … */
export function relativeDayPhraseRu(hoursFromEvent: number): string | null {
  const days = Math.round(Math.abs(hoursFromEvent) / 24);
  if (Math.abs(hoursFromEvent) < 12) return 'в тот же день, что и';
  if (days > 3) return null;
  const word = days === 1 ? 'день' : days === 2 ? 'два дня' : 'три дня';
  if (hoursFromEvent > 0) return days === 1 ? 'на следующий день после' : `через ${word} после`;
  return `за ${word} до`;
}

/**
 * Sky events around the birth: eclipses within three days and the nearest
 * solstice or equinox within two days. Needs astronomy-engine, loaded lazily.
 */
export function buildSkyEventMoments(chart: NatalChartDataV2, engine: AstronomyEngine): NatalMoment[] {
  const utc = chart.birth?.interval?.referenceUtc;
  if (!utc) return [];
  const birth = new Date(utc);
  if (!Number.isFinite(birth.getTime())) return [];
  const timezone = chart.birth.timezone || 'UTC';
  const south = (chart.birth.latitude ?? 0) < 0;
  const moments: NatalMoment[] = [];
  const window = new Date(birth.getTime() - 4 * 86_400_000);
  const hoursFrom = (date: Date) => (birth.getTime() - date.getTime()) / 3_600_000;

  const sun = chart.positions?.sun?.longitude;
  const moon = chart.positions?.moon?.longitude;
  const elongation = typeof sun === 'number' && typeof moon === 'number' ? ((moon - sun) % 360 + 360) % 360 : null;
  const illumination = elongation === null ? null : Math.round(((1 - Math.cos((elongation * Math.PI) / 180)) / 2) * 100);

  const lunar = engine.SearchLunarEclipse(window);
  const lunarHours = hoursFrom(lunar.peak.date);
  if (lunar.kind !== 'penumbral' && Math.abs(lunarHours) <= 84) {
    const phrase = relativeDayPhraseRu(lunarHours);
    if (phrase) {
      const kind = lunar.kind === 'total' ? 'полного' : 'частичного';
      moments.push({
        id: 'sky:lunar-eclipse',
        kicker: 'Твой день рождения',
        headline: `${phrase[0].toUpperCase()}${phrase.slice(1)} ${kind} лунного затмения`,
        body: `${formatDateRu(lunar.peak.date, timezone)} было ${kind} затмение Луны.${illumination !== null ? ` В момент твоего рождения Луна была освещена на ${illumination}%.` : ''}`,
        tone: 'evening',
        visual: { kind: 'moon', illumination: illumination ?? 100, waxing: (elongation ?? 180) < 180 },
      });
    }
  }

  const solar = engine.SearchGlobalSolarEclipse(window);
  const solarHours = hoursFrom(solar.peak.date);
  if (Math.abs(solarHours) <= 84) {
    const phrase = relativeDayPhraseRu(solarHours);
    if (phrase) {
      const kind = solar.kind === 'total' ? 'полного' : solar.kind === 'annular' ? 'кольцеобразного' : 'частичного';
      moments.push({
        id: 'sky:solar-eclipse',
        kicker: 'Твой день рождения',
        headline: `${phrase[0].toUpperCase()}${phrase.slice(1)} ${kind} солнечного затмения`,
        body: `${formatDateRu(solar.peak.date, timezone)} Луна закрыла Солнце. Видно было не везде, но в астрономических календарях этот день отмечен.`,
        tone: 'evening',
        visual: { kind: 'sun' },
      });
    }
  }

  const seasons = engine.Seasons(birth.getUTCFullYear());
  const events: Array<{ date: Date; north: string; southern: string }> = [
    { date: seasons.mar_equinox.date, north: 'весеннего равноденствия, когда день равен ночи', southern: 'осеннего равноденствия, когда день равен ночи' },
    { date: seasons.jun_solstice.date, north: 'летнего солнцестояния, самого длинного дня в году', southern: 'зимнего солнцестояния, самого короткого дня в году' },
    { date: seasons.sep_equinox.date, north: 'осеннего равноденствия, когда день равен ночи', southern: 'весеннего равноденствия, когда день равен ночи' },
    { date: seasons.dec_solstice.date, north: 'зимнего солнцестояния, самого короткого дня в году', southern: 'летнего солнцестояния, самого длинного дня в году' },
  ];
  for (const event of events) {
    const hours = hoursFrom(event.date);
    if (Math.abs(hours) > 48) continue;
    const phrase = relativeDayPhraseRu(hours);
    if (!phrase) continue;
    moments.push({
      id: 'sky:season',
      kicker: 'Особый день года',
      headline: `${phrase[0].toUpperCase()}${phrase.slice(1)} ${south ? event.southern : event.north}`,
      body: `${formatDateRu(event.date, timezone)} Солнце перешло в новый сезон. С этого дня меняется длина светового дня.`,
      tone: 'day',
      visual: { kind: 'sun' },
    });
    break;
  }

  if (!moments.some((moment) => moment.id === 'sky:lunar-eclipse') && illumination !== null && (illumination >= 97 || illumination <= 3)) {
    const full = illumination >= 97;
    moments.push({
      id: 'sky:moon-phase',
      kicker: 'Луна в день рождения',
      headline: full ? 'Полнолуние в день рождения' : 'Новолуние в день рождения',
      body: full
        ? `Луна была освещена на ${illumination}%: в ту ночь было по-настоящему светло.`
        : `Луна была почти не видна: освещена на ${illumination}%.`,
      tone: 'evening',
      visual: { kind: 'moon', illumination, waxing: (elongation ?? 0) < 180 },
    });
  }

  return moments;
}
