import fs from 'fs';

describe('personal forecast API profile contract', () => {
  const route = fs.readFileSync('pages/api/content/forecast/personal.ts', 'utf8');
  it('authenticates the user and rejects a missing raw profile without reading a chart', () => {
    expect(route).toContain('requireAppUser(req, { allowGuest: true })');
    expect(route).toContain('PERSONAL_FORECAST_PROFILE_REQUIRED');
    for (const forbidden of ['ensureValidContext', 'requireSelfChart', 'chartData', 'chartId']) expect(route).not.toContain(forbidden);
  });
});
