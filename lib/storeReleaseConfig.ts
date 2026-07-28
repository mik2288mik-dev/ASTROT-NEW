/** Public, replaceable store and legal metadata. Do not put credentials here. */
export const STORE_RELEASE_CONFIG = {
  appName: process.env.NEXT_PUBLIC_APP_NAME || 'Твой Гороскоп',
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || '[УКАЖИТЕ_EMAIL_ПОДДЕРЖКИ]',
  developerName: process.env.NEXT_PUBLIC_DEVELOPER_NAME || '[УКАЖИТЕ_ВЛАДЕЛЬЦА_ИЛИ_КОМПАНИЮ]',
  privacyUrl: '/privacy',
  termsUrl: '/terms',
  deleteAccountUrl: '/delete-account',
} as const;

export function isConfiguredPublicValue(value: string): boolean {
  return !!value && !value.startsWith('[УКАЖИТЕ_');
}
