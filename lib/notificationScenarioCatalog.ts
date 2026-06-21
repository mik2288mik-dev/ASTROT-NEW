import type { AdminNotificationTargetSegment } from '../types';

export type NotificationDayPart = 'morning' | 'day' | 'evening' | 'reactivation';
export type NotificationScenarioKey =
  | 'morning_daily_open'
  | 'morning_best_slot'
  | 'morning_mini_win'
  | 'day_slot_starting_soon'
  | 'day_current_state'
  | 'day_not_opened_reminder'
  | 'day_focus_followup'
  | 'evening_checkin'
  | 'evening_pattern_progress'
  | 'evening_focus_result'
  | 'reactivation_3_days'
  | 'reactivation_7_days'
  | 'premium_month_preview';

export type NotificationScenarioSeed = {
  key: NotificationScenarioKey;
  name: string;
  description: string;
  dayPart: NotificationDayPart;
  timeWindowStart: string;
  timeWindowEnd: string;
  priority: number;
  audienceRule: Record<string, unknown>;
  triggerRule: Record<string, unknown>;
  maxPerDay: number;
  cooldownHours: number;
  imageMode: 'auto' | 'manual' | 'none';
  imageTags: string[];
  buttonText: string;
  deepLinkSection: string;
  templates: NotificationTemplateSeed[];
};

export type NotificationTemplateSeed = {
  title: string;
  body: string;
  buttonText: string;
  tags: string[];
  weight?: number;
};

export const NOTIFICATION_VARIABLES = [
  'first_name',
  'main_title',
  'short_text',
  'current_state',
  'current_state_text',
  'best_slot_from',
  'best_slot_to',
  'best_slot_label',
  'mini_win',
  'checkin_streak',
  'pattern_progress',
  'good_for',
  'better_later',
  'minutes_to_slot',
] as const;

export const NOTIFICATION_FORBIDDEN_PATTERNS = [
  /\d+\s*дом/i,
  /[0-9]+\s*house/i,
  /луна\s+касает/i,
  /луна\s+в\s+[а-яёa-z]+/i,
  /венер[аы]\s+в\s+[а-яёa-z]+/i,
  /меркури[йя]\s+в\s+[а-яёa-z]+/i,
  /натальн(ый|ая|ое|ые)\s+акцент/i,
  /натальн(ая|ой|ую|ые)\s+карт/i,
  /транзит/i,
  /аспект/i,
  /синастри/i,
  /зодиакальн/i,
  /гороскоп\s+для/i,
];

function t(title: string, body: string, buttonText: string, tags: string[] = []): NotificationTemplateSeed {
  return { title, body, buttonText, tags, weight: 100 };
}

const morningDaily = [
  t('🌅 Утро. День уже собран', 'Где сегодня лучше разогнаться, а где сбавить — уже посчитано по твоему дню.\n\n{{main_title}}\n{{short_text}}', 'Открыть день', ['morning', 'today']),
  t('🌅 Твой день готов', 'Покажем коротко: что сделать сейчас, что отложить и где лучший момент.\n\nЛучшее окно: {{best_slot_from}}–{{best_slot_to}}.', 'Посмотреть сегодня', ['morning', 'best_time']),
  t('🎯 Начни день с одного ориентира', 'Главный момент дня, одна маленькая победа и вечерняя проверка — всё внутри.\n\n{{mini_win}}', 'Открыть LUMIA', ['morning', 'mini_win']),
  t('🍃 Утро без лишнего шума', 'Какой темп сегодня твой — спокойный разгон или быстрый старт? Посмотри за минуту.\n\n{{short_text}}', 'Открыть день', ['morning', 'calm']),
  t('⚡ Сегодня есть пара сильных моментов', 'Покажем, когда лучше писать, решать и закрывать дела.\n\nХорошо зайдёт: {{good_for}}.', 'Посмотреть ритм', ['morning', 'focus']),
  t('🗓 День собран по твоим данным', '{{main_title}}\n\nЗайди на минуту: темп дня, лучшее окно и один понятный шаг.', 'Открыть сегодня', ['morning']),
  t('🍃 Сегодня лучше без гонки', 'Похоже, день мягче отзовётся на спокойный темп. Проверь, так ли это.\n\n{{current_state_text}}', 'Проверить день', ['morning', 'calm']),
  t('🌅 Один ясный вход в день', 'Не держи всё в голове. Внутри уже видно, где действовать, а где не перегружаться.', 'Открыть день', ['morning', 'today']),
];

