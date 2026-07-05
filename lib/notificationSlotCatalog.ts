import type { AdminNotificationTargetSegment, NotificationSlot } from '../types';

export type NotificationRepeatMode = 'daily' | 'weekly' | 'weekdays';

export type NotificationSlotConfig = {
  slot: NotificationSlot;
  defaultTargetSegment: AdminNotificationTargetSegment | null;
  defaultSendTime: string;
  defaultRepeatMode: NotificationRepeatMode;
  targetView: 'dashboard' | 'horoscope' | 'settings' | 'synastry';
  defaultButtonText: string;
  notesRu: string;
  notesEn: string;
};

function getMiniAppBaseUrl(): string {
  return (
    process.env.TELEGRAM_MINI_APP_URL ||
    process.env.NEXT_PUBLIC_TELEGRAM_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    ''
  ).trim();
}

export function buildNotificationDeepLink(targetView: NotificationSlotConfig['targetView'], slot?: NotificationSlot): string {
  const baseUrl = getMiniAppBaseUrl();
  if (!baseUrl) return '';

  try {
    const url = new URL(baseUrl);
    url.searchParams.set('view', targetView);
    if (slot) {
      url.searchParams.set('source', 'notification');
      url.searchParams.set('slot', slot);
    }
    return url.toString();
  } catch {
    return baseUrl;
  }
}

export const NOTIFICATION_SLOT_CONFIG: Record<NotificationSlot, NotificationSlotConfig> = {
  morning: {
    slot: 'morning',
    defaultTargetSegment: 'all',
    defaultSendTime: '08:00',
    defaultRepeatMode: 'daily',
    targetView: 'horoscope',
    defaultButtonText: 'Открыть день',
    notesRu: 'Утренние ежедневные уведомления. Ведут в дневной экран с бесплатным гороскопом и дневной натальной картой.',
    notesEn: 'Morning daily notifications. Deep-link into the day screen with the free horoscope and daily natal card.',
  },
  day: {
    slot: 'day',
    defaultTargetSegment: 'all',
    defaultSendTime: '13:00',
    defaultRepeatMode: 'daily',
    targetView: 'horoscope',
    defaultButtonText: 'Открыть день',
    notesRu: 'Дневные уведомления. Ведут в экран дня, чтобы вернуть фокус и проверить текущий ритм.',
    notesEn: 'Daytime notifications. Deep-link into the day screen to regain focus and check the current rhythm.',
  },
  evening: {
    slot: 'evening',
    defaultTargetSegment: 'all',
    defaultSendTime: '20:00',
    defaultRepeatMode: 'daily',
    targetView: 'horoscope',
    defaultButtonText: 'Открыть день',
    notesRu: 'Вечерние уведомления. Ведут в экран дня для вечернего разбора и мягкого завершения дня.',
    notesEn: 'Evening notifications. Deep-link into the day screen for the evening reading and a softer close of the day.',
  },
  daily_lumi: {
    slot: 'daily_lumi',
    defaultTargetSegment: 'all',
    defaultSendTime: '18:00',
    defaultRepeatMode: 'daily',
    targetView: 'dashboard',
    defaultButtonText: 'Открыть «Твой Гороскоп»',
    notesRu: 'Вечерний возврат в приложение. Ведёт на главный экран «Твой Гороскоп».',
    notesEn: 'Evening re-engagement. Deep-links into the Your Horoscope home screen.',
  },
  upsell: {
    slot: 'upsell',
    defaultTargetSegment: 'free',
    defaultSendTime: '11:30',
    defaultRepeatMode: 'daily',
    targetView: 'horoscope',
    defaultButtonText: 'Открыть Premium',
    notesRu: 'Upsell для пользователей без Premium. Ведёт в экран дня с предложением Premium.',
    notesEn: 'Upsell for users without Premium. Deep-links into the day screen with a Premium offer.',
  },
  promo: {
    slot: 'promo',
    defaultTargetSegment: 'free',
    defaultSendTime: '19:00',
    defaultRepeatMode: 'weekdays',
    targetView: 'horoscope',
    defaultButtonText: 'Посмотреть Premium',
    notesRu: 'Редкие промо-офферы про Premium. По умолчанию ведут в экран дня; deep link можно переопределить вручную.',
    notesEn: 'Rare Premium promo offers. Default deep-link opens the day screen; you can override it manually for a specific offer.',
  },
  custom: {
    slot: 'custom',
    defaultTargetSegment: 'all',
    defaultSendTime: '12:00',
    defaultRepeatMode: 'daily',
    targetView: 'dashboard',
    defaultButtonText: 'Открыть «Твой Гороскоп»',
    notesRu: 'Свободный кастомный слот для служебных или возвратных сценариев.',
    notesEn: 'Free custom slot for operational or reactivation flows.',
  },
};

export const NOTIFICATION_SLOTS: NotificationSlot[] = [
  'morning',
  'day',
  'evening',
  'daily_lumi',
  'upsell',
  'promo',
  'custom',
];

export function getNotificationSlotConfig(slot: NotificationSlot): NotificationSlotConfig {
  return NOTIFICATION_SLOT_CONFIG[slot] || NOTIFICATION_SLOT_CONFIG.custom;
}

export function getNotificationSlotDefaultDeepLink(slot: NotificationSlot): string {
  const config = getNotificationSlotConfig(slot);
  return buildNotificationDeepLink(config.targetView, slot);
}
