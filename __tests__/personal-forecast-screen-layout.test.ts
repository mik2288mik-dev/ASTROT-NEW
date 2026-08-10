import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('personal forecast screen layout', () => {
  it('keeps today\'s date and the period switcher on the diary screen', () => {
    const dashboard = read('views/Dashboard.tsx');

    expect(dashboard).toContain("import { FreshTabs } from '../components/fresh-ui'");
    expect(dashboard).toContain('const todayWindow = useMemo(');
    expect(dashboard).toContain("resolvePersonalForecastWindow('day', periodKeys.day, timezone)");
    expect(dashboard).toContain('className="forecast-feed-period-tabs"');
    expect(dashboard).toContain('className="forecast-feed-footer"');
    expect(dashboard).not.toContain('<ForecastQuestions');
  });

  it('removes the duplicated personal-period navigation from the side drawer', () => {
    const drawer = read('components/lumia-ui/LumiaSideDrawer.tsx');
    const app = read('App.tsx');

    expect(drawer).not.toContain('PersonalForecastPeriod');
    expect(drawer).not.toContain('lumia-side-drawer-periods');
    expect(drawer).not.toContain('onSelectPeriod');
    expect(app).not.toContain('dashboardPeriod');
    expect(app).not.toContain('openDrawerPeriod');
  });
});
