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
    expect(component).toContain('Вариант натальной карты');
    expect(component).toContain('Авто: новый, при сбое старый');
    expect(component).toContain('Новый каталог');
    expect(component).toContain('Старый стабильный разбор');
  });

  it('tries catalog first in auto, falls back after 12 seconds or main failure, and respects forced modes', () => {
    const magazine = source('views/v2/NatalMagazine.tsx');
    const report = source('components/NatalReading/NatalCatalogReport.tsx');
    expect(magazine).toContain('const NATAL_CATALOG_AUTO_FALLBACK_MS = 12_000;');
    expect(magazine).toContain("resolveNatalReadingRenderer(readingVariant, false)");
    expect(magazine).toContain("readingVariant !== 'auto'");
    expect(magazine).toContain("setReadingRenderer('classic')");
    expect(magazine).toContain('onReady={() =>');
    expect(magazine).toContain('onUnavailable={() =>');
    expect(magazine).toContain("readingRenderer === 'catalog'");
    expect(magazine).toContain('surface="reading"');
    expect(report).toContain('onReady?: () => void;');
    expect(report).toContain('onUnavailable?: (error: unknown) => void;');
    expect(report).toContain('activeCategory === DEFAULT_CATEGORY');
    expect(report).toContain('notifyMainReady()');
    expect(report).toContain('notifyMainUnavailable(loadError)');
  });
});
