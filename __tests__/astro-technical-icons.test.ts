import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('newspaper infographic icon system', () => {
  it('keeps all required chart points in the shared planet icon component', () => {
    const source = read('components/icons/PlanetIcon.tsx');
    for (const key of ['lilith', 'desc', 'ic', 'north-node', 'south-node', 'chiron']) {
      expect(source).toContain(`'${key}'`);
    }
  });

  it('covers houses, aspects, transit and technical marks as monochrome SVG', () => {
    const source = read('components/icons/AstroTechnicalIcon.tsx');
    for (const key of [
      'house-', 'conjunction', 'opposition', 'trine', 'square', 'sextile',
      'quincunx', 'transit', 'retrograde', 'synastry', 'route',
    ]) {
      expect(source).toContain(key);
    }
    expect(source).toContain("stroke = 'currentColor'");
    expect(source).not.toContain('<img');
  });
});
