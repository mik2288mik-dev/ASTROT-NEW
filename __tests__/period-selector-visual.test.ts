import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('forecast period selector visual contract', () => {
  it('restores the historical capsule and cyan-blue-violet active treatment', () => {
    const styles = read('styles/globals.css');
    const newspaper = read('styles/newspaperVisual.css');
    const dashboard = read('views/Dashboard.tsx');

    expect(styles).toContain('.home-period-tabs {');
    expect(styles).toContain('grid-template-columns: repeat(4, minmax(0, 1fr))');
    expect(styles).toContain('border: 1px solid rgba(17, 24, 39, 0.065)');
    expect(styles).toContain('0 10px 24px rgba(24, 24, 27, 0.06)');
    expect(styles).toContain('linear-gradient(135deg, #00bfae 0%, #1478ff 52%, #7a4dff 100%)');
    expect(styles).toContain('opacity 160ms ease');
    expect(styles).toContain('transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1)');
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(dashboard).toContain('className="home-period-tab-label"');
    expect(dashboard).toContain('aria-selected={tab.id === activePeriod}');
    expect(dashboard).toContain('onClick={() => selectPeriod(tab.id)}');
    expect(newspaper).not.toContain('.forecast-feed-page .home-period-tab.is-active');
    expect(styles).not.toContain('linear-gradient(135deg, #38BDF8 0%, #1478FF 100%)');
  });
});
