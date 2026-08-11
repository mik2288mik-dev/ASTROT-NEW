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
    expect(dashboard).toContain("loadPeriod('week');");
    expect(dashboard).toContain("loadPeriod('month');");
    expect(dashboard).not.toContain("loadPeriod('week', { cacheOnly: true })");
    expect(dashboard).not.toContain('<ForecastQuestions');
  });

  it('keeps period navigation in the side drawer and shares the selected period with the diary', () => {
    const drawer = read('components/lumia-ui/LumiaSideDrawer.tsx');
    const app = read('App.tsx');

    expect(drawer).toContain('PersonalForecastPeriod');
    expect(drawer).toContain('lumia-side-drawer-periods');
    expect(drawer).toContain('onSelectPeriod');
    expect(app).toContain('dashboardPeriod');
    expect(app).toContain('openDrawerPeriod');
  });

  it('keeps the phrase visually centred and close to the period switcher', () => {
    const forecastStyles = read('styles/personalForecastFeed.css');
    const newspaperStyles = read('styles/newspaperVisual.css');

    expect(forecastStyles).toContain('margin: 10px auto 12px;');
    expect(newspaperStyles).toContain('.forecast-feed-page .forecast-feed-section.is-overview .forecast-feed-screen-headline');
    expect(newspaperStyles).toContain('text-align: center;');
  });

  it('uses one loading spinner instead of forecast-content placeholders', () => {
    const dashboard = read('views/Dashboard.tsx');
    const forecastStyles = read('styles/personalForecastFeed.css');

    expect(dashboard).toContain('forecast-feed-loading-indicator');
    expect(dashboard).toContain('<LoaderCircle');
    expect(dashboard).not.toContain('forecast-feed-loading-preview');
    expect(forecastStyles).toContain('.forecast-feed-loading-indicator');
  });
});
