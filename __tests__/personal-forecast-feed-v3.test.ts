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

  it('passes profile and period context while keeping anti-repeat history on the current prompt version', () => {
    const voice = read('lib/aiPersonalHoroscopeVoice.ts');
    const cache = read('lib/personalForecastCache.ts');
    const history = read('lib/aiPersonalHoroscopeHistory.ts');
    const route = read('pages/api/content/forecast/personal.ts');

    expect(voice).toContain('buildAiPersonalHoroscopeProfileSnapshot');
    expect(voice).toContain('previousForecasts');
    expect(voice).toContain('.slice(0, 8)');
    expect(cache).toContain('loadPreviousAiPersonalHoroscopes(identity.userId, 15)');
    expect(history).toContain('AND prompt_version = $2');
    expect(history).toContain('LIMIT $3');
    expect(history).toContain("content_variant IN ('daily', 'weekly', 'monthly')");
    expect(voice).not.toContain('themeKeywords');
    expect(voice).not.toContain('adviceKeywords');
    expect(voice).not.toContain('editorial_brief');
    expect(voice).not.toContain('previous_attempt');
    expect(route).not.toContain('chartData');
    expect(route).not.toContain('chartId');
  });

  it('uses Luna strict JSON with only opening forecast and 2-3 closing lines', () => {
    const generation = read('lib/aiPersonalHoroscopeGeneration.ts');
    const voice = read('lib/aiPersonalHoroscopeVoice.ts');
    const responses = read('lib/openaiResponses.ts');

    expect(generation).toContain('createLunaStructuredResponse');
    expect(generation).toContain('readAiPersonalHoroscopePayload(parsed, input.period)');
    expect(voice).toContain("required: ['opening', 'forecast', 'advice']");
    expect(voice).toContain('minItems: 2');
    expect(voice).toContain('maxItems: 3');
    expect(responses).toContain("type: 'json_schema'");
    expect(responses).toContain('strict: true');
  });

  it('uses a lean example-led voice prompt and a large Russian gold corpus', () => {
    const voice = read('lib/aiPersonalHoroscopeVoice.ts');
    const fewShot = read('lib/aiPersonalHoroscopeFewShot.ts');
    const generation = read('lib/aiPersonalHoroscopeGeneration.ts');

    expect(voice).toContain('настоящего личного гороскопа-прогноза');
    expect(voice).toContain('простыми разговорными словами, прямо, точно, уверенно и с характером');
    expect(voice).toContain('opening — отдельная короткая ударная реплика');
    expect(voice).toContain('нет астрологических терминов и объяснений, психологии, терапии, self-help, коучинга, псевдокоучинга');
    expect(voice).toContain('forecast: ровно 2 предложения');
    expect(voice).toContain('forecast: ровно 3 предложения');
    expect(voice).toContain('forecast: ровно 4 предложения');
    expect(voice).toContain('buildAiPersonalHoroscopeFewShotBlock');
    expect(fewShot).toContain('ЭТАЛОННЫЕ ПРИМЕРЫ');
    expect(fewShot).toContain("'INPUT'");
    expect(fewShot).toContain("'OUTPUT'");
    expect(fewShot).toContain('Скука сегодня идёт мимо');
    expect(fewShot).toContain('Фотографий станет заметно больше');
    expect((fewShot.match(/language: 'ru', period: '(?:day|week|month)'/gu) || []).length).toBe(21);
    expect(generation).toContain("if (period === 'day') return 1_200");
    expect(generation).not.toContain('repairHints');
  });

  it('bumps the direct prompt contract so old cached copy is not reused', () => {
    const contract = read('lib/aiPersonalHoroscope.ts');

    expect(contract).toContain("AI_PERSONAL_HOROSCOPE_VERSION = 'ai-personal-horoscope-v6'");
    expect(contract).toContain("AI_PERSONAL_HOROSCOPE_PROMPT_VERSION = 'ai-personal-horoscope.gold-examples.v4'");
    expect(contract).toContain("AI_PERSONAL_HOROSCOPE_CONTRACT_VERSION = 'ai-personal-horoscope-direct-v4'");
    expect(contract).toContain("AI_PERSONAL_HOROSCOPE_CACHE_VERSION = 'ai-personal-horoscope-history-current-v4'");
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
