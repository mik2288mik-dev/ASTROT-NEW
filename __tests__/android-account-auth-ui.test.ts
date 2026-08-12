import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('Android account authentication UI', () => {
  test('offers the RuStore sign-up and sign-in methods without Google', () => {
    const gate = read('views/AuthGate.tsx');

    expect(gate).toContain('Создать аккаунт');
    expect(gate).not.toContain('Продолжить с Google');
    expect(gate).toContain('Продолжить с Яндексом');
    expect(gate).toContain('Продолжить с VK ID');
    expect(gate).toContain('Повторите пароль');
    expect(gate).toContain('Уже есть аккаунт?');
    expect(gate).toContain('Забыли пароль?');
    expect(gate).toContain('Код из письма');
  });

  test('uses native provider credentials in Android and password server routes', () => {
    const service = read('services/accountAuthService.ts');
    const bridge = read('services/nativeIdentityAuthBridge.ts');

    expect(service).not.toContain("registerPlugin<NativeIdentityAuthBridge>('NativeIdentityAuth')");
    expect(bridge).toContain("registerPlugin<NativeIdentityAuthBridge>('NativeIdentityAuth')");
    expect(service).toContain('/api/auth/provider/${provider}/start');
    expect(service).toContain("'/api/auth/password/register'");
    expect(service).toContain("'/api/auth/password/register-verify'");
    expect(service).toContain("'/api/auth/password/login'");
    expect(service).toContain("'/api/auth/password/reset-request'");
    expect(service).toContain("'/api/auth/password/reset-complete'");
    expect(service).toContain('providerRequest');
    expect(bridge).toContain("export type NativeIdentityProvider = 'vk' | 'yandex'");
    expect(bridge).not.toContain("| 'google'");
  });

  test('does not make Telegram or guest access primary in the Android gate', () => {
    const gate = read('views/AuthGate.tsx');

    expect(gate).not.toContain('Продолжить как гость');
    expect(gate).not.toContain('Войти через Telegram');
  });

  test('fresh native automatic mode does not silently create a guest account', () => {
    const api = read('services/apiClient.ts');
    const app = read('App.tsx');

    expect(api).toContain("mode !== 'guest'");
    expect(api).not.toContain("mode !== 'automatic' && mode !== 'guest'");
    expect(app).toContain("!isNativeAppRuntime() && sessionMode === 'automatic'");
  });

  test('retries authentication capabilities after reconnect and by explicit user action', () => {
    const gate = read('views/AuthGate.tsx');
    const service = read('services/accountAuthService.ts');

    expect(service).not.toContain('return { vk: false, yandex: false, google: false, email: false }');
    expect(gate).toContain("window.addEventListener('online', retryOnReconnect)");
    expect(gate).toContain("window.removeEventListener('online', retryOnReconnect)");
    expect(gate).toContain('setCapabilitiesReload((value) => value + 1)');
    expect(gate).toContain('capabilitiesLoadFailed');
    expect(gate).toContain('Повторить');
    expect(service).toContain("usesNativeAndroidProviderAuth() ? 'native' : 'browser'");
    expect(service).toContain('`/api/auth/capabilities?runtime=${runtime}`');
    expect(service).toContain('usesNativeAndroidProviderAuth()');
    expect(service).toContain("body: JSON.stringify({ purpose, native: false })");
    expect(gate).toContain('emailPasswordReady');
    expect(gate).toContain('emailDeliveryReady');
  });

  test('native sessions use the Keystore-backed bridge instead of Capacitor Preferences', () => {
    const sessionStore = read('services/nativeSessionStore.ts');
    const bridge = read('services/nativeIdentityAuthBridge.ts');

    expect(sessionStore).not.toContain("registerPlugin<NativeIdentityAuthBridge>('NativeIdentityAuth')");
    expect(bridge).toContain("registerPlugin<NativeIdentityAuthBridge>('NativeIdentityAuth')");
    expect(sessionStore).toContain('getSessionToken');
    expect(sessionStore).toContain('setSessionToken');
    expect(sessionStore).toContain('clearSessionToken');
    expect(sessionStore).toContain('One-time upgrade path');
    expect(sessionStore).toContain('Preferences.remove');
  });

  test('settings links provider and password identities to the active account', () => {
    const settings = read('views/Settings.tsx');
    const identities = read('lib/auth/accountIdentity.ts');

    expect(settings).toContain('authenticateWithProvider(provider, authPurpose)');
    expect(settings).toContain("purpose: 'link'");
    expect(settings).toContain('verifyEmailPasswordRegistration');
    expect(identities).toContain('IDENTITY_ALREADY_LINKED');
    expect(identities).toContain('PROVIDER_ALREADY_LINKED');
    expect(identities).toContain('account-provider:');
  });

  test('uses canonical account state instead of treating every negative users.id as a guest', () => {
    const app = read('App.tsx');

    expect(app).toContain('const isGuestOnboarding = profile?.isGuest === true');
    expect(app).not.toContain('profile?.isGuest === true || isGuestUserId(safeUserId)');
    expect(app).not.toContain('!updatedProfile.isGuest && !isGuestUserId(canonicalUserId)');
  });
});
