import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('personal forecast screen layout', () => {
  it('keeps one controlled three-period text switcher below the Today header', () => {
    const dashboard = read('views/Dashboard.tsx');

    expect(dashboard).toContain('const activeWindow = useMemo(');
    expect(dashboard).toContain('resolvePersonalForecastWindow(');
    expect(dashboard).toContain('className="today-period-navigation"');
    expect(dashboard).toContain('className="today-period-tabs"');
    expect(dashboard).toContain('role="tablist"');
    expect(dashboard).toContain('aria-selected={period === activePeriod}');
    expect(dashboard).toContain('tabIndex={period === focusedPeriod ? 0 : -1}');
    expect(dashboard).toContain('onPeriodChange?.(period)');
    expect(dashboard).not.toContain('forecast-feed-period-tabs');
    expect(dashboard).not.toContain('<ForecastQuestions');
  });

  it('keeps Today editorial while Week and Month remain one continuous prose reading', () => {
    const dashboard = read('views/Dashboard.tsx');
    const sectionBlock = read('components/PersonalForecastFeed/ForecastSectionBlock.tsx');
    const forecastStyles = read('styles/personalForecastFeed.css');

    expect(dashboard).toContain('const storySections = useMemo(');
    expect(dashboard).toContain('[forecast.overview, ...forecast.sections]');
    expect(dashboard).toContain("activePeriod === 'day'");
    expect(dashboard).toContain('<TodayEditorialFeed');
    expect(dashboard).toContain('forecast-period-editorial-feed');
    expect(dashboard).toContain('data-forecast-period={activePeriod}');
    expect(dashboard).toContain('storySections.map((section)');
    expect(dashboard).toContain('<ForecastSectionBlock');
    expect(sectionBlock).toContain('forecast-feed-story-fragment');
    expect(forecastStyles).toContain('.forecast-period-editorial-feed');
    expect(forecastStyles).toContain('background: transparent;');
    expect(dashboard).not.toContain('AiPersonalHoroscopeReading');
  });

  it('requires the saved natal chart before loading personal forecast content', () => {
    const dashboard = read('views/Dashboard.tsx');
    const service = read('services/personalForecastService.ts');

    expect(dashboard).toContain('hasNatalChart(profile, {');
    expect(dashboard).toContain('if (!hasChart || !chartData)');
    expect(dashboard).toContain('chartData,');
    expect(service).toContain('buildPersonalForecastChartFingerprint(input.chartData)');
  });

  it('uses one honest full-width loading and period-scoped retry state', () => {
    const dashboard = read('views/Dashboard.tsx');
    const forecastStyles = read('styles/personalForecastFeed.css');

    expect(dashboard).not.toContain('<ForecastEditorialSkeleton');
    expect(dashboard).toContain('forecast-feed-status--loading');
    expect(dashboard).toContain('forecast-feed-loading-label');
    expect(dashboard).toContain('aria-busy="true"');
    expect(dashboard).toContain('loadPeriod(activePeriod, { retry: true })');
    expect(forecastStyles).toContain('inline-size: min(100%, var(--forecast-editorial-width));');
    expect(forecastStyles).toContain('min-block-size: clamp(16rem, 50dvh, 30rem);');
    expect(forecastStyles).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('reserves the shared top bar and a separate profile action', () => {
    const dashboard = read('views/Dashboard.tsx');
    const forecastStyles = read('styles/personalForecastFeed.css');

    expect(dashboard).toContain("title={language === 'ru' ? 'Твой Гороскоп' : 'Your Horoscope'}");
    expect(dashboard).toContain('className="app-top-bar-action today-profile-button"');
    expect(dashboard).toContain('aria-haspopup="dialog"');
    expect(forecastStyles).toContain('.forecast-feed-page .home-top');
    expect(forecastStyles).toContain('padding: 0;');
  });

  it('does not expose internal categories or the generated closing as UI labels', () => {
    const dashboard = read('views/Dashboard.tsx');
    const today = read('components/PersonalForecastFeed/TodayEditorialFeed.tsx');
    const sectionBlock = read('components/PersonalForecastFeed/ForecastSectionBlock.tsx');

    expect(dashboard).not.toMatch(/Love|Work|Money/);
    expect(sectionBlock).toContain('resolveVisibleForecastTitle');
    expect(sectionBlock).not.toContain('{section.kind}');
    expect(sectionBlock).not.toContain('{section.sourceTopicKey}');
    expect(today).not.toContain('Вывод и совет');
    expect(dashboard).not.toContain('Вывод и совет');
  });
});
