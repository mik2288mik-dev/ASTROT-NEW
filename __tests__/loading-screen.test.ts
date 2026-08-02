import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..');

describe('loading screen', () => {
  it('renders a pure-white splash with the app name, no image', () => {
    const source = fs.readFileSync(path.join(ROOT, 'components/ui/Loading.tsx'), 'utf8');
    expect(source).toContain('Твой Гороскоп');
    expect(source).toContain("var(--app-canvas, #FFFFFF)");
    expect(source).not.toContain('#FBFAF6');
    expect(source).toContain('min-h-[100dvh]');
    expect(source).not.toContain('/lumiastart.webp');
    expect(source).not.toContain('/lumia-logo.png');
    expect(source).not.toContain('object-cover');
    expect(source).not.toContain('<img');
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

  it('no longer ships the removed Lumia splash/logo raster assets', () => {
    for (const rel of ['public/lumiastart.webp', 'public/lumia-logo.png']) {
      expect(fs.existsSync(path.join(ROOT, rel))).toBe(false);
    }
  });
});
