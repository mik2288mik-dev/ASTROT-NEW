#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const channel = String(process.env.NEXT_PUBLIC_DISTRIBUTION_CHANNEL || 'development').trim();
const allowedChannels = new Set(['telegram', 'rustore', 'google_play', 'development']);
const errors = [];
const release = process.argv.includes('--release');
const rustorePaymentsEnabled = ['1', 'true', 'yes', 'on'].includes(
  String(process.env.NEXT_PUBLIC_RUSTORE_PAYMENTS_ENABLED || '').trim().toLowerCase(),
);

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function requireValue(name, value) {
  const normalized = String(value || '').trim();
  if (
    !normalized
    || normalized.includes('_REQUIRED')
    || normalized.includes('[УКАЖИТЕ')
    || /^replace-with/i.test(normalized)
    || /^your[_-]/i.test(normalized)
  ) {
    errors.push(`${name} is required`);
  }
}

if (!allowedChannels.has(channel)) errors.push('NEXT_PUBLIC_DISTRIBUTION_CHANNEL must be telegram, rustore, google_play, or development');

const apiUrl = String(process.env.NEXT_PUBLIC_API_URL || '').trim();
if (release) {
  requireValue('NEXT_PUBLIC_API_URL', apiUrl);
  if (apiUrl && !/^https:\/\//.test(apiUrl)) errors.push('NEXT_PUBLIC_API_URL must use HTTPS');
  if (/railway/i.test(apiUrl)) errors.push('NEXT_PUBLIC_API_URL must use the stable public API domain, not a Railway URL');
}

const appBuild = read('android/app/build.gradle');
const capacitor = read('capacitor.config.ts');
const strings = read('android/app/src/main/res/values/strings.xml');
const packageVariable = (appBuild.match(/def\s+appPackageId\s*=\s*["']([^"']+)["']/) || [])[1] || '';
const applicationId = (appBuild.match(/applicationId\s+["']([^"']+)["']/) || [])[1]
  || (appBuild.includes('applicationId appPackageId') ? packageVariable : '');
const namespace = (appBuild.match(/namespace\s*=\s*["']([^"']+)["']/) || [])[1]
  || (appBuild.includes('namespace = appPackageId') ? packageVariable : '');
const capacitorId = (capacitor.match(/appId:\s*'([^']+)'/) || [])[1] || '';
const resourceId = (strings.match(/<string name="package_name">([^<]+)<\/string>/) || [])[1] || '';
const scheme = (strings.match(/<string name="custom_url_scheme">([^<]+)<\/string>/) || [])[1] || '';
if (!applicationId || new Set([applicationId, namespace, capacitorId, resourceId, scheme]).size !== 1) {
  errors.push('package/application ID differs between Gradle, Capacitor, strings.xml, or URL scheme');
}
if (release && /yourhoroscope\.app|example|placeholder/i.test(applicationId)) {
  errors.push('A final non-temporary application ID is required before the first store upload');
}

const versionCode = String(process.env.APP_VERSION_CODE || '').trim();
const versionName = String(process.env.APP_VERSION_NAME || '').trim();
if (release && (!/^\d+$/.test(versionCode) || Number(versionCode) < 1)) errors.push('APP_VERSION_CODE must be a positive integer');
if (release && !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(versionName)) errors.push('APP_VERSION_NAME must be a semantic version such as 1.0.0');

if (release) {
  for (const name of [
    'NEXT_PUBLIC_DEVELOPER_NAME',
    'NEXT_PUBLIC_SUPPORT_EMAIL',
    'NEXT_PUBLIC_PUBLIC_BASE_URL',
    'NEXT_PUBLIC_PRIVACY_POLICY_URL',
    'NEXT_PUBLIC_TERMS_URL',
    'NEXT_PUBLIC_ACCOUNT_DELETION_URL',
    'NEXT_PUBLIC_LEGAL_PUBLICATION_DATE',
  ]) requireValue(name, process.env[name]);
  for (const name of ['NEXT_PUBLIC_PRIVACY_POLICY_URL', 'NEXT_PUBLIC_TERMS_URL', 'NEXT_PUBLIC_ACCOUNT_DELETION_URL']) {
    const value = String(process.env[name] || '');
    if (value && !/^https:\/\//.test(value)) errors.push(`${name} must be an absolute HTTPS URL`);
  }
  for (const name of ['RELEASE_STORE_FILE', 'RELEASE_STORE_PASSWORD', 'RELEASE_KEY_ALIAS', 'RELEASE_KEY_PASSWORD']) {
    requireValue(name, process.env[name]);
  }
  const authProviderNames = [
    'PUBLIC_APP_ORIGIN',
    'VK_AUTH_CLIENT_ID',
    'VK_ID_ANDROID_CLIENT_SECRET',
    'VK_AUTH_CLIENT_SECRET',
    'YANDEX_AUTH_CLIENT_ID',
    'YANDEX_AUTH_CLIENT_SECRET',
    'EMAIL_OTP_DELIVERY_URL',
    'EMAIL_OTP_DELIVERY_SECRET',
    'EMAIL_OTP_HASH_SECRET',
    'AUTH_RATE_LIMIT_SECRET',
    'APP_SESSION_SECRET',
  ];
  if (channel === 'google_play') {
    authProviderNames.push('GOOGLE_AUTH_CLIENT_ID', 'GOOGLE_AUTH_CLIENT_SECRET');
  }
  for (const name of authProviderNames) requireValue(name, process.env[name]);
  for (const name of ['EMAIL_OTP_HASH_SECRET', 'AUTH_RATE_LIMIT_SECRET', 'APP_SESSION_SECRET']) {
    const value = String(process.env[name] || '').trim();
    if (value && !value.includes('_REQUIRED') && Buffer.byteLength(value, 'utf8') < 32) {
      errors.push(`${name} must contain at least 32 bytes`);
    }
  }
  const rateLimitSecret = String(process.env.AUTH_RATE_LIMIT_SECRET || '').trim();
  const emailHashSecret = String(process.env.EMAIL_OTP_HASH_SECRET || '').trim();
  const appSessionSecret = String(process.env.APP_SESSION_SECRET || '').trim();
  if (rateLimitSecret && rateLimitSecret === emailHashSecret) {
    errors.push('AUTH_RATE_LIMIT_SECRET must be independent from EMAIL_OTP_HASH_SECRET');
  }
  if (rateLimitSecret && appSessionSecret && rateLimitSecret === appSessionSecret) {
    errors.push('AUTH_RATE_LIMIT_SECRET must be independent from APP_SESSION_SECRET');
  }
  if (emailHashSecret && appSessionSecret && emailHashSecret === appSessionSecret) {
    errors.push('EMAIL_OTP_HASH_SECRET must be independent from APP_SESSION_SECRET');
  }
  if (process.env.PUBLIC_APP_ORIGIN && !/^https:\/\//.test(process.env.PUBLIC_APP_ORIGIN)) {
    errors.push('PUBLIC_APP_ORIGIN must use HTTPS');
  }
  if (process.env.EMAIL_OTP_DELIVERY_URL && !/^https:\/\//.test(process.env.EMAIL_OTP_DELIVERY_URL)) {
    errors.push('EMAIL_OTP_DELIVERY_URL must use HTTPS');
  }
}

if (channel === 'rustore' && rustorePaymentsEnabled) {
  for (const name of [
    'RUSTORE_CONSOLE_APP_ID',
    'RUSTORE_PACKAGE_NAME',
    'RUSTORE_ALLOWED_PRODUCT_IDS',
    'NEXT_PUBLIC_RUSTORE_PRODUCT_PREMIUM_MONTH',
    'NEXT_PUBLIC_RUSTORE_PRODUCT_PREMIUM_QUARTER',
    'NEXT_PUBLIC_RUSTORE_PRODUCT_PREMIUM_YEAR',
  ]) requireValue(name, process.env[name]);
  if (process.env.RUSTORE_PACKAGE_NAME && process.env.RUSTORE_PACKAGE_NAME !== applicationId) {
    errors.push('RUSTORE_PACKAGE_NAME must match applicationId');
  }
  if (release) {
    requireValue('RUSTORE_PUBLIC_API_TOKEN', process.env.RUSTORE_PUBLIC_API_TOKEN);
    requireValue('RUSTORE_NOTIFICATION_AES_KEY', process.env.RUSTORE_NOTIFICATION_AES_KEY);
  }
}

if (channel !== 'rustore' && rustorePaymentsEnabled) {
  errors.push('NEXT_PUBLIC_RUSTORE_PAYMENTS_ENABLED may only be enabled for the rustore channel');
}

if (errors.length) {
  console.error('Store release configuration is incomplete:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`Store release configuration is valid for ${channel}${release ? ' release' : ''}.`);
