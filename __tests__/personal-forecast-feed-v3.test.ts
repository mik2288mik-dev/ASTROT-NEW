import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const exists = (file: string) => fs.existsSync(path.join(ROOT, file));

describe('personal forecast Luna architecture', () => {
  it('keeps day, week, and month as drawer-controlled diary periods without the retired forecast-question block', () => {
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

  it('uses the saved natal profile as the writer context, without recalculating period evidence', () => {
    const generation = read('lib/personalForecastGeneration.ts');
    const cache = read('lib/personalForecastCache.ts');

    expect(generation).toContain('buildPersonalForecastNatalContext');
    expect(generation).toContain('PERSONAL_FORECAST_PROFILE_EVIDENCE_ID');
    expect(generation).not.toContain('calculatePersonalForecastEvidence(');
    expect(cache).not.toContain('calculatePersonalForecastEvidence(');
  });

  it('uses Luna structured output and keeps the sign horoscope system separate', () => {
    const generation = read('lib/personalForecastGeneration.ts');
    const responses = read('lib/openaiResponses.ts');
    const zodiac = read('views/v2/HoroscopeReader.tsx');

    expect(generation).toContain('createLunaStructuredResponse');
    expect(generation).toContain('PERSONAL_FORECAST_RESPONSE_SCHEMA');
    expect(responses).toContain("type: 'json_schema'");
    expect(responses).toContain('strict: true');
    expect(zodiac).toContain("type Period = 'today';");
    expect(zodiac).toContain('getCachedDailySignHoroscope');
    expect(zodiac).not.toContain('getCachedWeeklySignHoroscope');
    expect(zodiac).not.toContain('getCachedMonthlySignHoroscope');
  });
});
