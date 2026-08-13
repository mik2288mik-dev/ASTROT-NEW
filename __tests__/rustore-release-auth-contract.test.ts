import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

jest.mock('../lib/db', () => ({ db: {}, getPool: jest.fn() }));

import { getAccountAuthCapabilities } from '../pages/api/auth/capabilities';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\r\n/g, '\n');

function releaseEnvironment(channel: 'rustore' | 'google_play'): NodeJS.ProcessEnv {
  return {
    ...process.env,
    NODE_ENV: 'production',
    NEXT_PUBLIC_DISTRIBUTION_CHANNEL: channel,
    NEXT_PUBLIC_API_URL: 'https://api.example.test',
    NEXT_PUBLIC_RUSTORE_PAYMENTS_ENABLED: '0',
    APP_VERSION_CODE: '1',
    APP_VERSION_NAME: '1.0.0',
    NEXT_PUBLIC_DEVELOPER_NAME: 'Test Developer',
    NEXT_PUBLIC_SUPPORT_EMAIL: 'support@example.test',
    NEXT_PUBLIC_PUBLIC_BASE_URL: 'https://example.test',
    NEXT_PUBLIC_PRIVACY_POLICY_URL: 'https://example.test/privacy',
    NEXT_PUBLIC_TERMS_URL: 'https://example.test/terms',
    NEXT_PUBLIC_ACCOUNT_DELETION_URL: 'https://example.test/delete-account',
    NEXT_PUBLIC_LEGAL_PUBLICATION_DATE: '2026-08-13',
    RELEASE_STORE_FILE: 'test-release.keystore',
    RELEASE_STORE_PASSWORD: 'test-store-password',
    RELEASE_KEY_ALIAS: 'test-key',
    RELEASE_KEY_PASSWORD: 'test-key-password',
    PUBLIC_APP_ORIGIN: 'https://example.test',
    VK_AUTH_CLIENT_ID: '12345678',
    VK_ID_ANDROID_CLIENT_SECRET: 'vk-android-client-secret',
    VK_AUTH_CLIENT_SECRET: 'vk-server-client-secret',
    YANDEX_AUTH_CLIENT_ID: 'yandex-client-id',
    YANDEX_AUTH_CLIENT_SECRET: 'yandex-client-secret',
    EMAIL_OTP_DELIVERY_URL: 'https://mailer.example.test/auth-code',
    EMAIL_OTP_DELIVERY_SECRET: 'email-delivery-secret',
    EMAIL_OTP_HASH_SECRET: 'email-code-secret-that-is-at-least-32-bytes',
    AUTH_RATE_LIMIT_SECRET: 'rate-limit-secret-that-is-at-least-32-bytes',
    APP_SESSION_SECRET: 'app-session-secret-that-is-at-least-32-bytes',
  };
}

function validateRelease(env: NodeJS.ProcessEnv) {
  return spawnSync(process.execPath, ['scripts/validate-store-release.mjs', '--release'], {
    cwd: ROOT,
    env,
    encoding: 'utf8',
  });
}

