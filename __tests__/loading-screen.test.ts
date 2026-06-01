import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..');

describe('loading screen', () => {
  it('uses loading main image and a single progress bar', () => {
    const source = fs.readFileSync(path.join(ROOT, 'components/ui/Loading.tsx'), 'utf8');
    expect(source).toMatch(/loading-main\.webp|loading%20main\.png/);
    expect(source).not.toContain('LumiaLogo');
    expect(source).toContain('Загружаем LUMIA');
    const barMatches = source.match(/rounded-full bg-/g) ?? [];
    expect(barMatches.length).toBeLessThanOrEqual(2);
  });

  it('loading main asset exists in public', () => {
    const png = path.join(ROOT, 'public', 'loading main.png');
    expect(fs.existsSync(png)).toBe(true);
  });
});
