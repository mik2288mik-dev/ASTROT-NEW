const DEFAULT_PUBLIC_BASE_URL = 'https://tvoi-goroskop.ru';

function clean(value: string | undefined): string {
  return String(value || '').trim();
}

function publicValue(value: string | undefined, placeholder: string): string {
  return clean(value) || `OWNER_REQUIRED:${placeholder}`;
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

const baseUrl = clean(process.env.NEXT_PUBLIC_PUBLIC_BASE_URL).replace(/\/+$/, '')
  || DEFAULT_PUBLIC_BASE_URL;
const supportEmail = publicValue(process.env.NEXT_PUBLIC_SUPPORT_EMAIL, 'support-email');
const privacyEmail = publicValue(process.env.NEXT_PUBLIC_PRIVACY_EMAIL, 'privacy-email');
const operatorName = publicValue(process.env.NEXT_PUBLIC_DEVELOPER_NAME, 'operator-name');
const operatorAddress = publicValue(process.env.NEXT_PUBLIC_OPERATOR_ADDRESS, 'operator-address');
const operatorInn = publicValue(process.env.NEXT_PUBLIC_OPERATOR_INN, 'operator-inn');
const operatorOgrnip = publicValue(process.env.NEXT_PUBLIC_OPERATOR_OGRNIP, 'operator-ogrnip');
const publicationDate = publicValue(
  process.env.NEXT_PUBLIC_LEGAL_PUBLICATION_DATE,
  'publication-date-yyyy-mm-dd',
);
const russianHostingProvider = publicValue(
  process.env.NEXT_PUBLIC_RUSSIAN_HOSTING_PROVIDER,
  'russian-hosting-provider',
);
const russianDataLocation = publicValue(
  process.env.NEXT_PUBLIC_RUSSIAN_DATA_LOCATION,
  'russian-data-centre-location',
);
const websiteHostingProvider = publicValue(
  process.env.NEXT_PUBLIC_WEBSITE_HOSTING_PROVIDER,
  'website-hosting-provider-and-country',
);
const transactionalEmailProvider = publicValue(
  process.env.NEXT_PUBLIC_TRANSACTIONAL_EMAIL_PROVIDER,
  'transactional-email-provider',
);
const transactionalEmailCountry = publicValue(
  process.env.NEXT_PUBLIC_TRANSACTIONAL_EMAIL_COUNTRY,
  'transactional-email-processing-country',
);
const supportMailProvider = publicValue(
  process.env.NEXT_PUBLIC_SUPPORT_MAIL_PROVIDER,
  'support-mail-provider',
);
const supportMailCountry = publicValue(
  process.env.NEXT_PUBLIC_SUPPORT_MAIL_COUNTRY,
  'support-mail-processing-country',
);
const geocodingProvider = publicValue(
  process.env.NEXT_PUBLIC_GEOCODING_PROVIDER,
  'geocoding-provider',
);
const geocodingCountry = publicValue(
  process.env.NEXT_PUBLIC_GEOCODING_COUNTRY,
  'geocoding-processing-country',
);
const applicationLogRetentionDays = publicValue(
  process.env.NEXT_PUBLIC_APP_LOG_RETENTION_DAYS,
  'approved-app-log-retention-days',
);
const backupRetentionDays = publicValue(
  process.env.NEXT_PUBLIC_BACKUP_RETENTION_DAYS,
  'approved-backup-retention-days',
);
const supportRetentionMonths = publicValue(
  process.env.NEXT_PUBLIC_SUPPORT_RETENTION_MONTHS,
  'approved-support-retention-months',
);
const minimumAge = publicValue(process.env.NEXT_PUBLIC_MINIMUM_AGE, 'approved-minimum-age');
const rustoreUrl = clean(process.env.NEXT_PUBLIC_RUSTORE_URL);

export const PUBLIC_SITE_CONFIG = {
  appName: 'MEOU',
  baseUrl,
  supportEmail,
  privacyEmail,
  operatorName,
  operatorAddress,
  operatorInn,
  operatorOgrnip,
  publicationDate,
  russianHostingProvider,
  russianDataLocation,
  websiteHostingProvider,
  transactionalEmailProvider,
  transactionalEmailCountry,
  supportMailProvider,
  supportMailCountry,
  geocodingProvider,
  geocodingCountry,
  applicationLogRetentionDays,
  backupRetentionDays,
  supportRetentionMonths,
  minimumAge,
  rustoreUrl,
  yandexWebmasterVerification: clean(process.env.NEXT_PUBLIC_YANDEX_WEBMASTER_VERIFICATION),
  googleSiteVerification: clean(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION),
  privacyUrl: `${baseUrl}/privacy`,
  termsUrl: `${baseUrl}/terms`,
  consentUrl: `${baseUrl}/personal-data-consent`,
  deleteAccountUrl: `${baseUrl}/delete-account`,
  supportUrl: `${baseUrl}/support`,
  requisitesUrl: `${baseUrl}/requisites`,
  isPublicWebsiteBuild: process.env.NEXT_PUBLIC_MEOU_PUBLIC_SITE === '1',
  isLegalPreview: process.env.NEXT_PUBLIC_LEGAL_PREVIEW === '1',
  dataLocalizationConfirmed: process.env.NEXT_PUBLIC_DATA_LOCALIZATION_CONFIRMED === '1',
  crossBorderNotificationsConfirmed:
    process.env.NEXT_PUBLIC_CROSS_BORDER_NOTIFICATIONS_CONFIRMED === '1',
} as const;

export function getPublicLegalProblems(): string[] {
  const problems: string[] = [];

  if (!isEmail(supportEmail)) problems.push('support email');
  if (!isEmail(privacyEmail)) problems.push('privacy email');
  if (operatorName.startsWith('OWNER_REQUIRED:')) problems.push('operator name');
  if (operatorAddress.startsWith('OWNER_REQUIRED:')) problems.push('operator address');
  if (!/^(?:\d{10}|\d{12})$/.test(operatorInn)) problems.push('operator INN');
  if (!/^\d{15}$/.test(operatorOgrnip)) problems.push('operator OGRNIP');
  if (!isIsoDate(publicationDate)) problems.push('legal publication date');
  if (!isHttpsUrl(baseUrl)) problems.push('public HTTPS base URL');
  if (russianHostingProvider.startsWith('OWNER_REQUIRED:')) problems.push('Russian hosting provider');
  if (russianDataLocation.startsWith('OWNER_REQUIRED:')) problems.push('Russian data location');
  if (websiteHostingProvider.startsWith('OWNER_REQUIRED:')) problems.push('website hosting provider');
  if (transactionalEmailProvider.startsWith('OWNER_REQUIRED:')) problems.push('transactional email provider');
  if (transactionalEmailCountry.startsWith('OWNER_REQUIRED:')) problems.push('transactional email country');
  if (supportMailProvider.startsWith('OWNER_REQUIRED:')) problems.push('support mail provider');
  if (supportMailCountry.startsWith('OWNER_REQUIRED:')) problems.push('support mail country');
  if (geocodingProvider.startsWith('OWNER_REQUIRED:')) problems.push('geocoding provider');
  if (geocodingCountry.startsWith('OWNER_REQUIRED:')) problems.push('geocoding country');
  if (!/^\d{1,3}$/.test(applicationLogRetentionDays)) problems.push('application log retention');
  if (!/^\d{1,3}$/.test(backupRetentionDays)) problems.push('backup retention');
  if (!/^\d{1,3}$/.test(supportRetentionMonths)) problems.push('support retention');
  if (!/^(?:[6-9]|1[0-8])$/.test(minimumAge)) problems.push('minimum age');
  if (!PUBLIC_SITE_CONFIG.dataLocalizationConfirmed) problems.push('data localisation confirmation');
  if (!PUBLIC_SITE_CONFIG.crossBorderNotificationsConfirmed) problems.push('cross-border notices confirmation');

  return problems;
}

export function isPublicLegalReady(): boolean {
  return getPublicLegalProblems().length === 0;
}

export function isRuStorePublished(): boolean {
  return isHttpsUrl(rustoreUrl);
}

export function formatPublicationDate(language: 'ru' | 'en' = 'ru'): string {
  if (!isIsoDate(publicationDate)) return publicationDate;
  return new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${publicationDate}T00:00:00Z`));
}

export function mailto(value: string, subject?: string): string | undefined {
  if (!isEmail(value)) return undefined;
  return `mailto:${value}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`;
}
