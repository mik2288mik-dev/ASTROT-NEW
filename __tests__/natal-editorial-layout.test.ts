import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('natal chart editorial layout', () => {
  it('keeps the agreed three-tab shell on the unified natal runtime', () => {
    const magazine = read('views/v2/NatalMagazine.tsx');
    const unified = read('components/NatalReading/NatalUnifiedReport.tsx');
    const questions = read('components/NatalReading/NatalQuestionExperience.tsx');
    const map = read('components/NatalReading/InteractiveNatalMap.tsx');

    expect(magazine).toContain("{ id: 'foundation', label: 'Обзор' }");
    expect(magazine).toContain("{ id: 'map', label: 'Карта' }");
    expect(magazine).toContain("{ id: 'ask', label: 'Спросить' }");
    expect(magazine).toContain('<NatalUnifiedReport');
    expect(magazine).toContain('<InteractiveNatalMap');
    expect(magazine).toContain('<NatalQuestionExperience');
    expect(magazine).not.toContain('<HumanReport');
    expect(magazine).not.toContain('<NatalCatalogReport');

    expect(unified).toContain('buildNatalInterpretation');
    expect(unified).toContain('ensureNatalUnifiedReading');
    expect(questions).toContain('askNatalQuestion');
    expect(questions).toContain('<NatalEvidenceSheet');
    expect(map).toContain('explainMapSelection');
  });
});
