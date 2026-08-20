import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('forecast period selector visual contract', () => {
  it('uses three quiet text tabs with one hairline active indicator', () => {
    const styles = read('styles/todayHome.css');
    const dashboard = read('views/Dashboard.tsx');

    expect(dashboard).toContain('className="today-period-tabs"');
    expect(dashboard).toContain('role="tablist"');
    expect(dashboard).toContain('className="today-period-tab"');
    expect(dashboard).toContain('aria-selected={period === activePeriod}');
    expect(dashboard).toContain('onClick={() => selectPeriod(period)}');
    expect(dashboard).toContain('className="today-period-tab-underline"');
    expect(dashboard).toContain('tabIndex={period === focusedPeriod ? 0 : -1}');
    expect(dashboard).toContain("event.key === 'ArrowRight'");
    expect(dashboard).toContain("event.key === 'Home'");
    expect(styles).toContain('.today-period-tabs {');
    expect(styles).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
    expect(styles).toContain(".today-period-tab[aria-selected='true']");
    expect(styles).toContain('height: 1px;');
    expect(styles).not.toContain('cyan-blue-violet');
    expect(styles).not.toContain('linear-gradient(135deg, #00bfae');
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
  });
});
