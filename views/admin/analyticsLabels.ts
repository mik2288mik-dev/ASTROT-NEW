// Человекочитаемые названия экранов и событий — общие для аналитики и карточки
// пользователя, чтобы подписи не расходились между экранами админки.

export const SECTION_LABELS: Record<string, { ru: string; en: string }> = {
  dashboard: { ru: 'Главная', en: 'Home' },
  horoscope: { ru: 'Гороскоп', en: 'Horoscope' },
  chart: { ru: 'Натальная карта', en: 'Natal chart' },
  charts: { ru: 'Мои карты', en: 'My charts' },
  synastry: { ru: 'Совместимость', en: 'Compatibility' },
  oracle: { ru: 'Чат с Lumia', en: 'Lumia chat' },
  matrix: { ru: 'Матрица судьбы', en: 'Destiny matrix' },
  personal_daily: { ru: 'Личный день', en: 'Personal day' },
  paywall: { ru: 'Экран Premium', en: 'Premium screen' },
  premium: { ru: 'Premium', en: 'Premium' },
  settings: { ru: 'Настройки', en: 'Settings' },
  onboarding: { ru: 'Онбординг', en: 'Onboarding' },
  admin: { ru: 'Админка', en: 'Admin' },
  unknown: { ru: 'Без раздела', en: 'No section' },
};

export const EVENT_LABELS: Record<string, { ru: string; en: string }> = {
  screen_view: { ru: 'Открыл экран', en: 'Opened screen' },
  click: { ru: 'Клик по уведомлению', en: 'Notification click' },
  clicked: { ru: 'Клик по уведомлению', en: 'Notification click' },
  open: { ru: 'Открытие из уведомления', en: 'Open from notification' },
  opened_app: { ru: 'Открытие приложения', en: 'App open' },
  opened_target_screen: { ru: 'Открытие экрана из пуша', en: 'Target screen from push' },
  paywall_view: { ru: 'Показ экрана Premium', en: 'Paywall view' },
  natal_upgrade_success: { ru: 'Покупка из натальной карты', en: 'Purchase from natal chart' },
  later: { ru: 'Отложил уведомления', en: 'Snoozed notifications' },
  muted_type: { ru: 'Отключил тип уведомлений', en: 'Muted notification type' },
  disabled_all: { ru: 'Отключил все уведомления', en: 'Disabled all notifications' },
};

export const sectionTitle = (lang: 'ru' | 'en', section: string): string =>
  SECTION_LABELS[section] ? SECTION_LABELS[section][lang] : section;

export const eventLabel = (lang: 'ru' | 'en', type: string): string =>
  EVENT_LABELS[type] ? EVENT_LABELS[type][lang] : type;
