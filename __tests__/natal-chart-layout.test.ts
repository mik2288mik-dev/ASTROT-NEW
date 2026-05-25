import { readFileSync } from 'fs';
import path from 'path';

describe('NatalChart layout', () => {
  it('does not render the natal wheel or the old dark presentation viewer', () => {
    const source = readFileSync(path.join(process.cwd(), 'views', 'NatalChart.tsx'), 'utf8');

    expect(source).not.toContain('TrueNatalWheelHero');
    expect(source).not.toContain('NatalMapPresentation');
    expect(source).not.toContain('wheelSectionRef');
    expect(source).toContain('HumanReport');
  });
});
