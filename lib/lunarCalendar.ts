/**
 * Лунные календари: сад и огород, стрижка и красота, здоровье, дела, дом.
 * День считается на устройстве по настоящему положению Луны (astronomy-engine): знак Луны, растёт или убывает,
 * новолуние и полнолуние, затмение рядом, ретроградный Меркурий. Оценка дня — народные лунные традиции,
 * поэтому в текстах везде «по традиции», «по примете», а не обещания.
 */

type AstronomyEngine = typeof import('astronomy-engine');

export type LunarDay = {
  dayKey: string;
  day: number;
  month: number;
  weekday: number;
  /** 0 = Овен … 11 = Рыбы. */
  sign: number;
  /** Угол между Луной и Солнцем: 0 новолуние, 180 полнолуние. */
  phase: number;
  waxing: boolean;
  exact: { q: 0 | 2 } | null;
  eclipse: boolean;
  mercuryRetrograde: boolean;
  venusRetrograde: boolean;
};

export const SIGNS_IN = ['в Овне', 'в Тельце', 'в Близнецах', 'в Раке', 'во Льве', 'в Деве', 'в Весах', 'в Скорпионе', 'в Стрельце', 'в Козероге', 'в Водолее', 'в Рыбах'];

const normalize = (value: number) => ((value % 360) + 360) % 360;
const signedDistance = (a: number, b: number) => ((a - b + 540) % 360) - 180;

function eclipticLongitude(engine: AstronomyEngine, body: string, date: Date): number {
  return normalize(engine.Ecliptic(engine.GeoVector(body as Parameters<AstronomyEngine['GeoVector']>[0], date, true)).elon);
}

const dayKeyOf = (date: Date) => date.toISOString().slice(0, 10);

/** Дни подряд от `from` (в UTC-полдень), `count` штук. */
export function buildLunarDays(engine: AstronomyEngine, from: Date, count: number): LunarDay[] {
  const start = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), 12));
  const end = new Date(start.getTime() + count * 86_400_000);
  const eclipseKeys = new Set<string>();
  try {
    const lunar = engine.SearchLunarEclipse(start);
    if (lunar.kind !== 'penumbral' && lunar.peak.date < end) eclipseKeys.add(dayKeyOf(lunar.peak.date));
    const solar = engine.SearchGlobalSolarEclipse(start);
    if (solar.peak.date < end) eclipseKeys.add(dayKeyOf(solar.peak.date));
  } catch { /* the eclipse search is optional */ }

  return Array.from({ length: count }, (_, index) => {
    const noon = new Date(start.getTime() + index * 86_400_000);
    const moon = eclipticLongitude(engine, 'Moon', noon);
    const sun = eclipticLongitude(engine, 'Sun', noon);
    const phase = normalize(moon - sun);
    const mercuryNow = eclipticLongitude(engine, 'Mercury', noon);
    const mercuryLater = eclipticLongitude(engine, 'Mercury', new Date(noon.getTime() + 3_600_000));
    const venusNow = eclipticLongitude(engine, 'Venus', noon);
    const venusLater = eclipticLongitude(engine, 'Venus', new Date(noon.getTime() + 3_600_000));
    const key = dayKeyOf(noon);
    const nearNew = Math.min(phase, 360 - phase) < 6.1;
    const nearFull = Math.abs(phase - 180) < 6.1;
    const near = (offset: number) => eclipseKeys.has(dayKeyOf(new Date(noon.getTime() + offset * 86_400_000)));
    return {
      dayKey: key,
      day: noon.getUTCDate(),
      month: noon.getUTCMonth() + 1,
      weekday: (noon.getUTCDay() + 6) % 7,
      sign: Math.floor(moon / 30),
      phase,
      waxing: phase < 180,
      exact: nearNew ? { q: 0 } : nearFull ? { q: 2 } : null,
      eclipse: near(-1) || near(0) || near(1),
      mercuryRetrograde: signedDistance(mercuryLater, mercuryNow) < 0,
      venusRetrograde: signedDistance(venusLater, venusNow) < 0,
    };
  });
}

