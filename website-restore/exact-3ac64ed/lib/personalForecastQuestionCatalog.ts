export type PersonalForecastQuestionPeriod = 'day' | 'week' | 'month';

export type PersonalForecastQuestionTheme =
  | 'daily'
  | 'relationships'
  | 'family'
  | 'friends'
  | 'career'
  | 'profession'
  | 'work_environment'
  | 'it'
  | 'business'
  | 'money'
  | 'relocation'
  | 'decisions'
  | 'future'
  | 'strengths';

export type PersonalForecastQuestionLanguage = 'ru' | 'en';

export type ApprovedPersonalForecastQuestion = {
  id: string;
  theme: PersonalForecastQuestionTheme;
  periods: readonly PersonalForecastQuestionPeriod[];
  text: Readonly<Record<PersonalForecastQuestionLanguage, string>>;
};

export type LocalizedPersonalForecastQuestion = {
  id: string;
  theme: PersonalForecastQuestionTheme;
  periods: readonly PersonalForecastQuestionPeriod[];
  text: string;
};

const ALL_PERIODS = ['day', 'week', 'month'] as const;
const SHORT_PERIODS = ['day', 'week'] as const;
const MEDIUM_PERIODS = ['week', 'month'] as const;
const LONG_PERIODS = ['month'] as const;
const PLANNING_PERIODS = ['week', 'month'] as const;

/**
 * Audited V3 successor to the 84 RU/EN presets from commit b6cffd7.
 *
 * IDs are deliberately independent from wording so editorial improvements do
 * not invalidate stored references. The catalog excludes the old reflective
 * question-of-day language and generic therapy/coaching prompts.
 */
