import type { NatalChartData } from '../../types';

export type ElementKey = 'fire' | 'earth' | 'air' | 'water';
export type ModalityKey = 'cardinal' | 'fixed' | 'mutable';

const SIGN_ELEMENT: Record<string, ElementKey> = {
  aries: 'fire', leo: 'fire', sagittarius: 'fire',
  taurus: 'earth', virgo: 'earth', capricorn: 'earth',
  gemini: 'air', libra: 'air', aquarius: 'air',
  cancer: 'water', scorpio: 'water', pisces: 'water',
};

const SIGN_MODALITY: Record<string, ModalityKey> = {
  aries: 'cardinal', cancer: 'cardinal', libra: 'cardinal', capricorn: 'cardinal',
  taurus: 'fixed', leo: 'fixed', scorpio: 'fixed', aquarius: 'fixed',
  gemini: 'mutable', virgo: 'mutable', sagittarius: 'mutable', pisces: 'mutable',
};

/* Учитываем личные + социальные планеты и (если время надёжно) Асцендент. */
const COUNT_KEYS: Array<keyof NatalChartData> = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'];

export type ChartBalance = {
  elements: Record<ElementKey, number>;
  modalities: Record<ModalityKey, number>;
  total: number;
  topElement: ElementKey | null;
  lowElement: ElementKey | null;
  topModality: ModalityKey | null;
};

function norm(sign?: string | null): string {
  return String(sign || '').trim().toLowerCase();
}

export function computeChartBalance(chart: NatalChartData | null | undefined, includeAscendant = true): ChartBalance {
  const elements: Record<ElementKey, number> = { fire: 0, earth: 0, air: 0, water: 0 };
  const modalities: Record<ModalityKey, number> = { cardinal: 0, fixed: 0, mutable: 0 };

  if (!chart) {
    return { elements, modalities, total: 0, topElement: null, lowElement: null, topModality: null };
  }

  const points: Array<string | undefined> = COUNT_KEYS.map((key) => (chart[key] as { sign?: string } | undefined)?.sign);
  if (includeAscendant) points.push((chart.rising as { sign?: string } | undefined)?.sign);

  let total = 0;
  for (const raw of points) {
    const sign = norm(raw);
    const el = SIGN_ELEMENT[sign];
    const mod = SIGN_MODALITY[sign];
    if (el) { elements[el] += 1; total += 1; }
    if (mod) { modalities[mod] += 1; }
  }

  const elEntries = (Object.entries(elements) as Array<[ElementKey, number]>);
  const modEntries = (Object.entries(modalities) as Array<[ModalityKey, number]>);

  const topElement = total ? elEntries.reduce((a, b) => (b[1] > a[1] ? b : a))[0] : null;
  const lowElement = total ? elEntries.reduce((a, b) => (b[1] < a[1] ? b : a))[0] : null;
  const topModality = total ? modEntries.reduce((a, b) => (b[1] > a[1] ? b : a))[0] : null;

  return { elements, modalities, total, topElement, lowElement, topModality };
}

export const ELEMENT_LABEL_RU: Record<ElementKey, string> = {
  fire: 'Огонь', earth: 'Земля', air: 'Воздух', water: 'Вода',
};
export const ELEMENT_LABEL_EN: Record<ElementKey, string> = {
  fire: 'Fire', earth: 'Earth', air: 'Air', water: 'Water',
};
export const MODALITY_LABEL_RU: Record<ModalityKey, string> = {
  cardinal: 'Кардинальный', fixed: 'Фиксированный', mutable: 'Мутабельный',
};
export const MODALITY_LABEL_EN: Record<ModalityKey, string> = {
  cardinal: 'Cardinal', fixed: 'Fixed', mutable: 'Mutable',
};

/* Цвета стихий — из fresh-палитры */
export const ELEMENT_COLOR: Record<ElementKey, string> = {
  fire: '#FF7E8B', earth: '#34C39A', air: '#5BB6EC', water: '#A98CEC',
};

/* Короткий человеческий вывод по балансу — без эзотерики */
const ELEMENT_MEANING_RU: Record<ElementKey, string> = {
  fire: 'действие, азарт и инициативу',
  earth: 'практичность, быт и доведение до результата',
  air: 'идеи, общение и анализ',
  water: 'чувства, интуицию и заботу',
};
const ELEMENT_LACK_RU: Record<ElementKey, string> = {
  fire: 'решительность и напор',
  earth: 'рутину и быт',
  air: 'отстранённый анализ и лёгкость в общении',
  water: 'чувствительность и контакт с эмоциями',
};

export function balanceSummaryRu(balance: ChartBalance): string {
  if (!balance.total || !balance.topElement || !balance.lowElement) return '';
  const top = ELEMENT_MEANING_RU[balance.topElement];
  const lacks = balance.elements[balance.lowElement] === 0
    ? `Совсем не хватает «${ELEMENT_LABEL_RU[balance.lowElement].toLowerCase()}» — ${ELEMENT_LACK_RU[balance.lowElement]} держать сложнее.`
    : `Меньше всего «${ELEMENT_LABEL_RU[balance.lowElement].toLowerCase()}» — ${ELEMENT_LACK_RU[balance.lowElement]} даётся труднее.`;
  return `Больше всего в тебе про ${top}. ${lacks}`;
}