export function phaseName(phase: number): string {
  return phase < 8 || phase > 352 ? 'Новолуние'
    : phase < 85 ? 'Растущий серп'
      : phase < 95 ? 'Первая четверть'
        : phase < 172 ? 'Растущая Луна'
          : phase < 188 ? 'Полнолуние'
            : phase < 265 ? 'Убывающая Луна'
              : phase < 275 ? 'Последняя четверть' : 'Убывающий серп';
}

// ───────────── Что делаем и как оценивается день ─────────────

/** 0 = не стоит, 1 = можно, 2 = хорошо. */
export type Verdict = readonly [0 | 1 | 2, string];

type Phase = 'wax' | 'wane' | null;

type Operation = {
  id: string;
  name: string;
  hint: string;
  evaluate: (day: LunarDay) => Verdict;
  /** Месяцы (1–12), в которые дело актуально; без поля — весь год. */
  months?: number[];
};

const FERTILITY: Record<number, 'f' | 'm' | 'w' | 'b'> = { 3: 'f', 7: 'f', 11: 'f', 1: 'm', 6: 'm', 9: 'm', 2: 'w', 5: 'w', 8: 'w', 0: 'b', 4: 'b', 10: 'b' };
const FERTILITY_TEXT = { f: 'плодородный знак', m: 'среднеплодородный знак', w: 'малоплодородный знак', b: 'бесплодный знак, всходы слабые' } as const;
const WAX_NEED = 'Луна убывает: сила уходит в корни, а этой работе нужна растущая';
const WANE_NEED = 'Луна растёт: сила уходит в вершки, а этой работе нужна убывающая';

type GardenSpec = { id: string; name: string; hint: string; months: number[]; phase: Phase; good: number[]; bad: number[]; blocksOnExact?: boolean; goodWhy?: string; badWhy?: string; wrong?: string };

function gardenVerdict(spec: GardenSpec, day: LunarDay): Verdict {
  if (spec.blocksOnExact !== false && day.exact) return [0, day.exact.q === 0 ? 'Новолуние: посадки и обрезку не делают' : 'Полнолуние: посадки и обрезку не делают'];
  if (spec.phase === 'wax' && !day.waxing) return [0, spec.wrong || WAX_NEED];
  if (spec.phase === 'wane' && day.waxing) return [0, spec.wrong || WANE_NEED];
  const sign = day.sign;
  const prefix = `Луна ${SIGNS_IN[sign]}: `;
  if (spec.good.includes(sign)) return [2, prefix + (spec.goodWhy || (FERTILITY[sign] === 'f' || FERTILITY[sign] === 'm' ? FERTILITY_TEXT[FERTILITY[sign]] : 'подходящий знак для этой работы'))];
  if (spec.bad.includes(sign)) return [0, prefix + (spec.badWhy || FERTILITY_TEXT[FERTILITY[sign]])];
  return [1, prefix + (spec.goodWhy || spec.badWhy ? 'день средний' : `${FERTILITY_TEXT[FERTILITY[sign]]}, можно, если не терпит`)];
}

