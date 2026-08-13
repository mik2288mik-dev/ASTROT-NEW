import fs from 'fs';
import path from 'path';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('account identity and session contract', () => {
  it('supports guest recovery through all required providers without client secrets', () => {
    const service = read('lib/auth/accountIdentity.ts');
    const env = read('.env.example');
    const settings = read('views/Settings.tsx');
    const gate = read('views/AuthGate.tsx');
    const capabilities = read('pages/api/auth/capabilities.ts');
    const releaseValidation = read('scripts/validate-store-release.mjs');
    expect(service).toContain("'vk', 'yandex', 'google', 'email', 'telegram'");
    expect(service).toContain('IDENTITY_ALREADY_LINKED');
    expect(service).toContain('accounts are never auto-merged');
    expect(settings).toContain('Восстановить существующий аккаунт');
    expect(env).toContain('GOOGLE_AUTH_CLIENT_SECRET=');
    expect(env).not.toContain('NEXT_PUBLIC_GOOGLE_AUTH_CLIENT_SECRET');
    expect(env).not.toContain('NEXT_PUBLIC_VK_AUTH_CLIENT_SECRET');
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
    expect(capabilities).toContain('getAccountAuthCapabilities(runtime, channel)');
    expect(capabilities).toContain("runtime === 'native'");
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

  it('does not attach notification attribution ids owned by another account', () => {
    const retention = read('services/notificationRetentionService.ts');
    const engine = read('services/notificationEngine.ts');
    expect(retention).toContain('SELECT id FROM scheduled_notifications WHERE id = $1 AND user_id = $2');
    expect(retention).toContain('SELECT id FROM notification_logs WHERE id = $1 AND user_id = $2');
    expect(engine).toContain('SELECT id FROM notification_logs WHERE id = $1 AND user_id = $2');
    expect(engine).toContain('ownedLogId');
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
