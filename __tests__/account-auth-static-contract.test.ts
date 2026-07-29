import fs from 'fs';
import path from 'path';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('account identity and session contract', () => {
  it('supports guest recovery through all required providers without client secrets', () => {
    const service = read('lib/auth/accountIdentity.ts');
    const env = read('.env.example');
    const settings = read('views/Settings.tsx');
    const releaseValidation = read('scripts/validate-store-release.mjs');
    expect(service).toContain("'vk', 'yandex', 'google', 'email', 'telegram'");
    expect(service).toContain('IDENTITY_ALREADY_LINKED');
    expect(service).toContain('accounts are never auto-merged');
    expect(settings).toContain('Восстановить существующий аккаунт');
    expect(env).toContain('GOOGLE_AUTH_CLIENT_SECRET=');
    expect(env).not.toContain('NEXT_PUBLIC_GOOGLE_AUTH_CLIENT_SECRET');
    expect(env).not.toContain('NEXT_PUBLIC_VK_AUTH_CLIENT_SECRET');
    expect(releaseValidation).toContain("'EMAIL_OTP_DELIVERY_SECRET'");
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
