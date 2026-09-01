import type { NatalChartData, UserProfile } from '../types';
import {
  getNatalReportAnswer,
  getNatalReportCategory,
  isNatalReportAnswerFree,
  isNatalReportAnswerKey,
  NATAL_REPORT_ANSWER_COUNT,
  NATAL_REPORT_ANSWER_KEYS,
  NATAL_REPORT_CATEGORIES,
  NATAL_REPORT_CATALOG_CONTRACT_VERSION,
  NATAL_REPORT_MAIN_PREVIEW_KEYS,
  type NatalReportAnswerKey,
} from '../lib/natalReading/reportCatalog';
import {
  buildNatalReportCategorySchema,
  hasNatalReportCatalogCopyViolation,
  isNatalReportMainSummaryLengthAllowed,
  NATAL_REPORT_MAIN_SUMMARY_MAX_CHARS,
  NATAL_REPORT_MAIN_SUMMARY_MIN_CHARS,
} from '../lib/natalReading/reportCatalogGeneration';
import {
  buildNatalReportCatalogContext,
  resolveNatalReportAnswerEvidence,
} from '../lib/natalReading/reportCatalogEvidence';

const profile: UserProfile = {
  id: 'catalog-contract-user',
  name: 'Лина',
  birthDate: '2000-03-01',
  birthTime: '09:20',
  birthPlace: 'Москва',
  isSetup: true,
  language: 'ru',
  theme: 'light',
  isPremium: false,
};

const chart: NatalChartData = {
  sun: { planet: 'Sun', sign: 'Pisces', degree: 11, longitude: 341, description: '' },
  moon: { planet: 'Moon', sign: 'Scorpio', degree: 18, longitude: 228, description: '' },
  rising: { planet: 'Ascendant', sign: 'Scorpio', degree: 4, longitude: 214, description: '' },
  mercury: { planet: 'Mercury', sign: 'Aquarius', degree: 26, longitude: 326, description: '' },
  venus: { planet: 'Venus', sign: 'Aries', degree: 3, longitude: 3, description: '' },
  mars: { planet: 'Mars', sign: 'Taurus', degree: 8, longitude: 38, description: '' },
  jupiter: { planet: 'Jupiter', sign: 'Gemini', degree: 2, longitude: 62, description: '' },
  saturn: { planet: 'Saturn', sign: 'Taurus', degree: 14, longitude: 44, description: '' },
  element: 'Water',
  rulingPlanet: 'Neptune',
  birthTimeQuality: 'unknown',
  aspects: [
    { type: 'trine', angle: 120, orb: 2, from: 'Sun', to: 'Moon' },
    { type: 'trine', angle: 120, orb: 1, from: 'Sun', to: 'Ascendant' },
  ],
  summary: '',
};

