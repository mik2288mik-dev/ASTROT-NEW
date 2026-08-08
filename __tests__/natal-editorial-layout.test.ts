import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('natal chart editorial layout', () => {
  it('scopes the light reading flow without replacing chart or Premium behavior', () => {
    const magazine = read('views/v2/NatalMagazine.tsx');
    const wheel = read('components/NatalReading/NatalChartWheel.tsx');
    const report = read('components/NatalReading/HumanReport.tsx');
    const styles = read('styles/natalEditorial.css');
    const newspaperStyles = read('styles/newspaperVisual.css');
    const app = read('pages/_app.tsx');

    expect(magazine.match(/fresh-page natal-editorial-page/g)).toHaveLength(2);
    expect(magazine).not.toContain('getUniversalCardBackground');
    expect(magazine).not.toContain('FreshHeroCard');
    expect(magazine).toContain('selectNatalEditorialSticker');
    expect(magazine).toContain('editorialSticker={natalSticker}');
    expect(magazine).toContain('natal-empty-technical');
    expect(magazine).toContain('<NatalChartWheel chart={data} language={language} />');
    expect(magazine.indexOf('<NatalChartWheel')).toBeGreaterThan(magazine.indexOf('className="natal-big3"'));
    expect(magazine.indexOf('<NatalChartWheel')).toBeLessThan(magazine.indexOf('<HumanReport'));
    expect(wheel).toContain('getPermanentNatalReliability');
    expect(wheel).toContain("'northNode'");
    expect(wheel).toContain("'southNode'");
    expect(wheel).toContain("'chiron'");
    expect(wheel).toContain('Array.isArray(chart.aspects)');
    expect(wheel).toContain("aspect.reliable === false");
    expect(wheel).toContain("reliability.quality === 'unknown'");
    expect(wheel).not.toContain('Math.random');
    expect(report).toContain('natal-editorial-report');
    expect(report).toContain('ensureHumanPremiumReport');
    expect(report).toContain('<PremiumReport');
    expect(report).toContain('editorialSticker');
    expect(styles).toContain('.natal-editorial-page .natal-sec');
    expect(styles).toContain('.natal-editorial-page .natal-big3-card');
    expect(styles).toContain('.natal-editorial-page .natal-chart-wheel-svg');
    expect(styles).toContain('.natal-editorial-page .natal-chart-wheel-aspect--trine');
    expect(newspaperStyles).toContain('.natal-editorial-page .product-screen-cover::before');
    expect(newspaperStyles).toContain('.natal-editorial-page .natal-empty-technical');
    expect(styles).not.toMatch(/display:\s*none[^}]*natal-premium/i);
    expect(app).toContain("import '../styles/natalEditorial.css'");
  });
});
