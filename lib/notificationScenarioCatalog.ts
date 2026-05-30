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
  t('Доброе утро ✨', 'Сегодня LUMIA уже собрала твой ритм: где лучше действовать, а где не разгоняться.\n\n{{main_title}}\n{{short_text}}', 'Открыть день', ['morning', 'today']),
  t('Твой день уже готов', 'Коротко покажем, что лучше сделать сейчас, а что оставить на потом.\n\nЛучший момент дня: {{best_slot_from}}-{{best_slot_to}}.', 'Посмотреть сегодня', ['morning', 'best_time']),
  t('Сегодня лучше начать спокойно', 'Внутри уже есть главный момент дня, маленькая победа и вечерняя проверка.\n\n{{mini_win}}', 'Открыть LUMIA', ['morning', 'mini_win']),
  t('Утро без лишнего шума', 'Посмотри, какой темп сегодня зайдет лучше всего.\n\n{{short_text}}', 'Открыть день', ['morning', 'calm']),
  t('Сегодня есть пара хороших моментов', 'LUMIA покажет, когда лучше писать, решать и закрывать дела.\n\nХорошо зайдет: {{good_for}}.', 'Посмотреть ритм', ['morning', 'focus']),
  t('День уже собран', '{{main_title}}\n\nЗайди на минуту: покажем темп, лучший слот и одну маленькую победу.', 'Открыть сегодня', ['morning']),
  t('Начнем без гонки', 'Похоже, день лучше зайдет через спокойный темп.\n\n{{current_state_text}}', 'Проверить день', ['morning', 'calm']),
  t('Один ясный вход в день', 'Не надо держать все в голове. В LUMIA уже видно, где действовать, а где не перегружаться.', 'Открыть день', ['morning', 'today']),
];

const morningSlot = [
  t('Сегодня есть хороший слот', 'Не для десяти задач сразу, а для одной, которую давно пора сдвинуть.\n\nЛучшее окно: {{best_slot_from}}-{{best_slot_to}}.', 'Посмотреть ритм', ['morning', 'best_time']),
  t('Поймай лучший кусок дня', '{{best_slot_label}}: {{best_slot_from}}-{{best_slot_to}}.\n\nПодходит для: {{good_for}}.', 'Открыть слот', ['morning', 'best_time']),
  t('Окно дня уже видно', 'Если есть одно важное дело, сегодня лучше поставить его на {{best_slot_from}}-{{best_slot_to}}.', 'Посмотреть время', ['morning', 'focus']),
  t('Не все сразу', 'Сегодня сильнее сработает одно точное действие.\n\nЛучший момент: {{best_slot_from}}-{{best_slot_to}}.', 'Открыть лучший момент', ['morning', 'focus']),
  t('Есть нормальное окно для дела', '{{current_state_text}}\n\nВнутри покажем, как не распылиться.', 'Посмотреть пульс', ['morning', 'pulse']),
  t('День не просит спешки', 'Но хороший рабочий слот есть: {{best_slot_from}}-{{best_slot_to}}.\n\nВыбери одну задачу.', 'Открыть день', ['morning', 'best_time']),
  t('Сегодня лучше попасть в момент', 'LUMIA уже подсветила, когда день дает больше хода.\n\n{{best_slot_label}}.', 'Проверить слот', ['morning']),
  t('Важное лучше не терять в шуме', 'Посмотри, во сколько сегодня проще сделать один чистый шаг.', 'Посмотреть ритм', ['morning', 'calm']),
];

const morningMiniWin = [
  t('Маленькая победа дня', '{{mini_win}}\n\nНе героический план, а один понятный шаг.', 'Выбрать действие', ['morning', 'mini_win']),
  t('Сегодня хватит одного сдвига', '{{mini_win}}\n\nLUMIA покажет, когда лучше его сделать.', 'Открыть mini-win', ['morning', 'mini_win']),
  t('Без списка на сто пунктов', 'Одна маленькая победа на сегодня уже есть.\n\n{{mini_win}}', 'Посмотреть', ['morning', 'mini_win']),
  t('Сделай день проще', '{{main_title}}\n\nНачни с малого: {{mini_win}}', 'Открыть сегодня', ['morning', 'calm']),
  t('Один шаг лучше хаоса', 'Сегодня хорошо зайдет короткое действие без лишнего давления.\n\n{{mini_win}}', 'Выбрать шаг', ['morning', 'focus']),
  t('Пусть день начнется с ясности', 'Не надо разгоняться. Возьми одну маленькую победу и держи темп.', 'Открыть действие', ['morning']),
  t('Сегодня можно мягко сдвинуть дело', '{{mini_win}}\n\nВ LUMIA видно, где для этого лучшее окно.', 'Посмотреть время', ['morning', 'best_time']),
  t('Мини-победа уже ждет', 'Открой LUMIA и забери короткий фокус на день без лишней драматичности.', 'Открыть LUMIA', ['morning', 'mini_win']),
];

