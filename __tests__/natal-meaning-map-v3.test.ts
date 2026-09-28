import fs from 'node:fs';
import path from 'node:path';

function source(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('current natal product shell', () => {
  it('uses one active reading instead of classic/catalog switching', () => {
    const magazine = source('views/v2/NatalMagazine.tsx');

    expect(magazine).toContain("export type NatalScreenTab = 'foundation' | 'explore' | 'ask' | 'map' | 'details' | 'matrix'");
    expect(magazine).toContain("{ id: 'foundation', label: 'Обзор' }");
    expect(magazine).toContain("{ id: 'map', label: 'Карта' }");
    expect(magazine).toContain("{ id: 'details', label: 'Подробно' }");
    expect(magazine).toContain("{ id: 'ask', label: 'Спросить' }");
    expect(magazine).toContain('<NatalUnifiedReport');
    expect(magazine).not.toContain('readingRenderer');
    expect(magazine).not.toContain('<HumanReport');
    expect(magazine).not.toContain('<NatalCatalogReport');
  });

  it('keeps Рассказ and По темам as two views of the unified reading', () => {
    const magazine = source('views/v2/NatalMagazine.tsx');
    const unified = source('components/NatalReading/NatalUnifiedReport.tsx');

    expect(magazine).toContain("'story','topics'");
    expect(magazine).toContain("mode === 'story' ? 'Рассказ' : 'По темам'");
    expect(unified).toContain("mode === 'story'");
    expect(unified).toContain('reading.story.map');
    expect(unified).toContain('reading.topics.map');
  });

  it('uses one astrology disclosure instead of a why button after every sentence', () => {
    const unified = source('components/NatalReading/NatalUnifiedReport.tsx');

    expect(unified).toContain('showAstrology');
    expect(unified).toContain('Показать астрологию');
    expect(unified).toContain('Скрыть астрологию');
    expect(unified).not.toContain('Почему так?');
  });

  it('uses the same interpretation source for map explanations', () => {
    const map = source('components/NatalReading/mapExplanation.ts');

    expect(map).toContain('buildNatalInterpretation');
    expect(map).toContain('interpretationFor');
    expect(map).not.toContain('SIGN_WAYS');
    expect(map).not.toContain('OBJECT_THEMES');
  });

  it('does not expose the removed classic/catalog admin selector', () => {
    const settings = source('views/Settings.tsx');

    expect(settings).not.toContain('NatalReadingVariantSettings');
    expect(settings).not.toContain('Версия разбора натальной карты');
    expect(settings).not.toContain('Старый разбор');
  });
});
