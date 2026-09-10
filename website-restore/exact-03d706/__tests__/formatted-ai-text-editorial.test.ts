import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(
  path.resolve(__dirname, '../components/ui/FormattedAiText.tsx'),
  'utf8',
);

describe('FormattedAiText editorial structure', () => {
  it('renders numbered sections, bold bullet leads and technical data separately', () => {
    expect(source).toContain("line.match(/^(\\d{1,2})[.)]\\s+(.+)$/)");
    expect(source).toContain("text.split(/(\\*\\*[^*]+\\*\\*)/g)");
    expect(source).toContain('restLines.every(isListLine)');
    expect(source).toContain('lines.slice(1).every(isListLine)');
    expect(source).toContain('Основание|Технические данные|Basis|Technical data');
    expect(source).toContain('<aside');
    expect(source).toContain("bg-[#f3f3f1]");
    expect(source).not.toContain('border-astro-highlight');
  });
});
