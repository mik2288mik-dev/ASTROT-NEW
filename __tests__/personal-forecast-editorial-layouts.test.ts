import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('AI personal horoscope editorial layout', () => {
  it('uses one white composition for Today, Week, and Month', () => {
    const dashboard = read('views/Dashboard.tsx');
    const reading = read('components/PersonalForecastFeed/AiPersonalHoroscopeReading.tsx');
    const styles = read('styles/aiPersonalHoroscope.css');

    expect(dashboard).toContain('<AiPersonalHoroscopeReading');
    expect(dashboard).toContain("const FORECAST_PERIODS: readonly PersonalForecastPeriod[] = ['day', 'week', 'month'];");
    expect(reading).toContain('data-ai-personal-horoscope="true"');
    expect(reading).toContain('data-period={forecast.period}');
    expect(styles).toContain('.ai-personal-horoscope-reading');
    expect(styles).toContain('background: #ffffff;');
  });

  it('renders one centered opening before the forecast', () => {
    const reading = read('components/PersonalForecastFeed/AiPersonalHoroscopeReading.tsx');
    const styles = read('styles/aiPersonalHoroscope.css');

    const openingIndex = reading.indexOf('ai-personal-horoscope-opening');
    const forecastIndex = reading.indexOf('ai-personal-horoscope-forecast');
    expect(openingIndex).toBeGreaterThan(-1);
    expect(forecastIndex).toBeGreaterThan(openingIndex);
    expect(styles).toContain('place-items: center;');
    expect(styles).toContain('text-align: center;');
    expect(styles).toContain('text-wrap: balance;');
  });

  it('keeps the forecast as readable prose without cards, images, or astrology details', () => {
    const reading = read('components/PersonalForecastFeed/AiPersonalHoroscopeReading.tsx');
    const styles = read('styles/aiPersonalHoroscope.css');

    expect(reading).toContain('<p>{reading.forecast}</p>');
    expect(reading).not.toContain('EditorialSticker');
    expect(reading).not.toContain('EditorialForecastVisual');
    expect(reading).not.toContain('AstrologyDetailsToggle');
    expect(reading).not.toContain('inlineAstroAccent');
    expect(reading).not.toContain('explanationAnchors');
    expect(styles).toContain('line-height: 1.72;');
    expect(styles).toContain('white-space: pre-line;');
  });

  it('renders two or three concrete advice rows after a restrained divider', () => {
    const reading = read('components/PersonalForecastFeed/AiPersonalHoroscopeReading.tsx');
    const styles = read('styles/aiPersonalHoroscope.css');

    expect(reading).toContain('ai-personal-horoscope-divider');
    expect(reading).toContain('<ol className="ai-personal-horoscope-advice"');
    expect(reading).toContain("String(index + 1).padStart(2, '0')");
    expect(styles).toContain('grid-template-columns: 2.25rem minmax(0, 1fr);');
    expect(styles).toContain('border-bottom: 1px solid #e7e7e4;');
  });

  it('keeps the active personal horoscope free of the removed diary visual engine', () => {
    const dashboard = read('views/Dashboard.tsx');
    const reading = read('components/PersonalForecastFeed/AiPersonalHoroscopeReading.tsx');

    for (const source of [dashboard, reading]) {
      expect(source).not.toContain('resolveDiaryTodayVisualPlan');
      expect(source).not.toContain('resolveDiaryEditorialPauses');
      expect(source).not.toContain('resolvePersonalForecastVisuals');
      expect(source).not.toContain('TodayEditorialFeed');
      expect(source).not.toContain('ForecastSectionBlock');
    }
  });

  it('keeps narrow screens inside safe horizontal bounds', () => {
    const styles = read('styles/aiPersonalHoroscope.css');

    expect(styles).toContain('env(safe-area-inset-left, 0px)');
    expect(styles).toContain('env(safe-area-inset-right, 0px)');
    expect(styles).toContain('var(--tg-content-safe-area-inset-left, 0px)');
    expect(styles).toContain('overflow-wrap: anywhere;');
    expect(styles).toContain('@media (max-width: 380px)');
  });
});
