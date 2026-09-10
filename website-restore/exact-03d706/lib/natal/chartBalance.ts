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

/* Короткий человеческий вывод по балансу — без эзотерики и без языка нехватки. */
const ELEMENT_STRONG_RU: Record<ElementKey, string> = {
  fire: 'Огонь включается быстрее остальных: проще начать, решить и проверить идею делом.',
  earth: 'Земля звучит заметнее: проще опереться на факты, порядок и понятный результат.',
  air: 'Воздух заметнее остальных: легче думать через разговор, идеи и быстрые связи между фактами.',
  water: 'Вода звучит громче: проще считывать настроение, заботиться и замечать эмоциональный подтекст.',
};

const ELEMENT_QUIET_RU: Record<ElementKey, string> = {
  fire: 'Огонь тише — импульс иногда удобнее не форсировать, а включать после короткой внутренней проверки.',
  earth: 'Земля тише — бытовые детали лучше держать простыми и видимыми, чтобы они не забирали лишнее внимание.',
  air: 'Воздух тише — мысли иногда полезнее сначала разложить по полочкам, а уже потом обсуждать.',
  water: 'Вода тише — чувства могут проявляться не сразу, зато честнее звучат, когда им дали пару минут тишины.',
};

const ELEMENT_STRONG_EN: Record<ElementKey, string> = {
  fire: 'Fire switches on fastest: starting, deciding, and testing an idea through action can feel natural.',
  earth: 'Earth is the clearest note: facts, order, and a visible result help you find your footing.',
  air: 'Air is the loudest note: ideas, conversation, and quick links between facts come online easily.',
  water: 'Water speaks clearly: mood, care, and emotional subtext are easy to notice.',
};

const ELEMENT_QUIET_EN: Record<ElementKey, string> = {
  fire: 'Fire is quieter, so impulse may work better after one small inner check.',
  earth: 'Earth is quieter, so practical details are easier when they stay simple and visible.',
  air: 'Air is quieter, so thoughts may need a little sorting before they become a conversation.',
  water: 'Water is quieter, so feelings may show up later, but they land cleaner when they get a moment.',
};

export function balanceSummaryRu(balance: ChartBalance): string {
  if (!balance.total || !balance.topElement || !balance.lowElement) return '';
  if (balance.topElement === balance.lowElement) {
    return 'Стихии распределены ровно: карта не толкает в один единственный стиль реакции. Можно выбирать темп под ситуацию.';
  }
  return `${ELEMENT_STRONG_RU[balance.topElement]} ${ELEMENT_QUIET_RU[balance.lowElement]} Не баг, просто другой порядок действий.`;
}

export function balanceSummaryEn(balance: ChartBalance): string {
  if (!balance.total || !balance.topElement || !balance.lowElement) return '';
  if (balance.topElement === balance.lowElement) {
    return 'The elements are evenly spread: the chart does not push one single reaction style. You can choose the pace that fits the moment.';
  }
  return `${ELEMENT_STRONG_EN[balance.topElement]} ${ELEMENT_QUIET_EN[balance.lowElement]} Not a flaw, just a different order of operations.`;
}
