export type Locale = 'ru' | 'en';

export const DAILY_PRESENTATION_PATTERNS = [
  {
    key: 'direct_observation',
    ru: 'Назови наблюдение прямо: что видно в поведении или выборе, без захода издалека.',
    en: 'Open with a plain observation: what shows in behavior or choice, without a long setup.',
  },
  {
    key: 'contradiction',
    ru: 'Построй фразу на живом противоречии: хочется одного, полезнее другое.',
    en: 'Frame the line around a real tension: one impulse pulls, another move helps more.',
  },
  {
    key: 'concrete_scene',
    ru: 'Начни с маленькой бытовой сцены: сообщение, покупка, задача, пауза, встреча.',
    en: 'Start from a small concrete scene: a message, purchase, task, pause, or meeting.',
  },
  {
    key: 'sharp_question',
    ru: 'Сформулируй острый вопрос, который сразу ведет к сути, без драматизации.',
    en: 'Use a sharp question that goes straight to the point without turning dramatic.',
  },
  {
    key: 'gentle_warning',
    ru: 'Дай мягкое предупреждение: где стоит быть аккуратнее и почему.',
    en: 'Give a gentle warning: where to be more careful and why.',
  },
  {
    key: 'permission',
    ru: 'Дай разрешение не тащить лишнее: снять давление, выбрать темп, упростить.',
    en: 'Give permission to drop extra pressure: choose pace, simplify, or pause.',
  },
  {
    key: 'cause_and_effect',
    ru: 'Покажи причинно-следственную связку: если делать так, станет легче вот здесь.',
    en: 'Show cause and effect: if this is handled one way, this part gets easier.',
  },
  {
    key: 'choice',
    ru: 'Поставь перед читателем ясный выбор между двумя понятными ходами.',
    en: 'Offer a clear choice between two understandable moves.',
  },
  {
    key: 'light_humor',
    ru: 'Разрешен легкий юмор: одна теплая улыбка, без шуток вместо смысла.',
    en: 'Allow light humor: one warm wink, never a joke instead of meaning.',
  },
  {
    key: 'missed_detail',
    ru: 'Подсвети деталь, которую легко пропустить: тон, срок, маленькое условие.',
    en: 'Point to an easy-to-miss detail: tone, timing, or one small condition.',
  },
] as const;

export type DailyPresentationPatternKey = (typeof DAILY_PRESENTATION_PATTERNS)[number]['key'];

export const DAILY_PACKAGE_FIELD_KEYS = [
  'hero_title',
  'hero_hook',
  'overview',
  'love.hook',
  'love.body',
  'money.hook',
  'money.body',
  'work.hook',
  'work.body',
  'goals.hook',
  'goals.body',
  'family.hook',
  'family.body',
  'friendship.hook',
  'friendship.body',
  'energy.hook',
  'energy.body',
  'communication.hook',
  'communication.body',
] as const;

export type DailyPackageFieldKey = (typeof DAILY_PACKAGE_FIELD_KEYS)[number];
export type DailyPresentationPlan = Record<DailyPackageFieldKey, DailyPresentationPatternKey>;

export function stableHash(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x2c1b3c6d) >>> 0;
  return (hash ^ (hash >>> 12)) >>> 0;
}

