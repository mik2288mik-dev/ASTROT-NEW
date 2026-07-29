import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('natal chart editorial layout', () => {
  it('scopes the light reading flow without replacing chart or Premium behavior', () => {
    const magazine = read('views/v2/NatalMagazine.tsx');
    const report = read('components/NatalReading/HumanReport.tsx');
    const styles = read('styles/natalEditorial.css');
    const app = read('pages/_app.tsx');

    expect(magazine.match(/fresh-page natal-editorial-page/g)).toHaveLength(2);
    expect(magazine).toContain("getUniversalCardBackground('natal'");
    expect(report).toContain('natal-editorial-report');
    expect(report).toContain('natal-topic-row');
    expect(report).toContain('natal-topic-teaser');
    expect(styles).toContain('.natal-editorial-page .natal-sec');
    expect(styles).toContain('.natal-editorial-page .natal-big3-card');
    expect(styles).toContain('.natal-editorial-page .product-screen-cover--natal::before');
    expect(styles).not.toMatch(/display:\s*none[^}]*natal-premium/i);
    expect(app).toContain("import '../styles/natalEditorial.css'");
  });
});
