import fs from 'fs';
import path from 'path';
import { renderPersonalForecastReferenceExamples } from '../lib/personalForecastExamples';
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
    expect(generation).toContain('store: false');
    expect(generation).toContain('callStructuredWithBudgetRetry');
    for (const period of ['day', 'week', 'month'] as const) {
      const rendered = renderPersonalForecastReferenceExamples('ru', period);
      expect(rendered.match(/<forecast_example_input>/g)).toHaveLength(3);
      expect(rendered.match(/<forecast_example_output>/g)).toHaveLength(3);
      expect(rendered).toContain('"astrologer_brief"');
      expect(rendered).not.toContain('"personal_profile"');
    }
  });
});
