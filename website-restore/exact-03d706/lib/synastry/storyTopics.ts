import type { RelationshipContext } from './relationshipContext';

export const COMPATIBILITY_STORY_TOPICS = ['connection', 'closeness', 'conversation', 'friction', 'everyday'] as const;
export type CompatibilityStoryTopic = typeof COMPATIBILITY_STORY_TOPICS[number];

const TITLES: Record<RelationshipContext, Record<CompatibilityStoryTopic, [string, string]>> = {
  romance: {
    connection: ['Что цепляет', 'What catches your attention'], closeness: ['Притяжение и близость', 'Attraction and closeness'],
    conversation: ['Как пойдёт разговор', 'How conversation flows'], friction: ['Где можно не совпасть', 'Where you may differ'],
    everyday: ['Легко ли быть рядом', 'How it feels to be together'],
  },
  relationship: {
    connection: ['Что вас соединяет', 'What brings you together'], closeness: ['Близость и желание', 'Closeness and desire'],
    conversation: ['Как вы слышите друг друга', 'How you hear each other'], friction: ['Что происходит в спорах', 'What happens in disagreements'],
    everyday: ['Жизнь рядом', 'Everyday life together'],
  },
  ex: {
    connection: ['Что могло притягивать', 'What may have drawn you together'], closeness: ['Близость и дистанция', 'Closeness and distance'],
    conversation: ['Если снова заговорить', 'If you talk again'], friction: ['Что может повториться', 'What may come up again'],
    everyday: ['На каких условиях общаться', 'What contact could look like'],
  },
  friendship: {
    connection: ['За что интересно вместе', 'What makes it fun together'], closeness: ['Доверие и поддержка', 'Trust and support'],
    conversation: ['Разговоры без церемоний', 'Speaking freely'], friction: ['Если не сошлись во мнениях', 'When you disagree'],
    everyday: ['Планы, привычки, расстояние', 'Plans, habits, and distance'],
  },
  family: {
    connection: ['Что помогает быть ближе', 'What helps you feel close'], closeness: ['Забота без нажима', 'Care without pressure'],
    conversation: ['Как услышать друг друга', 'Hearing each other'], friction: ['Ожидания и разногласия', 'Expectations and disagreements'],
    everyday: ['Свой выбор и общие дела', 'Your own choices and shared tasks'],
  },
  work: {
    connection: ['В чём вы дополняете друг друга', 'How you complement each other'], closeness: ['Доверие в деле', 'Trust at work'],
    conversation: ['Как обсуждать решения', 'Discussing decisions'], friction: ['Когда мнения расходятся', 'When opinions differ'],
    everyday: ['Темп и ответственность', 'Pace and responsibility'],
  },
};

export function compatibilityTopicTitle(topic: CompatibilityStoryTopic, context: RelationshipContext, language: 'ru' | 'en'): string {
  return TITLES[context][topic][language === 'ru' ? 0 : 1];
}
