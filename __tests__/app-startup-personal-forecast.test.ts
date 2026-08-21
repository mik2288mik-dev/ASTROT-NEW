import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');

describe('application startup forecast readiness', () => {
  it('starts personal forecasts in the background without waiting for Luna or the natal chart', () => {
    const app = fs.readFileSync(path.join(ROOT, 'App.tsx'), 'utf8');
    expect(app).toContain('void load(\'day\')');
    expect(app).toContain("Promise.allSettled(['week', 'month']");
    expect(app).not.toContain('await prepareStartupPersonalForecasts(');
    expect(app).toContain('void loadPrimaryChartOnce(updatedProfile)');
    expect(app).not.toContain('_targetChart');
    expect(app).not.toContain('_targetChartId');
  });
});
