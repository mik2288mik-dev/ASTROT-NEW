import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('settings mobile information architecture', () => {
  it('uses compact grouped rows and local detail screens', () => {
    const settings = read('views/Settings.tsx');
    const styles = read('styles/settingsEditorial.css');
    const newspaperStyles = read('styles/newspaperVisual.css');
    const app = read('pages/_app.tsx');

    expect(settings).toContain('settings-editorial-page');
    expect(settings).toContain('settings-editorial-content');
    expect(settings).toContain('type SettingsScreen');
    expect(settings).toContain('settings-list-row');
    expect(settings).toContain('settings-detail-panel');
    expect(settings).toContain("case 'profile'");
    expect(settings).toContain("case 'notifications'");
    expect(settings).toContain("case 'auth'");
    expect(settings).toContain("case 'subscription'");
    expect(settings).toContain("case 'legal'");
    expect(settings).toContain('onDeleteAccount');
    expect(settings).toContain('onLogout');
    expect(styles).toContain('.settings-list');
    expect(styles).toContain('min-height: 56px');
    expect(styles).toContain('animation: settings-panel-in 200ms');
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(settings).not.toContain('settings-editorial-premium');
    expect(settings).not.toContain('EditorialProfileButton');
    expect(settings).toContain('EditorialChartsButton');
    expect(settings).toContain("settingsScreen === 'root' && onOpenCharts");
    expect(settings).toContain('settings-editorial-page--embedded');
    expect(settings).toContain('settings-embedded-detail-header');
    expect(settings).not.toContain('font-serif');
    expect(styles).not.toContain('linear-gradient');
    expect(styles).not.toContain('radial-gradient');
    expect(newspaperStyles).not.toContain('.settings-editorial-content,');
    expect(styles).not.toMatch(/^\.fresh-page\s*\{/m);
    expect(app).toContain("import '../styles/settingsEditorial.css'");
  });

  it('returns details locally before App navigation handles root Back', () => {
    const settings = read('views/Settings.tsx');

    expect(settings).toContain('NATIVE_BACK_EVENT');
    expect(settings).toContain("if (settingsScreen === 'root') return");
    expect(settings).toContain("detail.handled = true");
    expect(settings).toContain('settingsDetailBusy');
    expect(settings).toContain('if (settingsDetailBusy) return');
    expect(settings).toContain('data-settings-target={target}');
    expect(settings).toContain('lastRootTargetRef.current');
    expect(settings).toContain('settingsContentRef.current?.focus');
    expect(settings).not.toContain('<main className="fresh-page settings-editorial-page"');
    expect(settings).toContain("embedded && settingsScreen !== 'root'");
  });
});
