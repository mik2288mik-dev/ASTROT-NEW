import fs from 'node:fs';
import path from 'node:path';
import {
  isNatalReadingVariant,
  natalReadingVariantLabel,
} from '../lib/natalReading/readingVariant';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('admin natal reading variant and safe fallback contract', () => {
  it('accepts only the three supported variants', () => {
    expect(isNatalReadingVariant('auto')).toBe(true);
    expect(isNatalReadingVariant('catalog')).toBe(true);
    expect(isNatalReadingVariant('legacy')).toBe(true);
    expect(isNatalReadingVariant('broken')).toBe(false);
    expect(natalReadingVariantLabel('catalog', 'ru')).toBe('Новый');
    expect(natalReadingVariantLabel('legacy', 'en')).toBe('Previous');
  });

  it('keeps the selector admin-only and stores it per user', () => {
    const settings = read('views/Settings.tsx');
    const variant = read('lib/natalReading/readingVariant.ts');

    expect(settings).toContain('props.profile.isAdmin');
    expect(settings).toContain("value: 'auto'");
    expect(settings).toContain("value: 'catalog'");
    expect(settings).toContain("value: 'legacy'");
    expect(variant).toContain('encodeURIComponent');
    expect(variant).toContain('NATAL_READING_VARIANT_CHANGED_EVENT');
  });

  it('uses the previous stable report when auto mode receives a main catalogue failure', () => {
    const report = read('components/NatalReading/NatalCatalogReport.tsx');
    const service = read('services/natalCatalogService.ts');

    expect(report).toContain("variant === 'auto' && fallbackCode");
    expect(report).toContain('<HumanReport');
    expect(report).toContain('<NatalCatalogReportBase');
    expect(service).toContain('dispatchNatalCatalogFailure');
    expect(service).toContain("readStoredNatalReadingVariant(userId) === 'legacy'");
  });

  it('repairs rejected fields with field paths and keeps privacy-safe logs', () => {
    const generator = read('lib/natalReading/reportCatalogGeneration.ts');

    expect(generator).toContain('NATAL_REPORT_REPAIR_ATTEMPTS = 3');
    expect(generator).toContain('FIELD_VALIDATION_ISSUES');
    expect(generator).toContain('PREVIOUS_CANDIDATE_TO_REWRITE');
    expect(generator).toContain("path: `summary[${index}].text`");
    expect(generator).toContain('[natal-report-validation]');
    expect(generator).not.toContain('value: issue.value');
  });
});
