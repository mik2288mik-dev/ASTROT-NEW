#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import net from 'node:net';

const root = process.cwd();
const channel = String(process.env.NEXT_PUBLIC_DISTRIBUTION_CHANNEL || 'development').trim();
const allowedChannels = new Set(['telegram', 'rustore', 'google_play', 'development']);
const errors = [];
const release = process.argv.includes('--release');
const rustorePaymentsEnabled = ['1', 'true', 'yes', 'on'].includes(
  String(process.env.NEXT_PUBLIC_RUSTORE_PAYMENTS_ENABLED || '').trim().toLowerCase(),
);

function enabled(name) {
  return ['1', 'true', 'yes', 'on'].includes(
    String(process.env[name] || '').trim().toLowerCase(),
  );
}

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

function csvValues(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function isBase64Aes256Key(value) {
  const encoded = String(value || '').trim();
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) return false;
  const decoded = Buffer.from(encoded, 'base64');
  return decoded.length === 32 && decoded.toString('base64') === encoded;
}

function isBase64Pkcs8PrivateKey(value) {
  const encoded = String(value || '').replace(/\s+/g, '');
  if (!encoded) return false;
  try {
    const decoded = Buffer.from(encoded, 'base64');
    if (decoded.toString('base64') !== encoded) return false;
    const key = crypto.createPrivateKey({ key: decoded, format: 'der', type: 'pkcs8' });
    return key.asymmetricKeyType === 'rsa';
  } catch {
    return false;
  }
}

function isPrivateIpv4(hostname) {
  const parts = hostname.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return false;
  const [first, second] = parts;
  return first === 0
    || first === 10
    || first === 127
    || (first === 100 && second >= 64 && second <= 127)
    || (first === 169 && second === 254)
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 168)
    || (first === 198 && (second === 18 || second === 19))
    || first >= 224;
}

function isNonPublicHostname(value) {
  const hostname = value.replace(/^\[|\]$/g, '').toLowerCase();
  const ipVersion = net.isIP(hostname);
  if (ipVersion === 4) return isPrivateIpv4(hostname);
  if (ipVersion === 6) {
    return hostname === '::'
      || hostname === '::1'
      || hostname.startsWith('fc')
      || hostname.startsWith('fd')
      || /^fe[89ab]/.test(hostname);
  }
  return !hostname.includes('.')
    || hostname.endsWith('.local')
    || hostname.endsWith('.internal');
}

function validatePublicApiOrigin(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    errors.push('NEXT_PUBLIC_API_URL must be a valid absolute URL');
    return;
  }
  const hostname = parsed.hostname.toLowerCase();
  if (parsed.protocol !== 'https:') errors.push('NEXT_PUBLIC_API_URL must use HTTPS');
  if (
    parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash
    || (parsed.pathname && parsed.pathname !== '/')
    || hostname === 'localhost'
    || isNonPublicHostname(hostname)
  ) {
    errors.push('NEXT_PUBLIC_API_URL must be a credential-free public HTTPS origin without a path, query, or fragment');
  }
  if (/railway/i.test(hostname)) {
    errors.push('NEXT_PUBLIC_API_URL must use the stable public API domain, not a Railway URL');
  }
}

if (!allowedChannels.has(channel)) errors.push('NEXT_PUBLIC_DISTRIBUTION_CHANNEL must be telegram, rustore, google_play, or development');

const apiUrl = String(process.env.NEXT_PUBLIC_API_URL || '').trim();
if (release) {
  requireValue('NEXT_PUBLIC_API_URL', apiUrl);
  if (apiUrl) validatePublicApiOrigin(apiUrl);
  for (const name of [
    'CAPACITOR_LIVE_RELOAD',
    'NEXT_PUBLIC_DEBUG_STORAGE_LOGS',
    'NEXT_PUBLIC_UI_PREVIEW',
    'ALLOW_TEST_PREMIUM_SIMULATION',
    'ADMIN_WEB_DEV_AUTH_ENABLED',
  ]) {
    if (enabled(name)) errors.push(`${name} must be disabled for a store release`);
  }
  if (String(process.env.CAPACITOR_LIVE_URL || '').trim()) {
    errors.push('CAPACITOR_LIVE_URL must not be configured for a store release');
  }
}

