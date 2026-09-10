import type { AdminNotificationTargetSegment } from '../types';

export type NotificationDayPart = 'morning' | 'day' | 'evening' | 'reactivation';
export type NotificationScenarioKey =
  | 'morning_daily_open'
  | 'day_not_opened_reminder'
  | 'day_slot_starting_soon'
  | 'natal_setup_reminder'
  | 'love_daily'
  | 'money_daily'
  | 'work_daily'
  | 'synastry_prompt'
  | 'premium_upgrade'
  | 'reactivation_3_days'
  | 'reactivation_7_days';

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
  'good_for',
  'better_later',
  'minutes_to_slot',
] as const;

export const NOTIFICATION_FORBIDDEN_PATTERNS = [
  /\d+\s*\u0434\u043e\u043c/i,
  /[0-9]+\s*house/i,
  /\u043b\u0443\u043d\u0430\s+\u043a\u0430\u0441\u0430\u0435\u0442/i,
  /\u043b\u0443\u043d\u0430\s+\u0432\s+[\u0430-\u044f\u0451a-z]+/i,
  /\u0432\u0435\u043d\u0435\u0440[\u0430\u044b]\s+\u0432\s+[\u0430-\u044f\u0451a-z]+/i,
  /\u043c\u0435\u0440\u043a\u0443\u0440\u0438[\u0439\u044f]\s+\u0432\s+[\u0430-\u044f\u0451a-z]+/i,
  /\u043d\u0430\u0442\u0430\u043b\u044c\u043d(\u044b\u0439|\u0430\u044f|\u043e\u0435|\u044b\u0435)\s+\u0430\u043a\u0446\u0435\u043d\u0442/i,
  /\u043d\u0430\u0442\u0430\u043b\u044c\u043d(\u0430\u044f|\u043e\u0439|\u0443\u044e|\u044b\u0435)\s+\u043a\u0430\u0440\u0442/i,
  /\u0442\u0440\u0430\u043d\u0437\u0438\u0442/i,
  /\u0430\u0441\u043f\u0435\u043a\u0442/i,
  /\u0441\u0438\u043d\u0430\u0441\u0442\u0440\u0438/i,
  /\u0437\u043e\u0434\u0438\u0430\u043a\u0430\u043b\u044c\u043d/i,
  /\u0433\u043e\u0440\u043e\u0441\u043a\u043e\u043f\s+\u0434\u043b\u044f/i,
];

function t(title: string, body: string, buttonText: string, tags: string[] = []): NotificationTemplateSeed {
  return { title, body, buttonText, tags, weight: 100 };
}

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

const dailyCard = [
  t(
    'День стоит открыть спокойно',
    '{{main_title}}\n\n{{short_text}}',
    'Открыть день',
    ['daily', 'personal']
  ),
  t(
    '{{first_name}}, коротко про сегодня',
    '{{current_state_text}}\n\nЛучше выбрать одно понятное дело и не раздавать день по кускам.',
    'Посмотреть',
    ['daily']
  ),
];

const dailySlot = [
  t(
    'Есть удобный кусок дня',
    'Если надо сдвинуть одно важное дело, присмотрись к {{best_slot_label}}: {{best_slot_from}}-{{best_slot_to}}.\n\nПодходит для: {{good_for}}.',
    'Открыть день',
    ['daily', 'timing']
  ),
  t(
    'Скоро хороший момент для одного шага',
    'Не для десяти задач сразу. Выбери главное и проверь дневной разбор перед стартом.',
    'Посмотреть день',
    ['daily', 'timing']
  ),
];

const natalSetup = [
  t(
    'Нужны данные рождения',
    'Без даты и места рождения личный день не станет по-настоящему твоим. Заполни профиль, и карта начнет работать точнее.',
    'Заполнить',
    ['setup', 'natal']
  ),
  t(
    'Можно уточнить карту',
    'Если добавишь время рождения, разбор станет точнее в темах отношений, денег и решений.',
    'Добавить время',
    ['setup', 'natal']
  ),
];

const love = [
  t(
    'Про отношения сегодня',
    'Смотри не только на слова. В разделе любви видно, где лучше сказать прямо, а где не давить.',
    'Открыть любовь',
    ['love', 'daily']
  ),
];

const money = [
  t(
    'Перед покупкой лучше сделать паузу',
    'День больше подходит для сравнения вариантов, чем для решения на импульсе.',
    'Открыть деньги',
    ['money', 'daily']
  ),
];

