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
    ru: 'Покажи возможное бытовое проявление: сообщение, покупку, задачу или встречу, не выдавая их за свершившийся факт.',
    en: 'Show a possible everyday manifestation, such as a message, purchase, task, or meeting, without claiming it already happened.',
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
    ru: 'Покажи, что человек не обязан тащить чужую часть ситуации и может упростить конкретное условие.',
    en: 'Show that the person does not have to carry someone else\'s part and may simplify one concrete condition.',
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
      'Сверяем детали по твоей карте. Это займёт несколько секунд.',
      'Проверяем расчёты, чтобы не подсовывать тебе догадки.',
      'Собираем личный разбор. Осталось проверить детали.',
      'Сопоставляем данные на эту дату. Скоро появится текст.',
      'Отделяем личные детали от общих фраз. Ещё немного.',
      'Карта на месте. Сейчас переведём расчёты на человеческий язык.',
      'Сначала проверяем факты, затем показываем вывод.',
      'Личный гороскоп собирается без тумана и общих фраз.',
      'Ищем полезный смысл в расчётах. Понадобится несколько секунд.',
      'Проверяем, чтобы текст относился именно к твоей карте.',
    ],
    en: [
      'Checking the details in your chart. This will take a few seconds.',
      'Verifying the calculations so you do not get a guess.',
      'Building your personal reading. A few details remain.',
      'Matching the data for this date. The text will appear shortly.',
      'Separating personal details from generic lines. Just a moment.',
      'The chart is here. Now we are translating it into normal language.',
      'Checking the facts first, then showing the conclusion.',
      'Your personal horoscope is being assembled without fog or filler.',
      'Finding the useful point in the calculations. A few seconds more.',
      'Checking that the text actually belongs to your chart.',
    ],
  },
  ready: {
    ru: [
      'Детали сверены. Можно переходить к сути.',
      'Текст собран по твоей карте. Читай с главного.',
      'Общие фразы убраны. Осталось то, что относится к тебе.',
      'Расчёты сошлись. Разбор уже на экране.',
      'Здесь нет страшилок и сладких обещаний. Только личный разбор.',
      'Сигналы карты переведены на обычный язык. Можно читать.',
      'Факты проверены. Смотри, что полезно учесть.',
      'Детали на месте. Начинай с общей картины.',
      'Этот текст собран по личным данным, а не по одному знаку.',
      'Разбор на экране. Без загадок ради загадок.',
    ],
    en: [
      'The details check out. You can go straight to the point.',
      'The text comes from your chart. Start with the main part.',
      'The generic lines are gone. What remains applies to you.',
      'The calculations line up. Your reading is on screen.',
      'No scare tactics or sweet promises here. Just the personal reading.',
      'The chart signals are now in normal language. You can read them.',
      'The facts are checked. See what is useful to notice.',
      'The details are in place. Start with the overview.',
      'This text uses personal data, not your sign alone.',
      'The reading is on screen. No mystery for mystery\'s sake.',
    ],
  },
  no_chart: {
    ru: [
      'Без данных рождения получится текст для всех. Нам такой не нужен — сначала соберём твою карту.',
      'Чтобы говорить про тебя, а не про абстрактного человека, нужна натальная карта.',
      'Дата, время и место рождения — и можно разбирать день по-настоящему.',
      'Сначала соберём карту. Иначе будет слишком много общих слов.',
      'Личный гороскоп начинается с карты рождения. Без неё честнее не выдумывать.',
      'Добавь данные рождения — тогда текст будет про тебя, а не про знак вообще.',
      'Пока не хватает карты. Давай сначала разберёмся с исходными данными.',
      'Нужна карта рождения. Иначе приложение будет гадать, а мы так не работаем.',
      'Сначала твои данные рождения, потом выводы. Нормальный порядок вещей.',
      'Без карты можно только обобщать. Нам нужен разбор точнее.',
    ],
    en: [
      'Without birth data, this would be a reading for everyone. We do not need that — build your chart first.',
      'To talk about you instead of an imaginary average person, we need your natal chart.',
      'Date, time, and place of birth — then the reading can actually be personal.',
      'Build the chart first. Otherwise there will be too many generic lines.',
      'A personal horoscope starts with a birth chart. Without it, making things up would be dishonest.',
      'Add your birth data so the text is about you, not just your sign.',
      'Your chart is still missing. Let us start with the source data.',
      'We need your birth chart. Otherwise the app would be guessing, and that is not how this works.',
      'Birth data first, conclusions second. A sensible order.',
      'Without a chart, we can only generalize. This reading should be more precise.',
    ],
  },
  generation_error: {
    ru: [
      'Разбор не собрался. Попробуй ещё раз.',
      'Сейчас произошла ошибка. Повтори попытку.',
      'Не получилось проверить расчёты. Лучше повторить, чем показать ерунду.',
      'Текст не открылся. Попробуй загрузить его ещё раз.',
      'Данные не сложились в нормальный текст. Фальшивую заглушку не покажем.',
      'Сейчас не вышло. Честнее сказать это прямо, чем подсовывать общие слова.',
      'Расчёт остановился на полпути. Запусти его ещё раз.',
      'Текст пока недоступен. Повтори попытку позже.',
      'Не получилось собрать личный гороскоп. Попробуй ещё раз через минуту.',
      'Здесь должен быть твой разбор, а не отговорка. Повтори попытку.',
    ],
    en: [
      'The reading did not load. Try again.',
      'An error occurred. Please retry.',
      'The calculations could not be checked. Retrying beats showing you nonsense.',
      'The text did not open. Try loading it again.',
      'The data did not turn into a proper reading. We will not fake one.',
      'It did not work this time. Saying that plainly beats serving generic filler.',
      'The calculation stopped halfway through. Run it again.',
      'The text is unavailable for now. Try again later.',
      'Your personal horoscope could not be assembled. Try again in a minute.',
      'Your reading belongs here, not an excuse. Please retry.',
    ],
  },
  free_section: {
    ru: [
      'Общий разбор и одна тема уже открыты. Остальное — в полной версии.',
      'Главное можно прочитать бесплатно. Ещё одну тему мы тоже открыли.',
      'Обзор доступен, плюс одна тема целиком. Без мелкого шрифта и сюрпризов.',
      'Одна дополнительная тема открыта на эту дату. Смотри, что досталось.',
      'Начни с общего разбора — одна личная тема уже ждёт внутри.',
      'Бесплатная часть не для галочки: обзор и одна тема открыты полностью.',
      'Суть дня открыта. Ещё одну тему можно разобрать без подписки.',
      'Обзор твой. И одна тема тоже — без внезапной двери перед самым интересным.',
      'Сначала прочитай главное. Одна из тем уже открыта целиком.',
      'Можно начать без Premium: общий разбор и одна дополнительная тема доступны.',
    ],
    en: [
      'The overview and one topic are already open. The rest is in the full version.',
      'You can read the main part for free. One extra topic is open too.',
      'The overview is available, plus one full topic. No tiny print, no surprises.',
      'One extra topic is open for this date. See which one you got.',
      'Start with the overview — one personal topic is already waiting inside.',
      'The free part is not decorative: the overview and one topic are fully open.',
      'The main picture is open. One more topic can be read without a subscription.',
      'The overview is yours. So is one topic — no sudden door before the useful part.',
      'Read the main part first. One topic is already open in full.',
      'You can start without Premium: the overview and one extra topic are available.',
    ],
  },
  premium_locked: {
    ru: [
      'Остальные темы закрыты. Premium открывает весь разбор целиком.',
      'Здесь есть продолжение — все темы доступны в Premium.',
      'Обзор уже прочитан. Полная версия покажет любовь, деньги, работу и остальное без обрезки.',
      'Одна тема открыта бесплатно, остальные — в полном разборе.',
      'Хочешь всю картину — она в Premium, без спрятанных кусочков.',
      'Полный разбор открывает все темы на эту дату.',
      'Эта тема пока закрыта. Premium снимает ограничения со всего личного гороскопа.',
      'В бесплатной версии — главное. В Premium — весь разбор по разделам.',
      'Остальное не исчезло, просто закрыто до полной версии.',
      'Все темы уже рассчитаны. Premium открывает их целиком.',
    ],
    en: [
      'The remaining topics are locked. Premium opens the full reading.',
      'There is more here — every topic is available with Premium.',
      'You have read the overview. The full version opens love, money, work, and the rest without cuts.',
      'One topic is free; the rest are in the full reading.',
      'The whole picture is in Premium, with no missing pieces.',
      'The full reading opens every topic for this date.',
      'This topic is still locked. Premium opens the entire personal horoscope.',
      'The free version gives you the main part. Premium gives you every section.',
      'The rest has not disappeared; it is simply locked until the full version.',
      'Every topic is already calculated. Premium opens them in full.',
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
