import {
  ASK_LUMIA_STARS_COST,
  FORECAST_FULL_DAY_STARS_COST,
  HUMAN_DAILY_STARS_COST,
  HUMAN_PAID_STARS_COST,
  SYNASTRY_EXTENDED_STARS_COST,
} from '../lib/starsPricing';

describe('stars pricing shared constants', () => {
  it('exports canonical one-off Stars costs', () => {
    expect(FORECAST_FULL_DAY_STARS_COST).toBeGreaterThan(0);
    expect(ASK_LUMIA_STARS_COST).toBeGreaterThan(0);
    expect(SYNASTRY_EXTENDED_STARS_COST).toBeGreaterThan(0);
    expect(HUMAN_PAID_STARS_COST).toBe(300);
    expect(HUMAN_DAILY_STARS_COST).toBe(35);
  });

  it('Horoscope human layers use HUMAN_DAILY_STARS_COST instead of hardcoded 35', () => {
    const horoscopeSource = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'views', 'Horoscope.tsx'),
      'utf8'
    );
    expect(horoscopeSource).toContain('HUMAN_DAILY_STARS_COST');
    expect(horoscopeSource).not.toMatch(/love:\s*35/);
    expect(horoscopeSource).not.toMatch(/work_money:\s*35/);
  });
});