const daySlot = [
  t('Через {{minutes_to_slot}} минут хороший момент', 'Подходит для: {{good_for}}.\n\nНе все сразу, выбери одно главное.', 'Открыть слот', ['day', 'best_time']),
  t('Скоро лучший кусок дня для дел', 'Если есть одно важное, сейчас самое время его поймать.', 'Посмотреть', ['day', 'focus']),
  t('День сейчас дает нормальный ход', 'Не распыляйся. Выбери одно главное и закрой спокойно.', 'Открыть пульс', ['day', 'pulse']),
  t('Можно сдвинуть то, что висит', 'В LUMIA уже подсвечен лучший слот: {{best_slot_from}}-{{best_slot_to}}.', 'Посмотреть ритм', ['day', 'best_time']),
  t('Сейчас хорошее окно для одного дела', '{{current_state_text}}\n\nПроверь, что лучше сделать до спада.', 'Открыть сейчас', ['day', 'focus']),
  t('Пора не распыляться', 'Следующий слот хорошо подходит для: {{good_for}}.', 'Посмотреть слот', ['day']),
  t('День открывает рабочее окно', 'Если давно откладывал короткое дело, сейчас можно подойти к нему спокойно.', 'Открыть день', ['day', 'focus']),
  t('Сейчас лучше точность, не скорость', 'LUMIA покажет, где у дня нормальный ход и что оставить на потом.', 'Проверить пульс', ['day', 'pulse']),
];

const dayState = [
  t('Сейчас хороший момент свериться', '{{current_state_text}}\n\nЛучше не тащить день на автомате.', 'Посмотреть пульс', ['day', 'pulse']),
  t('{{current_state}}', '{{short_text}}\n\nОткрой LUMIA на минуту и выбери один следующий шаг.', 'Открыть сейчас', ['day']),
  t('Не все нужно решать прямо сейчас', 'Посмотри, что лучше оставить на вечер: {{better_later}}.', 'Проверить сейчас', ['day', 'calm']),
  t('Середина дня просит фокуса', 'Выбери одно дело и закрой его спокойно.\n\n{{current_state_text}}', 'Открыть пульс', ['day', 'focus']),
  t('Сейчас лучше без резких решений', 'Зайди на минуту: покажем, где день проседает и что проще перенести.', 'Проверить день', ['day', 'calm']),
  t('Текущий момент уже читается яснее', '{{main_title}}\n\nВ LUMIA видно, что сейчас поддержит день.', 'Открыть ритм', ['day']),
  t('Пауза на одну минуту', 'Иногда этого хватает, чтобы вернуть себе фокус.\n\nСейчас подходит: {{good_for}}.', 'Посмотреть', ['day', 'focus']),
  t('День можно перенастроить', 'Открой LUMIA и посмотри, где добавить усилие, а где снять давление.', 'Открыть день', ['day']),
];

const eveningCheckin = [
  t('Как день прошел на самом деле?', 'Отметь за 20 секунд: настроение, фокус и совпал ли прогноз.\n\nТак LUMIA будет точнее подстраиваться под тебя.', 'Отметить день', ['evening', 'checkin']),
  t('Вечерняя точка ✨', 'Сегодня можно быстро отметить, что совпало, а что нет.\n\nЧерез несколько дней появятся первые личные наблюдения.', 'Записать день', ['evening', 'checkin']),
  t('День почти закрыт', 'Один короткий check-in, и LUMIA сохранит твой ритм для следующих подсказок.', 'Отметить', ['evening', 'checkin']),
  t('Сегодня было похоже на прогноз?', 'Ответь в пару тапов. Это улучшит следующие подсказки.', 'Проверить', ['evening', 'checkin']),
  t('Закроем день спокойно?', 'Настроение, фокус, совпало или нет — быстро сохраним твой ритм.', 'Записать', ['evening', 'checkin']),
  t('Вечер лучше не уносить в шум', 'Отметь, что реально сработало сегодня. Это займет меньше минуты.', 'Отметить день', ['evening', 'calm']),
  t('Один короткий итог', 'Так LUMIA поймет, какие моменты дня действительно совпадают с твоим состоянием.', 'Сделать check-in', ['evening', 'checkin']),
  t('Дай дню нормальную точку', 'Без длинных отчетов: три быстрых ответа и день сохранен.', 'Закрыть день', ['evening']),
];