const appBuild = read('android/app/build.gradle');
const capacitor = read('capacitor.config.ts');
const strings = read('android/app/src/main/res/values/strings.xml');
if (/\bCapacitorHttp\s*:\s*\{[^}]*\benabled\s*:\s*true\b/s.test(capacitor)) {
  errors.push('CapacitorHttp.enabled must remain false: global native fetch can hang Android startup requests');
}
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
    'VK_ANDROID_CLIENT_ID',
    'VK_ID_ANDROID_CLIENT_SECRET',
    'VK_AUTH_CLIENT_SECRET',
    'YANDEX_AUTH_CLIENT_ID',
    'YANDEX_ANDROID_CLIENT_ID',
    'YANDEX_AUTH_CLIENT_SECRET',
    'EMAIL_OTP_HASH_SECRET',
    'AUTH_RATE_LIMIT_SECRET',
    'APP_SESSION_SECRET',
  ];
  if (channel === 'google_play') {
    authProviderNames.push('GOOGLE_AUTH_CLIENT_ID', 'GOOGLE_AUTH_CLIENT_SECRET');
  }
  for (const name of authProviderNames) requireValue(name, process.env[name]);
  const resendConfigured = !!String(process.env.RESEND_API_KEY || '').trim()
    && !!String(process.env.AUTH_EMAIL_FROM || '').trim();
  const webhookConfigured = !!String(process.env.EMAIL_OTP_DELIVERY_URL || '').trim()
    && !!String(process.env.EMAIL_OTP_DELIVERY_SECRET || '').trim();
  if (!resendConfigured && !webhookConfigured) {
    errors.push('Email delivery requires RESEND_API_KEY and AUTH_EMAIL_FROM or EMAIL_OTP_DELIVERY_URL and EMAIL_OTP_DELIVERY_SECRET');
  }
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
  const consoleAppId = String(process.env.RUSTORE_CONSOLE_APP_ID || '').trim();
  if (consoleAppId && !/^\d+$/.test(consoleAppId)) {
    errors.push('RUSTORE_CONSOLE_APP_ID must be the numeric application ID from the RuStore Console URL');
  }
  const payMode = String(process.env.RUSTORE_PAY_MODE || '').trim().toLowerCase();
  if (!['sandbox', 'production'].includes(payMode)) {
    errors.push('RUSTORE_PAY_MODE must be sandbox or production');
  }
  if (release) {
    requireValue('RUSTORE_KEY_ID', process.env.RUSTORE_KEY_ID);
    requireValue('RUSTORE_PRIVATE_KEY_BASE64', process.env.RUSTORE_PRIVATE_KEY_BASE64);
    requireValue('RUSTORE_NOTIFICATION_AES_KEY', process.env.RUSTORE_NOTIFICATION_AES_KEY);
    requireValue('CRON_SECRET', process.env.CRON_SECRET);
    const cronSecret = String(process.env.CRON_SECRET || '').trim();
    if (cronSecret && Buffer.byteLength(cronSecret, 'utf8') < 32) {
      errors.push('CRON_SECRET must contain at least 32 bytes for a release');
    }
    if (payMode !== 'production') {
      errors.push('RUSTORE_PAY_MODE must be production for a release');
    }

    const clientProductIds = [
      process.env.NEXT_PUBLIC_RUSTORE_PRODUCT_PREMIUM_MONTH,
      process.env.NEXT_PUBLIC_RUSTORE_PRODUCT_PREMIUM_QUARTER,
      process.env.NEXT_PUBLIC_RUSTORE_PRODUCT_PREMIUM_YEAR,
    ].map((value) => String(value || '').trim()).filter(Boolean);
    const allowedProductIds = csvValues(process.env.RUSTORE_ALLOWED_PRODUCT_IDS);
    const clientProductSet = new Set(clientProductIds);
    const allowedProductSet = new Set(allowedProductIds);
    const exactProductMatch = clientProductIds.length === 3
      && clientProductSet.size === 3
      && allowedProductIds.length === allowedProductSet.size
      && allowedProductSet.size === clientProductSet.size
      && [...clientProductSet].every((productId) => allowedProductSet.has(productId));
    if (!exactProductMatch) {
      errors.push('RUSTORE_ALLOWED_PRODUCT_IDS must exactly match the three NEXT_PUBLIC_RUSTORE_PRODUCT_PREMIUM_* IDs');
    }

    const callbackKey = String(process.env.RUSTORE_NOTIFICATION_AES_KEY || '').trim();
    if (callbackKey && !callbackKey.includes('_REQUIRED') && !isBase64Aes256Key(callbackKey)) {
      errors.push('RUSTORE_NOTIFICATION_AES_KEY must be a base64-encoded 32-byte AES-256 key');
    }
    const privateKey = String(process.env.RUSTORE_PRIVATE_KEY_BASE64 || '').replace(/\s+/g, '');
    if (privateKey && !privateKey.includes('_REQUIRED') && !isBase64Pkcs8PrivateKey(privateKey)) {
      errors.push('RUSTORE_PRIVATE_KEY_BASE64 must be a base64-encoded PKCS#8 RSA private key');
    }
  }
}

if (release && channel === 'rustore' && !rustorePaymentsEnabled) {
  errors.push('NEXT_PUBLIC_RUSTORE_PAYMENTS_ENABLED must be enabled for a RuStore release with subscriptions');
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
