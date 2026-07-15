import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');

describe('App sky today background flow', () => {
  it('starts one non-blocking App-level request and passes the result to Dashboard', () => {
    const app = fs.readFileSync(path.join(ROOT, 'App.tsx'), 'utf8');
    expect(app).toContain('void getSkyToday(getMoscowTodayKey()).then((snapshot) => {');
    expect(app).toContain('if (!cancelled) setSkySnapshot(snapshot);');
    expect(app).toContain('skySnapshot={skySnapshot}');
    expect(app).not.toContain('await getSkyToday(getMoscowTodayKey())');
  });
});
