import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const exists = (file: string) => fs.existsSync(path.join(ROOT, file));

describe('simple personal horoscope Luna architecture', () => {
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

  it('uses only profile, period, current date and compact keyword memory', () => {
    const voice = read('lib/aiPersonalHoroscopeVoice.ts');
    const cache = read('lib/personalForecastCache.ts');
    const route = read('pages/api/content/forecast/personal.ts');

    expect(voice).toContain('buildAiPersonalHoroscopeProfileSnapshot');
    expect(voice).toContain('currentDate');
    expect(voice).toContain('recentMemory');
    expect(voice).not.toContain('editorial_brief');
    expect(voice).not.toContain('conversationMemory');
    expect(voice).not.toContain('previous_attempt');
    expect(cache).toContain('recentMemory');
    expect(cache).not.toContain('recentForecasts');
    expect(cache).not.toContain('loadAiPersonalHoroscopeDialogueMemory');
    expect(route).not.toContain('chartData');
    expect(route).not.toContain('chartId');
  });

  it('uses Luna strict JSON with only opening forecast and advice', () => {
    const generation = read('lib/aiPersonalHoroscopeGeneration.ts');
    const voice = read('lib/aiPersonalHoroscopeVoice.ts');
    const responses = read('lib/openaiResponses.ts');
    const zodiac = read('views/v2/HoroscopeReader.tsx');

    expect(generation).toContain('createLunaStructuredResponse');
    expect(generation).toContain('AI_PERSONAL_HOROSCOPE_RESPONSE_SCHEMA');
    expect(voice).toContain("required: ['opening', 'forecast', 'advice']");
    expect(voice).not.toContain("properties: {\n    memory:");
    expect(responses).toContain("type: 'json_schema'");
    expect(responses).toContain('strict: true');
    expect(zodiac).toContain("type Period = 'today';");
    expect(zodiac).toContain('getCachedDailySignHoroscope');
  });

  it('does not use PersonalForecastPackage or the old forecast contract as transport', () => {
    const activeFiles = [
      'views/Dashboard.tsx',
      'services/personalForecastService.ts',
      'pages/api/content/forecast/personal.ts',
      'lib/personalForecastCache.ts',
      'lib/aiPersonalHoroscopeGeneration.ts',
      'components/PersonalForecastFeed/AiPersonalHoroscopeReading.tsx',
    ].map(read).join('\n');

    expect(activeFiles).not.toContain('PersonalForecastPackage');
    expect(activeFiles).not.toContain("from './personalForecastContract'");
    expect(activeFiles).not.toContain("from '../lib/personalForecastContract'");
    expect(activeFiles).not.toContain('semanticFingerprint');
    expect(activeFiles).not.toContain('explanationAnchors');
    expect(activeFiles).not.toContain('semanticFactIds');
    expect(activeFiles).not.toContain('visualTag');
  });
});
