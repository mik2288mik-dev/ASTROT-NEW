import { activityId } from './productActivity';

export const APP_TRACE_VERSION = 'app-trace-v1';
export const TRACE_TYPES = ['visit_started', 'identity_ready', 'product_event', 'screen_view', 'screen_progress', 'screen_exit', 'section_view', 'section_exit', 'control_view', 'ui_click',
  'field_focus', 'field_changed', 'scroll_depth', 'feed_position', 'content_view', 'request_started', 'request_finished',
  'question_draft', 'question_submit', 'question_result', 'media_action', 'visibility', 'client_error'] as const;
export type TraceType = typeof TRACE_TYPES[number];
export type AppTraceEvent = { id: string; sequence: number; at: number; type: TraceType; screen: string;
  payload: Record<string, string | number | boolean> };
export const TRACE_SCREENS = ['startup', 'auth', 'legal', 'onboarding', 'dashboard', 'chart', 'personality',
  'horoscope', 'synastry', 'services', 'encyclopedia', 'matrix', 'settings', 'charts', 'tests', 'mood',
  'sounds', 'antistress', 'stories', 'paywall'];
export const TRACE_SCREEN_LABELS: Record<string, string> = { startup: 'Запуск', auth: 'Вход', legal: 'Согласие', onboarding: 'Первое знакомство',
  dashboard: 'Сегодня', chart: 'Натальная карта', personality: 'Профиль карты', horoscope: 'Гороскоп', synastry: 'Совместимость',
  services: 'Сервисы', encyclopedia: 'Энциклопедия', matrix: 'Матрица судьбы', settings: 'Настройки', charts: 'Сохранённые карты',
  tests: 'Тесты', mood: 'Настроение', sounds: 'Звуки', antistress: 'Антистресс', stories: 'Рассказы', paywall: 'Предложение Premium' };
export const TRACE_LABELS: Record<TraceType, string> = { visit_started: 'Открыл приложение', screen_view: 'Открыл экран', screen_progress: 'Время на экране',
  identity_ready: 'Гостевой или обычный вход готов',
  product_event: 'Действие или результат функции',
  screen_exit: 'Вышел из экрана', ui_click: 'Нажатие', field_focus: 'Открыл поле', field_changed: 'Изменил поле', scroll_depth: 'Прокрутка',
  section_view: 'Открыл вкладку', section_exit: 'Время на вкладке',
  control_view: 'Кнопка находилась на экране',
  content_view: 'Блок находился на экране', request_started: 'Началась загрузка', request_finished: 'Загрузка завершилась',
  feed_position: 'Позиция в ленте',
  question_draft: 'Текст в «Спросить»', question_submit: 'Отправил вопрос', question_result: 'Результат вопроса',
  media_action: 'Аудио / видео', visibility: 'Свернул / вернулся', client_error: 'Ошибка приложения' };

const keyText = (v: unknown, max = 100) => typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max) : null;
/** CSS state changes must not change the identity between an exposure and a click. */
export function traceControlKey(element: Element): string {
  return element.getAttribute('data-telemetry-id') || `${element.tagName.toLowerCase()}:${[...element.classList].filter(name => !/^(is-|has-|active$|selected$|disabled$|loading$)/.test(name)).slice(0, 2).join('.')}`;
}
/** Free text is allowed only for the explicit question instrument, never from arbitrary form values. */
export function sanitizeTraceEvent(input: unknown, now = Date.now()): AppTraceEvent | null {
  if (!input || typeof input !== 'object') return null;
  const e = input as Record<string, unknown>;
  const id = activityId(e.id);
  if (!id || !TRACE_TYPES.includes(e.type as TraceType) || !TRACE_SCREENS.includes(String(e.screen))
    || !Number.isSafeInteger(e.sequence) || Number(e.sequence) < 0 || Number(e.sequence) > 1_000_000
    || !Number.isSafeInteger(e.at) || Number(e.at) > now + 120_000 || Number(e.at) < now - 7 * 86_400_000) return null;
  const type = e.type as TraceType;
  const source = e.payload && typeof e.payload === 'object' ? e.payload as Record<string, unknown> : {};
  const payload: AppTraceEvent['payload'] = {};
  for (const k of ['view_id', 'request_id']) { const value = activityId(source[k]); if (value) payload[k] = value; }
  for (const k of ['elapsed_ms', 'visible_ms', 'focus_ms', 'duration_ms', 'visible_duration_ms', 'scroll_y', 'scroll_height', 'viewport_height', 'length', 'question_id', 'answer_id']) {
    if (Number.isSafeInteger(source[k]) && Number(source[k]) >= 0 && Number(source[k]) <= 7 * 86_400_000) payload[k] = Number(source[k]);
  }
  if (Number.isInteger(source.depth) && Number(source.depth) >= 0 && Number(source.depth) <= 100) payload.depth = Number(source.depth);
  if (Number.isInteger(source.status) && Number(source.status) >= 0 && Number(source.status) <= 599) payload.status = Number(source.status);
  for (const k of ['control', 'label', 'field', 'block', 'detail', 'operation', 'state', 'outcome', 'error_kind', 'media','event_name','section','source','feature_key','placement','period']) {
    const value = keyText(source[k]); if (value) payload[k] = value;
  }
  if (typeof source.filled === 'boolean') payload.filled = source.filled;
  if (['question_draft', 'question_submit'].includes(type) && e.screen === 'chart') {
    const text = keyText(source.text, 300); if (text != null) payload.text = text;
  }
  return { id, type, screen: String(e.screen), sequence: Number(e.sequence), at: Math.min(Number(e.at), now), payload };
}

/** URLs, query parameters and request/response bodies never enter telemetry. */
export function traceOperation(path: string): string | null {
  let pathname = path.split(/[?#]/, 1)[0];
  // Existing app services use both relative paths and the configured API's full URL.
  if (/^https?:\/\//i.test(path)) {
    try { pathname = new URL(path).pathname; } catch { return null; }
  }
  if (!pathname.startsWith('/api/') || /\/api\/(admin|telemetry|users\/(events|activity))\b/.test(pathname)) return null;
  return pathname.replace(/\/[0-9]+(?=\/|$)/g, '/:id').replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}(?=\/|$)/gi, '/:id').slice(0, 100);
}

/** Two different measures: presence in the viewport and the largest visible content block. */
export class ViewportBlockClock {
  private last:number;
  private shown=false;
  private primary=false;
  visibleMs=0;
  focusMs=0;
  constructor(private now:()=>number) {this.last=now();}
  sample(shown=this.shown,primary=this.primary) {
    const time=this.now(),delta=Math.max(0,time-this.last);
    if(this.shown) this.visibleMs+=delta;
    if(this.primary) this.focusMs+=delta;
    this.last=time;this.shown=shown;this.primary=shown && primary;
    return {visible_ms:Math.round(this.visibleMs),focus_ms:Math.round(this.focusMs)};
  }
}
