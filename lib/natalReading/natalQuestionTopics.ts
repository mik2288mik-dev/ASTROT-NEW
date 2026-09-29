import type { NatalMeaningTopic } from '../natalInterpretation';

export type NatalQuestionTopic = 'main' | NatalMeaningTopic;

export const NATAL_QUESTION_TOPICS: readonly NatalQuestionTopic[] = [
  'main',
  'character',
  'emotions',
  'communication',
  'relationships',
  'work',
  'money',
  'home',
  'learning',
  'rest',
];

export const NATAL_QUESTION_TOPIC_TITLES: Record<NatalQuestionTopic, {
  ru: string;
  en: string;
}> = {
  main: { ru: 'Обо всём', en: 'Anything about you' },
  character: { ru: 'Характер', en: 'Character' },
  emotions: { ru: 'Эмоции', en: 'Emotions' },
  communication: { ru: 'Общение', en: 'Communication' },
  relationships: { ru: 'Отношения', en: 'Relationships' },
  work: { ru: 'Работа', en: 'Work' },
  money: { ru: 'Деньги', en: 'Money' },
  home: { ru: 'Дом', en: 'Home' },
  learning: { ru: 'Учёба и новое', en: 'Learning' },
  rest: { ru: 'Отдых и нагрузка', en: 'Rest and workload' },
  general: { ru: 'Общее', en: 'General' },
};

export const NATAL_QUESTION_STARTERS: Record<NatalQuestionTopic, {
  ru: readonly string[];
  en: readonly string[];
}> = {
  main: {
    ru: [
      'Как я обычно принимаю важные решения?',
      'Что у меня лучше получается в работе?',
      'Как я обычно общаюсь с новыми людьми?',
      'Что для меня важно в отношениях?',
    ],
    en: [
      'How do I usually make important decisions?',
      'What tends to work well for me at work?',
      'How do I usually communicate with new people?',
      'What matters to me in relationships?',
    ],
  },
  character: {
    ru: [
      'Как я обычно начинаю новые дела?',
      'Как я реагирую, когда нужно быстро выбрать?',
      'Что во мне заметно другим в первую очередь?',
      'Как я веду себя, когда нужно настоять на своём?',
    ],
    en: [
      'How do I usually start something new?',
      'How do I react when I need to choose quickly?',
      'What do people notice about me first?',
      'How do I act when I need to stand my ground?',
    ],
  },
  emotions: {
    ru: [
      'Как я обычно переживаю сильные эмоции?',
      'Что помогает мне быстрее прийти в себя?',
      'Как я реагирую на напряжённую обстановку?',
      'Что для меня значит чувство комфорта?',
    ],
    en: [
      'How do I usually handle strong emotions?',
      'What helps me settle down after a strong reaction?',
      'How do I react in a tense atmosphere?',
      'What does feeling comfortable mean for me?',
    ],
  },
  communication: {
    ru: [
      'Как я обычно объясняю свои мысли?',
      'Как я веду себя в новом общении?',
      'Мне проще говорить сразу или сначала всё обдумать?',
      'Как я обычно решаю разногласия?',
    ],
    en: [
      'How do I usually explain what I mean?',
      'How do I act in a new conversation?',
      'Do I tend to speak first or think things through first?',
      'How do I usually handle disagreements?',
    ],
  },
  relationships: {
    ru: [
      'Что для меня важно в близких отношениях?',
      'Как я обычно показываю симпатию?',
      'Как я отношусь к близости и личному пространству?',
      'Что для меня важно в договорённостях с партнёром?',
    ],
    en: [
      'What matters to me in close relationships?',
      'How do I usually show attraction or interest?',
      'How do I approach closeness and personal space?',
      'What matters to me in agreements with a partner?',
    ],
  },
  work: {
    ru: [
      'Какой рабочий ритм мне обычно подходит?',
      'Как я обычно беру на себя ответственность?',
      'Как я действую, когда задача становится сложной?',
      'Что помогает мне доводить работу до результата?',
    ],
    en: [
      'What kind of work rhythm usually suits me?',
      'How do I usually take responsibility?',
      'How do I act when a task becomes difficult?',
      'What helps me carry work through to a result?',
    ],
  },
  money: {
    ru: [
      'Как я обычно принимаю денежные решения?',
      'Что для меня важнее в деньгах: стабильность или свобода?',
      'Как я отношусь к риску в деньгах?',
      'На что я обычно опираюсь перед крупной покупкой?',
    ],
    en: [
      'How do I usually make money decisions?',
      'What matters more to me with money: stability or flexibility?',
      'How do I usually approach financial risk?',
      'What do I usually rely on before a large purchase?',
    ],
  },
  home: {
    ru: [
      'Какой домашний ритм мне обычно комфортнее?',
      'Что для меня важно в личном пространстве?',
      'Как я обычно восстанавливаюсь дома?',
      'Насколько для меня важен привычный уклад?',
    ],
    en: [
      'What kind of home rhythm usually feels comfortable to me?',
      'What matters to me in my personal space?',
      'How do I usually recover at home?',
      'How important is a familiar routine to me?',
    ],
  },
  learning: {
    ru: [
      'Как мне обычно проще разбираться в новом?',
      'Как я обычно учусь?',
      'Что помогает мне быстрее понять сложную тему?',
      'Мне проще сначала разобраться в теории или сразу пробовать?',
    ],
    en: [
      'How do I usually understand something new?',
      'How do I usually learn?',
      'What helps me understand a difficult topic faster?',
      'Do I tend to understand theory first or try things immediately?',
    ],
  },
  rest: {
    ru: [
      'Какой отдых мне обычно подходит?',
      'Как я обычно переключаюсь после нагрузки?',
      'Что помогает мне восстановиться после напряжённого дня?',
      'Как я отношусь к рутине и паузам?',
    ],
    en: [
      'What kind of rest usually suits me?',
      'How do I usually switch off after a heavy workload?',
      'What helps me recover after a demanding day?',
      'How do I usually relate to routine and breaks?',
    ],
  },
  general: {
    ru: [
      'Что в моей карте повторяется в разных темах?',
      'Какие качества заметны сразу в нескольких сферах жизни?',
      'Где мои привычные способы действия похожи?',
      'Что объединяет разные части моего разбора?',
    ],
    en: [
      'What repeats across different areas of my chart?',
      'Which qualities show up in several areas of life?',
      'Where do my usual ways of acting look similar?',
      'What connects different parts of my reading?',
    ],
  },
};

export function natalQuestionTopicTitle(
  topic: NatalQuestionTopic,
  language: 'ru' | 'en',
): string {
  return NATAL_QUESTION_TOPIC_TITLES[topic][language];
}