const GARDEN_SPECS: GardenSpec[] = [
  { id: 'water', name: 'Полив и влагозарядка', hint: 'обильный полив сада перед морозами', months: [5, 6, 7, 8, 9, 10], phase: null, good: [3, 7, 11], bad: [0, 4, 8], blocksOnExact: false, goodWhy: 'знак воды, влага усваивается лучше', badWhy: 'знак огня, по этой традиции поливают меньше' },
  { id: 'store', name: 'Урожай на хранение', hint: 'картофель, морковь, лук, яблоки', months: [8, 9, 10], phase: 'wane', good: [0, 4, 8, 2, 10, 1, 9], bad: [3, 7, 11], blocksOnExact: false, goodWhy: '«сухой» знак, урожай дольше лежит', badWhy: '«водный» знак, собранное хуже хранится, лучше съесть сразу', wrong: 'Луна растёт: по этой традиции урожай хуже хранится' },
  { id: 'ferment', name: 'Квашение и соления', hint: 'капуста, огурцы, грибы', months: [8, 9, 10, 11], phase: 'wax', good: [0, 1, 4, 8, 9], bad: [3, 5, 11], blocksOnExact: false, goodWhy: 'по народной примете капуста выйдет хрусткой', badWhy: 'по примете капуста выйдет мягкой', wrong: 'Луна убывает: по примете соленья выйдут мягкими' },
  { id: 'garlic', name: 'Чеснок под зиму', hint: 'зубки на 5-7 см, за 3-4 недели до морозов', months: [9, 10], phase: 'wane', good: [1, 9, 3, 7, 11], bad: [0, 4, 10] },
  { id: 'bulbs', name: 'Луковичные цветы', hint: 'тюльпаны, нарциссы, крокусы', months: [9, 10], phase: 'wane', good: [1, 6, 5, 3, 9], bad: [0, 4, 10] },
  { id: 'trees', name: 'Посадка саженцев', hint: 'плодовые деревья и кусты', months: [4, 5, 9, 10], phase: 'wax', good: [1, 3, 5, 7, 9], bad: [0, 4, 10] },
  { id: 'soil', name: 'Перекопка и органика', hint: 'компост и перегной под перекопку', months: [4, 9, 10], phase: 'wane', good: [1, 9, 3, 7, 11], bad: [], blocksOnExact: false },
  { id: 'prune', name: 'Обрезка деревьев и кустов', hint: 'санитарная и формирующая', months: [3, 4, 10, 11], phase: 'wane', good: [0, 4, 8, 2, 10, 9], bad: [3, 7, 11], goodWhy: '«сухой» знак, срезы заживают быстрее', badWhy: '«водный» знак, по этой традиции срезы заживают дольше', wrong: 'Луна растёт: сокодвижение сильнее, срезы заживают хуже' },
  { id: 'wintersow', name: 'Подзимний посев', hint: 'морковь, свёкла, укроп в остывшую землю', months: [10, 11], phase: 'wane', good: [1, 9, 3, 7, 11], bad: [0, 4, 10] },
  { id: 'indoor', name: 'Комнатные растения', hint: 'полив, подкормка, пересадка', months: [11, 12, 1], phase: 'wax', good: [1, 3, 5, 6, 7, 11], bad: [0, 4, 10], blocksOnExact: false },
];

const GARDEN: Operation[] = GARDEN_SPECS.map((spec) => ({
  id: spec.id, name: spec.name, hint: spec.hint, months: spec.months, evaluate: (day) => gardenVerdict(spec, day),
}));

const nearFull = (day: LunarDay) => Math.abs(day.phase - 180) < 18;
const nearNew = (day: LunarDay) => day.phase < 9 || day.phase > 351;

const HEALTH: Operation[] = [
  { id: 'surgery', name: 'Плановая операция', hint: 'если дату можно выбрать', evaluate: (x) => (nearFull(x) ? [0, 'Полнолуние: плановые операции стараются не ставить'] : nearNew(x) ? [0, 'Новолуние: силы на минимуме, лучше другой день'] : x.eclipse ? [0, 'Рядом затмение: плановое лучше сдвинуть'] : x.waxing ? [1, 'Растущая Луна: можно, но на убывающей восстановление легче'] : [2, 'Убывающая Луна: восстановление проходит легче']) },
  { id: 'dentist', name: 'Стоматолог', hint: 'лечение, удаление, плановый визит', evaluate: (x) => (x.sign === 0 || x.sign === 9 ? [0, `Луна ${SIGNS_IN[x.sign]}: по этой школе зубы и челюсть чувствительнее`] : nearFull(x) ? [0, 'Полнолуние: чувствительность выше'] : x.waxing ? [1, 'Растущая Луна: можно, но на убывающей легче'] : [2, 'Убывающая Луна: хороший день']) },
  { id: 'massage', name: 'Массаж и баня', hint: 'расслабление и восстановление', evaluate: (x) => (x.waxing ? [1, 'Растущая Луна: можно, эффект мягче'] : [2, 'Убывающая Луна: тело легче отпускает напряжение']) },
  { id: 'course', name: 'Начать курс витаминов', hint: 'восстановление, укрепление', evaluate: (x) => (x.waxing ? [2, 'Растущая Луна: тело охотнее берёт полезное'] : [1, 'Убывающая Луна: лучше продолжать, чем начинать']) },
  { id: 'detox', name: 'Разгрузочный день', hint: 'меньше порции, больше воды', evaluate: (x) => (x.exact ? [2, `${x.exact.q === 0 ? 'Новолуние' : 'Полнолуние'}: классический разгрузочный день`] : x.waxing ? [1, 'Растущая Луна: тело копит, разгрузка даётся тяжелее'] : [2, 'Убывающая Луна: лучшее время худеть']) },
];

