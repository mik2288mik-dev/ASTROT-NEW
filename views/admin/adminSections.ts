export type AdminBackofficeSection =
  | 'overview'
  | 'analytics'
  | 'users'
  | 'economy'
  | 'charts'
  | 'send'
  | 'templates'
  | 'history'
  | 'automation'
  | 'ai'
  | 'assets';

export type AdminNavHub = 'home' | 'people' | 'comms' | 'system';

export type AdminNavGroup = {
  id: AdminNavHub;
  labelRu: string;
  labelEn: string;
  sections: AdminBackofficeSection[];
};

/** Mobile-first IA: 4 hubs instead of a flat 10-item list. */
export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    id: 'home',
    labelRu: 'Обзор',
    labelEn: 'Overview',
    sections: ['overview', 'analytics'],
  },
  {
    id: 'people',
    labelRu: 'Люди',
    labelEn: 'People',
    sections: ['users', 'economy', 'charts'],
  },
  {
    id: 'comms',
    labelRu: 'Рассылки',
    labelEn: 'Comms',
    sections: ['send', 'templates', 'history', 'automation'],
  },
  {
    id: 'system',
    labelRu: 'Система',
    labelEn: 'System',
    sections: ['ai', 'assets'],
  },
];

export const ADMIN_PRIMARY_SECTIONS: AdminBackofficeSection[] = [
  'overview',
  'users',
  'economy',
  'charts',
  'send',
  'automation',
];

export const ADMIN_SECONDARY_SECTIONS: AdminBackofficeSection[] = [
  'templates',
  'history',
  'ai',
  'assets',
];

export function getAdminNavHub(section: AdminBackofficeSection): AdminNavHub {
  return ADMIN_NAV_GROUPS.find((group) => group.sections.includes(section))?.id ?? 'home';
}

export function getAdminNavGroup(section: AdminBackofficeSection): AdminNavGroup {
  return ADMIN_NAV_GROUPS.find((group) => group.sections.includes(section)) ?? ADMIN_NAV_GROUPS[0];
}
