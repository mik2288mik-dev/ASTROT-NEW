// Чистая навигация админки: всего 4 раздела, каждый из которых реально работает.
// Никаких шаблонов/сценариев/генерации контента — только то, чем владелец
// реально управляет: метрики, аналитика, пользователи и ручные уведомления.

export type AdminBackofficeSection =
  | 'overview'
  | 'analytics'
  | 'users'
  | 'send';

export type AdminNavHub = 'home' | 'people';

export type AdminNavGroup = {
  id: AdminNavHub;
  labelRu: string;
  labelEn: string;
  sections: AdminBackofficeSection[];
};

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    id: 'home',
    labelRu: 'Главное',
    labelEn: 'Main',
    sections: ['overview', 'analytics'],
  },
  {
    id: 'people',
    labelRu: 'Управление',
    labelEn: 'Manage',
    sections: ['users', 'send'],
  },
];

/** Порядок разделов для нижней навигации на мобильном. */
export const ADMIN_PRIMARY_SECTIONS: AdminBackofficeSection[] = [
  'overview',
  'analytics',
  'users',
  'send',
];

export function getAdminNavHub(section: AdminBackofficeSection): AdminNavHub {
  return ADMIN_NAV_GROUPS.find((group) => group.sections.includes(section))?.id ?? 'home';
}

export function getAdminNavGroup(section: AdminBackofficeSection): AdminNavGroup {
  return ADMIN_NAV_GROUPS.find((group) => group.sections.includes(section)) ?? ADMIN_NAV_GROUPS[0];
}