type DealSpec = { id: string; name: string; hint: string; good: number[]; merc?: boolean; mercText?: string; anyPhase?: boolean; finish?: boolean };

function dealVerdict(spec: DealSpec, day: LunarDay): Verdict {
  const sign = day.sign;
  if (spec.finish) {
    if (day.exact || day.eclipse) return [0, 'Неспокойный день: резкие решения лучше отложить'];
    const score = (day.waxing ? 0 : 1) + (spec.good.includes(sign) ? 1 : 0);
    return [score as 0 | 1 | 2, day.waxing ? 'Луна растёт: легче начинать, чем заканчивать' : (spec.good.includes(sign) ? `Убывающая Луна ${SIGNS_IN[sign]}: хорошо отпускать и завершать` : 'Убывающая Луна: подходящее время завершать')];
  }
  if (day.exact) return [0, day.exact.q === 0 ? 'Новолуние: время планировать, а не запускать' : 'Полнолуние: эмоции на пике, решения бывают поспешными'];
  if (day.eclipse) return [0, 'Рядом затмение: важное лучше сдвинуть на несколько дней'];
  let score = (spec.anyPhase || day.waxing ? 1 : 0) + (spec.good.includes(sign) ? 1 : 0);
  let why = spec.good.includes(sign)
    ? `Луна ${SIGNS_IN[sign]}: подходящий знак для этого${day.waxing || spec.anyPhase ? '' : ', но Луна убывает'}`
    : spec.anyPhase ? 'Знак нейтральный: обычный день для этого' : day.waxing ? 'Растущая Луна, знак нейтральный' : 'Убывающая Луна и нейтральный знак: новое лучше начинать на растущей';
  if (spec.merc && day.mercuryRetrograde) {
    score = Math.max(0, score - 1);
    why += `. Ретроградный Меркурий: ${spec.mercText || 'перечитай договор дважды и сохрани копии'}`;
  }
  return [score as 0 | 1 | 2, why];
}

const DEAL_SPECS: DealSpec[] = [
  { id: 'contracts', name: 'Договор и документы', hint: 'подписать, подать, оформить', good: [5, 6, 9, 2], merc: true },
  { id: 'buy', name: 'Крупная покупка', hint: 'техника, мебель, авто', good: [1, 6, 9, 3], merc: true, mercText: 'технику и электронику лучше брать после его окончания' },
  { id: 'project', name: 'Новая работа или проект', hint: 'первый день, запуск', good: [0, 4, 9, 5] },
  { id: 'talk', name: 'Переговоры, собеседование', hint: 'встречи, где важно договориться', good: [2, 6, 4, 8, 10], anyPhase: true },
  { id: 'money', name: 'Разговор о деньгах', hint: 'повышение, цена, долг', good: [1, 4, 9] },
  { id: 'travel', name: 'Поездка', hint: 'дорога и путешествие', good: [8, 2, 10, 0], merc: true, mercText: 'проверь билеты и брони дважды' },
  { id: 'date', name: 'Свидание, личный разговор', hint: 'важное для двоих', good: [6, 1, 4, 3], anyPhase: true },
  { id: 'finish', name: 'Завершить и отпустить', hint: 'уйти, закрыть, расстаться с ненужным', good: [7, 9, 11, 5], finish: true },
];

