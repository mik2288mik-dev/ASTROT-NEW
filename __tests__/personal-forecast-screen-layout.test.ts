import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('AI personal horoscope screen layout', () => {
  it('keeps the selected period and date in the shared personal horoscope header', () => {
    const dashboard = read('views/Dashboard.tsx');

    expect(dashboard).toContain('resolveRequestedPersonalForecastPeriod(requestedPeriod)');
    expect(dashboard).toContain("day: language === 'ru' ? 'Сегодня' : 'Today'");
    expect(dashboard).toContain('subtitle={activePeriodTitle}');
    expect(dashboard).toContain('activeDateValue');
    expect(dashboard).toContain('<time');
    expect(dashboard).not.toContain('forecast-feed-period-tabs');
    expect(dashboard).not.toContain('FreshTabs');
  });

  it('renders Today Week and Month through one AI horoscope composition', () => {
    const dashboard = read('views/Dashboard.tsx');
    const reading = read('components/PersonalForecastFeed/AiPersonalHoroscopeReading.tsx');
    const styles = read('styles/aiPersonalHoroscope.css');

    expect(dashboard).toContain('<AiPersonalHoroscopeReading');
    expect(dashboard).not.toContain('TodayEditorialFeed');
    expect(dashboard).not.toContain('ForecastSectionBlock');
    expect(reading).toContain('readAiPersonalHoroscopeReading');
    expect(reading).toContain('ai-personal-horoscope-opening');
    expect(reading).toContain('ai-personal-horoscope-forecast');
    expect(reading).toContain('ai-personal-horoscope-advice');
    expect(styles).toContain('background: #ffffff;');
  });

  it('does not require a natal chart to load or render the personal horoscope', () => {
    const dashboard = read('views/Dashboard.tsx');
    const service = read('services/personalForecastService.ts');

    expect(dashboard).not.toContain('hasNatalChart');
    expect(dashboard).not.toContain('Добавь данные рождения');
    expect(dashboard).not.toContain('buildPersonalForecastChartFingerprint');
    expect(service).not.toContain('buildPersonalForecastChartFingerprint');
    expect(service).not.toContain('createPersonalForecastDeliveryFallback');
    expect(service).toContain('AI_PERSONAL_HOROSCOPE_VERSION');
  });

  it('keeps one honest loading and retry state for each AI period', () => {
    const dashboard = read('views/Dashboard.tsx');

    expect(dashboard).toContain('forecast-feed-status--loading');
    expect(dashboard).toContain('forecast-feed-loading-label');
    expect(dashboard).toContain('aria-busy="true"');
    expect(dashboard).toContain('loadPeriod(activePeriod, { retry: true })');
    expect(dashboard).not.toContain('<ForecastEditorialSkeleton');
  });

  it('does not expose old astrology evidence, topic categories or forecast questions', () => {
    const dashboard = read('views/Dashboard.tsx');
    const reading = read('components/PersonalForecastFeed/AiPersonalHoroscopeReading.tsx');

    for (const source of [dashboard, reading]) {
      expect(source).not.toContain('inlineAstroAccent');
      expect(source).not.toContain('explanationAnchors');
      expect(source).not.toContain('ForecastQuestions');
      expect(source).not.toMatch(/Love|Work|Money/);
    }
  });
});
