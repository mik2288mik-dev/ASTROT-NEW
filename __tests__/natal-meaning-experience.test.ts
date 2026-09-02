import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('natal meaning-first experience', () => {
  it('uses one clear product navigation and keeps the matrix outside the natal chart', () => {
    const magazine = read('views/v2/NatalMagazine.tsx');

    expect(magazine).toContain("'foundation' | 'explore' | 'questions' | 'map'");
    expect(magazine).toContain("'Главное'");
    expect(magazine).toContain("'Подробнее'");
    expect(magazine).toContain("'Спросить'");
    expect(magazine).toContain('<NatalQuestionExperience');
    expect(magazine).toContain('CATALOG_FALLBACK_MS');
    expect(magazine).toContain('onMainUnavailable={markCatalogUnavailable}');
    expect(magazine).not.toContain('<MatrixRoom');
    expect(magazine).not.toContain('EditorialTabs');
    expect(magazine).not.toContain("{ id: 'matrix'");
  });

  it('shows a core map, deeper areas, bottom-sheet answers and a reason for every conclusion', () => {
    const experience = read('components/NatalReading/NatalMeaningExperience.tsx');
    const catalog = read('components/NatalReading/NatalCatalogReport.tsx');
    const why = read('components/NatalReading/NatalWhySheet.tsx');

    expect(experience).toContain('FoundationOrbit');
    expect(experience).toContain("'Главное о тебе'");
    expect(experience).toContain("'Как это выглядит'");
    expect(experience).toContain("'Почему так?'");
    expect(experience).toContain('<CosmicSheet');
    expect(experience).toContain("'Открыть продолжение'");
    expect(catalog).toContain('<NatalMeaningExperience');
    expect(catalog).toContain('displayMode');
    expect(catalog).toContain('onMainReady');
    expect(why).toContain("'Простыми словами'");
    expect(why).toContain("'Что мы проверили'");
    expect(why).toContain("'Показать данные карты'");
  });

  it('keeps access boundaries quiet and avoids store language in the new interface', () => {
    const files = [
      read('views/v2/NatalMagazine.tsx'),
      read('components/NatalReading/NatalMeaningExperience.tsx'),
      read('components/NatalReading/NatalQuestionExperience.tsx'),
      read('components/NatalReading/NatalWhySheet.tsx'),
    ].join('\n');

    expect(files).not.toContain('Получить Premium');
    expect(files).not.toContain('Бесплатный вопрос');
    expect(files).not.toContain('Первый вопрос по карте — бесплатно');
    expect(files).not.toContain('Полный доступ в Premium');
    expect(files).not.toContain('Матрица судьбы');
  });

  it('keeps the administrator switch simple and device-scoped', () => {
    const settings = read('components/NatalReading/NatalReadingVariantSettings.tsx');
    const variant = read('lib/natalReading/readingVariant.ts');

    expect(settings).toContain("ru: 'Авто'");
    expect(settings).toContain("ru: 'Новый'");
    expect(settings).toContain("ru: 'Старый'");
    expect(settings).toContain('Выбор действует только на этом устройстве.');
    expect(variant).toContain("if (variant === 'classic') return 'classic'");
    expect(variant).toContain("return 'catalog'");
  });
});