const DEALS: Operation[] = DEAL_SPECS.map((spec) => ({ id: spec.id, name: spec.name, hint: spec.hint, evaluate: (day) => dealVerdict(spec, day) }));

/** A deal-like operation with its own good signs (used by «Хорошие даты»). */
export function makeDealOperation(id: string, good: number[], options: { merc?: boolean; anyPhase?: boolean } = {}): Operation {
  const spec: DealSpec = { id, name: id, hint: '', good, merc: options.merc, anyPhase: options.anyPhase };
  return { id, name: id, hint: '', evaluate: (day) => dealVerdict(spec, day) };
}

type HomeSpec = { id: string; name: string; hint: string; phase: Phase; good: number[]; bad: number[]; blocksOnMoveDays?: boolean; goodWhy?: string; badWhy?: string; wrong?: string; neutral?: string; strictPhase?: boolean };

function homeVerdict(spec: HomeSpec, day: LunarDay): Verdict {
  if (spec.blocksOnMoveDays && (day.exact || day.eclipse)) {
    return [0, day.exact ? `${day.exact.q === 0 ? 'Новолуние' : 'Полнолуние'}: с переездом лучше подождать` : 'Рядом затмение: переезд лучше сдвинуть'];
  }
  const sign = day.sign;
  const prefix = `Луна ${SIGNS_IN[sign]}: `;
  const phaseOk = !spec.phase || (spec.phase === 'wax') === day.waxing;
  if (spec.bad.includes(sign)) return [0, prefix + (spec.badWhy || 'по этой школе знак не подходит')];
  if (!phaseOk) return [spec.strictPhase ? 0 : 1, spec.wrong || ''];
  if (spec.good.length === 0) return [2, `${day.waxing ? 'Растущая' : 'Убывающая'} Луна: подходящее время`];
  if (spec.good.includes(sign)) return [2, prefix + (spec.goodWhy || 'подходящий знак')];
  return [1, prefix + (spec.neutral || 'фаза подходит, знак средний')];
}

const HOME_SPECS: HomeSpec[] = [
  { id: 'clean', name: 'Генеральная уборка', hint: 'шкафы, кладовка, балкон', phase: 'wane', good: [], bad: [], wrong: 'Луна растёт: можно, но на убывающей грязь уходит легче' },
  { id: 'wash', name: 'Большая стирка', hint: 'шторы, пледы, пуховики', phase: 'wane', good: [3, 7, 11, 10], bad: [], goodWhy: 'знак воды или Водолей, отстирывается легче', wrong: 'Луна растёт: можно, но пятна по этой школе сходят хуже' },
  { id: 'windows', name: 'Окна и зеркала', hint: 'перед зимой', phase: 'wane', good: [2, 6, 10], bad: [3, 7, 11], goodWhy: 'знак воздуха, без разводов', badWhy: 'знак воды, по этой школе останутся разводы', wrong: 'Луна растёт: можно, но лучше на убывающей' },
  { id: 'repair', name: 'Ремонт и покраска', hint: 'стены, мебель, мелкий ремонт', phase: 'wane', good: [1, 5, 9], bad: [3, 11], goodWhy: 'знак земли, краска ложится ровно', badWhy: '«сырой» знак, по этой школе дольше сохнет', wrong: 'Луна растёт: ремонт лучше начинать на убывающей' },
  { id: 'move', name: 'Переезд и новоселье', hint: 'первый день в новом доме', phase: 'wax', good: [1, 3, 4, 9], bad: [], blocksOnMoveDays: true, strictPhase: true, goodWhy: 'хороший знак для дома', wrong: 'Луна убывает: переезжать лучше на растущей' },
  { id: 'pests', name: 'Моль, тараканы, плесень', hint: 'обработка дома', phase: 'wane', good: [], bad: [], wrong: 'Луна растёт: по этой школе эффект слабее' },
];