export const APPROVED_PERSONAL_FORECAST_QUESTIONS = [
  {
    id: 'pfq_001_day_focus',
    theme: 'daily',
    periods: ['day'],
    text: {
      ru: 'На чём мне лучше сосредоточиться сегодня?',
      en: 'What should I focus on today?',
    },
  },
  {
    id: 'pfq_002_day_caution',
    theme: 'daily',
    periods: ['day'],
    text: {
      ru: 'Что сегодня требует особой осторожности?',
      en: 'What calls for extra caution today?',
    },
  },
  {
    id: 'pfq_003_day_conversation',
    theme: 'daily',
    periods: ['day'],
    text: {
      ru: 'Подходит ли сегодняшний день для важного разговора?',
      en: 'Is today suitable for an important conversation?',
    },
  },
  {
    id: 'pfq_004_day_work',
    theme: 'daily',
    periods: ['day'],
    text: {
      ru: 'Какой рабочий вопрос сегодня приоритетнее?',
      en: 'Which work matter deserves priority today?',
    },
  },
  {
    id: 'pfq_005_day_money',
    theme: 'money',
    periods: ['day'],
    text: {
      ru: 'Какое денежное решение сегодня важнее всего?',
      en: 'Which money decision matters most today?',
    },
  },
  {
    id: 'pfq_006_day_relationships',
    theme: 'relationships',
    periods: ['day'],
    text: {
      ru: 'Что важно учесть в отношениях сегодня?',
      en: 'What should I keep in mind in relationships today?',
    },
  },
  {
    id: 'pfq_007_day_risk',
    theme: 'decisions',
    periods: ['day'],
    text: {
      ru: 'Оправдан ли риск, который я рассматриваю сегодня?',
      en: 'Is the risk I am considering today justified?',
    },
  },
  {
    id: 'pfq_008_day_action',
    theme: 'daily',
    periods: ['day'],
    text: {
      ru: 'Какое действие сегодня даст самый заметный результат?',
      en: 'Which action can bring the clearest result today?',
    },
  },
  {
    id: 'pfq_009_love_period',
    theme: 'relationships',
    periods: ALL_PERIODS,
    text: {
      ru: 'Что сейчас главное в моей личной жизни?',
      en: 'What matters most in my love life right now?',
    },
  },
  {
    id: 'pfq_010_relationship_priority',
    theme: 'relationships',
    periods: ALL_PERIODS,
    text: {
      ru: 'Какая тема сейчас определяет мои отношения?',
      en: 'Which theme is shaping my relationships now?',
    },
  },
  {
    id: 'pfq_011_partner_conversation',
    theme: 'relationships',
    periods: SHORT_PERIODS,
    text: {
      ru: 'Как лучше провести важный разговор с партнёром?',
      en: 'How should I handle an important conversation with my partner?',
    },
  },
  {
    id: 'pfq_012_relationship_strength',
    theme: 'relationships',
    periods: LONG_PERIODS,
    text: {
      ru: 'В чём сейчас сильная сторона моих отношений?',
      en: 'What is the strongest part of my relationship now?',
    },
  },
  {
    id: 'pfq_013_relationship_risk',
    theme: 'relationships',
    periods: ['day', 'week', 'month'],
    text: {
      ru: 'Какой риск в отношениях сейчас нельзя игнорировать?',
      en: 'Which relationship risk should not be ignored now?',
    },
  },
  {
    id: 'pfq_014_new_relationship',
    theme: 'relationships',
    periods: LONG_PERIODS,
    text: {
      ru: 'Насколько этот период подходит для новых отношений?',
      en: 'How suitable is this period for a new relationship?',
    },
  },
  {
    id: 'pfq_015_serious_relationship',
    theme: 'relationships',
    periods: LONG_PERIODS,
    text: {
      ru: 'Что период показывает о готовности к серьёзным отношениям?',
      en: 'What does this period show about readiness for a serious relationship?',
    },
  },
  {
    id: 'pfq_016_first_move',
    theme: 'relationships',
    periods: SHORT_PERIODS,
    text: {
      ru: 'Стоит ли мне сейчас сделать первый шаг в отношениях?',
      en: 'Should I make the first move in a relationship now?',
    },
  },
  {
    id: 'pfq_017_second_chance',
    theme: 'relationships',
    periods: MEDIUM_PERIODS,
    text: {
      ru: 'Когда второй шанс в отношениях сейчас оправдан?',
      en: 'When is a second chance in a relationship justified now?',
    },
  },
  {
    id: 'pfq_018_relationship_future',
    theme: 'relationships',
    periods: LONG_PERIODS,
    text: {
      ru: 'Какое направление у моей личной жизни в ближайшие месяцы?',
      en: 'What direction is my love life taking over the coming months?',
    },
  },
  {
    id: 'pfq_019_relationship_conflict',
    theme: 'relationships',
    periods: SHORT_PERIODS,
    text: {
      ru: 'Как лучше решить повторяющийся конфликт в отношениях?',
      en: 'How can I best address a recurring relationship conflict?',
    },
  },
  {
    id: 'pfq_020_love_opportunity',
    theme: 'relationships',
    periods: ['day', 'week', 'month'],
    text: {
      ru: 'Где в этом периоде открывается шанс на новое знакомство?',
      en: 'Where does this period offer a chance for a new connection?',
    },
  },
  {
    id: 'pfq_021_family_priority',
    theme: 'family',
    periods: ALL_PERIODS,
    text: {
      ru: 'Что сейчас важнее всего для дома и семьи?',
      en: 'What matters most for home and family now?',
    },
  },
  {
    id: 'pfq_022_family_conversation',
    theme: 'family',
    periods: SHORT_PERIODS,
    text: {
      ru: 'Как лучше провести важный разговор с близкими?',
      en: 'How should I handle an important conversation with family?',
    },
  },
  {
    id: 'pfq_023_home_decision',
    theme: 'family',
    periods: PLANNING_PERIODS,
    text: {
      ru: 'Подходит ли период для важного решения о доме?',
      en: 'Is this period suitable for an important decision about home?',
    },
  },
  {
    id: 'pfq_024_parents',
    theme: 'family',
    periods: LONG_PERIODS,
    text: {
      ru: 'Что сейчас важно изменить в отношениях с родителями?',
      en: 'What needs to change in my relationship with my parents now?',
    },
  },
  {
    id: 'pfq_025_family_change',
    theme: 'family',
    periods: LONG_PERIODS,
    text: {
      ru: 'Какое семейное изменение становится главным в этом периоде?',
      en: 'Which family change becomes central in this period?',
    },
  },
  {
    id: 'pfq_026_friend_support',
    theme: 'friends',
    periods: SHORT_PERIODS,
    text: {
      ru: 'На чью поддержку из друзей сейчас можно рассчитывать?',
      en: 'Which kind of support from friends can I rely on now?',
    },
  },
  {
    id: 'pfq_027_friendship_conflict',
    theme: 'friends',
    periods: SHORT_PERIODS,
    text: {
      ru: 'Как лучше разобраться с конфликтом между друзьями?',
      en: 'How should I handle a conflict between friends?',
    },
  },
  {
    id: 'pfq_028_social_circle',
    theme: 'friends',
    periods: LONG_PERIODS,
    text: {
      ru: 'Как будет меняться мой круг общения в этом периоде?',
      en: 'How is my social circle likely to change in this period?',
    },
  },
  {
    id: 'pfq_029_work_priority',
    theme: 'career',
    periods: ALL_PERIODS,
    text: {
      ru: 'Что сейчас главное в моей работе?',
      en: 'What matters most in my work right now?',
    },
  },
  {
    id: 'pfq_030_career_week',
    theme: 'career',
    periods: ['week'],
    text: {
      ru: 'На чём сосредоточиться в карьере на этой неделе?',
      en: 'What should I focus on in my career this week?',
    },
  },
  {
    id: 'pfq_031_career_month',
    theme: 'career',
    periods: ['month'],
    text: {
      ru: 'Какой карьерный приоритет выбрать в этом месяце?',
      en: 'Which career priority should I choose this month?',
    },
  },
  {
    id: 'pfq_033_profession_fit',
    theme: 'profession',
    periods: LONG_PERIODS,
    text: {
      ru: 'Какая профессия лучше совпадает с моими сильными сторонами?',
      en: 'Which profession best matches my strengths?',
    },
  },
  {
    id: 'pfq_034_career_direction',
    theme: 'profession',
    periods: LONG_PERIODS,
    text: {
      ru: 'В каком профессиональном направлении мне разумнее развиваться?',
      en: 'Which professional direction makes the most sense for me?',
    },
  },
  {
    id: 'pfq_035_change_job',
    theme: 'career',
    periods: PLANNING_PERIODS,
    text: {
      ru: 'Подходит ли этот период для смены работы?',
      en: 'Is this period suitable for changing jobs?',
    },
  },
  {
    id: 'pfq_036_job_search',
    theme: 'career',
    periods: MEDIUM_PERIODS,
    text: {
      ru: 'Как лучше вести поиск новой работы в этом периоде?',
      en: 'How should I approach a job search in this period?',
    },
  },
  {
    id: 'pfq_037_job_offer',
    theme: 'career',
    periods: ['day', 'week', 'month'],
    text: {
      ru: 'Что важно проверить перед принятием предложения о работе?',
      en: 'What should I check before accepting a job offer?',
    },
  },
  {
    id: 'pfq_038_raise',
    theme: 'career',
    periods: PLANNING_PERIODS,
    text: {
      ru: 'Подходит ли период для разговора о повышении дохода?',
      en: 'Is this a suitable period to discuss a pay increase?',
    },
  },
  {
    id: 'pfq_039_promotion',
    theme: 'career',
    periods: LONG_PERIODS,
    text: {
      ru: 'Что сейчас сильнее всего влияет на моё повышение?',
      en: 'What has the strongest influence on my promotion prospects now?',
    },
  },
  {
    id: 'pfq_040_work_environment',
    theme: 'work_environment',
    periods: ['day', 'week', 'month'],
    text: {
      ru: 'В какой рабочей среде я показываю лучший результат?',
      en: 'In which work environment do I perform best?',
    },
  },
  {
    id: 'pfq_041_team_role',
    theme: 'work_environment',
    periods: MEDIUM_PERIODS,
    text: {
      ru: 'Какая роль в команде подходит мне лучше всего?',
      en: 'Which role in a team suits me best?',
    },
  },
  {
    id: 'pfq_042_manager_conversation',
    theme: 'work_environment',
    periods: SHORT_PERIODS,
    text: {
      ru: 'Как лучше провести важный разговор с руководителем?',
      en: 'How should I handle an important conversation with my manager?',
    },
  },
  {
    id: 'pfq_043_career_opportunity',
    theme: 'career',
    periods: PLANNING_PERIODS,
    text: {
      ru: 'Где сейчас находится главная карьерная возможность?',
      en: 'Where is the main career opportunity now?',
    },
  },
  {
    id: 'pfq_044_career_risk',
    theme: 'career',
    periods: ['day', 'week', 'month'],
    text: {
      ru: 'Какой карьерный риск сейчас наиболее существенен?',
      en: 'Which career risk matters most now?',
    },
  },
  {
    id: 'pfq_045_enter_it',
    theme: 'it',
    periods: LONG_PERIODS,
    text: {
      ru: 'Подходит ли мне переход в IT?',
      en: 'Would a move into IT suit me?',
    },
  },
  {
    id: 'pfq_046_it_direction',
    theme: 'it',
    periods: LONG_PERIODS,
    text: {
      ru: 'Какое направление в IT лучше совпадает с моими сильными сторонами?',
      en: 'Which area of IT best matches my strengths?',
    },
  },
  {
    id: 'pfq_047_it_role',
    theme: 'it',
    periods: LONG_PERIODS,
    text: {
      ru: 'Какая роль в IT подходит мне больше: техническая, продуктовая или управленческая?',
      en: 'Which IT role suits me better: technical, product, or management?',
    },
  },
  {
    id: 'pfq_048_it_skill',
    theme: 'it',
    periods: PLANNING_PERIODS,
    text: {
      ru: 'Какой навык важнее развить для работы в IT?',
      en: 'Which skill matters most for my work in IT?',
    },
  },
  {
    id: 'pfq_049_it_job_change',
    theme: 'it',
    periods: PLANNING_PERIODS,
    text: {
      ru: 'Подходит ли период для смены работы внутри IT?',
      en: 'Is this period suitable for changing jobs within IT?',
    },
  },
  {
    id: 'pfq_050_it_project',
    theme: 'it',
    periods: MEDIUM_PERIODS,
    text: {
      ru: 'Подходит ли период для запуска собственного IT-проекта?',
      en: 'Is this period suitable for launching my own IT project?',
    },
  },
  {
    id: 'pfq_051_entrepreneurship',
    theme: 'business',
    periods: LONG_PERIODS,
    text: {
      ru: 'Насколько мне подходит предпринимательство?',
      en: 'How well does entrepreneurship suit me?',
    },
  },
  {
    id: 'pfq_052_business_direction',
    theme: 'business',
    periods: LONG_PERIODS,
    text: {
      ru: 'В каком направлении мне разумнее развивать бизнес?',
      en: 'Which direction makes the most sense for my business?',
    },
  },
  {
    id: 'pfq_053_business_week',
    theme: 'business',
    periods: ['week'],
    text: {
      ru: 'Что важнее всего для бизнеса на этой неделе?',
      en: 'What matters most for business this week?',
    },
  },
  {
    id: 'pfq_054_business_month',
    theme: 'business',
    periods: ['month'],
    text: {
      ru: 'Какой бизнес-приоритет выбрать в этом месяце?',
      en: 'Which business priority should I choose this month?',
    },
  },
  {
    id: 'pfq_056_business_risk',
    theme: 'business',
    periods: PLANNING_PERIODS,
    text: {
      ru: 'Какой риск для бизнеса сейчас наиболее существенен?',
      en: 'Which business risk matters most now?',
    },
  },
  {
    id: 'pfq_057_business_partner',
    theme: 'business',
    periods: LONG_PERIODS,
    text: {
      ru: 'Что важно учитывать при выборе делового партнёра?',
      en: 'What should I consider when choosing a business partner?',
    },
  },
  {
    id: 'pfq_058_business_income',
    theme: 'business',
    periods: LONG_PERIODS,
    text: {
      ru: 'Где у бизнеса главный резерв роста дохода?',
      en: 'Where is the strongest potential for higher business income?',
    },
  },
  {
    id: 'pfq_059_money_priority',
    theme: 'money',
    periods: ALL_PERIODS,
    text: {
      ru: 'Что сейчас главное в моих финансах?',
      en: 'What matters most in my finances now?',
    },
  },
  {
    id: 'pfq_060_income_growth',
    theme: 'money',
    periods: PLANNING_PERIODS,
    text: {
      ru: 'Где в этом периоде реальнее увеличить доход?',
      en: 'Where is higher income most realistic in this period?',
    },
  },
  {
    id: 'pfq_061_large_income',
    theme: 'money',
    periods: LONG_PERIODS,
    text: {
      ru: 'Есть ли основание рассчитывать на крупный доход в этом периоде?',
      en: 'Is there a solid basis for expecting a large income in this period?',
    },
  },
  {
    id: 'pfq_062_investment',
    theme: 'money',
    periods: PLANNING_PERIODS,
    text: {
      ru: 'Подходит ли этот период для инвестиций?',
      en: 'Is this period suitable for investing?',
    },
  },
  {
    id: 'pfq_063_major_purchase',
    theme: 'money',
    periods: MEDIUM_PERIODS,
    text: {
      ru: 'Подходит ли этот период для крупной покупки?',
      en: 'Is this period suitable for a major purchase?',
    },
  },
  {
    id: 'pfq_064_financial_risk',
    theme: 'money',
    periods: ['day', 'week', 'month'],
    text: {
      ru: 'Какой финансовый риск сейчас важнее учесть?',
      en: 'Which financial risk matters most now?',
    },
  },
  {
    id: 'pfq_065_savings',
    theme: 'money',
    periods: LONG_PERIODS,
    text: {
      ru: 'Как лучше распределить деньги между расходами и накоплениями?',
      en: 'How should I divide money between spending and saving?',
    },
  },
  {
    id: 'pfq_066_money_decision',
    theme: 'money',
    periods: ['day', 'week', 'month'],
    text: {
      ru: 'Какое денежное решение сейчас требует особой ясности?',
      en: 'Which money decision needs the most clarity now?',
    },
  },
  {
    id: 'pfq_067_relocation_timing',
    theme: 'relocation',
    periods: PLANNING_PERIODS,
    text: {
      ru: 'Подходит ли этот период для переезда?',
      en: 'Is this period suitable for relocation?',
    },
  },
  {
    id: 'pfq_068_relocation_place',
    theme: 'relocation',
    periods: LONG_PERIODS,
    text: {
      ru: 'Что важнее учитывать при выборе места для переезда?',
      en: 'What matters most when choosing a place to relocate?',
    },
  },
  {
    id: 'pfq_069_relocation_risk',
    theme: 'relocation',
    periods: PLANNING_PERIODS,
    text: {
      ru: 'Какой риск переезда сейчас наиболее вероятен?',
      en: 'Which relocation risk is most likely now?',
    },
  },
  {
    id: 'pfq_070_relocation_adaptation',
    theme: 'relocation',
    periods: LONG_PERIODS,
    text: {
      ru: 'Какая сторона адаптации после переезда будет самой сложной?',
      en: 'Which part of adapting after a move is likely to be hardest?',
    },
  },
  {
    id: 'pfq_071_major_decision',
    theme: 'decisions',
    periods: ALL_PERIODS,
    text: {
      ru: 'Подходит ли этот период для крупного решения?',
      en: 'Is this period suitable for a major decision?',
    },
  },
  {
    id: 'pfq_072_wait_or_act',
    theme: 'decisions',
    periods: SHORT_PERIODS,
    text: {
      ru: 'Мне сейчас лучше ждать или действовать?',
      en: 'Is it better for me to wait or act now?',
    },
  },
  {
    id: 'pfq_073_two_options',
    theme: 'decisions',
    periods: ['day', 'week', 'month'],
    text: {
      ru: 'Что расчёт говорит о моменте выбора между двумя важными вариантами?',
      en: 'What does the calculation show about choosing between two important options now?',
    },
  },
  {
    id: 'pfq_074_decision_risk',
    theme: 'decisions',
    periods: ['day', 'week', 'month'],
    text: {
      ru: 'Какой риск важного решения сейчас легко недооценить?',
      en: 'Which risk in an important decision is easy to underestimate now?',
    },
  },
  {
    id: 'pfq_075_contract',
    theme: 'decisions',
    periods: ['day', 'week', 'month'],
    text: {
      ru: 'Подходит ли этот период для подписания важного договора?',
      en: 'Is this period suitable for signing an important agreement?',
    },
  },
  {
    id: 'pfq_076_new_project',
    theme: 'decisions',
    periods: ALL_PERIODS,
    text: {
      ru: 'Подходит ли этот период для начала нового проекта?',
      en: 'Is this period suitable for starting a new project?',
    },
  },
  {
    id: 'pfq_077_near_future',
    theme: 'future',
    periods: MEDIUM_PERIODS,
    text: {
      ru: 'Что в ближайшем будущем уже видно достаточно уверенно?',
      en: 'What can already be seen clearly enough in my near future?',
    },
  },
  {
    id: 'pfq_079_next_stage',
    theme: 'future',
    periods: LONG_PERIODS,
    text: {
      ru: 'Какой следующий этап обозначается в моей жизни?',
      en: 'Which next stage is taking shape in my life?',
    },
  },
  {
    id: 'pfq_081_main_strength',
    theme: 'strengths',
    periods: ALL_PERIODS,
    text: {
      ru: 'В чём моя главная сильная сторона?',
      en: 'What is my strongest quality?',
    },
  },
  {
    id: 'pfq_082_work_strength',
    theme: 'strengths',
    periods: PLANNING_PERIODS,
    text: {
      ru: 'Какая сильная сторона сейчас особенно полезна в работе?',
      en: 'Which strength is especially useful in my work now?',
    },
  },
  {
    id: 'pfq_083_underused_strength',
    theme: 'strengths',
    periods: LONG_PERIODS,
    text: {
      ru: 'Какую способность я сейчас использую меньше, чем мог бы?',
      en: 'Which ability am I using less than I could right now?',
    },
  },
  {
    id: 'pfq_084_strength_field',
    theme: 'strengths',
    periods: LONG_PERIODS,
    text: {
      ru: 'В какой сфере мои сильные стороны дают лучший результат?',
      en: 'In which field can my strengths produce the best result?',
    },
  },
] as const satisfies readonly ApprovedPersonalForecastQuestion[];

