import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');

describe('NEBO Android release controls', () => {
  it('resolves every Android system label to the public app name without changing the application id', () => {
    const capacitor = read('capacitor.config.ts');
    const manifest = read('android/app/src/main/AndroidManifest.xml');
    const strings = read('android/app/src/main/res/values/strings.xml');
    const stringsEn = read('android/app/src/main/res/values-en/strings.xml');
    const env = read('.env.example');
    const releaseConfig = read('lib/storeReleaseConfig.ts');
    const page = read('pages/index.tsx');

    expect(capacitor).toContain("appId: 'ru.tvoygoroskop.app'");
    expect(capacitor).toContain("appName: 'NEBO гороскоп натальная карта'");
    expect(manifest).toContain('android:label="@string/app_name"');
    expect(manifest).toContain('android:label="@string/title_activity_main"');
    for (const source of [strings, stringsEn]) {
      expect(source).toContain('<string name="app_name">NEBO гороскоп натальная карта</string>');
      expect(source).toContain('<string name="title_activity_main">NEBO гороскоп натальная карта</string>');
      expect(source).toContain('<string name="package_name">ru.tvoygoroskop.app</string>');
    }
    expect(env).toContain('NEXT_PUBLIC_APP_NAME=NEBO');
    expect(releaseConfig).toContain("process.env.NEXT_PUBLIC_APP_NAME || 'NEBO'");
    expect(page).toContain('<meta name="application-name" content="NEBO гороскоп натальная карта" />');
  });

  it('uses MEOU launcher resources for legacy and Android 12 launch screens', () => {
    const styles = read('android/app/src/main/res/values/styles.xml');
    const launchScreen = read('android/app/src/main/res/drawable/meou_launch_screen.xml');
    const appTheme = styles.match(/<style name="AppTheme\.NoActionBar"[\s\S]*?<\/style>/)?.[0] || '';
    const launchTheme = styles.match(/<style name="AppTheme\.NoActionBarLaunch"[\s\S]*?<\/style>/)?.[0] || '';

    expect(appTheme).toContain('<item name="android:background">@null</item>');
    expect(appTheme).toContain('<item name="android:windowBackground">#FFFFFF</item>');
    expect(appTheme).not.toContain('@drawable/meou_launch_screen');
    expect(launchTheme).toContain('<item name="android:background">@drawable/meou_launch_screen</item>');
    expect(styles).toContain(
      '<item name="windowSplashScreenBackground">@color/ic_launcher_background</item>',
    );
    expect(styles).toContain(
      '<item name="windowSplashScreenAnimatedIcon">@mipmap/ic_launcher_foreground</item>',
    );
    expect(styles).toContain(
      '<item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>',
    );
    expect(styles).not.toContain('@drawable/splash');
    expect(launchScreen).toContain('<layer-list');
    expect(launchScreen).toContain('android:drawable="@color/ic_launcher_background"');
    expect(launchScreen).toContain('android:drawable="@mipmap/ic_launcher_foreground"');
    expect(launchScreen).toContain('android:gravity="center"');
  });

  it('runs the release validator when the Windows Node path contains spaces', () => {
    const releaseScript = read('scripts/android-release.mjs');

    expect(releaseScript).toContain("'--mobile-artifact', `--profile=${task.profile}`");
    expect(releaseScript).toContain("['scripts/validate-store-release.mjs'");
    expect(releaseScript).toContain('shell: useShell');
  });

  it('preserves the selected plan across the existing recovery-identity flow', () => {
    const app = read('App.tsx');
    const settings = read('views/Settings.tsx');
    const paywall = read('views/Paywall.tsx');
    const rustore = read('services/rustorePayService.ts');

    const recoveryBranch = app.slice(
      app.indexOf("paymentResult.reason === 'RECOVERY_IDENTITY_REQUIRED'"),
      app.indexOf("if (paymentResult.status === 'pending')"),
    );
    expect(recoveryBranch).toContain('setPendingPremiumRecovery({ context, planId })');
    expect(recoveryBranch).toContain("setView('settings')");
    expect(app).toContain('recoveryIdentityRequired={pendingPremiumRecovery !== null}');
    expect(app).toContain('setPaywallInitialPlanId(pending.planId)');
    expect(app).toContain('setPaywallContext(pending.context)');
    expect(paywall).toContain('useState<PremiumPlanId>(initialPlanId)');
    expect(settings).toContain('authenticateWithProvider(provider, authPurpose)');
    expect(settings).toContain("purpose: 'link'");
    expect(settings).toContain('verifyEmailPasswordRegistration');
    expect(settings).toContain('if (recoveryIdentityRequired) onRecoveryIdentityReady?.()');
    expect(settings).toContain('VK ID, Яндекс или email');
    expect(rustore.indexOf('await hasRecoveryIdentity()')).toBeLessThan(rustore.indexOf('await nativeBridge.purchase'));
    expect(rustore).toContain("'RECOVERY_IDENTITY_REQUIRED'");
    expect(rustore).toContain('SDK_TERMINAL_PURCHASE_FAILURE_REASONS.has(result.reason)');
  });

  it('shows accessible password visibility controls and NEBO on user auth screens', () => {
    const gate = read('views/AuthGate.tsx');
    const settings = read('views/Settings.tsx');
    const complete = read('pages/auth/complete.tsx');

    expect(gate).toContain('Eye, EyeOff');
    expect(gate).toContain("type={passwordVisible ? 'text' : 'password'}");
    expect(gate).toContain("type={passwordConfirmationVisible ? 'text' : 'password'}");
    expect(gate).toContain("aria-label={passwordVisible ? 'Скрыть пароль' : 'Показать пароль'}");
    expect(gate).toContain('aria-pressed={passwordVisible}');
    expect(settings).toContain("type={emailPasswordVisible ? 'text' : 'password'}");
    expect(settings).toContain("type={emailPasswordConfirmationVisible ? 'text' : 'password'}");
    expect(settings).toContain('aria-pressed={emailPasswordVisible}');
    expect(settings).toContain('aria-pressed={emailPasswordConfirmationVisible}');
    expect(gate).toContain('NEBO');
    expect(complete).toContain('Вход в NEBO');
    expect(`${gate}\n${complete}`).not.toMatch(/aria-label="Твой Гороскоп"|Вход в Твой Гороскоп/);
  });
});
