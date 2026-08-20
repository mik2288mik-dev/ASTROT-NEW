import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const exists = (file: string) => fs.existsSync(path.join(ROOT, file));

describe('personal forecast Luna architecture', () => {
  it('keeps day, week, and month as controlled diary tabs without forecast questions', () => {
    const dashboard = read('views/Dashboard.tsx');

    expect(dashboard).toContain("const FORECAST_PERIODS: readonly PersonalForecastPeriod[] = ['day', 'week', 'month'];");
    expect(dashboard).toContain('requestedPeriod?: PersonalForecastPeriod;');
    expect(dashboard).toContain("const activePeriod: PersonalForecastPeriod = requestedPeriod || 'day';");
    expect(dashboard).toContain('className="today-period-navigation"');
    expect(dashboard).toContain('role="tablist"');
    expect(dashboard).toContain('onPeriodChange?.(period)');
    expect(dashboard).toContain('id="today-period-panel"');
    expect(dashboard).not.toContain('<ForecastQuestions');
    expect(exists('components/PersonalForecastFeed/ForecastQuestions.tsx')).toBe(false);
  });

  it('uses PersonalForecastPackage end to end and leaves the legacy AI horoscope modules inactive', () => {
    const dashboard = read('views/Dashboard.tsx');
    const activeFiles = [
      dashboard,
      read('services/personalForecastService.ts'),
      read('pages/api/content/forecast/personal.ts'),
      read('lib/personalForecastCache.ts'),
      read('lib/personalForecastGeneration.ts'),
    ].join('\n');

    expect(activeFiles).toContain('PersonalForecastPackage');
    expect(activeFiles).toContain('generatePersonalForecastPackage');
    expect(activeFiles).not.toContain('AiPersonalHoroscope');
    expect(activeFiles).not.toContain('aiPersonalHoroscope');
    expect(dashboard).toContain('<TodayEditorialFeed');
    expect(dashboard).toContain('sections={storySections}');
    expect(dashboard).toContain('<ForecastSectionBlock');
  });

  it('uses the saved natal chart and previous 15 same-user readings as private writer context', () => {
    const generation = read('lib/personalForecastGeneration.ts');
    const cache = read('lib/personalForecastCache.ts');
    const route = read('pages/api/content/forecast/personal.ts');

    expect(generation).toContain('buildPersonalForecastNatalContext(input.chartData)');
    expect(generation).toContain('saved_natal_context: input.natalContext');
    expect(cache).toContain('const PERSONAL_FORECAST_HISTORY_LIMIT = 15');
    expect(cache).toContain('WHERE user_id = $1');
    expect(cache).toContain('chartData: identity.common.chartData');
    expect(cache).toContain('input.ctx.chartId');
    expect(route).toContain('ctx.chartData');
    expect(route).toContain('const cacheInput = { ctx, period, periodKey };');
    expect(generation).not.toContain('calculatePersonalForecastEvidence(');
  });

  it('uses strict Luna structured output without provider storage and keeps sign horoscopes separate', () => {
    const generation = read('lib/personalForecastGeneration.ts');
    const responses = read('lib/openaiResponses.ts');
    const zodiac = read('views/v2/HoroscopeReader.tsx');

    expect(generation).toContain('createLunaStructuredResponse');
    expect(generation).toContain('PERSONAL_FORECAST_RESPONSE_SCHEMA');
    expect(generation).toContain('store: false');
    expect(responses).toContain("type: 'json_schema'");
    expect(responses).toContain('strict: true');
    expect(zodiac).toContain('getCachedWeeklySignHoroscope');
    expect(zodiac).toContain('getCachedMonthlySignHoroscope');
  });

  it('ships period-filtered editorial references without exposing their service metadata', () => {
    const examples = read('lib/personalForecastExamples.ts');
    const generation = read('lib/personalForecastGeneration.ts');

    expect(examples).toContain('PERSONAL_FORECAST_REFERENCE_EXAMPLES_RU');
    expect(examples).toContain(".filter((example) => example.period === period)");
    expect(examples).toContain('<forecast_reference_examples>');
    expect(generation).toContain('renderPersonalForecastReferenceExamples(language, period)');
    expect(generation).toContain('closing: {');
  });

  it('appends the strict closing to the story without a visible advice heading', () => {
    const generation = read('lib/personalForecastGeneration.ts');
    const renderer = read('components/PersonalForecastFeed/TodayEditorialFeed.tsx');
    const dashboard = read('views/Dashboard.tsx');

    expect(generation).toContain('joinForecastBodyAndClosing');
    expect(generation).toContain('closing duplicates the final story body');
    expect(renderer).not.toContain('Вывод и совет');
    expect(dashboard).not.toContain('Вывод и совет');
  });

  it('starts missing forecasts in the background after the foreground period loads', () => {
    const service = read('services/personalForecastService.ts');

    expect(service).toContain('scheduleStartupPrewarm');
    expect(service).toContain("? ['day', 'week', 'month']");
    expect(service).toContain('background: true');
    expect(service).toContain('maxInProgressRetries: 60');
  });
});
