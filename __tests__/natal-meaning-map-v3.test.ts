import fs from 'node:fs';
import path from 'node:path';

function source(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('natal meaning map v3', () => {
  it('uses one clear product hierarchy instead of nested natal and category tabs', () => {
    const magazine = source('views/v2/NatalMagazine.tsx');
    const catalog = source('components/NatalReading/NatalCatalogReport.tsx');

    expect(magazine).toContain("export type NatalScreenTab = 'foundation' | 'explore' | 'ask' | 'map' | 'matrix'");
    const primaryNav = magazine.slice(magazine.indexOf('className="natal-v3-primary-nav"'), magazine.indexOf('</nav>'));
    const labels = ["'Карта'", "'Разбор'", "'Спросить о себе'", "'Матрица судьбы'"];
    for (const label of labels) expect(primaryNav).toContain(label);
    expect(labels.map((label) => primaryNav.indexOf(label))).toEqual([...labels.map((label) => primaryNav.indexOf(label))].sort((a, b) => a - b));
    expect(magazine).toContain("'Круг карты'");
    expect(magazine).toContain("import { MatrixRoom } from './MatrixRoom'");
    expect(magazine).toContain("'Матрица судьбы'");
    expect(magazine).not.toContain('<EditorialTabs');
    expect(magazine).toContain("readingRenderer === 'catalog'");
    expect(magazine).toContain("tab === 'explore' && readingRenderer === 'classic'");
    expect(magazine).toContain("data-items={primaryNavItemCount}");
    expect(catalog).toContain('<NatalMeaningExperience');
    expect(catalog).not.toContain('natal-catalog-tabs');
  });

  it('keeps the complete foundation and five narrative continuations', () => {
    const experience = source('components/NatalReading/NatalMeaningExperience.tsx');

    expect(experience).toContain("'character'");
    expect(experience).toContain("'love'");
    expect(experience).toContain("'communication'");
    expect(experience).toContain("'work'");
    expect(experience).toContain("'money'");
    expect(experience).toContain('natal-narrative-chapters');
    expect(experience).toContain('natal-v3-premium-section');
    expect(experience).toContain('natal-narrative-copy');
    expect(experience).toContain('natal-reading-observation-heading');
    expect(experience).toContain('<CircleHelp aria-hidden="true" />');
    expect(experience).toContain("ru ? 'На чём основано' : 'Chart evidence'");
    expect(experience).toContain('<NatalEvidenceSheet');
  });

  it('uses real chart evidence and explains birth-time accuracy without changing calculation', () => {
    const evidence = source('components/NatalReading/NatalEvidenceSheet.tsx');

    expect(evidence).toContain('buildNatalModelContext(profile, chartData)');
    expect(evidence).toContain('getPermanentNatalReliability(chartData)');
    expect(evidence).toContain('Данные твоей карты');
    expect(evidence).toContain('className="natal-v3-evidence-summary-list"');
    expect(evidence).toContain('labels.map((label) => <li key={label}>{label}</li>)');
    expect(evidence).toContain('Время рождения неизвестно. Дома, Асцендент и MC не используются.');
    expect(evidence).not.toContain('Насколько это зависит от времени рождения');
    expect(evidence).not.toContain('Показать данные карты');
    expect(evidence).not.toContain('natal-v3-technical-disclosure');
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
