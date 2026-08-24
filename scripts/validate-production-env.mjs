#!/usr/bin/env node
import crypto from 'node:crypto';
import net from 'node:net';

const errors = [];

function raw(name) {
  return String(process.env[name] || '').trim();
}

function configured(name) {
  const value = raw(name);
  if (
    !value
    || value.includes('_REQUIRED')
    || value.includes('[УКАЖИТЕ')
    || /^(?:replace-with|your[_-])/i.test(value)
  ) return '';
  return value;
}

function requireValue(name) {
  if (!configured(name)) errors.push(`${name} is required`);
}

function requireSecret(name) {
  const value = configured(name);
  if (!value) {
    errors.push(`${name} is required`);
    return '';
  }
  if (Buffer.byteLength(value, 'utf8') < 32) {
    errors.push(`${name} must contain at least 32 bytes`);
  }
  return value;
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

function parseUrl(name, protocols, { publicHttps = false } = {}) {
  const value = configured(name);
  if (!value) return null;
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    errors.push(`${name} must be a valid URL`);
    return null;
  }
  if (!protocols.includes(parsed.protocol)) {
    errors.push(`${name} must use ${protocols.join(' or ')}`);
  }
  if (publicHttps) {
    const hostname = parsed.hostname.toLowerCase();
    if (
      parsed.username
      || parsed.password
      || parsed.search
      || parsed.hash
      || (parsed.pathname && parsed.pathname !== '/')
      || hostname === 'localhost'
      || isNonPublicHostname(hostname)
    ) {
      errors.push(`${name} must be a credential-free public HTTPS origin without a path, query, or fragment`);
    }
  }
  return parsed;
}

function enabled(name) {
  return ['1', 'true', 'yes', 'on'].includes(raw(name).toLowerCase());
}

function csv(name) {
  return raw(name).split(',').map((item) => item.trim()).filter(Boolean);
}

function isBase64Aes256Key(value) {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) return false;
  const decoded = Buffer.from(value, 'base64');
  return decoded.length === 32 && decoded.toString('base64') === value;
}

function isBase64Pkcs8RsaPrivateKey(value) {
  const normalized = value.replace(/\s+/g, '');
  try {
    const decoded = Buffer.from(normalized, 'base64');
    if (!normalized || decoded.toString('base64') !== normalized) return false;
    const key = crypto.createPrivateKey({ key: decoded, format: 'der', type: 'pkcs8' });
    return key.asymmetricKeyType === 'rsa';
  } catch {
    return false;
  }
}

if (process.env.NODE_ENV !== 'production') {
  errors.push('NODE_ENV must be production');
}

requireValue('DATABASE_URL');
parseUrl('DATABASE_URL', ['postgres:', 'postgresql:']);
if (configured('DATABASE_PUBLIC_URL')) {
  parseUrl('DATABASE_PUBLIC_URL', ['postgres:', 'postgresql:']);
}
requireValue('PUBLIC_APP_ORIGIN');
parseUrl('PUBLIC_APP_ORIGIN', ['https:'], { publicHttps: true });
requireValue('OPENAI_API_KEY');
requireValue('DEEPSEEK_API_KEY');
if (configured('DEEPSEEK_BASE_URL')) parseUrl('DEEPSEEK_BASE_URL', ['https:']);

for (const name of ['YANDEX_AUTH_CLIENT_ID', 'YANDEX_AUTH_CLIENT_SECRET']) {
  requireValue(name);
}
const vkClientId = configured('VK_AUTH_CLIENT_ID');
const vkClientSecret = configured('VK_AUTH_CLIENT_SECRET');
if (vkClientId || vkClientSecret) {
  if (!vkClientId) errors.push('VK_AUTH_CLIENT_ID is required when VK authentication is configured');
  if (!vkClientSecret) errors.push('VK_AUTH_CLIENT_SECRET is required when VK authentication is configured');
}

const appSessionSecret = requireSecret('APP_SESSION_SECRET');
const rateLimitSecret = requireSecret('AUTH_RATE_LIMIT_SECRET');
const emailHashSecret = requireSecret('EMAIL_OTP_HASH_SECRET');
const authSecrets = [
  ['APP_SESSION_SECRET', appSessionSecret],
  ['AUTH_RATE_LIMIT_SECRET', rateLimitSecret],
  ['EMAIL_OTP_HASH_SECRET', emailHashSecret],
].filter(([, value]) => value);
for (let index = 0; index < authSecrets.length; index += 1) {
  for (let other = index + 1; other < authSecrets.length; other += 1) {
    if (authSecrets[index][1] === authSecrets[other][1]) {
      errors.push(`${authSecrets[index][0]} and ${authSecrets[other][0]} must be independent`);
    }
  }
}

