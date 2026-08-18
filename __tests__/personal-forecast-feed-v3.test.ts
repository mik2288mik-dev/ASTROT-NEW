import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const exists = (file: string) => fs.existsSync(path.join(ROOT, file));

describe('direct personal horoscope Luna architecture', () => {
  it('keeps day, week, and month as drawer-controlled periods without forecast questions', () => {
    const dashboard = read('views/Dashboard.tsx');

    expect(dashboard).toContain("const FORECAST_PERIODS: readonly PersonalForecastPeriod[] = ['day', 'week', 'month'];");
    expect(dashboard).toContain('requestedPeriod?: PersonalForecastPeriod;');
    expect(dashboard).toContain('resolveRequestedPersonalForecastPeriod(requestedPeriod)');
    expect(dashboard).toContain('loadPeriod(activePeriod);');
    expect(dashboard).not.toContain('<ForecastQuestions');
    expect(exists('components/PersonalForecastFeed/ForecastQuestions.tsx')).toBe(false);
  });

  it('uses previous readings only as compact anti-repeat memory in the prompt', () => {
    const voice = read('lib/aiPersonalHoroscopeVoice.ts');
    const cache = read('lib/personalForecastCache.ts');
    const history = read('lib/aiPersonalHoroscopeHistory.ts');
    const route = read('pages/api/content/forecast/personal.ts');

    expect(voice).toContain('compactHistory');
    expect(voice).toContain('recentOpenings');
    expect(voice).toContain('recentClosings');
    expect(cache).toContain('loadPreviousAiPersonalHoroscopes(identity.userId, 15)');
    expect(history).toContain("content_variant IN ('daily', 'weekly', 'monthly')");
    expect(route).not.toContain('chartData');
    expect(route).not.toContain('chartId');
  });

  it('uses Luna strict JSON with concise period-specific output validation', () => {
    const generation = read('lib/aiPersonalHoroscopeGeneration.ts');
    const voice = read('lib/aiPersonalHoroscopeVoice.ts');
    const responses = read('lib/openaiResponses.ts');

    expect(generation).toContain('createLunaStructuredResponse');
    expect(generation).toContain("verbosity: 'low'");
    expect(generation).toContain('readAiPersonalHoroscopePayload(parsed, input.period, language)');
    expect(voice).toContain("required: ['opening', 'forecast', 'advice']");
    expect(voice).toContain('openingMaxWords: 10');
    expect(voice).toContain('forecastMaxWords: 55');
    expect(voice).toContain('forecastMaxWords: 90');
    expect(voice).toContain('forecastMaxWords: 130');
    expect(responses).toContain("type: 'json_schema'");
    expect(responses).toContain('strict: true');
  });

  it('uses a clean instruction hierarchy plus period-specific INPUT -> OUTPUT examples', () => {
    const voice = read('lib/aiPersonalHoroscopeVoice.ts');
    const fewShot = read('lib/aiPersonalHoroscopeFewShot.ts');

    expect(voice).toContain('IDENTITY');
    expect(voice).toContain('TASK');
    expect(voice).toContain('VOICE TARGET');
    expect(voice).toContain('CONTENT TARGET');
    expect(voice).toContain('OUTPUT CONTRACT');
    expect(voice).toContain('Живой человек. Прямо, точно, уверенно.');
    expect(voice).toContain('именно прогноз');
    expect(fewShot).toContain('ЭТАЛОННЫЕ ПРИМЕРЫ');
    expect(fewShot).toContain("'INPUT'");
    expect(fewShot).toContain("'OUTPUT'");
    expect(fewShot).toContain('Скромность сегодня можно оставить дома.');
    expect(fewShot).toContain('Хорошая компания — тоже серьёзный план.');
    expect(fewShot).not.toContain('День располагает');
    expect(fewShot).not.toContain('полезно решить');
  });

  it('invalidates the server prompt cache after the voice rewrite', () => {
    const cache = read('lib/personalForecastCache.ts');
    expect(cache).toContain("PERSONAL_HOROSCOPE_PROMPT_CACHE_VARIANT = 'few-shot-v2'");
  });

  it('starts missing forecasts in the background after the first foreground load', () => {
    const service = read('services/personalForecastService.ts');

    expect(service).toContain('scheduleStartupPrewarm');
    expect(service).toContain("? ['day', 'week', 'month']");
    expect(service).toContain('background: true');
    expect(service).toContain('if (!input.options?.background) scheduleStartupPrewarm(input.profile);');
  });

  it('renders the generated fields directly without old editorial transport', () => {
    const renderer = read('components/PersonalForecastFeed/AiPersonalHoroscopeReading.tsx');
    const activeFiles = [
      'views/Dashboard.tsx',
      'services/personalForecastService.ts',
      'pages/api/content/forecast/personal.ts',
      'lib/personalForecastCache.ts',
      'lib/aiPersonalHoroscopeGeneration.ts',
      'components/PersonalForecastFeed/AiPersonalHoroscopeReading.tsx',
    ].map(read).join('\n');

    expect(renderer).toContain('reading.opening');
    expect(renderer).toContain('reading.forecast');
    expect(renderer).toContain('reading.advice');
    expect(activeFiles).not.toContain('PersonalForecastPackage');
    expect(activeFiles).not.toContain('semanticFingerprint');
    expect(activeFiles).not.toContain('explanationAnchors');
  });
});
