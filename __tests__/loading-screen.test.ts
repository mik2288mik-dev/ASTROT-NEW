import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..');

describe('loading screen', () => {
  it('uses full-screen splash without cropping', () => {
    const source = fs.readFileSync(path.join(ROOT, 'components/ui/Loading.tsx'), 'utf8');
    expect(source).toContain('/lumia_splash_text_updated_1440x3040.webp');
    expect(source).toContain('object-contain');
    expect(source).not.toContain('object-cover');
    expect(source).toContain('min-h-[100dvh]');
    expect(source).not.toContain('LumiaLogo');
    expect(source).not.toContain('loading-main.webp');
  });

  it('contains only one progress indicator', () => {
    const source = fs.readFileSync(path.join(ROOT, 'components/ui/Loading.tsx'), 'utf8');
    const barTracks = source.match(/h-0\.5/g) ?? [];
    expect(barTracks.length).toBe(1);
  });

  it('does not contain forbidden phrases in visible copy', () => {
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
  });

  it('loading splash asset exists in public', () => {
    const webp = path.join(ROOT, 'public', 'lumia_splash_text_updated_1440x3040.webp');
    expect(fs.existsSync(webp)).toBe(true);
    expect(fs.statSync(webp).size).toBeGreaterThan(0);
  });
});
