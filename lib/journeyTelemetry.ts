import { activityId } from './productActivity';

export const JOURNEY_VERSION = 'onboarding-v1';
export const JOURNEY_EVENTS = [
  'onboarding_step_view', 'onboarding_step_progress', 'onboarding_step_exit',
  'onboarding_action', 'birth_field_interaction', 'birth_validation_error',
  'onboarding_wait_started', 'onboarding_wait_finished', 'onboarding_wait_progress',
  'onboarding_result_ready', 'onboarding_failed', 'onboarding_video', 'screen_exit', 'ui_action',
] as const;
export const ONBOARDING_STEPS = ['hello', 'natal', 'future', 'compat', 'calm', 'more', 'choice', 'birth', 'calculating', 'waiting', 'horoscope'] as const;
export const STEP_LABELS: Record<string, string> = {
  hello: 'Личный прогноз', natal: 'Знакомство с натальной картой', future: 'Календарь',
  compat: 'Совместимость', calm: 'Антистресс', more: 'Рассказы и тесты',
  choice: 'Создать прогноз или посмотреть', birth: 'Данные рождения',
  calculating: 'Видео расчёта', waiting: 'Ожидание разбора', horoscope: 'Гороскоп во время ожидания',
};
export const JOURNEY_ACTIONS = ['next', 'back', 'skip_stories', 'create', 'look', 'sign_in', 'submit',
  'retry', 'edit', 'read_horoscope', 'return_wait', 'open_result', 'time_exact', 'time_approximate', 'time_unknown'] as const;
export const ACTION_LABELS: Record<string, string> = {
  next: 'Далее', back: 'Назад', skip_stories: 'Пропустить знакомство', create: 'Создать прогноз',
  look: 'Посмотреть без карты', sign_in: 'Войти в аккаунт', submit: 'Отправить данные', retry: 'Повторить',
  edit: 'Изменить данные', read_horoscope: 'Читать гороскоп', return_wait: 'Вернуться к ожиданию',
  open_result: 'Открыть готовый разбор', time_exact: 'Точное время', time_approximate: 'Примерное время', time_unknown: 'Время неизвестно',
};
export const JOURNEY_KEYS = ['journey_version', 'attempt_id', 'view_id', 'sequence', 'client_at_ms',
  'step', 'next_step', 'action', 'field', 'filled', 'elapsed_ms', 'visible_ms', 'phase', 'wait_id',
  'outcome', 'state', 'time_mode', 'error_kind', 'video_state'] as const;

/** Accept only structural telemetry. Never retain names, birth dates, cities, input values or error text. */
export function sanitizeJourneyValue(key: string, value: unknown): string | number | boolean | null {
  if (['attempt_id', 'view_id', 'wait_id'].includes(key)) return activityId(value);
  if (['elapsed_ms', 'visible_ms'].includes(key)) return Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= 7 * 86_400_000 ? Number(value) : null;
  if (key === 'client_at_ms') return Number.isSafeInteger(value) && Number(value) >= 1_577_836_800_000 && Number(value) <= 4_102_444_800_000 ? Number(value) : null;
  if (key === 'sequence') return Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= 1_000_000 ? Number(value) : null;
  if (key === 'filled') return typeof value === 'boolean' ? value : null;
  const enums: Record<string, readonly string[]> = {
    journey_version: [JOURNEY_VERSION], step: ONBOARDING_STEPS, next_step: ONBOARDING_STEPS,
    action: JOURNEY_ACTIONS, field: ['name', 'date', 'time', 'place', 'gender'],
    phase: ['chart', 'reading', 'video'], outcome: ['created', 'without_chart', 'sign_in', 'ready', 'failed', 'cancelled'],
    state: ['visible', 'hidden', 'closed', 'unmounted', 'transition'], time_mode: ['exact', 'approximate', 'unknown'],
    error_kind: ['validation', 'network', 'calculation', 'session', 'unknown'],
    video_state: ['playing', 'waiting', 'failed', 'poster'],
  };
  return typeof value === 'string' && enums[key]?.includes(value) ? value : null;
}

/** Timing can be tested without a browser; foreground time excludes backgrounding. */
export class JourneyClock {
  private last: number;
  private visible = true;
  visibleMs = 0;
  constructor(readonly startedAt: number, private now: () => number) { this.last = now(); }
  sample(visible = this.visible) {
    const time = this.now();
    if (this.visible) this.visibleMs += Math.max(0, time - this.last);
    this.last = time; this.visible = visible;
    return { elapsed_ms: Math.max(0, time - this.startedAt), visible_ms: Math.round(this.visibleMs) };
  }
}
