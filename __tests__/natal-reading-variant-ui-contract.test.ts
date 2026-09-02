import fs from 'node:fs';
import path from 'node:path';

function source(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('natal reading variant UI contract', () => {
  it('keeps the switch inside the admin-only developer settings screen', () => {
    const settings = source('views/Settings.tsx');
    const component = source('components/NatalReading/NatalReadingVariantSettings.tsx');
    expect(settings).toContain("case 'developer':");
    expect(settings).toContain('<NatalReadingVariantSettings profile={profile} />');
    expect(component).toContain('if (!isAdmin) return null;');
    expect(component).toContain("value: 'auto'");
    expect(component).toContain("value: 'catalog'");
    expect(component).toContain("value: 'classic'");
  });

  it('renders classic, forced catalog and cache-aware auto without a mid-reading swap', () => {
    const magazine = source('views/v2/NatalMagazine.tsx');
    expect(magazine).toContain("resolveNatalReadingRenderer(readingVariant, Boolean(cached))");
    expect(magazine).toContain("readingVariant === 'auto' && !cached && userId");
    expect(magazine).toContain('void ensureNatalCatalogCategory(');
    expect(magazine).toContain("readingRenderer === 'catalog'");
    expect(magazine).toContain('surface="reading"');
    expect(magazine).not.toContain('.then(() => setReadingRenderer');
  });
});
