/** Human names are shared by recommendations, tables and a person's history. */
export function operationLabel(operation: string): string {
  const path = operation.split('?')[0];
  if (/\/natal\/(questions?|questions\/.*)$/.test(path)) return 'Вопросы и ответы в «Спросить»';
  if (path.includes('/forecast/personal')) return 'Личный гороскоп';
  if (path.includes('/forecast/micro')) return 'Короткий личный прогноз';
  if (path.includes('/forecast/future')) return 'Личный прогноз на будущее';
  if (path.includes('/content/natal/reading')) return 'Разбор натальной карты';
  if (path.includes('/content/natal/planet-insight')) return 'Разбор планеты';
  if (path.includes('/content/natal/')) return 'Данные натальной карты';
  if (path.includes('/synastry/')) return 'Разбор совместимости';
  if (path.includes('/content/horoscope/')) return 'Гороскоп по знаку зодиака';
  if (path.includes('/content/today/sky')) return 'Небо сегодня';
  if (path.includes('/content/home-cards')) return 'Блоки главного экрана';
  if (path.startsWith('/api/charts')) return 'Сохранённые карты';
  if (path.includes('/matrix')) return 'Матрица судьбы';
  if (path.includes('/auth/password/register')) return 'Регистрация';
  if (path.includes('/auth/password/reset')) return 'Восстановление пароля';
  if (/\/auth\/(native-guest|guest)$/.test(path)) return 'Вход как гость';
  if (path.startsWith('/api/auth/') || path.includes('/users/session')) return 'Вход и проверка аккаунта';
  if (path.includes('/users/notification-settings')) return 'Настройки уведомлений';
  if (path.startsWith('/api/users/')) return 'Данные профиля';
  if (path.includes('/content/reactions')) return 'Реакция на материал';
  if (path.startsWith('/api/sleep-stories')) return 'Рассказы для сна';
  if (path.startsWith('/api/stories')) return 'Рассказы';
  if (path.startsWith('/api/audio/') || path.startsWith('/api/radio/')) return 'Аудио';
  if (path.startsWith('/api/subscriptions/')) return 'Данные Premium';
  if (path.startsWith('/api/payments/')) return 'Проверка покупки';
  if (path.includes('/forecast/gift')) return 'Гороскоп в подарок';
  if (path.includes('/app/entry-announcement')) return 'Сообщение при запуске';
  return 'Загрузка данных приложения';
}

export const DETAIL_LABELS: Record<string, string> = {
  'navigation:profile': 'Меню профиля',
  foundation: 'Обзор карты', map: 'Круг карты', profile: 'Профиль карты', ask: 'Спросить', explore: 'Разбор карты',
  register: 'Регистрация', login: 'Вход', verify: 'Подтверждение', forgot: 'Восстановление', reset: 'Новый пароль',
  matrix: 'Матрица судьбы', antistress: 'Антистресс', tests: 'Тесты', sounds: 'Звуки', stories: 'Рассказы', knowledge: 'Хочу знать', store: 'Магазин',
  name: 'Имя', date: 'Дата рождения', time: 'Время рождения', place: 'Город рождения', gender: 'Пол', email: 'Почта', question: 'Вопрос',
  day: 'День', week: 'Неделя', month: 'Месяц', exact: 'Точное время', approximate: 'Примерное время', unknown: 'Время неизвестно',
};
export const readableLabel = (value: unknown, fallback = 'Действие без названия'): string =>
  typeof value === 'string' && /[а-яё]/i.test(value) ? value : fallback;
export const detailLabel = (value: unknown) => DETAIL_LABELS[String(value)] || readableLabel(value, 'Другая вкладка');
export function productEventLabel(key: string, label: unknown): string {
  const names: Record<string, string> = {
    onboarding_started: 'Начал первое знакомство', onboarding_completed: 'Закончил первое знакомство',
    first_value_viewed: 'Посмотрел первый результат на главном экране', paywall_view: 'Открыл предложение Premium',
    paywall_viewed: 'Открыл предложение Premium', paywall_impression: 'Увидел предложение Premium', trial_started: 'Начал пробный период',
  };
  return names[key] || readableLabel(label, 'Действие в приложении');
}

const STATE_LABELS: Record<string, string> = {
  success: 'Готово', ready: 'Готово', failed: 'Не получилось', http_error: 'Сервер не выполнил действие', network_error: 'Не удалось связаться с сервером',
  cancelled: 'Ожидание прервано', aborted: 'Ожидание прервано', visible: 'Вернулся в приложение', hidden: 'Свернул приложение',
  scroll_stop: 'Остановился после прокрутки', leave: 'Последняя позиция перед уходом', transition: 'Перешёл на другой экран',
  unmounted: 'Закрыл экран', closed: 'Закрыл приложение', playing: 'Видео играет', waiting: 'Видео загружается', poster: 'Показана обложка видео',
  play: 'Включил', pause: 'Поставил на паузу', ended: 'Досмотрел или дослушал', error: 'Не удалось воспроизвести', stalled: 'Воспроизведение задержалось',
};
export function traceNote(payload: Record<string, unknown>, seconds: (ms: number) => string): string {
  const parts = [
    payload.label ? payload.event_name ? productEventLabel(String(payload.event_name),payload.label) : readableLabel(payload.label) : null,
    payload.detail ? detailLabel(payload.detail) : null,
    payload.block ? readableLabel(payload.block, 'Блок без названия') : null,
    payload.field ? DETAIL_LABELS[String(payload.field)] || 'Поле ввода' : null,
    payload.filled === true ? 'Начал заполнять' : payload.filled === false ? 'Поле пустое' : null,
    payload.period ? DETAIL_LABELS[String(payload.period)] : null,
    typeof payload.visible_ms === 'number' ? `${seconds(payload.visible_ms)} на экране` : null,
    typeof payload.elapsed_ms === 'number' ? payload.media ? `Позиция воспроизведения: ${seconds(payload.elapsed_ms)}` : `${seconds(payload.elapsed_ms)} с начала действия, включая время вне приложения` : null,
    typeof payload.duration_ms === 'number' ? `Заняло ${seconds(payload.duration_ms)}` : null,
    typeof payload.depth === 'number' ? `Прокрутил ${payload.depth}% экрана` : null,
    payload.operation ? operationLabel(String(payload.operation)) : null,
    typeof payload.focus_ms === 'number' ? `${seconds(payload.focus_ms)} занимал больше всего места на экране` : null,
    STATE_LABELS[String(payload.outcome)], STATE_LABELS[String(payload.state)],
    payload.error_kind ? 'Приложение сообщило об ошибке' : null,
  ];
  return [...new Set(parts.filter(Boolean))].join(' · ');
}
