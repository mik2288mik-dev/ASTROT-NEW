import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..');

describe('loading screen', () => {
  it('uses full-screen splash that fills the viewport', () => {
    const source = fs.readFileSync(path.join(ROOT, 'components/ui/Loading.tsx'), 'utf8');
    expect(source).toContain('/lumiastart.webp');
    expect(source).toContain('object-cover');
    expect(source).toContain('object-top');
    expect(source).toContain('absolute inset-0 h-full w-full');
    expect(source).not.toContain('object-contain');
    expect(source).toContain('min-h-[100dvh]');
    expect(source).not.toContain('LumiaLogo');
    expect(source).not.toContain('loading-main.webp');
  });

  it('contains only one progress indicator', () => {
    const source = fs.readFileSync(path.join(ROOT, 'components/ui/Loading.tsx'), 'utf8');
    const barTracks = source.match(/h-0\.5/g) ?? [];
    expect(barTracks.length).toBe(1);
  });

  it('shows a numeric progress percent under the bar', () => {
    const source = fs.readFileSync(path.join(ROOT, 'components/ui/Loading.tsx'), 'utf8');
    expect(source).toContain('progressPercent');
    expect(source).toContain('{progressPercent}%');
    expect(source).toContain('tabular-nums');
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
    const webp = path.join(ROOT, 'public', 'lumiastart.webp');
    expect(fs.existsSync(webp)).toBe(true);
    expect(fs.statSync(webp).size).toBeGreaterThan(0);
  });
});
