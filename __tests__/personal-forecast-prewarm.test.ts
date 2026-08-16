import fs from 'fs';
import path from 'path';
import { buildPersonalForecastPrewarmTargets } from '../lib/personalForecastPrewarm';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('personal horoscope on-demand generation', () => {
  it('does not trigger client prewarm from Dashboard', () => {
    const dashboard = read('views/Dashboard.tsx');
    expect(dashboard).toContain('loadPeriod(activePeriod);');
    expect(dashboard).not.toContain('prewarmUserContent');
    expect(dashboard).not.toContain('contentPrewarmService');
    expect(dashboard).not.toContain("mode: 'generate-missing'");
  });

  it('does not schedule server-side personal horoscope generation', () => {
    const ordinary = buildPersonalForecastPrewarmTargets(
      new Date('2026-07-15T09:00:00.000Z'),
      'Europe/Moscow',
    );
    expect(ordinary).toEqual([]);
    const boundary = buildPersonalForecastPrewarmTargets(
      new Date('2026-12-30T19:30:00.000Z'),
      'Europe/Moscow',
    );
    expect(boundary).toEqual([]);
  });

  it('keeps the dormant prewarm utility outside the active personal horoscope path', () => {
    const activePath = [
      read('views/Dashboard.tsx'),
      read('services/personalForecastService.ts'),
      read('pages/api/content/forecast/personal.ts'),
      read('lib/personalForecastCache.ts'),
      read('lib/aiPersonalHoroscopeGeneration.ts'),
    ].join('\n');
    expect(activePath).not.toContain('prewarmUserContent');
    expect(activePath).not.toContain('buildUserPrewarmPlan');
    expect(activePath).not.toContain('personal_forecast_week');
    expect(activePath).not.toContain('personal_forecast_month');
  });
});