const HAIR_SPECS: HomeSpec[] = [
  { id: 'hair_grow', name: 'Стрижка, чтобы быстрее отросли', hint: 'кончики, длина', phase: 'wax', good: [4, 5, 1], bad: [3, 11], strictPhase: true, goodWhy: 'хороший знак для волос', badWhy: 'по этой школе неудачный знак для волос', wrong: 'Луна убывает: волосы будут отрастать медленнее' },
  { id: 'hair_keep', name: 'Стрижка, чтобы дольше держала форму', hint: 'короткие стрижки, чёлка', phase: 'wane', good: [4, 5, 1, 9], bad: [3, 11], strictPhase: true, goodWhy: 'хороший знак для волос', badWhy: 'по этой школе неудачный знак для волос', wrong: 'Луна растёт: стрижка быстрее потеряет форму' },
  { id: 'color', name: 'Окрашивание', hint: 'цвет ляжет ровнее и продержится дольше', phase: 'wax', good: [4, 1, 6], bad: [3, 11], goodWhy: 'хороший знак для цвета', badWhy: 'по этой школе цвет быстрее вымоется', wrong: 'Луна убывает: по этой школе цвет держится меньше' },
  { id: 'nails', name: 'Маникюр и педикюр', hint: 'покрытие, уход', phase: null, good: [9], bad: [], goodWhy: 'Козерог, ногти крепче', neutral: 'обычный день' },
];

const toOperation = (spec: HomeSpec): Operation => ({ id: spec.id, name: spec.name, hint: spec.hint, evaluate: (day) => homeVerdict(spec, day) });
const HOME: Operation[] = HOME_SPECS.map(toOperation);
const HAIR: Operation[] = HAIR_SPECS.map(toOperation);
const FACE: Operation = {
  id: 'face', name: 'Чистка лица и пилинг', hint: 'косметолог и домашний уход',
  evaluate: (x) => (x.sign === 0 ? [0, 'Луна в Овне: кожа лица чувствительнее, лучше щадящий уход'] : x.waxing ? [1, 'Растущая Луна: лучше питать и увлажнять, чистку на убывающую'] : [2, 'Убывающая Луна: кожа легче очищается']),
};

export type LunarCategoryKey = 'garden' | 'beauty' | 'health' | 'deals' | 'home';

export const LUNAR_CATEGORIES: ReadonlyArray<{ key: LunarCategoryKey; name: string; text: string; operations: Operation[] }> = [
  { key: 'garden', name: 'Сад и огород', text: 'Когда сажать, поливать и собирать', operations: GARDEN },
  { key: 'beauty', name: 'Стрижка и красота', text: 'Волосы, ногти, уход за кожей', operations: [...HAIR, FACE] },
  { key: 'health', name: 'Здоровье и питание', text: 'Врач, массаж, разгрузка', operations: HEALTH },
  { key: 'deals', name: 'Дела', text: 'Договор, покупка, поездка, переговоры', operations: DEALS },
  { key: 'home', name: 'Дом и быт', text: 'Уборка, стирка, ремонт, переезд', operations: HOME },
];

/** Какие дела показывать сейчас: в саду только сезонные, остальное весь год. */
export function operationsFor(key: LunarCategoryKey, month: number): Operation[] {
  const category = LUNAR_CATEGORIES.find((item) => item.key === key);
  if (!category) return [];
  return key === 'garden' ? category.operations.filter((op) => op.months?.includes(month)) : category.operations;
}

export const VERDICT_LABEL = ['Не стоит', 'Можно', 'Хорошо'] as const;

/** Лучшие дни для дела: сначала «хорошо», потом «можно», по порядку дат. */
export function bestDays(operation: Operation, days: LunarDay[], limit = 5): LunarDay[] {
  return days
    .map((day) => ({ day, score: operation.evaluate(day)[0] }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.day.dayKey.localeCompare(b.day.dayKey))
    .slice(0, limit)
    .sort((a, b) => a.day.dayKey.localeCompare(b.day.dayKey))
    .map((item) => item.day);
}

export type { Operation };

/** Any calendar operation by its id, e.g. 'contracts', 'move', 'hair_grow', 'detox'. */
export function operationById(id: string): Operation | null {
  for (const category of LUNAR_CATEGORIES) {
    const found = category.operations.find((op) => op.id === id);
    if (found) return found;
  }
  return null;
}
