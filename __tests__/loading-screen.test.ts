import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..');

describe('loading screen', () => {
  it('uses full-screen image background', () => {
    const source = fs.readFileSync(path.join(ROOT, 'components/ui/Loading.tsx'), 'utf8');
    expect(source).toMatch(/loading-main\.webp|loading%20main\.png/);
    expect(source).toContain('absolute inset-0');
    expect(source).toContain('object-cover');
    expect(source).toContain('min-h-[100dvh]');
    expect(source).not.toContain('object-contain');
    expect(source).not.toContain('LumiaLogo');
  });

  it('contains only one progress indicator', () => {
    const source = fs.readFileSync(path.join(ROOT, 'components/ui/Loading.tsx'), 'utf8');
    const barTracks = source.match(/h-0\.5/g) ?? [];
    expect(barTracks.length).toBe(1);
  });

  it('does not contain forbidden phrases', () => {
    const source = fs.readFileSync(path.join(ROOT, 'components/ui/Loading.tsx'), 'utf8');
    const forbidden = [
      /космическ/i,
      /энерги/i,
      /подключаем/i,
      /интерпретац/i,
      /Premium/i,
      /прогноз готовится/i,
    ];
    for (const pattern of forbidden) {
      expect(source).not.toMatch(pattern);
    }
    expect(source).toContain('Загружаем LUMIA');
  });

  it('loading main asset exists in public', () => {
    const png = path.join(ROOT, 'public', 'loading main.png');
    expect(fs.existsSync(png)).toBe(true);
  });
});
