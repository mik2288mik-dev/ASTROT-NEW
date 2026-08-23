import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('Android NativeIdentityAuth bridge contract', () => {
  it('registers the Capacitor plugin before BridgeActivity creates the bridge', () => {
    const activity = read('android/app/src/main/java/ru/tvoygoroskop/app/MainActivity.java');
    const registration = activity.indexOf('registerPlugin(NativeIdentityAuthPlugin.class)');
    const bridgeCreation = activity.indexOf('super.onCreate(savedInstanceState)');

    expect(registration).toBeGreaterThan(0);
    expect(bridgeCreation).toBeGreaterThan(registration);
    expect(activity).toContain('registerRuStorePlugin()');
  });

  it('uses the current native identity SDKs with build-injected configuration', () => {
    const rootGradle = read('android/build.gradle');
    const appGradle = read('android/app/build.gradle');
    const manifest = read('android/app/src/main/AndroidManifest.xml');
    const nativeProviders = read('lib/auth/nativeProviderAuth.ts');
    const defaultConfigStart = appGradle.indexOf('defaultConfig {');
    const flavorsStart = appGradle.indexOf('productFlavors {');
    const rustoreStart = appGradle.indexOf('rustore {', flavorsStart);
    const googlePlayStart = appGradle.indexOf('googlePlay {', flavorsStart);
    const buildFeaturesStart = appGradle.indexOf('buildFeatures {', googlePlayStart);
    const rustoreGooglePolicy = `${appGradle.slice(defaultConfigStart, flavorsStart)}\n${appGradle.slice(rustoreStart, googlePlayStart)}`;
    const googlePlayPolicy = appGradle.slice(googlePlayStart, buildFeaturesStart);

    expect(appGradle).toContain('androidx.credentials:credentials:1.6.0');
    expect(appGradle).toContain('androidx.credentials:credentials-play-services-auth:1.6.0');
    expect(appGradle).toContain('com.google.android.libraries.identity.googleid:googleid:1.2.0');
    expect(appGradle).toContain('com.yandex.android:authsdk:3.1.3');
    expect(appGradle).toContain('com.vk.id:vkid:2.7.2');
    expect(appGradle).toContain("authValue('GOOGLE_AUTH_CLIENT_ID')");
    expect(appGradle).toContain("authValue('YANDEX_AUTH_CLIENT_ID')");
    expect(appGradle).toContain("authValue('VK_AUTH_CLIENT_ID')");
    expect(appGradle).toContain("authValue('VK_ID_ANDROID_CLIENT_SECRET')");
    expect(appGradle).toContain('YANDEX_CLIENT_ID: yandexAuthClientId');
    expect(appGradle).toContain('VKIDClientSecret: vkIdAndroidClientSecret');
    expect(rustoreGooglePolicy).toContain("buildConfigField 'boolean', 'GOOGLE_AUTH_ENABLED', 'false'");
    expect(googlePlayPolicy).toContain("buildConfigField 'boolean', 'GOOGLE_AUTH_ENABLED', 'true'");
    expect(nativeProviders).toContain("['google', 'yandex', 'vk']");
    expect(rootGradle).toContain('vkid-sdk-android');
    expect(rootGradle).toContain('vk-id-captcha/android');
    expect(manifest).toContain('android.permission.ACCESS_NETWORK_STATE');
  });

  it('returns only provider proof and protects every native launch with stable errors', () => {
    const plugin = read(
      'android/app/src/main/java/ru/tvoygoroskop/app/auth/NativeIdentityAuthPlugin.java',
    );
    const googleHandler = read(
      'android/app/src/googleAuth/java/ru/tvoygoroskop/app/auth/GoogleIdentityAuthHandler.java',
    );
    const proguard = read('android/app/proguard-rules.pro');

    expect(plugin).toContain('@CapacitorPlugin(name = "NativeIdentityAuth")');
    expect(plugin).toContain('public void signIn(PluginCall call)');
    expect(plugin).toContain('public void clearCredentialState(PluginCall call)');
    expect(plugin).toContain('OptionalIdentityAuthDelegate');
    expect(plugin).toContain('BuildConfig.OPTIONAL_IDENTITY_AUTH_HANDLER_CLASS');
    expect(plugin).not.toContain('ru.tvoygoroskop.app.auth.GoogleIdentityAuthHandler');
    expect(googleHandler).toContain('GetSignInWithGoogleOption.Builder');
    expect(googleHandler).toContain('.setNonce(nonce)');
    expect(googleHandler).toContain('GoogleIdTokenCredential.createFrom');
    expect(googleHandler).toContain('callback.onSuccess(googleCredential.getIdToken())');
    expect(plugin).toContain('YandexAuthSdk.create');
    expect(plugin).toContain('YandexAuthResult.Cancelled');
    expect(plugin).toContain('payload.put("accessToken", accessToken)');
    expect(plugin).toContain('builder.setState(state)');
    expect(plugin).toContain('builder.setCodeChallenge(codeChallenge)');
    expect(plugin).toContain('public void onAuthCode(AuthCodeData data, boolean isCompletion)');
    expect(plugin).toContain('result.put("deviceId", deviceId)');
    expect(plugin).toContain('AUTH_CANCELLED');
    expect(plugin).toContain('AUTH_NETWORK');
    expect(plugin).toContain('AUTH_CONFIGURATION');
    expect(plugin).toContain('AUTH_FAILED');
    expect(plugin).toContain('compareAndSet(false, true)');
    expect(plugin).toContain('activeSignInCall != call');
    expect(plugin).not.toMatch(/\bLog\.(?:d|e|i|v|w)\s*\(/);

    const googleCaseStart = plugin.indexOf('case "google":');
    const yandexCaseStart = plugin.indexOf('case "yandex":', googleCaseStart);
    const googleCase = plugin.slice(googleCaseStart, yandexCaseStart);
    expect(googleCaseStart).toBeGreaterThan(-1);
    expect(googleCase).toContain('BuildConfig.GOOGLE_AUTH_ENABLED');
    expect(googleCase).toContain('rejectSignIn(call, AUTH_CONFIGURATION)');
    expect(proguard).toContain('-keep class ru.tvoygoroskop.app.auth.GoogleIdentityAuthHandler');
    expect(proguard).toContain('public <init>(...);');
  });

  it('keeps Google implementation classes outside the common and RuStore source sets', () => {
    const appGradle = read('android/app/build.gradle');
    const plugin = read(
      'android/app/src/main/java/ru/tvoygoroskop/app/auth/NativeIdentityAuthPlugin.java',
    );
    const commonDelegatePath = path.join(
      process.cwd(),
      'android/app/src/main/java/ru/tvoygoroskop/app/auth/GoogleIdentityAuthDelegate.java',
    );

    expect(fs.existsSync(commonDelegatePath)).toBe(false);
    expect(appGradle).toContain("development.java.srcDir 'src/googleAuth/java'");
    expect(appGradle).toContain("googlePlay.java.srcDir 'src/googleAuth/java'");
    expect(appGradle).not.toContain("rustore.java.srcDir 'src/googleAuth/java'");
    expect(plugin).not.toContain('com.google.android.libraries.identity');
    expect(plugin).not.toContain('androidx.credentials');
  });

  it('does not load or require Google credentials for a RuStore release', () => {
    const releaseHelper = read('scripts/android-release.mjs');
    const targetStart = releaseHelper.indexOf('const target = process.argv[2]');
    const channelStart = releaseHelper.indexOf('const channel =', targetStart);
    const channelAwareLoad = releaseHelper.indexOf('loadAndroidAuthEnv(channel)', channelStart);

    expect(targetStart).toBeGreaterThan(-1);
    expect(channelStart).toBeGreaterThan(targetStart);
    expect(channelAwareLoad).toBeGreaterThan(channelStart);
    expect(releaseHelper).toContain("channel === 'google_play'");

    const baseEnv: NodeJS.ProcessEnv = {
      ...process.env,
      NEXT_PUBLIC_API_URL: 'https://api.example.test',
      NEXT_PUBLIC_RUSTORE_PAYMENTS_ENABLED: '0',
      APP_VERSION_CODE: '1',
      APP_VERSION_NAME: '1.0.0',
      NEXT_PUBLIC_DEVELOPER_NAME: 'Example Developer',
      NEXT_PUBLIC_SUPPORT_EMAIL: 'support@example.test',
      NEXT_PUBLIC_PUBLIC_BASE_URL: 'https://example.test',
      NEXT_PUBLIC_PRIVACY_POLICY_URL: 'https://example.test/privacy',
      NEXT_PUBLIC_TERMS_URL: 'https://example.test/terms',
      NEXT_PUBLIC_ACCOUNT_DELETION_URL: 'https://example.test/delete-account',
      NEXT_PUBLIC_LEGAL_PUBLICATION_DATE: '2026-08-13',
      RELEASE_STORE_FILE: 'release.jks',
      RELEASE_STORE_PASSWORD: 'release-store-password',
      RELEASE_KEY_ALIAS: 'release-key',
      RELEASE_KEY_PASSWORD: 'release-key-password',
      PUBLIC_APP_ORIGIN: 'https://example.test',
      VK_AUTH_CLIENT_ID: 'vk-client',
      VK_ID_ANDROID_CLIENT_SECRET: 'vk-android-secret',
      VK_AUTH_CLIENT_SECRET: 'vk-server-secret',
      YANDEX_AUTH_CLIENT_ID: 'yandex-client',
      YANDEX_AUTH_CLIENT_SECRET: 'yandex-server-secret',
      EMAIL_OTP_DELIVERY_URL: 'https://mailer.example.test/send',
      EMAIL_OTP_DELIVERY_SECRET: 'mailer-secret',
      EMAIL_OTP_HASH_SECRET: 'email-otp-hash-secret-at-least-32-bytes',
      AUTH_RATE_LIMIT_SECRET: 'auth-rate-limit-secret-at-least-32-bytes',
      APP_SESSION_SECRET: 'app-session-secret-at-least-32-bytes',
      GOOGLE_AUTH_CLIENT_ID: '',
      GOOGLE_AUTH_CLIENT_SECRET: '',
    };
    const validate = (channel: 'rustore' | 'google_play', googleReady = false) => spawnSync(
      process.execPath,
      ['scripts/validate-store-release.mjs', '--release'],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: {
          ...baseEnv,
          NEXT_PUBLIC_DISTRIBUTION_CHANNEL: channel,
          GOOGLE_AUTH_CLIENT_ID: googleReady ? 'google-client' : '',
          GOOGLE_AUTH_CLIENT_SECRET: googleReady ? 'google-secret' : '',
        },
      },
    );

    const rustore = validate('rustore');
    const rustoreOutput = `${rustore.stdout}\n${rustore.stderr}`;
    expect(rustoreOutput).not.toContain('GOOGLE_AUTH_');
    expect(rustoreOutput).toContain(
      'NEXT_PUBLIC_RUSTORE_PAYMENTS_ENABLED must be enabled for a RuStore release with subscriptions',
    );
    expect(rustore.status).toBe(1);

    const googlePlayWithoutCredentials = validate('google_play');
    expect(googlePlayWithoutCredentials.status).not.toBe(0);
    expect(`${googlePlayWithoutCredentials.stdout}\n${googlePlayWithoutCredentials.stderr}`)
      .toContain('GOOGLE_AUTH_CLIENT_ID is required');

    const googlePlayReady = validate('google_play', true);
    expect(googlePlayReady.status).toBe(0);
  });

  it('stores the native session token with a non-exportable AES-GCM key', () => {
    const plugin = read(
      'android/app/src/main/java/ru/tvoygoroskop/app/auth/NativeIdentityAuthPlugin.java',
    );
    const storage = read(
      'android/app/src/main/java/ru/tvoygoroskop/app/auth/SecureSessionStore.java',
    );

    expect(plugin).toContain('public void getSessionToken(PluginCall call)');
    expect(plugin).toContain('public void setSessionToken(PluginCall call)');
    expect(plugin).toContain('public void clearSessionToken(PluginCall call)');
    expect(storage).toContain('AndroidKeyStore');
    expect(storage).toContain('AES/GCM/NoPadding');
    expect(storage).toContain('KeyProperties.BLOCK_MODE_GCM');
    expect(storage).toContain('Context.MODE_PRIVATE');
    expect(plugin).toContain('result.put("token", "")');
  });

  it('keeps CI package aligned and removes the retired browser-OAuth deep link', () => {
    const workflow = read('.github/workflows/ci.yml');
    const appGradle = read('android/app/build.gradle');
    const manifest = read('android/app/src/main/AndroidManifest.xml');

    expect(workflow).toContain('RUSTORE_PACKAGE_NAME: ru.tvoygoroskop.app');
    expect(workflow).not.toContain('RUSTORE_PACKAGE_NAME: com.yourhoroscope.app');
    expect(workflow).not.toContain('grep -q "final non-temporary application ID"');
    expect(workflow).not.toContain('NATIVE_AUTH_CALLBACK_SCHEME');
    expect(appGradle).not.toContain('authCallbackScheme');
    expect(manifest).not.toContain('android:host="auth"');
  });
});
