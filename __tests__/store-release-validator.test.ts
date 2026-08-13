import { spawnSync } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import path from 'node:path';

const releasePrivateKey = generateKeyPairSync('rsa', { modulusLength: 2048 })
  .privateKey.export({ format: 'der', type: 'pkcs8' })
  .toString('base64');

const validReleaseEnv = (): NodeJS.ProcessEnv => ({
  ...process.env,
  NEXT_PUBLIC_DISTRIBUTION_CHANNEL: 'rustore',
  NEXT_PUBLIC_RUSTORE_PAYMENTS_ENABLED: '1',
  NEXT_PUBLIC_API_URL: 'https://api.example.ru',
  APP_VERSION_CODE: '1',
  APP_VERSION_NAME: '1.0.0',
  NEXT_PUBLIC_DEVELOPER_NAME: 'Developer',
  NEXT_PUBLIC_SUPPORT_EMAIL: 'support@example.ru',
  NEXT_PUBLIC_PUBLIC_BASE_URL: 'https://example.ru',
  NEXT_PUBLIC_PRIVACY_POLICY_URL: 'https://example.ru/privacy',
  NEXT_PUBLIC_TERMS_URL: 'https://example.ru/terms',
  NEXT_PUBLIC_ACCOUNT_DELETION_URL: 'https://example.ru/delete-account',
  NEXT_PUBLIC_LEGAL_PUBLICATION_DATE: '2026-08-13',
  RELEASE_STORE_FILE: 'release.jks',
  RELEASE_STORE_PASSWORD: 'release-store-password',
  RELEASE_KEY_ALIAS: 'release',
  RELEASE_KEY_PASSWORD: 'release-key-password',
  PUBLIC_APP_ORIGIN: 'https://example.ru',
  VK_AUTH_CLIENT_ID: 'vk-client',
  VK_ID_ANDROID_CLIENT_SECRET: 'vk-android-secret',
  VK_AUTH_CLIENT_SECRET: 'vk-server-secret',
  YANDEX_AUTH_CLIENT_ID: 'yandex-client',
  YANDEX_AUTH_CLIENT_SECRET: 'yandex-secret',
  GOOGLE_AUTH_CLIENT_ID: 'google-client',
  GOOGLE_AUTH_CLIENT_SECRET: 'google-secret',
  EMAIL_OTP_DELIVERY_URL: 'https://api.example.ru/email',
  EMAIL_OTP_DELIVERY_SECRET: 'email-delivery-secret',
  EMAIL_OTP_HASH_SECRET: 'h'.repeat(32),
  AUTH_RATE_LIMIT_SECRET: 'r'.repeat(32),
  RUSTORE_CONSOLE_APP_ID: '123456',
  RUSTORE_PACKAGE_NAME: 'ru.tvoygoroskop.app',
  NEXT_PUBLIC_RUSTORE_PRODUCT_PREMIUM_MONTH: 'premium.month',
  NEXT_PUBLIC_RUSTORE_PRODUCT_PREMIUM_QUARTER: 'premium.quarter',
  NEXT_PUBLIC_RUSTORE_PRODUCT_PREMIUM_YEAR: 'premium.year',
  RUSTORE_ALLOWED_PRODUCT_IDS: 'premium.month,premium.quarter,premium.year',
  RUSTORE_KEY_ID: '1234567',
  RUSTORE_PRIVATE_KEY_BASE64: releasePrivateKey,
  RUSTORE_NOTIFICATION_AES_KEY: Buffer.alloc(32, 7).toString('base64'),
  RUSTORE_PAY_MODE: 'production',
});

function validate(env: NodeJS.ProcessEnv) {
  return spawnSync(process.execPath, [path.join('scripts', 'validate-store-release.mjs'), '--release'], {
    cwd: process.cwd(),
    env,
    encoding: 'utf8',
  });
}

describe('store release validator', () => {
  it('accepts a production RuStore release with exact catalog IDs and an AES-256 key', () => {
    const result = validate(validReleaseEnv());
    expect(result.status).toBe(0);
  });

  it('rejects sandbox mode for a release build', () => {
    const result = validate({ ...validReleaseEnv(), RUSTORE_PAY_MODE: 'sandbox' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('RUSTORE_PAY_MODE must be production for a release');
  });

  it('rejects a RuStore subscription release with Pay disabled', () => {
    const result = validate({
      ...validReleaseEnv(),
      NEXT_PUBLIC_RUSTORE_PAYMENTS_ENABLED: '0',
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('NEXT_PUBLIC_RUSTORE_PAYMENTS_ENABLED must be enabled');
  });

  it('requires the server allowlist to exactly equal the three client catalog IDs', () => {
    const result = validate({
      ...validReleaseEnv(),
      RUSTORE_ALLOWED_PRODUCT_IDS: 'premium.month,premium.quarter,unexpected.product',
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('RUSTORE_ALLOWED_PRODUCT_IDS must exactly match');
  });

  it('requires a valid 32-byte base64 callback key', () => {
    const result = validate({
      ...validReleaseEnv(),
      RUSTORE_NOTIFICATION_AES_KEY: Buffer.alloc(16, 7).toString('base64'),
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('RUSTORE_NOTIFICATION_AES_KEY must be a base64-encoded 32-byte AES-256 key');
  });

  it('requires a valid PKCS#8 RSA key for short-lived API token renewal', () => {
    const result = validate({
      ...validReleaseEnv(),
      RUSTORE_PRIVATE_KEY_BASE64: Buffer.alloc(700, 7).toString('base64'),
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('RUSTORE_PRIVATE_KEY_BASE64 must be a base64-encoded PKCS#8 RSA private key');
  });
});
