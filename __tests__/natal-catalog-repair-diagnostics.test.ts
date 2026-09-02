import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(
  path.join(process.cwd(), 'lib/natalReading/reportCatalogGeneration.ts'),
  'utf8',
);

describe('natal catalog semantic repair diagnostics', () => {
  it('uses three semantic attempts and field-specific safe issue codes', () => {
    expect(source).toContain('const NATAL_REPORT_SEMANTIC_ATTEMPTS = 3;');
    expect(source).toContain("'PERSONALITY_COPY'");
    expect(source).toContain("'CATALOG_COPY'");
    expect(source).toContain("'RELIABILITY'");
    expect(source).toContain('COPY_VIOLATION:${path}:${kind}');
    expect(source).toContain('free_answers[${answerIndex}].paragraphs[${paragraphIndex}]');
  });

  it('logs only identifiers and issue codes and explains every repair class', () => {
    expect(source).toContain("'[natal/catalog-validation]'");
    expect(source).toContain('semanticAttempt: attempt');
    expect(source).toContain('responseId: result.responseId');
    expect(source).toContain('PERSONALITY_COPY means');
    expect(source).toContain('CATALOG_COPY means');
    expect(source).toContain('RELIABILITY means');
    expect(source).not.toContain('generatedText:');
    expect(source).not.toContain('birthData: input.profile');
  });
});
