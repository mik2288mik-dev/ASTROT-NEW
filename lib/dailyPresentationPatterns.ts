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
      'Сверяем твою карту с расчётами на день. Секунду.',
      'Проверяем детали по твоей карте — тут лучше без угадываний.',
      'Разбор собирается. Не магия, просто расчётам нужно немного времени.',
      'Картина дня почти сложилась. Осталось проверить пару деталей.',
      'Смотрим, что действительно относится к тебе, а не ко всем подряд.',
      'Карта на месте. Теперь разбираемся, что в ней главное на эту дату.',
      'Не торопимся с выводами — сначала сверим всё по расчётам.',
      'Личный разбор уже в работе. Без тумана и общих фраз.',
      'Собираем смысл из расчётов, а не красивую болтовню.',
      'Ещё несколько секунд — проверяем, чтобы текст был именно про тебя.',
    ],
    en: [
      'Matching your chart with the calculations for the day. One second.',
      'Checking the details in your chart — guessing would be cheaper, but worse.',
      'Your reading is coming together. The calculations just need a moment.',
      'The picture is almost clear. A couple of details still need checking.',
      'Finding what actually applies to you, not to everyone with the same sign.',
      'The chart is here. Now we are sorting out what matters most for this date.',
      'No rushed conclusions — the calculations come first.',
      'Your personal reading is in progress. No fog, no generic filler.',
      'Turning calculations into something useful, not pretty noise.',
      'A few more seconds — making sure this is really about you.',
    ],
  },
  ready: {
    ru: [
      'Разбор на месте. Можно смотреть, где день играет за тебя, а где просит внимания.',
      'Всё сверили. Дальше — только то, что касается тебя.',
      'Готово. Общие фразы оставили за дверью.',
      'Расчёты сошлись. Переходим к сути.',
      'Разбор готов — без страшилок и сахарной ваты.',
      'Твоя карта сказала достаточно. Мы перевели на человеческий.',
      'Всё готово. Смотри, где не стоит усложнять.',
      'Детали проверены. Можно читать.',
      'Разбор собран. Тут про тебя, а не про «всех представителей знака».',
      'Готово. Никаких загадок ради загадок.',
    ],
    en: [
      'Your reading is here. See where the day helps and where it needs more care.',
      'Everything checks out. From here on, it is about you.',
      'Ready. The generic lines stayed outside.',
      'The calculations line up. Let us get to the point.',
      'Your reading is ready — no scare tactics, no sugar coating.',
      'Your chart said enough. We translated it into normal language.',
      'All set. See where you do not need to make things harder.',
      'The details are checked. You can read now.',
      'The reading is ready. This is about you, not every person with your sign.',
      'Ready. No mystery for the sake of mystery.',
    ],
  },
  no_chart: {
    ru: [
      'Без данных рождения получится текст для всех. Нам такой не нужен — сначала соберём твою карту.',
      'Чтобы говорить про тебя, а не про абстрактного человека, нужна натальная карта.',
      'Дата, время и место рождения — и можно разбирать день по-настоящему.',
      'Сначала соберём карту. Иначе будет слишком много общих слов.',
      'Личный разбор начинается с карты рождения. Без неё честнее не выдумывать.',
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
      'A personal reading starts with a birth chart. Without it, making things up would be dishonest.',
      'Add your birth data so the text is about you, not just your sign.',
      'Your chart is still missing. Let us start with the source data.',
      'We need your birth chart. Otherwise the app would be guessing, and that is not how this works.',
      'Birth data first, conclusions second. A sensible order.',
      'Without a chart, we can only generalize. This reading should be more precise.',
    ],
  },
  generation_error: {
    ru: [
      'Разбор не собрался. Ничего мистического — попробуй ещё раз.',
      'Что-то пошло не так. Небо ни при чём, это техника.',
      'Не получилось проверить расчёты. Лучше повторить, чем показать тебе ерунду.',
      'Разбор пока не открылся. Попробуем ещё раз без драматических спецэффектов.',
      'Данные не сложились в нормальный текст. Фальшивую заглушку не покажем.',
      'Сейчас не вышло. Честнее сказать это прямо, чем подсовывать общие слова.',
      'Расчёт споткнулся на полпути. Дай ему ещё одну попытку.',
      'Текст не готов. Лучше немного позже, чем красиво и мимо.',
      'Не получилось собрать личный разбор. Повтори попытку через минуту.',
      'Здесь должен быть твой разбор, а не отговорка. Попробуем ещё раз.',
    ],
    en: [
      'The reading did not come together. Nothing mystical — try again.',
      'Something went wrong. The sky is innocent; this one is technical.',
      'The calculations could not be checked. Better to retry than show you nonsense.',
      'The reading did not open yet. Let us try again without the dramatic effects.',
      'The data did not turn into a proper reading. We will not fake one.',
      'It did not work this time. Saying that plainly beats serving generic filler.',
      'The calculation stumbled halfway through. Give it another try.',
      'The text is not ready. A little later is better than polished and wrong.',
      'Your personal reading could not be prepared. Try again in a minute.',
      'Your reading belongs here, not an excuse. Let us try again.',
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
      'Эта тема пока закрыта. Premium снимает ограничения со всего личного дня.',
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
      'This topic is still locked. Premium opens the entire personal day.',
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
