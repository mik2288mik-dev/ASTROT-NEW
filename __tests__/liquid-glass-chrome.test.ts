import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('liquid glass application chrome', () => {
  it('uses the requested labels and recognizable navigation icons', () => {
    const tabs = read('components/lumia-ui/LumiaBottomTabBar.tsx');
    const icons = read('components/icons/UiIcons.tsx');

    expect(tabs).toContain("today: 'Diary'");
    expect(tabs).toContain("today: 'Дневник'");
    expect(tabs).toContain("id: 'diary'");
    expect(tabs).toContain('BookOpenText');
    expect(tabs).toContain('ZodiacWheelIcon');
    expect(tabs).toContain('Handshake');
    expect(tabs).not.toContain("id: 'today'");
    expect(icons).toContain('export function ZodiacWheelIcon');
  });

  it('applies one frosted material to the top and bottom bars', () => {
    const styles = read('styles/liquidGlassChrome.css');
    const app = read('pages/_app.tsx');
    const topBar = read('components/lumia-ui/AppTopBar.tsx');
    const freshHeaders = read('components/fresh-ui/FreshHeaders.tsx');
    const dashboard = read('views/Dashboard.tsx');
    const legacyHeader = read('components/Header.tsx');

    expect(app.indexOf("import '../styles/liquidGlassChrome.css'")).toBeGreaterThan(
      app.indexOf("import '../styles/newspaperVisual.css'"),
    );
    expect(styles).toContain('--app-glass-filter: blur(30px) saturate(1.62)');
    expect(styles).toContain('.lumia-bottom-tab-bar');
    expect(styles).toContain('.fresh-page::before');
    expect(styles).toContain('.app-top-bar');
    expect(styles).toContain('backdrop-filter: var(--app-glass-filter)');
    expect(styles).toContain('position: fixed');
    expect(styles).toContain('@supports not');
    expect(styles).toContain('@media (prefers-reduced-transparency: reduce)');
    expect(topBar).toContain("className={cn('app-top-bar', className)}");
    expect(topBar).toContain('app-top-bar-spacer');
    expect(freshHeaders).toContain('<AppTopBar');
    expect(dashboard).toContain('<AppTopBar');
    expect(legacyHeader).toContain('return <AppTopBar');
  });

  it('uses a compact active glass lens that expands for Compatibility', () => {
    const tabs = read('components/lumia-ui/LumiaBottomTabBar.tsx');
    const styles = read('styles/liquidGlassChrome.css');

    expect(tabs).toContain('lumia-bottom-tab-active-pill-frame');
    expect(styles).toContain('.lumia-bottom-tab-active-pill-frame');
    expect(styles).toContain(".lumia-bottom-tab-item[data-tab-id='union'] .lumia-bottom-tab-active-pill");
    expect(styles).toContain('width: min(calc(100% - 4px), 3.45rem)');
    expect(styles).toContain('width: calc(100% - 2px)');
  });
});
