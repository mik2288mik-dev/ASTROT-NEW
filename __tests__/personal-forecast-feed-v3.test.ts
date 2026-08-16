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

  it('passes the profile, date window and previous 15 full forecasts without keyword memory', () => {
    const voice = read('lib/aiPersonalHoroscopeVoice.ts');
    const cache = read('lib/personalForecastCache.ts');
    const history = read('lib/aiPersonalHoroscopeHistory.ts');
    const route = read('pages/api/content/forecast/personal.ts');

    expect(voice).toContain('buildAiPersonalHoroscopeProfileSnapshot');
    expect(voice).toContain('previousForecasts');
    expect(cache).toContain('loadPreviousAiPersonalHoroscopes(identity.userId, 15)');
    expect(history).toContain("LIMIT $2");
    expect(history).toContain("content_variant IN ('daily', 'weekly', 'monthly')");
    expect(voice).not.toContain('themeKeywords');
    expect(voice).not.toContain('adviceKeywords');
    expect(voice).not.toContain('editorial_brief');
    expect(voice).not.toContain('previous_attempt');
    expect(route).not.toContain('chartData');
    expect(route).not.toContain('chartId');
  });

  it('uses Luna strict JSON with only opening forecast and 2-3 advice', () => {
    const generation = read('lib/aiPersonalHoroscopeGeneration.ts');
    const voice = read('lib/aiPersonalHoroscopeVoice.ts');
    const responses = read('lib/openaiResponses.ts');

    expect(generation).toContain('createLunaStructuredResponse');
    expect(generation).toContain('readAiPersonalHoroscopePayload');
    expect(voice).toContain("required: ['opening', 'forecast', 'advice']");
    expect(voice).toContain('minItems: 2');
    expect(voice).toContain('maxItems: 3');
    expect(responses).toContain("type: 'json_schema'");
    expect(responses).toContain('strict: true');
  });

  it('contains the exact requested prompt and no editorial or stop-word layer', () => {
    const voice = read('lib/aiPersonalHoroscopeVoice.ts');
    const generation = read('lib/aiPersonalHoroscopeGeneration.ts');

    expect(voice).toContain('Ты АСТРОЛОГ');
    expect(voice).toContain('предыдущие 15 прогнозов');
    expect(voice).toContain('forecast — 3–6 предложений');
    expect(voice).toContain('advice — 2–3');
    expect(voice).toContain('родителей');
    expect(voice).not.toContain('RU_EMPTY_CLICHES');
    expect(voice).not.toContain('ASTROLOGY_OR_ESOTERICISM');
    expect(voice).not.toContain('MANAGER_WORD_PATTERN');
    expect(generation).not.toContain('validationErrors');
    expect(generation).not.toContain('repairHints');
  });

  it('starts missing forecasts in the background after the first foreground load', () => {
    const service = read('services/personalForecastService.ts');

    expect(service).toContain('scheduleStartupPrewarm');
    expect(service).toContain("? ['day', 'week', 'month']");
    expect(service).toContain('background: true');
    expect(service).toContain('if (!input.options?.background) scheduleStartupPrewarm(input.profile);');
  });

  it('renders advice without the old 01 02 03 markers', () => {
    const renderer = read('components/PersonalForecastFeed/AiPersonalHoroscopeReading.tsx');
    const css = read('styles/aiPersonalHoroscope.css');

    expect(renderer).not.toContain('padStart(2');
    expect(renderer).not.toContain('<ol');
    expect(renderer).toContain('className="ai-personal-horoscope-advice"');
    expect(css).not.toContain('grid-template-columns: 2.25rem');
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
    expect(activeFiles).not.toContain('semanticFingerprint');
    expect(activeFiles).not.toContain('explanationAnchors');
    expect(activeFiles).not.toContain('semanticFactIds');
    expect(activeFiles).not.toContain('visualTag');
  });
});