const morningSlot = [
  t('⏰ Сегодня есть сильное окно', 'Не для десяти задач, а для одной, которую пора наконец сдвинуть.\n\nЛучшее окно: {{best_slot_from}}–{{best_slot_to}}.', 'Посмотреть ритм', ['morning', 'best_time']),
  t('🎯 Поймай лучший кусок дня', '{{best_slot_label}}: {{best_slot_from}}–{{best_slot_to}}.\n\nПодходит для: {{good_for}}.', 'Открыть окно', ['morning', 'best_time']),
  t('⏰ Окно дня уже видно', 'Если есть одно важное дело — поставь его на {{best_slot_from}}–{{best_slot_to}}.', 'Посмотреть время', ['morning', 'focus']),
  t('🎯 Сегодня сработает точность', 'Одно верное действие даст больше, чем десять начатых.\n\nЛучший момент: {{best_slot_from}}–{{best_slot_to}}.', 'Открыть момент', ['morning', 'focus']),
  t('🧭 У дня есть нормальный ход', '{{current_state_text}}\n\nВнутри — как не распылиться к обеду.', 'Посмотреть пульс', ['morning', 'pulse']),
  t('⏰ День не торопит', 'Но рабочее окно есть: {{best_slot_from}}–{{best_slot_to}}. Выбери одну задачу под него.', 'Открыть день', ['morning', 'best_time']),
  t('⚡ Лови момент', 'LUMIA подсветила, когда сегодня день даёт больше хода.\n\n{{best_slot_label}}.', 'Проверить окно', ['morning']),
  t('🎯 Важное не теряй в шуме', 'Посмотри, во сколько проще сделать один чистый шаг без помех.', 'Посмотреть ритм', ['morning', 'calm']),
];

const morningMiniWin = [
  t('✅ Маленькая победа на сегодня', '{{mini_win}}\n\nНе геройский план — один понятный шаг.', 'Выбрать действие', ['morning', 'mini_win']),
  t('✅ Хватит одного сдвига', '{{mini_win}}\n\nПокажем, когда его лучше сделать.', 'Открыть шаг', ['morning', 'mini_win']),
  t('🎯 Без списка на сто пунктов', 'Одна победа на день уже есть.\n\n{{mini_win}}', 'Посмотреть', ['morning', 'mini_win']),
  t('🍃 Сделай день проще', '{{main_title}}\n\nНачни с малого: {{mini_win}}', 'Открыть сегодня', ['morning', 'calm']),
  t('⚡ Один шаг лучше хаоса', 'Сегодня зайдёт короткое действие без давления.\n\n{{mini_win}}', 'Выбрать шаг', ['morning', 'focus']),
  t('✨ Пусть день начнётся с ясности', 'Не разгоняйся. Возьми одну маленькую победу и держи темп.', 'Открыть действие', ['morning']),
  t('🎯 Сегодня можно мягко сдвинуть дело', '{{mini_win}}\n\nВнутри видно, где для этого лучшее окно.', 'Посмотреть время', ['morning', 'best_time']),
  t('✅ Мини-победа уже ждёт', 'Открой LUMIA и забери короткий фокус на день — без драмы и списков.', 'Открыть LUMIA', ['morning', 'mini_win']),
];

const daySlot = [
  t('⏳ Через {{minutes_to_slot}} минут — сильный момент', 'Подходит для: {{good_for}}.\n\nНе всё сразу — выбери одно главное.', 'Открыть окно', ['day', 'best_time']),
  t('⏰ Скоро лучший кусок дня', 'Если есть одно важное дело — сейчас самое время его поймать.', 'Посмотреть', ['day', 'focus']),
  t('🧭 День даёт нормальный ход', 'Не распыляйся: одно главное и закрой спокойно.', 'Открыть пульс', ['day', 'pulse']),
  t('🎯 Можно сдвинуть то, что висит', 'Лучшее окно уже подсвечено: {{best_slot_from}}–{{best_slot_to}}.', 'Посмотреть ритм', ['day', 'best_time']),
  t('⚡ Сейчас хорошее окно для одного дела', '{{current_state_text}}\n\nПроверь, что успеть до спада.', 'Открыть сейчас', ['day', 'focus']),
  t('🎯 Пора не распыляться', 'Следующее окно хорошо подходит для: {{good_for}}.', 'Посмотреть окно', ['day']),
  t('💼 День открыл рабочее окно', 'Давно откладывал короткое дело? Сейчас к нему проще подойти.', 'Открыть день', ['day', 'focus']),
  t('🧭 Сейчас важнее точность, не скорость', 'Покажем, где у дня нормальный ход, а что оставить на потом.', 'Проверить пульс', ['day', 'pulse']),
];

