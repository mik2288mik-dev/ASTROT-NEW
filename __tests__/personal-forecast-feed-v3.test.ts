import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const exists = (file: string) => fs.existsSync(path.join(ROOT, file));

describe('personal horoscope Luna architecture', () => {
  it('keeps day, week, and month as drawer-controlled periods without forecast questions', () => {
    const dashboard = read('views/Dashboard.tsx');

    expect(dashboard).toContain("const FORECAST_PERIODS: readonly PersonalForecastPeriod[] = ['day', 'week', 'month'];");
    expect(dashboard).toContain('requestedPeriod?: PersonalForecastPeriod;');
    expect(dashboard).toContain('resolveRequestedPersonalForecastPeriod(requestedPeriod)');
    expect(dashboard).toContain('loadPeriod(activePeriod);');
    expect(dashboard).not.toContain('pendingPeriodRef');
    expect(dashboard).not.toContain('forecast-feed-period-tabs');
    expect(dashboard).not.toContain('<ForecastQuestions');
    expect(exists('components/PersonalForecastFeed/ForecastQuestions.tsx')).toBe(false);
  });

  it('uses only the user profile, period, previous horoscopes and dialogue as writer context', () => {
    const voice = read('lib/aiPersonalHoroscopeVoice.ts');
    const cache = read('lib/personalForecastCache.ts');
    const route = read('pages/api/content/forecast/personal.ts');

    expect(voice).toContain('buildAiPersonalHoroscopeProfileSnapshot');
    expect(voice).toContain('recentForecasts');
    expect(voice).toContain('conversationMemory');
    expect(cache).toContain('generateAiPersonalHoroscopePackage');
    expect(cache).not.toContain('generatePersonalForecastPackage');
    expect(cache).not.toContain('buildPersonalForecastChartFingerprint');
    expect(route).not.toContain('ensureValidContext');
    expect(route).not.toContain('chartData');
    expect(route).not.toContain('chartId');
  });

  it('uses Luna strict structured output and keeps the sign horoscope separate', () => {
    const generation = read('lib/aiPersonalHoroscopeGeneration.ts');
    const voice = read('lib/aiPersonalHoroscopeVoice.ts');
    const responses = read('lib/openaiResponses.ts');
    const zodiac = read('views/v2/HoroscopeReader.tsx');

    expect(generation).toContain('createLunaStructuredResponse');
    expect(generation).toContain('AI_PERSONAL_HOROSCOPE_RESPONSE_SCHEMA');
    expect(voice).toContain('opening');
    expect(voice).toContain('forecast');
    expect(voice).toContain('advice');
    expect(responses).toContain("type: 'json_schema'");
    expect(responses).toContain('strict: true');
    expect(zodiac).toContain("type Period = 'today';");
    expect(zodiac).toContain('getCachedDailySignHoroscope');
    expect(zodiac).not.toContain('getCachedWeeklySignHoroscope');
    expect(zodiac).not.toContain('getCachedMonthlySignHoroscope');
  });
});
