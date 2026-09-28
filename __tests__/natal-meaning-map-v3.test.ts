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

  it('uses the same interpretation source for map explanations and shows the meaning on first tap', () => {
    const map = source('components/NatalReading/mapExplanation.ts');
    const interactive = source('components/NatalReading/InteractiveNatalMap.tsx');

    expect(map).toContain('buildNatalInterpretation');
    expect(map).toContain('interpretationFor');
    expect(map).not.toContain('SIGN_WAYS');
    expect(map).not.toContain('OBJECT_THEMES');
    expect(interactive).toContain('{explanation.meaning}');
    expect(interactive).toContain('На чём основано');
    expect(interactive).not.toContain("from '../../lib/natalReading/permanentReport'");
  });

  it('answers natal questions only from unified meanings and derives technical evidence server-side', () => {
    const question = source('lib/natalReading/natalQuestion.ts');
    const endpoint = source('pages/api/content/natal/questions.ts');
    const evidence = source('components/NatalReading/NatalEvidenceSheet.tsx');

    expect(question).toContain('buildNatalInterpretation');
    expect(question).toContain('approvedMeanings');
    expect(question).toContain('meaning_ids');
    expect(question).toContain('evidenceIdsForMeanings');
    expect(question).toContain('reviewNatalQuestionSemanticFidelity');
    expect(question).not.toContain('buildNatalModelContext');
    expect(question).not.toContain('buildNatalPromptContext');
    expect(question).not.toContain('getNatalNarrativeEvidenceIds');
    expect(question).not.toContain('NATAL_PERMANENT_CONTRACT_VERSION');
    expect(endpoint).not.toContain('getCachedPermanentPremiumReport');
    expect(endpoint).toContain('meaningIds: answer.meaningIds');
    expect(evidence).toContain('buildNatalInterpretation');
    expect(evidence).not.toContain("from '../../lib/natalReading/permanentReport'");
  });

  it('does not expose the removed classic/catalog admin selector', () => {
    const settings = source('views/Settings.tsx');

    expect(settings).not.toContain('NatalReadingVariantSettings');
    expect(settings).not.toContain('Версия разбора натальной карты');
    expect(settings).not.toContain('Старый разбор');
  });
});
