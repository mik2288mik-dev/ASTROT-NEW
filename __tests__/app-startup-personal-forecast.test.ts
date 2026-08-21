import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('application startup forecast readiness', () => {
  it('primes every accessible period without blocking profile startup on Luna', () => {
    const app = read('App.tsx');

    expect(app).toContain('loadPersonalForecast');
    expect(app).toContain('primeLocalPersonalForecast');
    expect(app).toContain('prepareStartupPersonalForecasts');
    expect(app).toContain("hasActivePremium(targetProfile) ? ['day', 'week', 'month'] : ['day']");
    expect(app).toContain('periods.forEach((period) => primeLocalPersonalForecast({');
    expect(app).toContain('await Promise.allSettled(periods.map');
    expect(app).toContain('await prepareStartupPersonalForecasts(');
    expect(app).toContain("'Preparing your horoscope'");
    expect(app).toContain("'Готовим твой гороскоп'");
    expect(app).not.toContain("new Error('PERSONAL_FORECAST_STARTUP_FAILED')");
  });
});
