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

  it('keeps Week and Month as one calm prose reading column', () => {
    const dashboard = read('views/Dashboard.tsx');
    const sectionBlock = read('components/PersonalForecastFeed/ForecastSectionBlock.tsx');
    const forecastStyles = read('styles/personalForecastFeed.css');

    expect(forecastStyles).not.toContain('.forecast-feed-period-tabs');
    expect(dashboard).toContain('[forecast.overview, ...forecast.sections]');
    expect(dashboard).toContain('storySections.map((section)');
    expect(dashboard).toContain('sticker={stickerPausesBySection.get(section.id) || null}');
    expect(sectionBlock).toContain('forecast-feed-story-fragment');
    expect(sectionBlock).toContain('<EditorialSticker');
    expect(sectionBlock).not.toContain('data-editorial-role');
    expect(sectionBlock).not.toContain('forecast-feed-section--${section.kind}');
    expect(forecastStyles).toContain('.forecast-feed-story .forecast-feed-story-fragment');
    expect(forecastStyles).toContain('background: transparent;');
    expect(forecastStyles).not.toContain('background-image: var(--forecast-section-image)');
  });

  it('labels Today directly and keeps period navigation outside the reading canvas', () => {
    const dashboard = read('views/Dashboard.tsx');

    expect(dashboard).toContain("day: language === 'ru' ? 'Сегодня' : 'Today'");
    expect(dashboard).toContain('<time');
    expect(dashboard).not.toContain('ForecastTopicNavigation');
    expect(dashboard).not.toContain('ForecastSideNavigator');
  });

  it('shows the editorial skeleton only for a first-load Today without local content', () => {
    const dashboard = read('views/Dashboard.tsx');
    const skeleton = read('components/PersonalForecastFeed/ForecastEditorialSkeleton.tsx');
    const forecastStyles = read('styles/personalForecastFeed.css');

    expect(dashboard).toContain('const retained = current[period]?.result || local');
    expect(dashboard).toContain('<ForecastEditorialSkeleton');
    expect(dashboard).toMatch(/displayPeriod === 'day' \? \(\s*<ForecastEditorialSkeleton/);
    expect(skeleton).toContain('aria-busy="true"');
    expect(skeleton).toContain('forecast-editorial-skeleton-headline');
    expect(skeleton).toContain('forecast-editorial-skeleton-lead');
    expect(skeleton).toContain('forecast-editorial-skeleton-body');
    expect(skeleton).toContain('forecast-editorial-skeleton-visual');
    expect(skeleton).toContain("layout !== 'typography-first'");
    expect(skeleton).toContain("'--forecast-skeleton-visual-ratio'");
    expect(skeleton).toContain('`${visual.width} / ${visual.height}`');
    expect(skeleton).toContain('aria-hidden="true"');
    expect(forecastStyles).toContain('.forecast-editorial-skeleton-headline');
    expect(forecastStyles).toContain("[data-forecast-skeleton-layout='hero-visual-note']");
    expect(forecastStyles).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('scrolls nested editorial fragments relative to the actual scroll root', () => {
    const dashboard = read('views/Dashboard.tsx');
    expect(dashboard).toContain('const rootRect = root.getBoundingClientRect()');
    expect(dashboard).toContain('const targetRect = target.getBoundingClientRect()');
    expect(dashboard).toContain('root.scrollTop + targetRect.top - rootRect.top - 84');
    expect(dashboard).not.toContain('target.offsetTop - 84');
  });

  it('keeps Today editorial while Week and Month retain prose rendering', () => {
    const dashboard = read('views/Dashboard.tsx');

    expect(dashboard).toContain("displayPeriod === 'day'");
    expect(dashboard).toContain('<TodayEditorialFeed');
    expect(dashboard).toContain('storySections.map((section)');
    expect(dashboard).toContain('<ForecastSectionBlock');
    expect(dashboard).toContain('[forecast.overview, ...forecast.sections]');
  });

  it('does not expose internal categories or bottom navigation on Today', () => {
    const dashboard = read('views/Dashboard.tsx');
    const sectionBlock = read('components/PersonalForecastFeed/ForecastSectionBlock.tsx');

    expect(dashboard).not.toContain('LumiaBottomTabBar');
    expect(dashboard).not.toContain('lumia-bottom-tab-scroll');
    expect(dashboard).not.toMatch(/Love|Work|Money/);
    expect(sectionBlock).toContain('resolveVisibleForecastTitle');
    expect(sectionBlock).not.toContain('{section.kind}');
    expect(sectionBlock).not.toContain('{section.sourceTopicKey}');
  });

  it('reserves sticker space and keeps the current story mounted during background refresh', () => {
    const dashboard = read('views/Dashboard.tsx');
    const sticker = read('components/EditorialSticker.tsx');
    const forecastStyles = read('styles/personalForecastFeed.css');

    expect(dashboard).toContain('const retained = current[period]?.result || local');
    expect(dashboard).toContain('stickerPlanCacheRef.current.get(stickerPlanKey)');
    expect(sticker).toContain("'--editorial-sticker-ratio'");
    expect(sticker).toContain("loading={priority ? 'eager' : 'lazy'}");
    expect(sticker).toContain('width={asset.width}');
    expect(sticker).toContain('height={asset.height}');
    expect(forecastStyles).toContain('overflow-wrap: anywhere;');
    expect(forecastStyles).toContain('font-size: clamp(1rem, 4.2vw, 1.075rem);');
  });
});
