import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('cosmic transient surface contract', () => {
  it('keeps one accessible sheet primitive with keyboard and native Back handling', () => {
    const source = read('components/lumia-ui/CosmicSheet.tsx');
    expect(source).toContain('role="dialog"');
    expect(source).toContain('aria-modal="true"');
    expect(source).toContain('aria-labelledby={titleId}');
    expect(source).toContain("event.key === 'Escape'");
    expect(source).toContain('FOCUSABLE_SELECTOR');
    expect(source).toContain('previousFocusRef.current?.focus');
    expect(source).toContain('NATIVE_BACK_EVENT');
    expect(source).toContain('nativeEvent.detail.handled = true');
    expect(source).toContain('className="cosmic-sheet-backdrop');
  });

  it('mounts the current navigation shell through CosmicSheet without the legacy drawer', () => {
    const app = read('App.tsx');
    const nextApp = read('pages/_app.tsx');
    const navigation = read('components/lumia-ui/LumiaBottomTabBar.tsx');
    const surface = read('components/lumia-ui/CosmicSurface.tsx');
    const css = read('styles/globals.css');

    expect(surface).toContain("sheet: '/assets/cosmic/sheet.webp'");
    expect(app).toContain('LumiaBottomTabBar');
    expect(app).toContain('LumiaNavigationSheet');
    expect(app).toContain('navigationSheet');
    expect(app).not.toContain('LumiaSideDrawer');
    expect(nextApp).not.toContain('LumiaSideDrawer');
    expect(navigation).toContain("export type LumiaNavigationSheetId = 'profile';");
    expect(navigation).toContain('today-bottom-navigation');
    expect(navigation).toContain('today-bottom-nav-hub');
    expect(navigation).toContain('today-bottom-nav-services');
    expect(navigation).toContain('CosmicSheet');
    expect(navigation).toContain('<CosmicSheet');
    expect(navigation).not.toContain('variant="drawer"');
    expect(navigation).not.toContain('variant="paywall"');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('max(env(safe-area-inset-bottom');
    expect(css).toContain('.cosmic-sheet-panel:has(.cosmic-sheet-footer) .cosmic-sheet-content');
  });

  it('routes active sheets, previews and stories through the cosmic layer', () => {
    const forecastSheet = read('components/PersonalForecastFeed/ForecastBottomSheet.tsx');
    const daySheet = read('components/lumia-ui/DaySheet.tsx');
    const signSheet = read('components/lumia-ui/v2/LzSignPickerSheet.tsx');
    const premiumPreview = read('components/PremiumPreview.tsx');
    const stories = read('components/lumia-ui/StoriesViewer.tsx');

    for (const source of [forecastSheet, daySheet, signSheet, premiumPreview]) {
      expect(source).toContain('CosmicSheet');
    }
    expect(stories).toContain('role="dialog"');
    expect(stories).toContain('NATIVE_BACK_EVENT');
    expect(stories).toContain('/assets/cosmic/sheet.webp');
    expect(stories).toContain("event.key === 'Escape'");
  });
});
