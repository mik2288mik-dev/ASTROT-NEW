import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('Android account authentication UI', () => {
  test('renders only providers allowed for the active distribution channel', () => {
    const gate = read('views/AuthGate.tsx');
    const settings = read('views/Settings.tsx');
    const service = read('services/accountAuthService.ts');
    const capabilities = read('pages/api/auth/capabilities.ts');
    const distribution = read('lib/distributionChannel.ts');

    expect(gate).toContain("? 'Начать'");
    expect(gate).toContain('Продолжить без аккаунта');
    expect(gate).toContain('Продолжить с Яндексом');
    expect(gate).toContain('Продолжить с VK ID');
    expect(gate).toContain('Повторите пароль');
    expect(gate).toContain('Уже есть аккаунт?');
    expect(gate).toContain('Забыли пароль?');
    expect(gate).toContain('Шестизначный код из письма');
    expect(gate).toContain('PROVIDERS.filter');
    expect(gate).not.toContain('capabilities?.[provider.id] !== true');
    expect(settings).toContain(".filter((provider) => authCapabilities?.[provider] === true)");
    expect(service).toContain('resolveDistributionChannel');
    expect(service).toContain('channel=${channel}');
    expect(capabilities).toContain('canUseAccountAuthProvider');
    expect(distribution).toContain("channel === 'google_play' || channel === 'development'");
    expect(distribution).toContain("if (provider !== 'google') return true");
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
  });

  test('offers guest access independently and Telegram only inside a verified Mini App context', () => {
    const gate = read('views/AuthGate.tsx');
    const app = read('App.tsx');

    expect(gate).toContain('onGuestStart: () => Promise<void>');
    expect(gate).toContain('await onGuestStart()');
    expect(gate).toContain('Продолжить без аккаунта');
    expect(app).toContain("setAuthSessionMode('guest')");
    expect(app).toContain('const guestProfile = await startGuestAccount()');
    expect(app).toContain("resumeAuthenticatedStartup(guestProfile, 'guest')");
    expect(gate).toContain('hasTelegramMiniAppContext');
    expect(gate).toContain('loginWithTelegram');
    expect(gate).toContain('hasTelegramMiniAppContext()');
    expect(gate).toContain('Войти через Telegram');
    expect(gate).toContain("code.includes('AUTH_TIMEOUT')");
    expect(gate).toContain('Вход занял слишком много времени. Проверь сеть и попробуй ещё раз.');
  });

  test('fresh native automatic mode does not silently create a guest account', () => {
    const api = read('services/apiClient.ts');
    const app = read('App.tsx');

    expect(api).toContain("mode !== 'guest'");
    expect(api).not.toContain("mode !== 'automatic' && mode !== 'guest'");
    expect(app).toContain("!isNativeAppRuntime() && sessionMode === 'automatic'");
    expect(app).toContain("const isFreshNativeLaunch = sessionMode === 'automatic' && isNativeAppRuntime()");
    expect(app).toContain('setAuthGateMessage(isFreshNativeLaunch');
    expect(app).toContain('onGuestStart={handleGuestStart}');
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
    expect(service).toContain('`/api/auth/capabilities?runtime=${runtime}&channel=${channel}`');
    expect(service).toContain('usesNativeAndroidProviderAuth()');
    expect(service).toContain("body: JSON.stringify({ purpose, native: false })");
    expect(gate).toContain('emailPasswordReady');
    expect(gate).toContain('emailDeliveryReady');
    const guestAction = gate.indexOf('Продолжить без аккаунта');
    const capabilityFailure = gate.indexOf('capabilitiesLoadFailed ?');
    expect(guestAction).toBeGreaterThan(-1);
    expect(capabilityFailure).toBeGreaterThan(guestAction);
  });

  test('keeps compiled Android providers and guest transport independent from discovery', () => {
    const gate = read('views/AuthGate.tsx');
    const settings = read('views/Settings.tsx');
    const service = read('services/accountAuthService.ts');
    const api = read('services/apiClient.ts');
    const session = read('services/sessionService.ts');

    expect(service).toContain('export function getLocalAccountAuthCapabilities');
    expect(service).toContain('if (localCapabilities) return localCapabilities;');
    expect(gate).toContain('const initialLocalCapabilities = getLocalAccountAuthCapabilities()');
    expect(gate).toContain('if (usesLocalCapabilities)');
    expect(gate).toContain('availableProviders.map');
    expect(settings).not.toContain('Promise.all([getLinkedIdentities(), getAccountAuthCapabilities()])');
    expect(api).toContain('export async function apiFetchUnauthenticated');
    expect(session).toContain('apiFetchUnauthenticated(');
    expect(session).not.toContain("fetch(apiUrl('/api/auth/native-guest')");
  });

  test('detects the native runtime from Capacitor even when the build flag is unavailable', () => {
    const api = read('services/apiClient.ts');
    const runtime = read('services/nativeRuntime.ts');

    expect(api).toContain("import { isNativeAndroidRuntime, isNativeAppRuntime as hasNativeAppRuntime } from './nativeRuntime'");
    expect(api).toContain('return hasNativeAppRuntime();');
    expect(runtime).toContain("process.env.NEXT_PUBLIC_MOBILE_BUILD === '1' || Capacitor.isNativePlatform()");
    expect(runtime).toContain("process.env.NEXT_PUBLIC_ANDROID_BUILD === '1'");
  });

  test('keeps Android Back inside multi-step authentication before root exit', () => {
    const gate = read('views/AuthGate.tsx');

    expect(gate).toContain('window.addEventListener(NATIVE_BACK_EVENT, onNativeBack)');
    expect(gate).toContain('window.removeEventListener(NATIVE_BACK_EVENT, onNativeBack)');
    expect(gate).toContain("if (screen === 'register') return");
    expect(gate).toContain("setScreen(screen === 'verify' ? 'register' : screen === 'reset' ? 'forgot' : 'register')");
    expect(gate).toContain('if (detail) detail.handled = true');
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
    expect(settings).toContain('два заполненных профиля автоматически не объединяются');
    expect(settings).toContain('Восстановить существующий аккаунт');
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
