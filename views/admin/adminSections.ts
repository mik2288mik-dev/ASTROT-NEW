export type AdminBackofficeSection =
  | 'overview'
  | 'users'
  | 'economy'
  | 'charts'
  | 'send'
  | 'templates'
  | 'history'
  | 'automation'
  | 'ai'
  | 'assets';

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
