import fs from 'fs';
import path from 'path';

describe('architecture status documentation', () => {
  it('docs/LUMIA_ARCHITECTURE_STATUS.md exists with required sections', () => {
    const docPath = path.join(__dirname, '..', 'docs', 'LUMIA_ARCHITECTURE_STATUS.md');
    expect(fs.existsSync(docPath)).toBe(true);

    const content = fs.readFileSync(docPath, 'utf8');
    expect(content).toContain('## 1. Surface map');
    expect(content).toContain('## 2. Legacy `/api/astrology/*` client calls');
    expect(content).toContain('## 3. Stars pricing map');
    expect(content).toContain('## 4. Lumi read-paths');
    expect(content).toContain('## 6. Backlog');
    expect(content).toContain('### P0');
    expect(content).toContain('### P1');
    expect(content).toContain('### P2');
    expect(content).toContain('### P3');
  });
});