export function dayOrdinal(dateKey: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return 0;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return 0;
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

export function selectDailyPresentationPattern(
  userId: string,
  dateKey: string,
  section: string,
): DailyPresentationPatternKey {
  const index = (dayOrdinal(dateKey) + stableHash(`${userId}${section}`)) % DAILY_PRESENTATION_PATTERNS.length;
  return DAILY_PRESENTATION_PATTERNS[index].key;
}

export function buildDailyPresentationPlan(
  userId: string,
  dateKey: string,
  fields: readonly DailyPackageFieldKey[] = DAILY_PACKAGE_FIELD_KEYS,
): DailyPresentationPlan {
  const plan = {} as DailyPresentationPlan;
  let previousIndex: number | null = null;

  for (const field of fields) {
    let index = (dayOrdinal(dateKey) + stableHash(`${userId}${field}`)) % DAILY_PRESENTATION_PATTERNS.length;
    if (previousIndex != null && index === previousIndex) {
      index = (index + 1) % DAILY_PRESENTATION_PATTERNS.length;
    }
    plan[field] = DAILY_PRESENTATION_PATTERNS[index].key;
    previousIndex = index;
  }

  return plan;
}

export function getDailyPresentationInstruction(
  key: DailyPresentationPatternKey,
  locale: Locale,
): string {
  const pattern = DAILY_PRESENTATION_PATTERNS.find((item) => item.key === key) || DAILY_PRESENTATION_PATTERNS[0];
  return locale === 'en' ? pattern.en : pattern.ru;
}

export type DashboardSystemState =
  | 'loading'
  | 'ready'
  | 'no_chart'
  | 'generation_error'
  | 'free_section'
  | 'premium_locked';

const DASHBOARD_SYSTEM_COPY: Record<DashboardSystemState, Record<Locale, string[]>> = {
  loading: {
    ru: [
      'Собираю личный пакет дня.',
      'Проверяю карту и дневные расчеты.',
      'Готовлю текст по твоим данным.',
      'Ищу сохраненный пакет для этой даты.',
      'Сверяю личный день с расчетом.',
      'Поднимаю дневной пакет.',
      'Собираю hero и карточки.',
      'Жду готовый текст дня.',
      'Проверяю, есть ли сохраненная версия.',
      'Готовлю персональный экран.',
    ],
    en: [
      'Preparing your daily package.',
      'Checking the chart and day data.',
      'Preparing text from your saved data.',
      'Looking for the saved package for this date.',
      'Matching the personal day with the calculation.',
      'Loading the daily package.',
      'Preparing the hero and cards.',
      'Waiting for the day text.',
      'Checking for a saved version.',
      'Preparing your personal screen.',
    ],
  },
  ready: {
    ru: [
      'Личный пакет дня готов.',
      'Текст для этой даты готов.',
      'Hero и карточки собраны.',
      'Сохраненный пакет найден.',
      'Дневной пакет готов к чтению.',
      'Карточки обновлены из пакета.',
      'Личный день загружен.',
      'Текст дня на месте.',
      'Готовая версия открыта.',
      'Пакет для Dashboard готов.',
    ],
    en: [
      'Your daily package is ready.',
      'The text for this date is ready.',
      'Hero and cards are prepared.',
      'The saved package was found.',
      'The daily package is ready to read.',
      'Cards were updated from the package.',
      'Your personal day is loaded.',
      'The day text is in place.',
      'The ready version is open.',
      'The Dashboard package is ready.',
    ],
  },
  no_chart: {
    ru: [
      'Сначала нужна натальная карта.',
      'Добавь данные рождения, чтобы собрать личный день.',
      'Без карты здесь будет только общий экран.',
      'Личный пакет появится после расчета карты.',
      'Сначала сохраним карту рождения.',
      'Для персонального текста не хватает карты.',
      'Нужны дата, время и место рождения.',
      'Пакет дня появится после создания карты.',
      'Собери карту, и Dashboard станет личным.',
      'Персональный день начнется с карты.',
    ],
    en: [
      'Create a natal chart first.',
      'Add birth data to build a personal day.',
      'Without a chart, this stays a general screen.',
      'The personal package appears after chart calculation.',
      'Save the birth chart first.',
      'A personal text needs a chart.',
      'Date, time, and place of birth are needed.',
      'The day package appears after the chart is created.',
      'Build the chart to make Dashboard personal.',
      'The personal day starts with a chart.',
    ],
  },
  generation_error: {
    ru: [
      'Не удалось собрать дневной пакет.',
      'Текст дня пока не готов.',
      'Пакет не сохранился, попробуй позже.',
      'Сейчас не получилось подготовить Dashboard.',
      'Генерация не завершилась.',
      'Не показываю заглушку вместо личного текста.',
      'Пакет дня временно недоступен.',
      'Личный текст не пришел от сервера.',
      'Сохраненной версии для этой даты нет.',
      'Dashboard ждет настоящий пакет, не замену.',
    ],
    en: [
      'Could not prepare the daily package.',
      'The day text is not ready yet.',
      'The package was not saved; try later.',
      'Dashboard could not be prepared now.',
      'Generation did not finish.',
      'No placeholder is shown instead of personal text.',
      'The day package is temporarily unavailable.',
      'The personal text did not come back from the server.',
      'No saved version exists for this date.',
      'Dashboard is waiting for the real package, not a substitute.',
    ],
  },
  free_section: {
    ru: [
      'Открыт обзор и одна тема.',
      'Бесплатно доступна часть дневного пакета.',
      'Одна дополнительная тема уже открыта.',
      'Обзор доступен без Premium.',
      'Часть пакета можно читать сразу.',
      'Свободная тема выбрана для этой даты.',
      'Доступна бесплатная часть дня.',
      'Открыта одна тема сверх обзора.',
      'Бесплатный доступ активен для части пакета.',
      'Можно открыть обзор и выбранную тему.',
    ],
    en: [
      'Overview and one topic are open.',
      'Part of the daily package is free.',
      'One extra topic is already open.',
      'Overview is available without Premium.',
      'Part of the package can be read now.',
      'The free topic is selected for this date.',
      'The free part of the day is available.',
      'One topic beyond overview is open.',
      'Free access is active for part of the package.',
      'You can open the overview and selected topic.',
    ],
  },
  premium_locked: {
    ru: [
      'Полный дневной пакет открыт в Premium.',
      'Остальные темы ждут Premium.',
      'Полный набор карточек доступен в Premium.',
      'Все разделы дня открываются с Premium.',
      'Premium показывает весь пакет целиком.',
      'Эта часть закрыта до Premium.',
      'Полный Dashboard доступен с Premium.',
      'Остальные тела разделов закрыты.',
      'Premium открывает все темы дня.',
      'Для полного текста нужен Premium.',
    ],
    en: [
      'The full daily package opens in Premium.',
      'The remaining topics wait for Premium.',
      'The full card set is available in Premium.',
      'All day sections open with Premium.',
      'Premium shows the whole package.',
      'This part is locked until Premium.',
      'The full Dashboard is available with Premium.',
      'The remaining section bodies are locked.',
      'Premium opens every day topic.',
      'Full text requires Premium.',
    ],
  },
};

export function getDashboardSystemText(
  state: DashboardSystemState,
  locale: Locale,
  dateKey: string,
): string {
  const variants = DASHBOARD_SYSTEM_COPY[state][locale];
  const index = stableHash(`${dateKey}${state}${locale}`) % variants.length;
  return variants[index];
}
