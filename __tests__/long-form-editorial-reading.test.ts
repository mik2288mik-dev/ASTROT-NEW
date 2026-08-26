import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('long-form v2 editorial reading structure', () => {
  it('keeps one shared unnumbered reading system with quiet evidence and summary blocks', () => {
    const component = read('components/EditorialReading.tsx');
    const styles = read('styles/newspaperVisual.css');

    expect(component).toContain('EditorialSectionHeading');
    expect(component).toContain('EditorialSummary');
    expect(component).toContain('EditorialEvidence');
    expect(component).toContain('EditorialProse');
    expect(component).toContain('EditorialBulletText');
    expect(component).not.toContain('editorial-reading-number');
    expect(styles).not.toContain('.editorial-reading-number');
    expect(styles).toContain('.editorial-reading-list li::marker');
    expect(styles).toContain('.editorial-reading-evidence');
    expect(styles).toContain('background: var(--news-paper-soft)');
  });

  it('shows the complete sign-horoscope story with period tabs and the editorial sign picker', () => {
    const source = read('views/v2/HoroscopeReader.tsx');

    expect(source.indexOf('<FreshTabs')).toBeLessThan(source.indexOf('displayedReading.headline'));
    expect(source).toContain('displayedReading.headline');
    expect(source).toContain('displayedReading.text');
    expect(source).toContain('<HoroscopeActivityBar');
    expect(source).toContain('<LzSignPickerSheet');
    expect(source).toContain("variant=\"editorial\"");
  });

  it('puts the natal hook first, keeps full report fields unnumbered, and keeps chart data technical', () => {
    const source = read('components/NatalReading/HumanReport.tsx');

    expect(source.indexOf('natal-reading-hook')).toBeLessThan(source.indexOf('freeSections.map'));
    expect(source).not.toContain('number={index + 1}');
    expect(source).toContain('report.hook.text');
    expect(source).toContain('section.title');
    expect(source).toContain('section.content');
    expect(source).toContain('report.sections.map');
    expect(source).toContain('section.paragraphs.map');
    expect(source).toContain('<NatalEvidenceDetails');
    expect(source).toContain('Как это видно в карте');
    expect(source).toContain('<PremiumReport');
    expect(source).toContain('natal-technical-details');
  });

  it('separates compatibility conclusions, technical scores, unnumbered reading, and the deep summary', () => {
    const source = read('views/v2/UnionRoom.tsx');

    expect(source.indexOf('compat-main-conclusion')).toBeLessThan(source.indexOf('compat-technical-data'));
    expect(source).not.toContain('number={1}');
    expect(source).not.toContain('number={6}');
    expect(source).toContain('compat-final-summary');
    expect(source).not.toContain('function CompatBlock({ title, color');
  });

  it('renders matrix groups as unnumbered article sections rather than a stack of visual cards', () => {
    const source = read('views/v2/MatrixRoom.tsx');

    expect(source.indexOf('className="mtx-hero"')).toBeLessThan(source.indexOf('mtx-editorial-sections'));
    expect(source).not.toContain('number={i + 1}');
    expect(source).not.toContain('number={themeGroups.length + i + 1}');
    expect(source).toContain('<h2 className="mtx-life-head"');
    expect(source).toContain('Basis of the calculation');
  });
});