describe('RuStore account-auth release contract', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('does not require Google release credentials for a RuStore release', () => {
    const env = releaseEnvironment('rustore');
    delete env.GOOGLE_AUTH_CLIENT_ID;
    delete env.GOOGLE_AUTH_CLIENT_SECRET;

    const result = validateRelease(env);
    expect(`${result.stdout}\n${result.stderr}`).not.toContain('GOOGLE_AUTH_CLIENT_ID is required');
    expect(`${result.stdout}\n${result.stderr}`).not.toContain('GOOGLE_AUTH_CLIENT_SECRET is required');
    expect(result.status).toBe(0);
  });

  it('keeps Google credentials mandatory for the future Google Play release branch', () => {
    const env = releaseEnvironment('google_play');
    delete env.GOOGLE_AUTH_CLIENT_ID;
    delete env.GOOGLE_AUTH_CLIENT_SECRET;

    const result = validateRelease(env);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('GOOGLE_AUTH_CLIENT_ID is required');
    expect(result.stderr).toContain('GOOGLE_AUTH_CLIENT_SECRET is required');
  });

  it('rejects a release when OTP HMAC and rate-limit secrets are the same value', () => {
    const env = releaseEnvironment('rustore');
    env.GOOGLE_AUTH_CLIENT_ID = 'google-web-client.apps.googleusercontent.com';
    env.GOOGLE_AUTH_CLIENT_SECRET = 'google-server-secret';
    env.AUTH_RATE_LIMIT_SECRET = env.EMAIL_OTP_HASH_SECRET;

    const result = validateRelease(env);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('AUTH_RATE_LIMIT_SECRET must be independent from EMAIL_OTP_HASH_SECRET');
  });

  it('requires an independent production app-session signing secret', () => {
    const missing = releaseEnvironment('rustore');
    delete missing.APP_SESSION_SECRET;
    const missingResult = validateRelease(missing);
    expect(missingResult.status).toBe(1);
    expect(missingResult.stderr).toContain('APP_SESSION_SECRET is required');

    const placeholder = releaseEnvironment('rustore');
    placeholder.APP_SESSION_SECRET = 'replace-with-a-long-random-secret';
    const placeholderResult = validateRelease(placeholder);
    expect(placeholderResult.status).toBe(1);
    expect(placeholderResult.stderr).toContain('APP_SESSION_SECRET is required');

    const reused = releaseEnvironment('rustore');
    reused.AUTH_RATE_LIMIT_SECRET = reused.APP_SESSION_SECRET;
    const reusedResult = validateRelease(reused);
    expect(reusedResult.status).toBe(1);
    expect(reusedResult.stderr).toContain('AUTH_RATE_LIMIT_SECRET must be independent from APP_SESSION_SECRET');

    const reusedForEmailCodes = releaseEnvironment('rustore');
    reusedForEmailCodes.EMAIL_OTP_HASH_SECRET = reusedForEmailCodes.APP_SESSION_SECRET;
    const reusedForEmailCodesResult = validateRelease(reusedForEmailCodes);
    expect(reusedForEmailCodesResult.status).toBe(1);
    expect(reusedForEmailCodesResult.stderr).toContain('EMAIL_OTP_HASH_SECRET must be independent from APP_SESSION_SECRET');
  });

  it('reports Google unavailable to RuStore clients even when Google credentials exist', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    process.env.NEXT_PUBLIC_DISTRIBUTION_CHANNEL = 'rustore';
    process.env.GOOGLE_AUTH_CLIENT_ID = 'google-web-client.apps.googleusercontent.com';
    process.env.GOOGLE_AUTH_CLIENT_SECRET = 'google-server-secret';
    process.env.APP_SESSION_SECRET = 'app-session-secret-that-is-at-least-32-bytes';
    process.env.AUTH_RATE_LIMIT_SECRET = 'rate-limit-secret-that-is-at-least-32-bytes';
    process.env.EMAIL_OTP_HASH_SECRET = 'email-code-secret-that-is-at-least-32-bytes';
    process.env.EMAIL_OTP_DELIVERY_URL = 'https://mailer.example.test/auth-code';
    process.env.EMAIL_OTP_DELIVERY_SECRET = 'email-delivery-secret';

    expect(getAccountAuthCapabilities('native')).toMatchObject({ google: false });

    process.env.NEXT_PUBLIC_DISTRIBUTION_CHANNEL = 'google_play';
    expect(getAccountAuthCapabilities('native')).toMatchObject({ google: true });
  });

  it('fails closed for Google when a production distribution channel is missing', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    delete process.env.NEXT_PUBLIC_DISTRIBUTION_CHANNEL;
    process.env.GOOGLE_AUTH_CLIENT_ID = 'google-web-client.apps.googleusercontent.com';
    process.env.GOOGLE_AUTH_CLIENT_SECRET = 'google-server-secret';

    expect(() => getAccountAuthCapabilities('native')).toThrow('Unsupported distribution channel');
  });

  it('enforces the Google channel boundary in server start and completion code', () => {
    const native = read('lib/auth/nativeProviderAuth.ts');
    const oauth = read('lib/auth/accountIdentity.ts');
    const capabilities = read('pages/api/auth/capabilities.ts');

    expect(native.match(/canUseAccountAuthProvider\(input\.provider, resolveDistributionChannel\(\)\)/g))
      .toHaveLength(2);
    expect(oauth.match(/canUseAccountAuthProvider\(input\.provider, resolveDistributionChannel\(\)\)/g))
      .toHaveLength(3);
    expect(capabilities).toContain('const channel = resolveDistributionChannel()');
    expect(capabilities).not.toContain('resolveDistributionChannel(requestedChannel)');
  });

  it('does not render unavailable providers as disabled AuthGate buttons', () => {
    const authGate = read('views/AuthGate.tsx');
    const providerList = authGate.slice(
      authGate.indexOf('{PROVIDERS'),
      authGate.indexOf('</button>', authGate.indexOf('{PROVIDERS')),
    );

    expect(providerList).toContain('.filter(');
    expect(providerList).toContain('capabilities?.[provider.id] === true');
    expect(providerList.indexOf('.filter(')).toBeLessThan(providerList.indexOf('.map('));
  });

  it('keeps Google native code and dependencies out of the RuStore variant', () => {
    const gradle = read('android/app/build.gradle');
    const plugin = read('android/app/src/main/java/ru/tvoygoroskop/app/auth/NativeIdentityAuthPlugin.java');
    const googleHandler = read('android/app/src/googleAuth/java/ru/tvoygoroskop/app/auth/GoogleIdentityAuthHandler.java');
    const googleCase = plugin.slice(plugin.indexOf('case "google"'), plugin.indexOf('case "yandex"'));

    expect(gradle).toContain("googlePlayImplementation 'androidx.credentials:credentials:1.6.0'");
    expect(gradle).toContain("googlePlayImplementation 'androidx.credentials:credentials-play-services-auth:1.6.0'");
    expect(gradle).toContain("googlePlayImplementation 'com.google.android.libraries.identity.googleid:googleid:1.2.0'");
    expect(gradle).not.toMatch(/^\s*implementation\s+'(?:androidx\.credentials|com\.google\.android\.libraries\.identity\.googleid)/m);
    expect(googleCase).toContain('BuildConfig.DISTRIBUTION_CHANNEL');
    expect(googleCase).toContain('google_play');
    expect(plugin).not.toContain('com.google.android.libraries.identity.googleid');
    expect(googleHandler).toContain('com.google.android.libraries.identity.googleid');
  });

  it('preserves the intentional provider=google database compatibility', () => {
    const migrations = read('lib/migrations.ts');
    expect(migrations).toContain("CHECK (provider IN ('vk', 'yandex', 'google', 'email', 'telegram'))");
  });
});