const dayState = [
  t('🧭 Момент свериться', '{{current_state_text}}\n\nЛучше не тащить день на автомате.', 'Посмотреть пульс', ['day', 'pulse']),
  t('🧭 {{current_state}}', '{{short_text}}\n\nЗайди на минуту и выбери один следующий шаг.', 'Открыть сейчас', ['day']),
  t('🍃 Не всё нужно решать сейчас', 'Посмотри, что спокойно подождёт до вечера: {{better_later}}.', 'Проверить сейчас', ['day', 'calm']),
  t('🎯 Середина дня просит фокуса', 'Одно дело — и закрой его спокойно.\n\n{{current_state_text}}', 'Открыть пульс', ['day', 'focus']),
  t('🍃 Сейчас лучше без резких решений', 'Зайди на минуту: где день проседает и что проще перенести.', 'Проверить день', ['day', 'calm']),
  t('🧭 Момент читается яснее', '{{main_title}}\n\nВнутри видно, что сейчас поддержит день.', 'Открыть ритм', ['day']),
  t('⏸ Пауза на минуту', 'Иногда этого хватает, чтобы вернуть фокус.\n\nСейчас подходит: {{good_for}}.', 'Посмотреть', ['day', 'focus']),
  t('🧭 День можно перенастроить', 'Посмотри, где добавить усилие, а где снять давление.', 'Открыть день', ['day']),
];

const eveningCheckin = [
  t('🌙 Как день прошёл на самом деле?', 'Отметь за 20 секунд: настроение, фокус и совпал ли ориентир.\n\nЗавтра подсказки станут точнее.', 'Отметить день', ['evening', 'checkin']),
  t('🌙 Вечерняя точка', 'Быстро отметь, что совпало, а что нет.\n\nЧерез пару дней появятся первые личные наблюдения.', 'Записать день', ['evening', 'checkin']),
  t('🌙 День почти закрыт', 'Один короткий check-in — и LUMIA запомнит твой ритм для завтрашних подсказок.', 'Отметить', ['evening', 'checkin']),
  t('🌙 Сегодня было похоже на прогноз?', 'Ответь в пару тапов. Это заметно улучшит следующие подсказки.', 'Проверить', ['evening', 'checkin']),
  t('🌙 Закроем день спокойно?', 'Настроение, фокус, совпало или нет — сохраним твой ритм за минуту.', 'Записать', ['evening', 'checkin']),
  t('🍃 Вечер лучше не уносить в шум', 'Отметь, что реально сработало сегодня. Меньше минуты.', 'Отметить день', ['evening', 'calm']),
  t('🌙 Один короткий итог', 'Так LUMIA поймёт, какие моменты дня правда совпадают с твоим состоянием.', 'Сделать check-in', ['evening', 'checkin']),
  t('🌙 Дай дню нормальную точку', 'Без длинных отчётов: три быстрых ответа — и день сохранён.', 'Закрыть день', ['evening']),
];

const eveningProgress = [
  t('📈 Уже {{checkin_streak}} дня подряд', 'Ещё немного — и LUMIA начнёт ловить твои повторы точнее.\n\nСегодняшний check-in — 20 секунд.', 'Продолжить', ['evening', 'pattern']),
  t('📈 Личные наблюдения собираются', '{{pattern_progress}}\n\nОтметь день — и подсказки станут точнее.', 'Отметить день', ['evening', 'pattern']),
  t('📈 Твой ритм становится понятнее', 'Каждая вечерняя отметка отделяет случайность от повтора.', 'Записать день', ['evening', 'pattern']),
  t('🌙 Ещё один день в картину', 'Короткий check-in поможет точнее ловить твои рабочие окна.', 'Отметить', ['evening', 'checkin']),
  t('📈 Паттерны собираются тихо', 'Не дневник — пара тапов, чтобы сохранить день.', 'Сохранить ритм', ['evening', 'pattern']),
  t('🌙 Сегодня тоже стоит отметить', 'Даже обычные дни часто показывают самые честные повторы.', 'Записать', ['evening']),
  t('📈 Точность растёт из простых отметок', 'Отметь, как день прошёл на деле — наблюдения обновятся.', 'Отметить день', ['evening', 'pattern']),
  t('🌙 Вечерняя проверка ритма', 'Через несколько дней эти отметки сложатся в полезную картину.', 'Проверить', ['evening']),
];

