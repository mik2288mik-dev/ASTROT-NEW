import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(
  path.join(process.cwd(), 'lib/natalReading/reportCatalog.ts'),
  'utf8',
);

describe('natal report cache identity', () => {
  it('uses v2 prompt and cache identities after validator repair changes', () => {
    expect(source).toContain('.category.v2');
    expect(source).toContain('.answer.v2');
    expect(source).toContain('natal.report-catalog.category.v2');
    expect(source).toContain('natal.report-catalog.answer.v2');
    expect(source).not.toContain('natal.report-catalog.category.v1');
    expect(source).not.toContain('natal.report-catalog.answer.v1');
  });
});
