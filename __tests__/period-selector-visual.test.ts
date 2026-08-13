import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('forecast period selector visual contract', () => {
  it('keeps Today, Week and Month in the diary drawer instead of adding screen tabs', () => {
    const dashboard = read('views/Dashboard.tsx');
    const drawer = read('components/lumia-ui/LumiaSideDrawer.tsx');

    expect(drawer).toContain('lumia-side-drawer-periods');
    expect(drawer).toContain('onSelectPeriod');
    expect(dashboard).not.toContain('home-period-tab-label');
    expect(dashboard).not.toContain('forecast-feed-period-tabs');
    expect(dashboard).not.toContain('onClick={() => selectPeriod');
  });
});
