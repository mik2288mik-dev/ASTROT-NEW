import fs from 'fs';
import path from 'path';

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

  it('packages only the current RuStore identity SDKs with build-injected configuration', () => {
    const rootGradle = read('android/build.gradle');
    const appGradle = read('android/app/build.gradle');
    const manifest = read('android/app/src/main/AndroidManifest.xml');

    expect(appGradle).not.toContain('androidx.credentials:credentials:');
    expect(appGradle).not.toContain('androidx.credentials:credentials-play-services-auth:');
    expect(appGradle).not.toContain('com.google.android.libraries.identity.googleid:googleid:');
    expect(appGradle).toContain('com.yandex.android:authsdk:3.1.3');
    expect(appGradle).toContain('com.vk.id:vkid:2.7.2');
    expect(appGradle).not.toContain("authValue('GOOGLE_AUTH_CLIENT_ID')");
    expect(appGradle).toContain("authValue('YANDEX_AUTH_CLIENT_ID')");
    expect(appGradle).toContain("authValue('VK_AUTH_CLIENT_ID')");
    expect(appGradle).toContain("authValue('VK_ID_ANDROID_CLIENT_SECRET')");
    expect(appGradle).toContain('YANDEX_CLIENT_ID: yandexAuthClientId');
    expect(appGradle).toContain('VKIDClientSecret: vkIdAndroidClientSecret');
    expect(rootGradle).toContain('vkid-sdk-android');
    expect(rootGradle).toContain('vk-id-captcha/android');
    expect(manifest).toContain('android.permission.ACCESS_NETWORK_STATE');
  });

  it('returns only Yandex/VK provider proof and protects every native launch with stable errors', () => {
    const plugin = read(
      'android/app/src/main/java/ru/tvoygoroskop/app/auth/NativeIdentityAuthPlugin.java',
    );

    expect(plugin).toContain('@CapacitorPlugin(name = "NativeIdentityAuth")');
    expect(plugin).toContain('public void signIn(PluginCall call)');
    expect(plugin).toContain('public void clearCredentialState(PluginCall call)');
    expect(plugin).not.toContain('GetSignInWithGoogleOption');
    expect(plugin).not.toContain('GoogleIdTokenCredential');
    expect(plugin).not.toContain('CredentialManager');
    expect(plugin).not.toContain('case "google"');
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