const work = [
  t(
    'Рабочее лучше не распылять',
    'Выбери одну задачу и доведи ее до результата. В разделе работы есть подсказка, где меньше лишнего сопротивления.',
    'Открыть работу',
    ['work', 'daily']
  ),
];

const synastry = [
  t(
    'Можно проверить союз',
    'Если есть человек, с которым все непросто, совместимость покажет, где вы чаще цепляетесь и где легче договориться.',
    'Проверить союз',
    ['synastry']
  ),
];

const premium = [
  t(
    'В полном дне больше деталей',
    'Free показывает главное. Premium открывает все темы дня, summary и архив личных разборов.',
    'Открыть Premium',
    ['premium']
  ),
];

const reactivation = [
  t(
    'Можно вернуться с одного экрана',
    'Открой сегодняшний разбор: главное, осторожнее и один полезный шаг уже собраны в дневной карте.',
    'Открыть день',
    ['reactivation', 'daily']
  ),
  t(
    'Без большого возвращения',
    'Просто загляни на минуту и забери один ориентир на сегодня.',
    'Посмотреть',
    ['reactivation']
  ),
];

export const NOTIFICATION_SCENARIO_SEEDS: NotificationScenarioSeed[] = [
  scenario('morning_daily_open', 'Утро: личный день', 'Короткий вход в личный прогноз дня.', 'morning', '08:30', '11:30', 80, dailyCard, 'Открыть день', 'daily_card', { imageTags: ['morning', 'daily'] }),
  scenario('day_not_opened_reminder', 'День: не открывал сегодня', 'Напоминание открыть личный день, если утром пользователь не заходил.', 'day', '12:00', '17:30', 62, dailyCard, 'Открыть день', 'daily_card', { trigger: { openedToday: false }, imageTags: ['day', 'daily'] }),
  scenario('day_slot_starting_soon', 'День: удобное окно скоро', 'Текстовый сигнал внутри личного дня, без отдельной Action Window.', 'day', '12:00', '17:30', 72, dailySlot, 'Открыть день', 'daily_card', { trigger: { requiresBestSlot: true, minutesToSlotMax: 45 }, imageTags: ['day', 'daily'] }),
  scenario('natal_setup_reminder', 'Настройка: данные рождения', 'Просит заполнить данные рождения для личного дня.', 'day', '10:00', '20:00', 90, natalSetup, 'Заполнить', 'natal_free', { segment: 'new_user_no_birth_data', imageTags: ['setup', 'natal'] }),
  scenario('love_daily', 'День: любовь', 'Ведет в тему любви личного дня.', 'day', '13:00', '20:00', 58, love, 'Открыть любовь', 'love', { imageTags: ['love', 'daily'] }),
  scenario('money_daily', 'День: деньги', 'Ведет в тему денег личного дня.', 'day', '13:00', '20:00', 56, money, 'Открыть деньги', 'money', { imageTags: ['money', 'daily'] }),
  scenario('work_daily', 'День: работа', 'Ведет в тему работы личного дня.', 'day', '13:00', '20:00', 56, work, 'Открыть работу', 'work', { imageTags: ['work', 'daily'] }),
  scenario('synastry_prompt', 'Premium: совместимость', 'Ведет в совместимость по данным рождения.', 'day', '13:00', '20:00', 52, synastry, 'Проверить союз', 'synastry', { imageTags: ['synastry'] }),
  scenario('premium_upgrade', 'Premium: полный день', 'Показывает ценность полного личного дня и архива.', 'day', '11:00', '20:00', 50, premium, 'Открыть Premium', 'premium', { segment: 'free', imageTags: ['premium'], cooldownHours: 72 }),
  scenario('reactivation_3_days', 'Возврат: 3 дня без клика', 'Мягкое возвращение после нескольких дней без клика.', 'reactivation', '10:00', '20:00', 30, reactivation, 'Открыть день', 'daily_card', { segment: 'inactive_3d', trigger: { minDaysWithoutClick: 3, maxDaysWithoutClick: 6 }, imageTags: ['reactivation'] }),
  scenario('reactivation_7_days', 'Возврат: 7 дней без клика', 'Редкое возвращение после недели без клика.', 'reactivation', '10:00', '20:00', 25, reactivation, 'Открыть день', 'daily_card', { segment: 'inactive_7d', trigger: { minDaysWithoutClick: 7 }, imageTags: ['reactivation'] }),
];

export const NOTIFICATION_SCENARIO_KEYS = NOTIFICATION_SCENARIO_SEEDS.map((item) => item.key);
