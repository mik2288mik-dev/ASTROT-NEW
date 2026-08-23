import type { UserProfile } from '../types';

export type EncyclopediaTopic = {
  id: string;
  title: string;
  category: string;
  eyebrow: string;
  paragraphs: string[];
  simple: string;
};

export const INITIAL_ENCYCLOPEDIA_SCREEN = 'catalog' as const;

const TOPICS_RU: readonly EncyclopediaTopic[] = [
  {
    id: 'mercury-retrograde', title: 'Меркурий ретроградный', category: 'Ретроградный Меркурий', eyebrow: 'Как это работает',
    paragraphs: ['Это кажущееся обратное движение Меркурия с точки зрения Земли. В астрологической традиции этот период связывают с более медленным темпом в общении, информации, транспорте и технике.', 'Это не «плохое» время, а повод перепроверить договорённости, вернуться к незавершённому и оставить решениям чуть больше пространства.'],
    simple: 'Не торопите ясность: перечитайте сообщение, уточните адрес и оставьте плану возможность измениться.',
  },
  {
    id: 'mercury-signs', title: 'Меркурий в знаках', category: 'Натальная карта', eyebrow: 'Планета в карте',
    paragraphs: ['Положение Меркурия в знаке описывает привычный способ собирать информацию, формулировать мысли и вести разговор.', 'Это не оценка ума и не жёсткий тип личности. Один и тот же человек может говорить по-разному в зависимости от ситуации, опыта и собеседника.'],
    simple: 'Знак Меркурия — скорее привычный почерк мысли, чем готовый сценарий поведения.',
  },
  {
    id: 'mercury-houses', title: 'Меркурий в домах', category: 'Натальная карта', eyebrow: 'Планета в карте',
    paragraphs: ['Дом показывает область жизни, где темы Меркурия — вопросы, обмен информацией и обучение — чаще оказываются заметны.', 'Дома зависят от времени и места рождения. Если время неизвестно или приблизительно, положение дома нельзя считать точно определённым.'],
    simple: 'Знак описывает стиль мышления, а дом — где этот стиль чаще включается.',
  },
  {
    id: 'retrograde-routine', title: 'Как прожить ретроградный Меркурий', category: 'Ретроградный Меркурий', eyebrow: 'Практика',
    paragraphs: ['Не нужен особый режим жизни. Достаточно оставлять запас времени, сохранять важные данные и проговаривать то, что легко понять по-разному.', 'Если всё идёт по плану, не стоит искать проблему специально. Астрологический символ полезен только тогда, когда помогает внимательнее смотреть на реальную ситуацию.'],
    simple: 'Проверить важное — разумно. Останавливать жизнь из-за периода — нет.',
  },
];

const TOPICS_EN: readonly EncyclopediaTopic[] = [
  {
    id: 'mercury-retrograde', title: 'Mercury retrograde', category: 'Mercury retrograde', eyebrow: 'How it works',
    paragraphs: ['This is Mercury appearing to move backwards from Earth. In astrological tradition, the period is associated with a slower pace in communication, information, transport, and technology.', 'It is not inherently a bad time. It can be a useful cue to review agreements, return to unfinished work, and leave decisions a little more room.'],
    simple: 'Do not rush clarity: reread the message, confirm the address, and let a plan change when it needs to.',
  },
  {
    id: 'mercury-signs', title: 'Mercury in the signs', category: 'Natal chart', eyebrow: 'A planet in the chart',
    paragraphs: ['Mercury’s sign describes a familiar way of gathering information, shaping thoughts, and joining a conversation.', 'It is neither an intelligence score nor a fixed personality type. Context, experience, and the other person still matter.'],
    simple: 'Mercury’s sign is a familiar handwriting of thought, not a fixed script.',
  },
  {
    id: 'mercury-houses', title: 'Mercury in the houses', category: 'Natal chart', eyebrow: 'A planet in the chart',
    paragraphs: ['A house points to the area of life where Mercury themes—questions, information exchange, and learning—may be more visible.', 'Houses depend on birth time and place. If time is unknown or approximate, the app should not present an unreliable house as a precise fact.'],
    simple: 'The sign describes the style of thought; the house suggests where that style is often engaged.',
  },
  {
    id: 'retrograde-routine', title: 'Living through Mercury retrograde', category: 'Mercury retrograde', eyebrow: 'Practice',
    paragraphs: ['No special life protocol is required. Leave a little buffer, back up important information, and clarify anything that can be read in two ways.', 'If everything is working, there is no need to invent a problem. An astrological symbol is useful only when it helps you notice the real situation more clearly.'],
    simple: 'Checking what matters is sensible. Putting life on hold is not.',
  },
];

export function getEncyclopediaTopics(language: UserProfile['language']): readonly EncyclopediaTopic[] {
  return language === 'en' ? TOPICS_EN : TOPICS_RU;
}

export function groupTopicsByCategory(topics: readonly EncyclopediaTopic[]): Array<[string, EncyclopediaTopic[]]> {
  const groups = new Map<string, EncyclopediaTopic[]>();
  topics.forEach((topic) => groups.set(topic.category, [...(groups.get(topic.category) || []), topic]));
  return Array.from(groups.entries());
}

export function getRelatedTopics(topics: readonly EncyclopediaTopic[], activeTopicId: string): EncyclopediaTopic[] {
  return topics.filter((topic) => topic.id !== activeTopicId).slice(0, 3);
}
