import fs from 'fs';
import path from 'path';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('account identity and session contract', () => {
  it('supports RuStore recovery providers without exposing client secrets', () => {
    const service = read('lib/auth/accountIdentity.ts');
    const env = read('.env.example');
    const settings = read('views/Settings.tsx');
    const gate = read('views/AuthGate.tsx');
    const capabilities = read('pages/api/auth/capabilities.ts');
    const releaseValidation = read('scripts/validate-store-release.mjs');
    // The identity table keeps the historical Google provider value for data compatibility,
    // while current RuStore sign-in capabilities and release config disable Google entirely.
    expect(service).toContain("'vk', 'yandex', 'google', 'email', 'telegram'");
    expect(service).toContain('IDENTITY_ALREADY_LINKED');
    expect(service).toContain('accounts are never auto-merged');
    expect(settings).toContain('Восстановить существующий аккаунт');
    expect(env).not.toContain('GOOGLE_AUTH_CLIENT_ID=');
    expect(env).not.toContain('GOOGLE_AUTH_CLIENT_SECRET=');
    expect(env).not.toContain('NEXT_PUBLIC_GOOGLE_AUTH_CLIENT_SECRET');
    expect(env).not.toContain('NEXT_PUBLIC_VK_AUTH_CLIENT_SECRET');
    expect(releaseValidation).not.toContain("'GOOGLE_AUTH_CLIENT_ID'");
    expect(releaseValidation).not.toContain("'GOOGLE_AUTH_CLIENT_SECRET'");
    expect(releaseValidation).toContain("'EMAIL_OTP_DELIVERY_SECRET'");
    expect(releaseValidation).toContain("'VK_ID_ANDROID_CLIENT_SECRET'");
    expect(releaseValidation).toContain("'EMAIL_OTP_HASH_SECRET'");
    expect(releaseValidation).toContain("'AUTH_RATE_LIMIT_SECRET'");
    expect(releaseValidation).toContain('must contain at least 32 bytes');
    expect(service).toContain("'https://id.vk.ru/authorize'");
    expect(service).toContain('VK_DEVICE_ID_REQUIRED');
    expect(service).toContain("device_id: deviceId!");
    expect(service).toContain("input.provider === 'vk' ? 's256' : 'S256'");
    expect(gate).toContain('getAccountAuthCapabilities');
    expect(gate).toContain('emailPassword');
    expect(gate).toContain('emailDelivery');
    expect(settings).toContain('getAccountAuthCapabilities');
    expect(capabilities).toContain('getAccountAuthCapabilities(runtime)');
    expect(capabilities).toContain("runtime === 'native'");
    expect(capabilities).toContain('google: false');
  });

  it('persists revocable server sessions and blocks guest RuStore purchases', () => {
    const migration = read('lib/migrations.ts');
    const auth = read('lib/auth/appAuth.ts');
    const validate = read('pages/api/payments/rustore/validate.ts');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS app_sessions');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS account_identities');
    expect(auth).toContain('assertAppSessionActive');
    expect(validate).toContain('RECOVERY_IDENTITY_REQUIRED');
  });

  it('queues RuStore callbacks before external validation with retry state', () => {
    const migration = read('lib/migrations.ts');
    const payments = read('lib/rustorePayments.ts');
    expect(migration).toContain('last_error');
    expect(migration).toContain('next_attempt_at');
    expect(migration).toContain('failed_at');
    expect(payments).toContain('FOR UPDATE SKIP LOCKED');
    expect(payments).toContain('retryDelaySeconds');
    const callbackStart = payments.indexOf('export async function processRuStoreCallback');
    const workerStart = payments.indexOf('export async function processPendingRuStoreEvents');
    expect(callbackStart).toBeGreaterThan(0);
    expect(workerStart).toBeGreaterThan(callbackStart);
    expect(payments.slice(callbackStart, workerStart)).not.toContain('validateRuStorePurchase({');
  });
});
