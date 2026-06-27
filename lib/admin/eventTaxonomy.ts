/**
 * Канон продуктовой event-таксономии (см. docs/ADMIN_PANEL_SPEC.md §6).
 * Источник правды по именам событий и их человекочитаемым меткам для аналитики.
 * События пишутся в user_app_events(event_type, section, source, payload_json, occurred_at)
 * клиентом (services/sessionService → /api/users/events) и сервером (нотификации).
 *
 * Заметка по мультиплатформе: каждое событие должно нести property `platform`
 * (telegram/ios/android/web) и `app_version` — заведено в users; на этапе native
 * клиент будет проставлять их в payload_json.
 */

export const CANONICAL_EVENTS = [
  'app_opened',
  'signup_started', 'signup_completed',
  'onboarding_started', 'onboarding_completed',
  'birth_data_started', 'birth_data_completed',
  'natal_chart_generated', 'natal_chart_opened',
  'horoscope_opened',
  'compatibility_started', 'compatibility_completed',
  'paywall_viewed', 'trial_started',
  'subscription_started', 'subscription_cancelled', 'purchase_failed',
  'push_sent', 'push_opened',
  'account_delete_requested',
] as const;
export type CanonicalEvent = (typeof CANONICAL_EVENTS)[number];

/** Алиасы исторических имён → канон (то, что клиент уже шлёт сегодня). */
export const EVENT_ALIASES: Record<string, CanonicalEvent> = {
  paywall_view: 'paywall_viewed',
  purchase: 'subscription_started',
  natal_upgrade_success: 'subscription_started',
  push_daily: 'push_sent',
  push_return: 'push_sent',
};

export function canonicalizeEvent(eventType: string): string {
  return EVENT_ALIASES[eventType] || eventType;
}

export const EVENT_LABELS: Record<string, string> = {
  app_opened: 'Открытие приложения',
  screen_view: 'Просмотр экрана',
  signup_started: 'Начало регистрации',
  signup_completed: 'Регистрация завершена',
  onboarding_started: 'Начало онбординга',
  onboarding_completed: 'Онбординг завершён',
  birth_data_started: 'Ввод данных рождения',
  birth_data_completed: 'Данные рождения введены',
  natal_chart_generated: 'Карта построена',
  natal_chart_opened: 'Карта открыта',
  horoscope_opened: 'Гороскоп открыт',
  compatibility_started: 'Совместимость начата',
  compatibility_completed: 'Совместимость завершена',
  paywall_viewed: 'Просмотр paywall',
  trial_started: 'Триал начат',
  subscription_started: 'Подписка оформлена',
  subscription_cancelled: 'Подписка отменена',
  purchase_failed: 'Ошибка оплаты',
  push_sent: 'Пуш отправлен',
  push_opened: 'Пуш открыт',
  account_delete_requested: 'Запрос удаления аккаунта',
};

export function eventLabel(eventType: string): string {
  return EVENT_LABELS[eventType] || EVENT_LABELS[canonicalizeEvent(eventType)] || eventType;
}
