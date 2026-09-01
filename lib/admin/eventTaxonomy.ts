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
  'first_value_viewed', 'first_result_ready', 'natal_section_open', 'compatibility_ready',
  'person_added', 'future_open', 'question_sent', 'share', 'invite_open',
  'paywall_view', 'checkout_start', 'trial_started',
  'purchase_success', 'purchase_cancelled', 'purchase_failed',
  'restore_started', 'restore_success', 'restore_failed',
  'subscription_cancelled', 'subscription_expired',
  'push_sent', 'push_opened',
  'account_delete_requested',
] as const;
export type CanonicalEvent = (typeof CANONICAL_EVENTS)[number];

/** Алиасы исторических имён → канон (то, что клиент уже шлёт сегодня). */
export const EVENT_ALIASES: Record<string, CanonicalEvent> = {
  paywall_viewed: 'paywall_view',
  paywall_impression: 'paywall_view',
  checkout_started: 'checkout_start',
  purchase_succeeded: 'purchase_success',
  subscription_started: 'purchase_success',
  purchase: 'purchase_success',
  natal_upgrade_success: 'purchase_success',
  restore_succeeded: 'restore_success',
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
  first_value_viewed: 'Первый результат Today просмотрен',
  first_result_ready: 'Первый результат готов',
  natal_section_open: 'Раздел натальной карты открыт',
  compatibility_ready: 'Совместимость готова',
  person_added: 'Человек добавлен',
  future_open: 'Будущее открыто',
  question_sent: 'Вопрос отправлен',
  share: 'Результат отправлен',
  invite_open: 'Приглашение открыто',
  paywall_view: 'Просмотр paywall',
  checkout_start: 'Начало оплаты',
  trial_started: 'Триал начат',
  purchase_success: 'Подписка оформлена',
  purchase_cancelled: 'Оплата отменена',
  subscription_cancelled: 'Подписка отменена',
  subscription_expired: 'Подписка истекла',
  purchase_failed: 'Ошибка оплаты',
  restore_started: 'Начало восстановления',
  restore_success: 'Покупка восстановлена',
  restore_failed: 'Ошибка восстановления',
  push_sent: 'Пуш отправлен',
  push_opened: 'Пуш открыт',
  account_delete_requested: 'Запрос удаления аккаунта',
};

export function eventLabel(eventType: string): string {
  return EVENT_LABELS[eventType] || EVENT_LABELS[canonicalizeEvent(eventType)] || eventType;
}
