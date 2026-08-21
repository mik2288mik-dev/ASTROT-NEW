import fs from 'fs';
import path from 'path';
const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('personal forecast raw-profile runtime', () => {
  it('has no natal calculation inputs in the active forecast chain', () => {
    const scope = [
      'lib/personalForecastGeneration.ts', 'lib/personalForecastCache.ts',
      'services/personalForecastService.ts', 'pages/api/content/forecast/personal.ts',
    ].map(read).join('\n');
    for (const forbidden of ['saved_natal_context', 'buildPersonalForecastNatalContext', 'chartData', 'chartId', 'NatalChartData', 'requireSelfChart']) {
      expect(scope).not.toContain(forbidden);
    }
  });

  it('keeps a single strict Luna runtime and period-specific few shots', () => {
    const generation = read('lib/personalForecastGeneration.ts');
    const examples = read('lib/personalForecastExamples.ts');
    expect(generation).toContain('store: false');
    expect(generation).toContain('createLunaStructuredResponse');
    expect(examples).toContain('.slice(0, 3)');
    expect(examples).toContain('<forecast_example_input>');
  });
});