const eveningProgress = [
  t('Уже {{checkin_streak}} дня подряд', 'Еще немного, и LUMIA начнет видеть твои повторения точнее.\n\nСегодня можно закрыть check-in за 20 секунд.', 'Продолжить', ['evening', 'pattern']),
  t('Личные наблюдения собираются', '{{pattern_progress}}\n\nОтметь сегодняшний день, чтобы подсказки стали точнее.', 'Отметить день', ['evening', 'pattern']),
  t('Твой ритм становится понятнее', 'Каждая вечерняя отметка помогает отделять случайность от повторения.', 'Записать день', ['evening', 'pattern']),
  t('Еще один день в картину', 'Короткий check-in сегодня поможет LUMIA лучше ловить твои рабочие окна.', 'Отметить', ['evening', 'checkin']),
  t('Паттерны собираются тихо', 'Не надо писать дневник. Достаточно пары тапов, чтобы сохранить день.', 'Сохранить ритм', ['evening', 'pattern']),
  t('Сегодня тоже важно отметить', 'Даже если день был обычным, обычные дни часто показывают самые честные повторения.', 'Записать', ['evening']),
  t('Точность растет от простых отметок', 'Отметь, как день прошел на деле, и LUMIA обновит личные наблюдения.', 'Отметить день', ['evening', 'pattern']),
  t('Вечерняя проверка ритма', 'Через несколько дней эти короткие отметки начнут складываться в полезную картину.', 'Проверить', ['evening']),
];

const eveningFocus = [
  t('Что сегодня реально сработало?', 'Отметь фокус и настроение. LUMIA сохранит, где день был точным, а где нет.', 'Записать результат', ['evening', 'focus']),
  t('Фокус дня можно закрыть', 'Если маленькая победа получилась — отлично. Если нет, просто отметь как было.', 'Отметить результат', ['evening', 'mini_win']),
  t('Без самокритики, просто факт', 'Пара быстрых ответов поможет точнее показывать лучшие моменты следующих дней.', 'Закрыть день', ['evening', 'calm']),
  t('Сегодняшний фокус важен', '{{mini_win}}\n\nОтметь вечером, получилось ли сдвинуть это хоть немного.', 'Проверить фокус', ['evening', 'focus']),
  t('День почти завершен', 'Сохраним, что получилось, что не зашло и какой темп был твоим.', 'Отметить', ['evening']),
  t('Маленький итог без давления', 'LUMIA не оценивает день, а учится твоему ритму.', 'Записать итог', ['evening', 'checkin']),
  t('Фокус дня возвращается вечером', 'Посмотри, что сработало, и отметь в пару тапов.', 'Открыть итог', ['evening', 'focus']),
  t('Закрой день честно', 'Даже «почти» полезно. Так следующие подсказки станут мягче и точнее.', 'Отметить день', ['evening']),
];

const reactivation = [
  t('Мы сохранили сегодняшний ритм', 'Зайди на минуту — там коротко и без лишнего.', 'Открыть', ['reactivation']),
  t('LUMIA не потерялась ✨', 'Сегодня есть новый день, новый ритм и маленькая подсказка.', 'Вернуться', ['reactivation']),
  t('Пора обновить твой ритм', 'Один check-in, и подсказки снова станут точнее.', 'Открыть', ['reactivation', 'checkin']),
  t('Твой день уже ждет внутри', 'Без длинных текстов: только темп дня, лучший момент и вечерняя отметка.', 'Вернуться', ['reactivation']),
  t('Можно зайти мягко', 'LUMIA покажет сегодняшний ритм без давления и лишнего шума.', 'Открыть сегодня', ['reactivation', 'calm']),
  t('Новый день уже собран', '{{main_title}}\n\nЗагляни на минуту, чтобы поймать свой темп.', 'Посмотреть', ['reactivation']),
  t('Давай без большого возвращения', 'Просто открой сегодняшний день и посмотри один полезный ориентир.', 'Открыть LUMIA', ['reactivation']),
  t('Твой ритм можно быстро обновить', 'Пара тапов сегодня помогут подсказкам снова стать ближе к тебе.', 'Обновить ритм', ['reactivation']),
];

const premium = [
  t('Месяц можно увидеть подробнее', 'В Premium откроется больше личных подсказок дня без лишней сложности.', 'Посмотреть Premium', ['premium']),
  t('Сегодняшний ритм — только начало', 'Полный месяц в LUMIA покажет больше рабочих окон, повторений и вечерних выводов.', 'Открыть preview', ['premium']),
  t('Хочешь больше точности?', 'Premium покажет не больше шума, а больше полезных деталей по твоему ритму.', 'Посмотреть', ['premium']),
  t('Полный месяц уже можно открыть', 'Когда подсказок хватает не на один день, проще планировать спокойнее.', 'Открыть месяц', ['premium']),
  t('Больше личных наблюдений', 'Premium помогает видеть не только сегодня, но и повторения ближайших недель.', 'Посмотреть Premium', ['premium']),
  t('Если хочется шире', 'Внутри есть месячный preview: без сложных объяснений, только полезные акценты.', 'Открыть preview', ['premium']),
  t('Твой ритм не заканчивается сегодня', 'Посмотри, как LUMIA собирает ближайший месяц в понятные подсказки.', 'Посмотреть месяц', ['premium']),
  t('Premium без перегруза', 'Больше точности, меньше случайных догадок. Открой preview и реши спокойно.', 'Открыть', ['premium']),
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