const resendKey = configured('RESEND_API_KEY');
const resendFrom = configured('AUTH_EMAIL_FROM');
const emailWebhook = configured('EMAIL_OTP_DELIVERY_URL');
const emailWebhookSecret = configured('EMAIL_OTP_DELIVERY_SECRET');
if (resendKey || resendFrom) {
  if (!resendKey || !resendFrom) errors.push('RESEND_API_KEY and AUTH_EMAIL_FROM must be configured together');
} else if (emailWebhook || emailWebhookSecret) {
  if (!emailWebhook || !emailWebhookSecret) {
    errors.push('EMAIL_OTP_DELIVERY_URL and EMAIL_OTP_DELIVERY_SECRET must be configured together');
  }
  if (emailWebhook) parseUrl('EMAIL_OTP_DELIVERY_URL', ['https:']);
} else {
  errors.push('Email delivery requires Resend or the HTTPS delivery webhook');
}

const trustProxy = raw('AUTH_TRUST_PROXY') || '0';
if (!['0', '1'].includes(trustProxy)) errors.push('AUTH_TRUST_PROXY must be 0 or 1');
const disableInProcessCron = raw('DISABLE_INPROCESS_CRON') || '0';
if (!['0', '1'].includes(disableInProcessCron)) errors.push('DISABLE_INPROCESS_CRON must be 0 or 1');
if (disableInProcessCron === '1') requireSecret('CRON_SECRET');
if (
  disableInProcessCron !== '1'
  && configured('CRON_SECRET')
  && Buffer.byteLength(configured('CRON_SECRET'), 'utf8') < 32
) {
  console.warn('[production-env] Weak CRON_SECRET is disabled for external cron routes; in-process scheduler remains enabled.');
}

for (const origin of csv('NATIVE_APP_ORIGINS')) {
  let parsed;
  try {
    parsed = new URL(origin);
  } catch {
    errors.push(`NATIVE_APP_ORIGINS contains an invalid origin: ${origin}`);
    continue;
  }
  const normalized = `${parsed.protocol}//${parsed.host}`;
  if (
    normalized !== origin.replace(/\/+$/, '')
    || !parsed.host
    || !['https:', 'capacitor:'].includes(parsed.protocol)
    || parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash
    || (parsed.pathname && parsed.pathname !== '/')
  ) {
    errors.push(`NATIVE_APP_ORIGINS must contain origins only: ${origin}`);
  }
}

if (enabled('ALLOW_TEST_PREMIUM_SIMULATION')) {
  errors.push('ALLOW_TEST_PREMIUM_SIMULATION must be disabled in production');
}
if (enabled('ADMIN_WEB_DEV_AUTH_ENABLED')) {
  errors.push('ADMIN_WEB_DEV_AUTH_ENABLED must be disabled in production');
}
if (enabled('NEXT_PUBLIC_DEBUG_STORAGE_LOGS')) {
  errors.push('NEXT_PUBLIC_DEBUG_STORAGE_LOGS must be disabled in production');
}
if (enabled('NEXT_PUBLIC_UI_PREVIEW')) {
  errors.push('NEXT_PUBLIC_UI_PREVIEW must be disabled in production');
}
if (raw('PERSONAL_FORECAST_TRACE') === 'full_eval') {
  errors.push('PERSONAL_FORECAST_TRACE=full_eval is not allowed in production');
}

const forbiddenPublicSecrets = [
  'NEXT_PUBLIC_DATABASE_URL',
  'NEXT_PUBLIC_DATABASE_PUBLIC_URL',
  'NEXT_PUBLIC_APP_SESSION_SECRET',
  'NEXT_PUBLIC_AUTH_RATE_LIMIT_SECRET',
  'NEXT_PUBLIC_EMAIL_OTP_HASH_SECRET',
  'NEXT_PUBLIC_RESEND_API_KEY',
  'NEXT_PUBLIC_EMAIL_OTP_DELIVERY_SECRET',
  'NEXT_PUBLIC_VK_AUTH_CLIENT_SECRET',
  'NEXT_PUBLIC_YANDEX_AUTH_CLIENT_SECRET',
  'NEXT_PUBLIC_GOOGLE_AUTH_CLIENT_SECRET',
  'NEXT_PUBLIC_RUSTORE_PRIVATE_KEY_BASE64',
  'NEXT_PUBLIC_RUSTORE_NOTIFICATION_AES_KEY',
  'NEXT_PUBLIC_BOT_TOKEN',
  'NEXT_PUBLIC_CRON_SECRET',
  'NEXT_PUBLIC_WEBHOOK_SECRET_TOKEN',
];
for (const name of forbiddenPublicSecrets) {
  if (raw(name)) errors.push(`${name} must not be configured; this value is server-only`);
}

