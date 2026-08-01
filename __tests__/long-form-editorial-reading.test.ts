import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('long-form v2 editorial reading structure', () => {
  it('keeps one shared numbered reading system with quiet evidence and summary blocks', () => {
    const component = read('components/EditorialReading.tsx');
    const styles = read('styles/newspaperVisual.css');

    expect(component).toContain('EditorialSectionHeading');
    expect(component).toContain('EditorialSummary');
    expect(component).toContain('EditorialEvidence');
    expect(component).toContain('EditorialProse');
    expect(component).toContain('EditorialBulletText');
    expect(component).toContain("String(value).padStart(2, '0')");
    expect(styles).toContain('.editorial-reading-number');
    expect(styles).toContain('.editorial-reading-list li::marker');
    expect(styles).toContain('.editorial-reading-evidence');
    expect(styles).toContain('background: var(--news-paper-soft)');
  });

  it('shows every existing horoscope field in conclusion, numbered sections, evidence, and final focus', () => {
    const source = read('views/v2/HoroscopeReader.tsx');

    expect(source.indexOf('horo-editorial-intro')).toBeLessThan(source.indexOf('number={1}'));
    expect(source).toContain('reading.summary');
    expect(source).toContain('reading.reading');
    expect(source).toContain('reading.chance');
    expect(source).toContain('reading.risk');
    expect(source).toContain('reading.advice.slice(0, 3)');
    expect(source).toContain('reading.context');
    expect(source).toContain('reading.focus');
    expect(source).toContain('editorial-reading-list');
  });

  it('puts the natal takeaway first, numbers free sections, and keeps chart data technical', () => {
    const source = read('components/NatalReading/HumanReport.tsx');

    expect(source.indexOf('natal-reading-overview')).toBeLessThan(source.indexOf('visibleFreeSections.map'));
    expect(source).toContain('number={index + 1}');
    expect(source).toContain('section.subtitle');
    expect(source).toContain('natal-sec-bullets');
    expect(source).toContain('<EditorialBulletText text={item} />');
    expect(source).toContain('natal-reading-final');
    expect(source).toContain('natal-technical-details');
  });

  it('separates compatibility conclusions, technical scores, numbered reading, and the deep summary', () => {
    const source = read('views/v2/UnionRoom.tsx');

    expect(source.indexOf('compat-main-conclusion')).toBeLessThan(source.indexOf('compat-technical-data'));
    expect(source).toContain('number={1}');
    expect(source).toContain('number={6}');
    expect(source).toContain('compat-final-summary');
    expect(source).not.toContain('function CompatBlock({ title, color');
  });

  it('renders matrix groups as numbered article sections rather than a stack of visual cards', () => {
    const source = read('views/v2/MatrixRoom.tsx');

    expect(source.indexOf('className="mtx-hero"')).toBeLessThan(source.indexOf('mtx-editorial-sections'));
    expect(source).toContain('number={i + 1}');
    expect(source).toContain('number={themeGroups.length + i + 1}');
    expect(source).toContain('<h2 className="mtx-life-head"');
    expect(source).toContain('Basis of the calculation');
  });
});
