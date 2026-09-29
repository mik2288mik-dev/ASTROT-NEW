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

  it('keeps the natal story and topic views on one unnumbered unified reading', () => {
    const source = read('components/NatalReading/NatalUnifiedReport.tsx');
    const evidence = read('components/NatalReading/NatalEvidenceSheet.tsx');

    expect(source).toContain('reading.story.map');
    expect(source).toContain('reading.topics.map');
    expect(source).toContain('buildNatalInterpretation');
    expect(source).not.toContain('number={index + 1}');
    expect(source).not.toContain('HumanReport');
    expect(evidence).toContain('buildNatalInterpretation');
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
