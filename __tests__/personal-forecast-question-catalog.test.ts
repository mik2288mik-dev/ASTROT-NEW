import {
  APPROVED_PERSONAL_FORECAST_QUESTIONS,
  findApprovedPersonalForecastQuestionById,
  findApprovedPersonalForecastQuestionByText,
  getApprovedPersonalForecastQuestions,
  questionSupportsPeriod,
  searchApprovedPersonalForecastQuestions,
  type PersonalForecastQuestionTheme,
} from '../lib/personalForecastQuestionCatalog';

describe('personal forecast approved question catalog', () => {
  it('keeps the audited bilingual catalog at 84 stable unique entries', () => {
    expect(APPROVED_PERSONAL_FORECAST_QUESTIONS).toHaveLength(84);

    const ids = APPROVED_PERSONAL_FORECAST_QUESTIONS.map(({ id }) => id);
    const ruTexts = APPROVED_PERSONAL_FORECAST_QUESTIONS.map(({ text }) => text.ru);
    const enTexts = APPROVED_PERSONAL_FORECAST_QUESTIONS.map(({ text }) => text.en);

    expect(new Set(ids).size).toBe(84);
    expect(new Set(ruTexts).size).toBe(84);
    expect(new Set(enTexts).size).toBe(84);
    expect(ids.every((id) => /^pfq_\d{3}_[a-z0-9_]+$/.test(id))).toBe(true);
    expect(ruTexts.every((text) => text.trim().length > 0)).toBe(true);
    expect(enTexts.every((text) => text.trim().length > 0)).toBe(true);
  });

  it('covers every required product theme without reflective coaching language', () => {
    const requiredThemes: PersonalForecastQuestionTheme[] = [
      'daily',
      'relationships',
      'family',
      'friends',
      'career',
      'profession',
      'work_environment',
      'it',
      'business',
      'money',
      'relocation',
      'decisions',
      'future',
      'strengths',
    ];
    const themes = new Set(
      APPROVED_PERSONAL_FORECAST_QUESTIONS.map(({ theme }) => theme),
    );
    expect(requiredThemes.every((theme) => themes.has(theme))).toBe(true);

    const allText = APPROVED_PERSONAL_FORECAST_QUESTIONS
      .flatMap(({ text }) => [text.ru, text.en])
      .join('\n')
      .toLocaleLowerCase();
    const forbiddenPhrases = [
      'энергия дня',
      'прислушайся к себе',
      'доверься своему пути',
      'раскрой свой потенциал',
      'сохраняй баланс',
      'listen to yourself',
      'trust your path',
      'unlock your potential',
      'keep your balance',
    ];

    for (const phrase of forbiddenPhrases) {
      expect(allText).not.toContain(phrase);
    }
  });

  it('contains the required concrete work, money, life, and relationship topics', () => {
    const ruText = APPROVED_PERSONAL_FORECAST_QUESTIONS
      .map(({ text }) => text.ru)
      .join('\n')
      .toLocaleLowerCase();

    for (const fragment of [
      'it',
      'професс',
      'карьер',
      'бизнес',
      'крупный доход',
      'смены работы',
      'отношени',
      'семь',
      'переезд',
      'крупного решения',
      'будущ',
      'сильн',
      'рабочей сред',
      'сфере',
    ]) {
      expect(ruText).toContain(fragment);
    }
  });

  it('filters questions by allowed period and preserves catalog order', () => {
    const day = getApprovedPersonalForecastQuestions({
      language: 'ru',
      period: 'day',
    });
    const month = getApprovedPersonalForecastQuestions({
      language: 'ru',
      period: 'month',
    });

    expect(day[0]?.id).toBe('pfq_001_day_focus');
    expect(day.some(({ id }) => id === 'pfq_031_career_month')).toBe(false);
    expect(month.some(({ id }) => id === 'pfq_001_day_focus')).toBe(false);
    expect(month.some(({ id }) => id === 'pfq_031_career_month')).toBe(true);
    expect(
      month.every((item) => {
        const source = findApprovedPersonalForecastQuestionById(item.id);
        return source ? questionSupportsPeriod(source, 'month') : false;
      }),
    ).toBe(true);
  });

  it('searches immediately across both localized texts and themes', () => {
    const relocation = searchApprovedPersonalForecastQuestions(
      'пере',
      'ru',
      'month',
    );
    const career = searchApprovedPersonalForecastQuestions('car', 'en', 'year');
    const itQuestions = getApprovedPersonalForecastQuestions({
      language: 'ru',
      period: 'year',
      query: 'IT',
      themes: ['it'],
    });

    expect(relocation.some(({ theme }) => theme === 'relocation')).toBe(true);
    expect(career.some(({ theme }) => theme === 'career')).toBe(true);
    expect(itQuestions.length).toBeGreaterThan(0);
    expect(itQuestions.every(({ theme }) => theme === 'it')).toBe(true);
  });

  it('resolves stable IDs and normalized exact text', () => {
    expect(
      findApprovedPersonalForecastQuestionById('pfq_067_relocation_timing')
        ?.text.ru,
    ).toBe('Подходит ли этот период для переезда?');
    expect(
      findApprovedPersonalForecastQuestionByText(
        '  ПОДХОДИТ ЛИ ЭТОТ ПЕРИОД ДЛЯ ПЕРЕЕЗДА!!! ',
        'ru',
      )?.id,
    ).toBe('pfq_067_relocation_timing');
  });
});
