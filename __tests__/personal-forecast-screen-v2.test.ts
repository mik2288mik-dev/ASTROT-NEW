import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('personal forecast screen V2 wiring', () => {
  it('Dashboard uses one personal contract for all periods and no Zodiac forecasts', () => {
    const source = read('views/Dashboard.tsx');
    expect(source).toContain("type PersonalForecastPeriod");
    expect(source).toContain("loadPersonalForecast");
    expect(source).toContain("readLocalPersonalForecast");
    expect(source).toContain('FIXED_FORECAST_TOPIC_KEYS');
    expect(source).not.toMatch(/DailyCanvas|periodExtras|ensurePeriodExtras/);
    expect(source).not.toMatch(/SignHoroscope|selectedSign|sunSignFromDate/);
  });

  it('renders card, reading, explanation and exact evidence as separate layers', () => {
    const source = read('views/PersonalForecastScreen.tsx');
    expect(source).toContain('text?.card');
    expect(source).toContain('text.reading');
    expect(source).toContain('text.astrology.explanation');
    expect(source).toContain("forecast.evidence[id]");
    expect(source).toContain('Показать расчёт');
  });

  it('startup does not own or await personal forecast generation', () => {
    const source = read('App.tsx');
    expect(source).not.toMatch(/DailyCanvas|loadHumanDailyPackage|prepareStartupDailyPackage/);
    expect(source).toContain("mode: 'cache-only'");
    expect(source).toContain("mode: 'generate-missing'");
    expect(source).toContain('void prewarmUserContent');
  });

  it('keeps the separate Zodiac system intact', () => {
    const zodiac = read('views/v2/HoroscopeReader.tsx');
    expect(zodiac).toContain('getCachedWeeklySignHoroscope');
    expect(zodiac).toContain('ensureWeeklySignHoroscope');
    expect(zodiac).toContain('getCachedMonthlySignHoroscope');
    expect(zodiac).toContain('ensureMonthlySignHoroscope');
  });

  it('has no working imports of the incompatible personal systems', () => {
    const sourceFiles = [
      'App.tsx',
      'views/Dashboard.tsx',
      'views/PersonalForecastScreen.tsx',
      'services/contentPrewarmService.ts',
      'lib/personalForecastPrewarm.ts',
    ].map(read).join('\n');
    expect(sourceFiles).not.toMatch(/DailyCanvas|periodExtras|human-daily/);
  });
});