const CATALOG_BY_ID = new Map<string, ApprovedPersonalForecastQuestion>(
  APPROVED_PERSONAL_FORECAST_QUESTIONS.map((question) => [question.id, question]),
);

export function normalizePersonalForecastQuestionSearch(value: string): string {
  return String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function questionSupportsPeriod(
  question: ApprovedPersonalForecastQuestion,
  period: PersonalForecastQuestionPeriod,
): boolean {
  return question.periods.includes(period);
}

export function findApprovedPersonalForecastQuestionById(
  id: string,
): ApprovedPersonalForecastQuestion | null {
  return CATALOG_BY_ID.get(String(id || '').trim()) || null;
}

export function findApprovedPersonalForecastQuestionByText(
  value: string,
  language?: PersonalForecastQuestionLanguage,
): ApprovedPersonalForecastQuestion | null {
  const needle = normalizePersonalForecastQuestionSearch(value);
  if (!needle) return null;
  return APPROVED_PERSONAL_FORECAST_QUESTIONS.find((question) => {
    const languages = language ? [language] : (['ru', 'en'] as const);
    return languages.some(
      (item) => normalizePersonalForecastQuestionSearch(question.text[item]) === needle,
    );
  }) || null;
}

export function getApprovedPersonalForecastQuestions(input: {
  language: PersonalForecastQuestionLanguage;
  period: PersonalForecastQuestionPeriod;
  query?: string;
  themes?: readonly PersonalForecastQuestionTheme[];
}): LocalizedPersonalForecastQuestion[] {
  const query = normalizePersonalForecastQuestionSearch(input.query || '');
  const queryParts = query.split(' ').filter(Boolean);
  const themeSet = input.themes?.length ? new Set(input.themes) : null;

  return APPROVED_PERSONAL_FORECAST_QUESTIONS
    .filter((question) => questionSupportsPeriod(question, input.period))
    .filter((question) => !themeSet || themeSet.has(question.theme))
    .filter((question) => {
      if (!queryParts.length) return true;
      const haystack = normalizePersonalForecastQuestionSearch([
        question.text[input.language],
        question.text[input.language === 'ru' ? 'en' : 'ru'],
        question.theme,
      ].join(' '));
      return queryParts.every((part) => haystack.includes(part));
    })
    .map((question) => ({
      id: question.id,
      theme: question.theme,
      periods: question.periods,
      text: question.text[input.language],
    }));
}

export function searchApprovedPersonalForecastQuestions(
  query: string,
  language: PersonalForecastQuestionLanguage,
  period: PersonalForecastQuestionPeriod,
): LocalizedPersonalForecastQuestion[] {
  return getApprovedPersonalForecastQuestions({ query, language, period });
}
