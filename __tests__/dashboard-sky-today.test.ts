import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');

describe('Dashboard sky today card', () => {
  it('hides the card without a snapshot and renders both snapshot rows otherwise', () => {
    const card = fs.readFileSync(path.join(ROOT, 'components', 'Dashboard', 'SkyTodayCard.tsx'), 'utf8');
    expect(card).toContain('if (!snapshot || !narrative) return null;');
    expect(card).toContain("ru ? 'Луна' : 'Moon'");
    expect(card).toContain("ru ? 'Меркурий' : 'Mercury'");
    expect(card).toContain('{narrative.moonPosition}');
    expect(card).toContain('{narrative.mercuryPosition}');
    expect(card).toContain("ru ? 'Как это может ощущаться'");
    expect(card).toContain("ru ? 'Общий фон'");
  });

  it('no longer imports the approximate client Moon phase calculator', () => {
    const dashboard = fs.readFileSync(path.join(ROOT, 'views', 'Dashboard.tsx'), 'utf8');
    expect(dashboard).not.toContain("lib/horoscope/moonPhase");
    expect(dashboard).not.toContain('getMoonPhase(');
    expect(dashboard).toContain('<SkyTodayCard snapshot={skySnapshot}');
  });

  it('uses the generated light asset with cover sizing and a narrow iPhone override', () => {
    const css = fs.readFileSync(path.join(ROOT, 'styles', 'globals.css'), 'utf8');
    expect(css).toContain("url('/assets/sky-today-bg.webp')");
    expect(css).toContain('background-size: cover, cover;');
    expect(css).toContain('@media (max-width: 360px)');
    expect(fs.existsSync(path.join(ROOT, 'public', 'assets', 'sky-today-bg.webp'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, 'public', 'assets', 'sky-today-bg.svg'))).toBe(true);
  });
});
