import fs from 'fs';
import path from 'path';
import {
  PERSONAL_FORECAST_REFERENCE_EXAMPLES_RU,
  renderPersonalForecastReferenceExamples,
} from '../lib/personalForecastExamples';
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
      const periodExamples = PERSONAL_FORECAST_REFERENCE_EXAMPLES_RU
        .filter((example) => example.period === period);
      const rendered = renderPersonalForecastReferenceExamples('ru', period);
      expect(periodExamples.length).toBeGreaterThan(0);
      expect(rendered.match(/<forecast_example_input>/g)).toHaveLength(periodExamples.length);
      expect(rendered.match(/<forecast_example_output>/g)).toHaveLength(periodExamples.length);
      expect(rendered).toContain('"reference_scope": "voice_and_structure_only"');
      expect(rendered).toContain('"grammatical_gender": "unspecified"');
      expect(rendered).toContain('"title"');
      expect(rendered).toContain('"forecast"');
      expect(rendered).toContain('"closing"');
      expect(rendered).not.toContain('"punchline"');
      for (const forbidden of [
        '"name"', '"current_date"', '"period_start"', '"period_end"',
        '"timezone"', '"personal_profile"',
      ]) {
        expect(rendered).not.toContain(forbidden);
      }
      const pairs = [...rendered.matchAll(/<forecast_example_input>\n([\s\S]*?)\n<\/forecast_example_input>\n<forecast_example_output>\n([\s\S]*?)\n<\/forecast_example_output>/g)];
      expect(pairs).toHaveLength(3);
      pairs.forEach((pair, index) => {
        const input = JSON.parse(pair[1]);
        const output = JSON.parse(pair[2]);
        expect(input.astrologer_brief).toEqual(periodExamples[index].input.astrologer_brief);
        expect(input.astrologer_brief.observations.length).toBeGreaterThanOrEqual(2);
        expect(input.astrologer_brief.observations.length).toBeLessThanOrEqual(4);
        expect(input.astrologer_brief).not.toHaveProperty('situation');
        expect(input.astrologer_brief).not.toHaveProperty('turn');
        expect(input.astrologer_brief).not.toHaveProperty('outcome');
        expect(output).toEqual(periodExamples[index].output);
        expect(Object.keys(output)).toEqual(['title', 'forecast', 'closing']);
      });
    }
  });
});