const botToken = configured('BOT_TOKEN') || configured('TELEGRAM_BOT_TOKEN');
if (botToken) {
  if (!/^\d+:[A-Za-z0-9_-]{20,}$/.test(botToken)) {
    errors.push('BOT_TOKEN/TELEGRAM_BOT_TOKEN has an invalid Telegram bot token format');
  }
}
const telegramWebhookMode = raw('TELEGRAM_WEBHOOK_ENABLED') || '0';
if (!['0', '1'].includes(telegramWebhookMode)) {
  errors.push('TELEGRAM_WEBHOOK_ENABLED must be 0 or 1');
}
const telegramWebhookConfigured = telegramWebhookMode === '1' || !!configured('WEBHOOK_BASE_URL');
if (telegramWebhookConfigured) {
  if (!botToken) errors.push('BOT_TOKEN/TELEGRAM_BOT_TOKEN is required when Telegram webhook is enabled');
  const webhookSecret = requireSecret('WEBHOOK_SECRET_TOKEN');
  if (webhookSecret && !/^[A-Za-z0-9_-]{32,256}$/.test(webhookSecret)) {
    errors.push('WEBHOOK_SECRET_TOKEN must use 32-256 ASCII letters, digits, underscore, or hyphen');
  }
  requireValue('WEBHOOK_BASE_URL');
  parseUrl('WEBHOOK_BASE_URL', ['https:'], { publicHttps: true });
}
if (configured('WEBHOOK_SETUP_SECRET')) requireSecret('WEBHOOK_SETUP_SECRET');

if (enabled('NEXT_PUBLIC_RUSTORE_PAYMENTS_ENABLED')) {
  for (const name of [
    'RUSTORE_CONSOLE_APP_ID',
    'RUSTORE_PACKAGE_NAME',
    'RUSTORE_ALLOWED_PRODUCT_IDS',
    'RUSTORE_KEY_ID',
    'RUSTORE_PRIVATE_KEY_BASE64',
    'RUSTORE_NOTIFICATION_AES_KEY',
    'NEXT_PUBLIC_RUSTORE_PRODUCT_PREMIUM_MONTH',
    'NEXT_PUBLIC_RUSTORE_PRODUCT_PREMIUM_QUARTER',
    'NEXT_PUBLIC_RUSTORE_PRODUCT_PREMIUM_YEAR',
  ]) requireValue(name);
  if (configured('RUSTORE_PACKAGE_NAME') !== 'ru.tvoygoroskop.app') {
    errors.push('RUSTORE_PACKAGE_NAME must be ru.tvoygoroskop.app');
  }
  if (raw('RUSTORE_PAY_MODE').toLowerCase() !== 'production') {
    errors.push('RUSTORE_PAY_MODE must be production when RuStore payments are enabled');
  }
  const callbackKey = configured('RUSTORE_NOTIFICATION_AES_KEY');
  if (callbackKey && !isBase64Aes256Key(callbackKey)) {
    errors.push('RUSTORE_NOTIFICATION_AES_KEY must be a base64-encoded 32-byte AES-256 key');
  }
  const privateKey = configured('RUSTORE_PRIVATE_KEY_BASE64');
  if (privateKey && !isBase64Pkcs8RsaPrivateKey(privateKey)) {
    errors.push('RUSTORE_PRIVATE_KEY_BASE64 must be a base64-encoded PKCS#8 RSA private key');
  }
  const clientProducts = [
    configured('NEXT_PUBLIC_RUSTORE_PRODUCT_PREMIUM_MONTH'),
    configured('NEXT_PUBLIC_RUSTORE_PRODUCT_PREMIUM_QUARTER'),
    configured('NEXT_PUBLIC_RUSTORE_PRODUCT_PREMIUM_YEAR'),
  ].filter(Boolean);
  const allowedProducts = csv('RUSTORE_ALLOWED_PRODUCT_IDS');
  const clientSet = new Set(clientProducts);
  const allowedSet = new Set(allowedProducts);
  if (
    clientProducts.length !== 3
    || clientSet.size !== 3
    || allowedProducts.length !== allowedSet.size
    || allowedSet.size !== clientSet.size
    || [...clientSet].some((productId) => !allowedSet.has(productId))
  ) {
    errors.push('RUSTORE_ALLOWED_PRODUCT_IDS must exactly match the three public RuStore product IDs');
  }
}

if (errors.length) {
  console.error('[production-env] Configuration is not production-ready:');
  for (const error of [...new Set(errors)]) console.error(`- ${error}`);
  process.exit(1);
}

console.log('[production-env] Production environment contract is valid.');
