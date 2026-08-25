const DEFAULT_PUBLIC_BASE_URL = 'https://www.tvoi-goroskop.ru';
const ANDROID_PACKAGE_ID = 'ru.tvoygoroskop.app';

function clean(value: string | undefined): string {
  return String(value || '').trim();
}

function publicValue(value: string | undefined, fallback: string): string {
  const configuredValue = clean(value);
  const obsoleteMarker = ['OWNER', 'REQUIRED'].join('_');
  if (!configuredValue || configuredValue.startsWith(`${obsoleteMarker}:`)) return fallback;
  return configuredValue;
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
const operatorName = publicValue(
  process.env.NEXT_PUBLIC_DEVELOPER_NAME,
  'Индивидуальный предприниматель Кобытев Михаил Сергеевич',
);
const operatorAddress = publicValue(
  process.env.NEXT_PUBLIC_OPERATOR_ADDRESS,
  'Московская область, г. Хотьково',
);
const operatorInn = publicValue(process.env.NEXT_PUBLIC_OPERATOR_INN, '504215768509');
const operatorOgrnip = publicValue(process.env.NEXT_PUBLIC_OPERATOR_OGRNIP, '326508100461369');
const publicationDate = publicValue(
  process.env.NEXT_PUBLIC_LEGAL_PUBLICATION_DATE,
  '2026-08-26',
);
const applicationHostingProvider = publicValue(
  process.env.NEXT_PUBLIC_APPLICATION_HOSTING_PROVIDER,
  'Railway Corp. (США)',
);
const applicationDataLocation = publicValue(
  process.env.NEXT_PUBLIC_APPLICATION_DATA_LOCATION,
  'инфраструктура Railway за пределами России',
);
const websiteHostingProvider = publicValue(
  process.env.NEXT_PUBLIC_WEBSITE_HOSTING_PROVIDER,
  'Railway Corp. (США), инфраструктура за пределами России',
);
const transactionalEmailProvider = publicValue(
  process.env.NEXT_PUBLIC_TRANSACTIONAL_EMAIL_PROVIDER,
  'Resend, Inc.',
);
const transactionalEmailCountry = publicValue(
  process.env.NEXT_PUBLIC_TRANSACTIONAL_EMAIL_COUNTRY,
  'США',
);
const supportMailProvider = publicValue(
  process.env.NEXT_PUBLIC_SUPPORT_MAIL_PROVIDER,
  'ООО «Яндекс», Яндекс Почта',
);
const supportMailCountry = publicValue(
  process.env.NEXT_PUBLIC_SUPPORT_MAIL_COUNTRY,
  'Россия',
);
const geocodingProvider = publicValue(
  process.env.NEXT_PUBLIC_GEOCODING_PROVIDER,
  'Open-Meteo и OpenStreetMap Nominatim',
);
const geocodingCountry = publicValue(
  process.env.NEXT_PUBLIC_GEOCODING_COUNTRY,
  'иностранная инфраструктура',
);
const applicationLogRetentionDays = publicValue(
  process.env.NEXT_PUBLIC_APP_LOG_RETENTION_DAYS,
  '30',
);
const backupRetentionDays = publicValue(
  process.env.NEXT_PUBLIC_BACKUP_RETENTION_DAYS,
  '30',
);
const supportRetentionMonths = publicValue(
  process.env.NEXT_PUBLIC_SUPPORT_RETENTION_MONTHS,
  '12',
);
const minimumAge = publicValue(process.env.NEXT_PUBLIC_MINIMUM_AGE, '18');
const rustoreUrl = clean(process.env.NEXT_PUBLIC_RUSTORE_URL);

export const PUBLIC_SITE_CONFIG = {
  appName: 'MEOU',
  baseUrl,
  operatorName,
  operatorAddress,
  operatorInn,
  operatorOgrnip,
  publicationDate,
  applicationHostingProvider,
  applicationDataLocation,
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
} as const;

export function getPublicLegalProblems(): string[] {
  const problems: string[] = [];

  if (!operatorName) problems.push('operator name');
  if (!operatorAddress) problems.push('operator address');
  if (!/^(?:\d{10}|\d{12})$/.test(operatorInn)) problems.push('operator INN');
  if (!/^\d{15}$/.test(operatorOgrnip)) problems.push('operator OGRNIP');
  if (!isIsoDate(publicationDate)) problems.push('legal publication date');
  if (!isHttpsUrl(baseUrl)) problems.push('public HTTPS base URL');
  if (!applicationHostingProvider) problems.push('application hosting provider');
  if (!applicationDataLocation) problems.push('application data location');
  if (!websiteHostingProvider) problems.push('website hosting provider');
  if (!transactionalEmailProvider) problems.push('transactional email provider');
  if (!transactionalEmailCountry) problems.push('transactional email country');
  if (!supportMailProvider) problems.push('support mail provider');
  if (!supportMailCountry) problems.push('support mail country');
  if (!geocodingProvider) problems.push('geocoding provider');
  if (!geocodingCountry) problems.push('geocoding country');
  if (!/^\d{1,3}$/.test(applicationLogRetentionDays)) problems.push('application log retention');
  if (!/^\d{1,3}$/.test(backupRetentionDays)) problems.push('backup retention');
  if (!/^\d{1,3}$/.test(supportRetentionMonths)) problems.push('support retention');
  if (!/^(?:[6-9]|1[0-8])$/.test(minimumAge)) problems.push('minimum age');
  return problems;
}

export function isPublicLegalReady(): boolean {
  return getPublicLegalProblems().length === 0;
}

export function isRuStorePublished(): boolean {
  if (!isHttpsUrl(rustoreUrl)) return false;

  try {
    const url = new URL(rustoreUrl);
    return (url.hostname === 'rustore.ru' || url.hostname === 'www.rustore.ru')
      && url.pathname === `/catalog/app/${ANDROID_PACKAGE_ID}`;
  } catch {
    return false;
  }
}

export function getRuStoreDownloadUrl(): string {
  if (!isRuStorePublished()) return '';

  const url = new URL(rustoreUrl);
  url.searchParams.set('utm_source', 'available_in_rustore');
  url.searchParams.set('utm_medium', ANDROID_PACKAGE_ID);
  url.searchParams.set('rsm', '1');
  url.searchParams.set('mt_link_id', 'iios36');
  url.searchParams.set('mt_sub1', ANDROID_PACKAGE_ID);
  return url.toString();
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