const eveningFocus = [
  t('✅ Что сегодня реально сработало?', 'Отметь фокус и настроение. Сохраним, где день был точным, а где нет.', 'Записать результат', ['evening', 'focus']),
  t('✅ Фокус дня можно закрыть', 'Получилось — отлично. Нет — просто отметь как было, без оценок.', 'Отметить результат', ['evening', 'mini_win']),
  t('🍃 Без самокритики, просто факт', 'Пара ответов — и завтрашние лучшие моменты покажем точнее.', 'Закрыть день', ['evening', 'calm']),
  t('🎯 Сегодняшний фокус важен', '{{mini_win}}\n\nОтметь вечером, удалось ли сдвинуть это хоть немного.', 'Проверить фокус', ['evening', 'focus']),
  t('🌙 День почти завершён', 'Сохраним, что получилось, что не зашло и какой темп был твоим.', 'Отметить', ['evening']),
  t('🍃 Маленький итог без давления', 'LUMIA не оценивает день, а учится твоему ритму.', 'Записать итог', ['evening', 'checkin']),
  t('✅ Фокус дня возвращается вечером', 'Посмотри, что сработало, и отметь в пару тапов.', 'Открыть итог', ['evening', 'focus']),
  t('🌙 Закрой день честно', 'Даже «почти» полезно — следующие подсказки станут мягче и точнее.', 'Отметить день', ['evening']),
];

const reactivation = [
  t('Твой день уже собран', 'Зайди на минуту: что сегодня стоит сделать, а что отпустить. Коротко и по делу.', 'Открыть', ['reactivation']),
  t('LUMIA на месте', 'Новый день и одна понятная подсказка ждут внутри. Загляни, когда будет удобно.', 'Вернуться', ['reactivation']),
  t('Можно вернуться спокойно', 'Без длинных текстов — главный ориентир на сегодня и пара тёплых советов.', 'Открыть', ['reactivation']),
  t('Сегодняшний разбор уже ждёт', 'Открой на минуту и забери один полезный вывод на день.', 'Вернуться', ['reactivation']),
  t('Можно зайти мягко', 'Покажем сегодняшний день — без давления и лишнего шума.', 'Открыть сегодня', ['reactivation', 'calm']),
  t('Новый день собран', '{{main_title}}\n\nЗагляни на минуту, чтобы поймать свой ритм.', 'Посмотреть', ['reactivation']),
  t('Без большого возвращения', 'Просто открой сегодняшний день и забери один ориентир.', 'Открыть LUMIA', ['reactivation']),
  t('Вернуться можно за минуту', 'Пара тапов сегодня — и подсказки снова станут ближе к тебе.', 'Открыть', ['reactivation']),
];

const premium = [
  t('🌟 Сегодняшний день — только начало', 'В Premium открывается целый месяц: больше рабочих окон, повторов и вечерних выводов.', 'Посмотреть Premium', ['premium']),
  t('🔓 Хочешь видеть наперёд?', 'Полный месяц в LUMIA — это планировать спокойнее, а не гадать по одному дню.', 'Открыть месяц', ['premium']),
  t('🌟 Больше точности, меньше догадок', 'Premium даёт не больше текста, а больше полезных деталей по твоему ритму.', 'Посмотреть', ['premium']),
  t('🔓 Полный месяц уже можно открыть', 'Когда подсказок хватает не на один день, неделя выстраивается сама.', 'Открыть месяц', ['premium']),
  t('🌟 Больше личных наблюдений', 'Premium показывает не только сегодня, но и повторы ближайших недель.', 'Посмотреть Premium', ['premium']),
  t('✨ Если хочется шире', 'Внутри — месячный preview: без сложностей, только полезные акценты.', 'Открыть preview', ['premium']),
  t('🌟 Твой ритм не заканчивается сегодня', 'Посмотри, как LUMIA собирает ближайший месяц в понятные подсказки.', 'Посмотреть месяц', ['premium']),
  t('🔓 Premium без перегруза', 'Больше точности, меньше случайных догадок. Открой preview и реши спокойно.', 'Открыть', ['premium']),
];

function scenario(
  key: NotificationScenarioKey,
  name: string,
  description: string,
  dayPart: NotificationDayPart,
  timeWindowStart: string,
  timeWindowEnd: string,
  priority: number,
  templates: NotificationTemplateSeed[],
  buttonText: string,
  deepLinkSection: string,
  extra?: {
    segment?: AdminNotificationTargetSegment;
    trigger?: Record<string, unknown>;
    imageTags?: string[];
    maxPerDay?: number;
    cooldownHours?: number;
  }
): NotificationScenarioSeed {
  return {
    key,
    name,
    description,
    dayPart,
    timeWindowStart,
    timeWindowEnd,
    priority,
    audienceRule: { segment: extra?.segment || 'all' },
    triggerRule: extra?.trigger || {},
    maxPerDay: extra?.maxPerDay ?? 1,
    cooldownHours: extra?.cooldownHours ?? 20,
    imageMode: 'auto',
    imageTags: extra?.imageTags || [dayPart],
    buttonText,
    deepLinkSection,
    templates,
  };
}

