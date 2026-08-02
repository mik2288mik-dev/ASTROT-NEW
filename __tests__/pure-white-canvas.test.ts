import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('pure-white application canvas', () => {
  it('uses one #FFFFFF token across primary screens and reading surfaces', () => {
    const globals = read('styles/globals.css');
    const primaryStyles = [
      'styles/personalForecastFeed.css',
      'styles/zodiacReader.css',
      'styles/natalEditorial.css',
      'styles/compatibilityEditorial.css',
      'styles/settingsEditorial.css',
      'styles/readingBackgrounds.css',
    ].map(read).join('\n');

    expect(globals).toContain('--app-canvas: #FFFFFF');
    expect(globals).toContain('--lumia-home-bg: var(--app-canvas)');
    expect(globals).toContain('--today-screen-bg: var(--app-canvas)');
    expect(globals).toContain('--mono-bg: var(--app-canvas)');
    expect(globals).toContain('--fresh-bg: var(--app-canvas)');
    expect(primaryStyles).toContain('var(--app-canvas)');
    expect(primaryStyles).not.toMatch(/#fbfaf7|#fbfbfa|rgba\(251,\s*250,\s*247|rgba\(251,\s*251,\s*250/i);
  });

  it('aligns browser, Telegram and Android system surfaces with the same white', () => {
    const document = read('pages/_document.tsx');
    const app = read('App.tsx');
    const capacitor = read('capacitor.config.ts');
    const android = read('android/app/src/main/res/values/styles.xml');
    const loading = read('components/ui/Loading.tsx');

    expect(document).toContain('<meta name="theme-color" content="#FFFFFF" />');
    expect(app).toContain("setHeaderColor?.('#FFFFFF')");
    expect(app).toContain("setBackgroundColor?.('#FFFFFF')");
    expect(app).toContain("setBottomBarColor?.('#FFFFFF')");
    expect(capacitor).toContain("backgroundColor: '#ffffff'");
    expect(android).toContain('<item name="android:statusBarColor">#FFFFFF</item>');
    expect(android).toContain('<item name="android:navigationBarColor">#FFFFFF</item>');
    expect(android).toContain('<item name="android:windowLightStatusBar">true</item>');
    expect(android).toContain('<item name="android:windowLightNavigationBar">true</item>');
    expect(loading).toContain('var(--app-canvas, #FFFFFF)');
    expect(loading).not.toContain('#FBFAF6');
  });
});
