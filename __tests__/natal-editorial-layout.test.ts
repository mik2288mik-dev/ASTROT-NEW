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
    const studioStyles = read('styles/editorialStudio.css');
    const app = read('pages/_app.tsx');

    expect(magazine.match(/fresh-page natal-editorial-page/g)).toHaveLength(2);
    expect(magazine).not.toContain('getUniversalCardBackground');
    expect(magazine).not.toContain('FreshHeroCard');
    expect(magazine).not.toContain('selectNatalEditorialSticker');
    expect(magazine).not.toContain('editorialSticker={natalSticker}');
    expect(magazine.match(/natal-mvp-page/g)).toHaveLength(2);
    expect(magazine).toContain('<EditorialTabs');
    expect(magazine).toContain('natal-empty-content');
    expect(magazine).toContain('onClick={onCreateChart}');
    expect(magazine).toContain('<NatalChartWheel');
    expect(magazine).not.toContain('<NatalChartPortrait');
    expect(magazine.indexOf('<NatalChartWheel')).toBeLessThan(magazine.indexOf('<HumanReport'));
    expect(magazine).toContain('premiumContinuation={premiumContinuation}');
    expect(magazine).toContain('canPromotePremium={canPromotePremium}');
    expect(wheel).toContain('getPermanentNatalReliability');
    expect(wheel).toContain("'northNode'");
    expect(wheel).toContain("'southNode'");
    expect(wheel).toContain("'chiron'");
    expect(wheel).toContain('Array.isArray(chart.aspects)');
    expect(wheel).toContain('aspect.reliable === false');
    expect(wheel).not.toContain('Math.random');
    expect(report).toContain('natal-editorial-report');
    expect(report).toContain('ensureHumanPremiumReport');
    expect(report).toContain('<PremiumReport');
    expect(report).toContain('<TechnicalDetails chartData={chartData} language={language} />');
    expect(report).not.toContain('editorialSticker');
    expect(styles).toContain('.natal-editorial-page .natal-sec');
    expect(styles).toContain('.natal-chart-wheel-svg');
    expect(styles).toContain('.natal-chart-wheel-aspect');
    expect(styles).toContain('.natal-chart-wheel-marker');
    expect(studioStyles).toContain('.natal-map-stage');
    expect(studioStyles).toContain('.natal-map-meta');
    expect(studioStyles).toContain('.natal-reading-stage');
    expect(studioStyles).toContain('.fresh-page.natal-editorial-page.natal-mvp-page');
    expect(styles).not.toMatch(/display:\s*none[^}]*natal-premium/i);
    expect(app).toContain("import '../styles/natalEditorial.css'");
    expect(app).toContain("import '../styles/editorialStudio.css'");
  });
});