export const NOTIFICATION_SCENARIO_SEEDS: NotificationScenarioSeed[] = [
  scenario('morning_daily_open', 'Утро: день коротко', 'Короткий вход в сегодняшний ритм LUMIA.', 'morning', '08:30', '10:30', 70, morningDaily, 'Открыть сегодня', 'today', { imageTags: ['morning', 'today'] }),
  scenario('morning_best_slot', 'Утро: лучший момент дня', 'Утренний сценарий, если у дня есть понятный сильный слот.', 'morning', '08:30', '10:30', 76, morningSlot, 'Посмотреть ритм', 'best-time', { trigger: { requiresBestSlot: true }, imageTags: ['morning', 'best_time'] }),
  scenario('morning_mini_win', 'Утро: маленькая победа', 'Утренний сценарий с одним мягким действием дня.', 'morning', '08:30', '10:30', 72, morningMiniWin, 'Выбрать действие', 'mini-win', { imageTags: ['morning', 'mini_win'] }),
  scenario('day_slot_starting_soon', 'День: слот скоро начнется', 'Дневной триггер перед лучшим окном дня.', 'day', '12:00', '17:30', 92, daySlot, 'Открыть слот', 'best-time', { trigger: { minutesToSlotMax: 45 }, imageTags: ['day', 'best_time'] }),
  scenario('day_current_state', 'День: текущее состояние', 'Мягкая подсказка по текущему состоянию дня.', 'day', '12:00', '17:30', 68, dayState, 'Посмотреть пульс', 'pulse', { imageTags: ['day', 'pulse'] }),
  scenario('day_not_opened_reminder', 'День: не открывал сегодня', 'Напоминание, если пользователь не заходил утром.', 'day', '12:00', '17:30', 60, dayState, 'Открыть день', 'today', { trigger: { openedToday: false }, imageTags: ['day', 'today'] }),
  scenario('day_focus_followup', 'День: продолжение фокуса', 'Follow-up после выбранного действия/фокуса дня.', 'day', '12:00', '17:30', 64, daySlot, 'Проверить фокус', 'mini-win', { trigger: { acceptedFocusToday: true }, imageTags: ['day', 'focus'] }),
  scenario('evening_checkin', 'Вечер: check-in', 'Основной вечерний сценарий для отметки дня.', 'evening', '19:00', '22:00', 100, eveningCheckin, 'Отметить день', 'checkin', { imageTags: ['evening', 'checkin'] }),
  scenario('evening_pattern_progress', 'Вечер: прогресс наблюдений', 'Показывает прогресс к личным паттернам.', 'evening', '19:00', '22:00', 88, eveningProgress, 'Продолжить', 'checkin', { trigger: { hasPatternProgress: true }, imageTags: ['evening', 'pattern'] }),
  scenario('evening_focus_result', 'Вечер: результат фокуса', 'Закрывает маленькую победу или фокус дня.', 'evening', '19:00', '22:00', 90, eveningFocus, 'Отметить результат', 'checkin', { imageTags: ['evening', 'focus'] }),
  scenario('reactivation_3_days', 'Возврат: 3 дня без клика', 'Мягкое возвращение после нескольких дней без клика.', 'reactivation', '10:00', '20:00', 25, reactivation, 'Открыть', 'today', { segment: 'inactive_3d', trigger: { minDaysWithoutClick: 3, maxDaysWithoutClick: 6 }, imageTags: ['reactivation'] }),
  scenario('reactivation_7_days', 'Возврат: 7 дней без клика', 'Редкое возвращение после недели без клика.', 'reactivation', '10:00', '20:00', 20, reactivation, 'Вернуться', 'today', { segment: 'inactive_7d', trigger: { minDaysWithoutClick: 7 }, imageTags: ['reactivation'] }),
  scenario('premium_month_preview', 'Premium: preview месяца', 'Ненавязчивый premium-preview для free-аудитории.', 'day', '11:00', '18:00', 30, premium, 'Посмотреть Premium', 'premium', { segment: 'free', imageTags: ['premium', 'day'], cooldownHours: 72 }),
];

export const NOTIFICATION_SCENARIO_KEYS = NOTIFICATION_SCENARIO_SEEDS.map((item) => item.key);
