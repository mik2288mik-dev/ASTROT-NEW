import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('personal forecast screen layout', () => {
  it('keeps the selected period date on the diary screen without a second period switcher', () => {
    const dashboard = read('views/Dashboard.tsx');

    expect(dashboard).not.toContain("import { FreshTabs } from '../components/fresh-ui'");
    expect(dashboard).toContain('const activeWindow = useMemo(');
    expect(dashboard).toContain('resolvePersonalForecastWindow(activePeriod, periodKeys[activePeriod], timezone)');
    expect(dashboard).not.toContain('forecast-feed-period-tabs');
    expect(dashboard).not.toContain('forecast-feed-footer');
    expect(dashboard).not.toContain("loadPeriod('week');");
    expect(dashboard).not.toContain("loadPeriod('month');");
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

  it('keeps the personal story as one calm reading column without a sticker treatment', () => {
    const forecastStyles = read('styles/personalForecastFeed.css');
    const newspaperStyles = read('styles/newspaperVisual.css');

    expect(forecastStyles).not.toContain('.forecast-feed-period-tabs');
    expect(newspaperStyles).toContain('.forecast-feed-page .forecast-feed-section.is-overview .forecast-feed-screen-headline');
    expect(newspaperStyles).toContain('text-align: left;');
    expect(newspaperStyles).not.toContain('.forecast-feed-page .forecast-feed-editorial-sticker');
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
