import fs from 'fs';
import path from 'path';
import { buildPersonalForecastPrewarmTargets } from '../lib/personalForecastPrewarm';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('personal horoscope startup generation', () => {
  it('starts missing forecasts after the first foreground load without changing the visible Dashboard', () => {
    const dashboard = read('views/Dashboard.tsx');
    const service = read('services/personalForecastService.ts');

    expect(dashboard).toContain('loadPeriod(activePeriod);');
    expect(dashboard).not.toContain('prewarmUserContent');
    expect(service).toContain('scheduleStartupPrewarm');
    expect(service).toContain('if (!input.options?.background) {');
    expect(service).toContain('profile: input.profile');
    expect(service).toContain('chartData: input.chartData');
    expect(service).toContain('chartId: input.chartId');
    expect(service).toContain('background: true');
  });

  it('generates Today Week and Month for Premium and only Today for Free', () => {
    const service = read('services/personalForecastService.ts');

    expect(service).toContain("? ['day', 'week', 'month']");
    expect(service).toContain(": ['day'];");
    expect(service).toContain('for (const period of periods)');
  });

  it('does not recurse when the background request finishes', () => {
    const service = read('services/personalForecastService.ts');

    expect(service).toContain('background?: boolean;');
    expect(service).toContain('if (!input.options?.background) {');
    expect(service).toContain('scheduleStartupPrewarm({');
    expect(service).toContain('maxInProgressRetries: 60');
  });

  it('keeps the unrelated server-side scheduler disabled for this product', () => {
    const ordinary = buildPersonalForecastPrewarmTargets(
      new Date('2026-07-15T09:00:00.000Z'),
      'Europe/Moscow',
    );
    expect(ordinary).toEqual([]);
  });
});
