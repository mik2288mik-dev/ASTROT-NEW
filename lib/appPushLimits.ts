/** Общие для сервера и админки ограничения рассылок (совпадают с проверкой в NeboNotificationReceiver). */
export const APP_PUSH_ROUTES = ['today', 'natal', 'horoscope', 'compatibility'] as const;
export type AppPushRoute = typeof APP_PUSH_ROUTES[number];
export const APP_PUSH_TITLE_MAX = 70;
export const APP_PUSH_BODY_MAX = 240;
