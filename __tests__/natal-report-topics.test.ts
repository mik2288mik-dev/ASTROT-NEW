import type { InterpretationSection } from '../types';
import {
  NATAL_PERMANENT_CONTRACT_VERSION,
  NATAL_READER_CHAPTERS,
  type NatalPermanentFreeReport,
  type NatalPermanentPremiumReport,
} from '../lib/natalReading/permanentReport';
import {
  buildNatalReportTopics,
  isNatalTopicKey,
  NATAL_TOPIC_DEFINITION_KEYS,
  NATAL_TOPIC_KEYS,
} from '../lib/natalReading/reportTopics';

const evidenceId = 'natal.position.sun';

function freeSection(key: InterpretationSection['key'], title: string): InterpretationSection {
  return {
    key,
    title,
    access: 'free',
    content: `${title}: законченный бесплатный разбор.`,
    evidenceIds: [evidenceId],
  };
}

function freeReport(
  sections: InterpretationSection[] = [
    freeSection('base_portrait', 'Внутренний мир'),
    freeSection('how_others_see_you', 'Первое впечатление'),
    freeSection('thinking', 'Решения'),
    freeSection('communication', 'Общение'),
    freeSection('strengths', 'Сильные стороны'),
  ],
): NatalPermanentFreeReport {
  return {
    schemaVersion: 'natal-permanent-free-v3',
    contractVersion: NATAL_PERMANENT_CONTRACT_VERSION,
    tier: 'free',
    evidenceIds: [evidenceId],
    hook: { text: 'Короткий законченный общий результат натальной карты пользователя.', evidenceIds: [evidenceId] },
    userName: 'Лена',
    birthData: { birthDate: '1990-01-01', birthTime: '12:00', birthPlace: 'Москва' },
    calculatedAt: '2026-09-01T00:00:00.000Z',
    shortCard: { title: 'Карта', text: 'Карта', keywords: [], advice: '' },
    freeSections: sections,
    paidSections: [],
    premiumSections: [],
  };
}

function premiumReport(): NatalPermanentPremiumReport {
  const paragraph = (text: string) => ({ text, evidenceIds: [evidenceId] });
  return {
    schemaVersion: 'natal-permanent-premium-v2',
    contractVersion: NATAL_PERMANENT_CONTRACT_VERSION,
    tier: 'premium',
    headline: 'Полная карта',
    headlineEvidenceIds: [evidenceId],
    lead: paragraph('Полный вводный результат.'),
    sections: [
      { id: 'inner_world', title: 'Что у тебя внутри', paragraphs: [paragraph('Глубокий внутренний разбор.')] },
      { id: 'relationships', title: 'Отношения и семья', paragraphs: [paragraph('Полный разбор отношений.')] },
      { id: 'work', title: 'Работа и своё дело', paragraphs: [paragraph('Полный разбор работы.')] },
      { id: 'challenges', title: 'Когда всё идёт не по плану', paragraphs: [paragraph('Полный разбор сложных ситуаций.')] },
    ],
    strategies: [],
    pitfalls: [],
    conclusion: paragraph('Итог полного разбора.'),
    evidenceIds: [evidenceId],
  };
}

describe('Natal report topic model', () => {
  it('stays exhaustive with the calculation chapter contract', () => {
    expect(NATAL_TOPIC_KEYS).toEqual(NATAL_READER_CHAPTERS.map((chapter) => chapter.key));
    expect(NATAL_TOPIC_DEFINITION_KEYS).toEqual(NATAL_TOPIC_KEYS);
  });

  it('opens exactly two complete topics and locks the remaining topics for a free user', () => {
    const topics = buildNatalReportTopics({
      language: 'ru',
      report: freeReport(),
      premiumReport: null,
      isPremium: false,
    });

    expect(topics).toHaveLength(8);
    expect(topics.filter((topic) => topic.accessState === 'open').map((topic) => topic.key))
      .toEqual(['new_people', 'strengths']);
    expect(topics.find((topic) => topic.key === 'new_people')).toMatchObject({
      title: 'Как тебя видят',
      paragraphs: [{ text: 'Первое впечатление: законченный бесплатный разбор.' }],
    });
    expect(topics.find((topic) => topic.key === 'relationships')?.accessState).toBe('locked');
    expect(topics.every((topic) => topic.related.length >= 4)).toBe(true);
  });

  it('unlocks every available topic and uses the deeper report for Premium', () => {
    const topics = buildNatalReportTopics({
      language: 'ru',
      report: freeReport(),
      premiumReport: premiumReport(),
      isPremium: true,
    });

    expect(topics.every((topic) => topic.accessState !== 'locked')).toBe(true);
    expect(topics.find((topic) => topic.key === 'inner_world')?.paragraphs[0].text)
      .toBe('Глубокий внутренний разбор.');
    expect(topics.find((topic) => topic.key === 'relationships')?.paragraphs[0].text)
      .toBe('Полный разбор отношений.');
  });

  it('never exposes a cached Premium paragraph when the current entitlement is inactive', () => {
    const topics = buildNatalReportTopics({
      language: 'ru',
      report: freeReport(),
      premiumReport: premiumReport(),
      isPremium: false,
    });

    expect(topics.find((topic) => topic.key === 'inner_world')?.paragraphs[0].text)
      .toBe('Внутренний мир: законченный бесплатный разбор.');
    expect(topics.find((topic) => topic.key === 'relationships')).toMatchObject({
      accessState: 'locked',
      paragraphs: [],
    });
  });

  it('falls back to two reliable free topics when birth-time content is unavailable', () => {
    const withoutFirstImpression = freeReport([
      freeSection('base_portrait', 'Внутренний мир'),
      freeSection('thinking', 'Решения'),
      freeSection('communication', 'Общение'),
      freeSection('strengths', 'Сильные стороны'),
    ]);
    const topics = buildNatalReportTopics({
      language: 'ru',
      report: withoutFirstImpression,
      premiumReport: null,
      isPremium: false,
    });

    expect(topics.some((topic) => topic.key === 'new_people')).toBe(false);
    expect(topics.filter((topic) => topic.accessState === 'open').map((topic) => topic.key))
      .toEqual(['inner_world', 'strengths']);
  });

  it('accepts only real topic keys for post-purchase continuation', () => {
    expect(isNatalTopicKey('relationships')).toBe(true);
    expect(isNatalTopicKey('money')).toBe(false);
    expect(isNatalTopicKey(null)).toBe(false);
  });
});
