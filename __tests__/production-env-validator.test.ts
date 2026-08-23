import { spawnSync } from 'node:child_process';
import path from 'node:path';

function validProductionEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://app:password@postgres.railway.internal:5432/app',
    PUBLIC_APP_ORIGIN: 'https://tvoi-goroskop.ru',
    OPENAI_API_KEY: 'openai-server-key',
    DEEPSEEK_API_KEY: 'deepseek-server-key',
    DEEPSEEK_BASE_URL: 'https://api.deepseek.com',
    VK_AUTH_CLIENT_ID: 'vk-client-id',
    VK_AUTH_CLIENT_SECRET: 'vk-server-secret',
    YANDEX_AUTH_CLIENT_ID: 'yandex-client-id',
    YANDEX_AUTH_CLIENT_SECRET: 'yandex-server-secret',
    APP_SESSION_SECRET: 's'.repeat(32),
    AUTH_RATE_LIMIT_SECRET: 'r'.repeat(32),
    EMAIL_OTP_HASH_SECRET: 'e'.repeat(32),
    RESEND_API_KEY: 'resend-server-key',
    AUTH_EMAIL_FROM: 'MEOU <noreply@auth.tvoi-goroskop.ru>',
    AUTH_TRUST_PROXY: '0',
    DISABLE_INPROCESS_CRON: '0',
    ALLOW_TEST_PREMIUM_SIMULATION: '0',
    ADMIN_WEB_DEV_AUTH_ENABLED: '0',
    NEXT_PUBLIC_DEBUG_STORAGE_LOGS: '0',
    NEXT_PUBLIC_UI_PREVIEW: '0',
    NEXT_PUBLIC_RUSTORE_PAYMENTS_ENABLED: '0',
    NATIVE_APP_ORIGINS: 'https://localhost,capacitor://localhost',
  };
  for (const name of [
    'DATABASE_PUBLIC_URL',
    'EMAIL_OTP_DELIVERY_URL',
    'EMAIL_OTP_DELIVERY_SECRET',
    'BOT_TOKEN',
    'TELEGRAM_BOT_TOKEN',
    'CRON_SECRET',
    'NEXT_PUBLIC_APP_SESSION_SECRET',
    'NEXT_PUBLIC_DATABASE_URL',
  ]) delete env[name];
  return env;
}

function validate(env: NodeJS.ProcessEnv) {
  return spawnSync(process.execPath, [path.join('scripts', 'validate-production-env.mjs')], {
    cwd: process.cwd(),
    env,
    encoding: 'utf8',
  });
}

describe('production environment validator', () => {
  it('accepts the fail-closed RuStore backend baseline with payments disabled', () => {
    const result = validate(validProductionEnv());
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Production environment contract is valid');
  });

  it('requires independent long session, OTP and rate-limit secrets', () => {
    const env = validProductionEnv();
    env.AUTH_RATE_LIMIT_SECRET = env.APP_SESSION_SECRET;
    env.EMAIL_OTP_HASH_SECRET = 'short';
    const result = validate(env);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('EMAIL_OTP_HASH_SECRET must contain at least 32 bytes');
    expect(result.stderr).toContain('APP_SESSION_SECRET and AUTH_RATE_LIMIT_SECRET must be independent');
  });

  it('rejects production test/debug fallbacks and public copies of secrets', () => {
    const result = validate({
      ...validProductionEnv(),
      ALLOW_TEST_PREMIUM_SIMULATION: '1',
      ADMIN_WEB_DEV_AUTH_ENABLED: '1',
      NEXT_PUBLIC_APP_SESSION_SECRET: 'public-leak',
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('ALLOW_TEST_PREMIUM_SIMULATION must be disabled');
    expect(result.stderr).toContain('ADMIN_WEB_DEV_AUTH_ENABLED must be disabled');
    expect(result.stderr).toContain('NEXT_PUBLIC_APP_SESSION_SECRET must not be configured');
  });

  it('rejects an origin that is not reachable from a store application', () => {
    const result = validate({
      ...validProductionEnv(),
      PUBLIC_APP_ORIGIN: 'https://192.168.1.8',
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('PUBLIC_APP_ORIGIN must be a credential-free public HTTPS origin');
  });

  it('requires the full server credential set when RuStore payments are enabled', () => {
    const result = validate({
      ...validProductionEnv(),
      NEXT_PUBLIC_RUSTORE_PAYMENTS_ENABLED: '1',
      RUSTORE_PAY_MODE: 'sandbox',
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('RUSTORE_KEY_ID is required');
    expect(result.stderr).toContain('RUSTORE_PAY_MODE must be production');
  });
});