describe('natal report catalog contract', () => {
  it('defines 47 unique owned answers in the six requested categories', () => {
    expect(NATAL_REPORT_CATALOG_CONTRACT_VERSION).toBe('natal-report-catalog-v1');
    expect(NATAL_REPORT_ANSWER_COUNT).toBe(47);
    expect(NATAL_REPORT_ANSWER_KEYS).toHaveLength(47);
    expect(new Set(NATAL_REPORT_ANSWER_KEYS).size).toBe(47);
    expect(NATAL_REPORT_CATEGORIES.map((category) => category.key)).toEqual([
      'main', 'character', 'love', 'communication', 'work', 'money',
    ]);
    expect(NATAL_REPORT_CATEGORIES.map((category) => category.answerKeys.length)).toEqual([
      2, 8, 9, 9, 10, 9,
    ]);
    const ownedKeys = NATAL_REPORT_CATEGORIES.flatMap((category) => category.answerKeys);
    expect(ownedKeys).toEqual(NATAL_REPORT_ANSWER_KEYS);
    expect(new Set(ownedKeys).size).toBe(47);
    expect(NATAL_REPORT_ANSWER_KEYS.every(isNatalReportAnswerKey)).toBe(true);
    expect(isNatalReportAnswerKey('not_a_catalog_answer')).toBe(false);
  });

  it('keeps exactly seven free answers and one sample in each non-main category', () => {
    const freeKeys = NATAL_REPORT_ANSWER_KEYS.filter(isNatalReportAnswerFree);
    expect(freeKeys).toEqual([
      'main_how_people_see_you',
      'main_not_seen_at_once',
      'character_decisions',
      'love_show_interest',
      'communication_new_people',
      'work_start_new',
      'money_save_or_spend',
    ]);
    expect(getNatalReportCategory('main')?.answerKeys.filter(isNatalReportAnswerFree)).toHaveLength(2);
    for (const category of NATAL_REPORT_CATEGORIES.filter((item) => item.key !== 'main')) {
      expect(category.answerKeys.filter(isNatalReportAnswerFree)).toHaveLength(1);
    }
  });

  it('gives every answer useful locked-screen details and valid continuations', () => {
    for (const key of NATAL_REPORT_ANSWER_KEYS) {
      const definition = getNatalReportAnswer(key);
      expect(definition).not.toBeNull();
      expect(definition?.key).toBe(key);
      expect(definition?.title.ru.trim()).toBeTruthy();
      expect(definition?.title.en.trim()).toBeTruthy();
      expect(definition?.related.length).toBeGreaterThanOrEqual(3);
      expect(definition?.related.length).toBeLessThanOrEqual(4);
      expect(new Set(definition?.related).size).toBe(definition?.related.length);
      expect(definition?.related).not.toContain(key);
      expect(definition?.related.every(isNatalReportAnswerKey)).toBe(true);
      expect(definition?.fullAnswerIncludes.ru.length).toBeGreaterThanOrEqual(4);
      expect(definition?.fullAnswerIncludes.ru.length).toBeLessThanOrEqual(5);
      expect(definition?.fullAnswerIncludes.en.length).toBe(definition?.fullAnswerIncludes.ru.length);
    }
  });

  it('uses six personal continuation previews on Main without changing answer ownership', () => {
    expect(NATAL_REPORT_MAIN_PREVIEW_KEYS).toEqual([
      'main_how_people_see_you',
      'main_not_seen_at_once',
      'love_people_you_like',
      'communication_arguments',
      'work_routine',
      'money_save_or_spend',
    ]);
    expect(new Set(NATAL_REPORT_MAIN_PREVIEW_KEYS).size).toBe(6);
    const schema = buildNatalReportCategorySchema('main') as any;
    expect(schema.properties.previews.minItems).toBe(6);
    expect(schema.properties.previews.maxItems).toBe(6);
    expect(schema.properties.free_answers.minItems).toBe(2);
    expect(schema.properties.free_answers.maxItems).toBe(2);
    expect(schema.properties.previews.items.properties.preview.maxLength).toBe(150);
    expect(schema.properties.observations.items.properties.text.maxLength).toBe(150);
  });

  it('blocks report jargon in Russian and English without matching ordinary words by substring', () => {
    const forbidden = [
      'Это психологический разбор.',
      'Здесь начинается коучинг.',
      'Тема — самовыражение.',
      'Главное — твои ценности.',
      'У тебя сильная энергия.',
      'Так раскрывается потенциал.',
      'Ниже идут рекомендации и практики.',
      'Ты защищаешь личные границы.',
      'Это твой внутренний ресурс, опора, паттерн и триггер.',
      'This is a psychological coaching pattern.',
      'Your self-expression, values, energy and potential are described here.',
      'Read the recommendations, practices and boundaries.',
      'This resource offers support for every trigger.',
    ];
    expect(forbidden.filter((value) => !hasNatalReportCatalogCopyViolation(value))).toEqual([]);

    const ordinary = [
      'Чужой напор не ускоряет твоё решение.',
      'Ты называешь цену после того, как видишь весь объём работы.',
      'Это практичный ответ на обычную ситуацию.',
      'В пограничном случае ты сначала проверяешь факты.',
      'You value work that reaches a visible result.',
      'A triggerfish and a patterned shirt are unrelated words.',
      'The supporter waited for a concrete answer.',
    ];
    expect(ordinary.filter(hasNatalReportCatalogCopyViolation)).toEqual([]);
  });

  it('keeps the Main reading between 600 and 1050 characters in three to five paragraphs', () => {
    const lengths = (...sizes: number[]) => sizes.map((size) => 'а'.repeat(size));

    expect(NATAL_REPORT_MAIN_SUMMARY_MIN_CHARS).toBe(600);
    expect(NATAL_REPORT_MAIN_SUMMARY_MAX_CHARS).toBe(1050);
    expect(isNatalReportMainSummaryLengthAllowed(lengths(200, 200, 200))).toBe(true);
    expect(isNatalReportMainSummaryLengthAllowed(lengths(199, 200, 200))).toBe(false);
    expect(isNatalReportMainSummaryLengthAllowed(lengths(210, 210, 210, 210, 210))).toBe(true);
    expect(isNatalReportMainSummaryLengthAllowed(lengths(211, 210, 210, 210, 210))).toBe(false);
    expect(isNatalReportMainSummaryLengthAllowed(lengths(300, 300))).toBe(false);
    expect(isNatalReportMainSummaryLengthAllowed(lengths(175, 175, 175, 175, 175, 175))).toBe(false);
  });

  it('builds deterministic evidence for all answers without requiring angles or houses', () => {
    const built = buildNatalReportCatalogContext(profile, chart);
    const plans = NATAL_REPORT_ANSWER_KEYS.map((answerKey) => (
      resolveNatalReportAnswerEvidence(built, answerKey)
    ));
    expect(plans.map((plan) => plan.answerKey)).toEqual(
      NATAL_REPORT_ANSWER_KEYS as readonly NatalReportAnswerKey[],
    );
    for (const plan of plans) {
      expect(plan.evidenceIds.length).toBeGreaterThan(0);
      expect(plan.requiredEvidenceIds.length).toBeGreaterThan(0);
      expect(plan.requiredEvidenceIds.every((id) => plan.evidenceIds.includes(id))).toBe(true);
      expect(plan.requiredEvidenceIds.some((id) => /(?:ascendant|descendant|\bmc\b|\bic\b|house)/iu.test(id))).toBe(false);
    }
  });
});
