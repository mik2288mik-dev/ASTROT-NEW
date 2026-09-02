import fs from 'node:fs';
import path from 'node:path';

function source(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('natal meaning map v3', () => {
  it('uses one clear product hierarchy instead of nested natal and category tabs', () => {
    const magazine = source('views/v2/NatalMagazine.tsx');
    const catalog = source('components/NatalReading/NatalCatalogReport.tsx');

    expect(magazine).toContain("export type NatalScreenTab = 'foundation' | 'explore' | 'ask' | 'map'");
    expect(magazine).toContain("'Основа'");
    expect(magazine).toContain("'Разобрать'");
    expect(magazine).toContain("'Спросить'");
    expect(magazine).toContain("'Круг карты'");
    expect(magazine).not.toContain("import { MatrixRoom } from './MatrixRoom'");
    expect(magazine).not.toContain('<EditorialTabs');
    expect(magazine).toContain("readingRenderer === 'catalog'");
    expect(magazine).toContain("tab === 'explore' && readingRenderer === 'classic'");
    expect(magazine).toContain("data-items={primaryNavItemCount}");
    expect(catalog).toContain('<NatalMeaningExperience');
    expect(catalog).not.toContain('natal-catalog-tabs');
  });

  it('keeps foundation, five directions, focused answers, and one premium block per direction', () => {
    const experience = source('components/NatalReading/NatalMeaningExperience.tsx');

    expect(experience).toContain("'character'");
    expect(experience).toContain("'love'");
    expect(experience).toContain("'communication'");
    expect(experience).toContain("'work'");
    expect(experience).toContain("'money'");
    expect(experience).toContain('natal-v3-meaning-map');
    expect(experience).toContain('natal-v3-premium-section');
    expect(experience).toContain('natal-v3-answer-sheet');
    expect(experience).toContain('Почему так?');
    expect(experience).toContain('<NatalEvidenceSheet');
  });

  it('uses real chart evidence and explains birth-time accuracy without changing calculation', () => {
    const evidence = source('components/NatalReading/NatalEvidenceSheet.tsx');

    expect(evidence).toContain('buildNatalModelContext(profile, chartData)');
    expect(evidence).toContain('getPermanentNatalReliability(chartData)');
    expect(evidence).toContain('Что именно использовано');
    expect(evidence).toContain('Насколько это зависит от времени рождения');
    expect(evidence).toContain('Показать данные карты');
    expect(evidence).not.toContain('calculateNatalChart(');
  });

  it('makes custom questions contextual and keeps answers tied to evidence', () => {
    const questions = source('components/NatalReading/NatalQuestionExperience.tsx');

    expect(questions).toContain('QUESTION_STARTERS');
    expect(questions).toContain('contextCategory');
    expect(questions).toContain('askNatalQuestion(userId, value, chartId)');
    expect(questions).toContain('questionMessageEvidenceIds(answer)');
    expect(questions).toContain('<NatalEvidenceSheet');
    expect(questions).toContain('Почему так?');
  });

  it('keeps the UI monochrome except for the six navigation circles', () => {
    const styles = source('styles/natalMeaningMap.css');
    const app = source('pages/_app.tsx');

    expect(app).toContain("import '../styles/natalMeaningMap.css'");
    expect(styles).toContain('.natal-v3-map-node.is-foundation .natal-v3-map-node-circle');
    expect(styles).toContain('.natal-v3-map-node.is-character .natal-v3-map-node-circle');
    expect(styles).toContain('.natal-v3-map-node.is-love .natal-v3-map-node-circle');
    expect(styles).toContain('.natal-v3-map-node.is-communication .natal-v3-map-node-circle');
    expect(styles).toContain('.natal-v3-map-node.is-work .natal-v3-map-node-circle');
    expect(styles).toContain('.natal-v3-map-node.is-money .natal-v3-map-node-circle');
    expect(styles).not.toContain('linear-gradient');
    expect(styles).not.toContain('radial-gradient');
  });
});
