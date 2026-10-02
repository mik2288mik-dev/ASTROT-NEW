import type { CompatibilityDimensionKey, CompatibilityDimensionResult } from '../../types';
import type { RelationshipContext } from './relationshipContext';

/**
 * A compatibility reading answers the questions people actually ask about the
 * chosen kind of relationship. Each question is backed by calculated dimensions;
 * the short answer comes from the engine, never from the writer.
 */

export type CompatibilityQuestionId =
  | 'romance_attraction' | 'romance_calm' | 'romance_talk' | 'romance_quarrels' | 'romance_trust' | 'romance_future'
  | 'relationship_good' | 'relationship_hear' | 'relationship_quarrels' | 'relationship_home' | 'relationship_freedom' | 'relationship_lasting'
  | 'friendship_yourself' | 'friendship_interests' | 'friendship_support' | 'friendship_secrets' | 'friendship_talk' | 'friendship_quarrels'
  | 'family_close' | 'family_support' | 'family_roles' | 'family_boundaries' | 'family_arguments' | 'family_agree'
  | 'work_decisions' | 'work_talk' | 'work_pace' | 'work_roles' | 'work_reliable' | 'work_pressure';

export type CompatibilityAnswer = 'yes' | 'likely' | 'mixed' | 'hard' | 'unknown';

export type CompatibilityQuestionDefinition = {
  id: CompatibilityQuestionId;
  dimensionIds: CompatibilityDimensionKey[];
  ru: string;
  en: string;
  /** Two-three words for «Сильнее всего — …» lines. */
  shortRu: string;
  shortEn: string;
};

export type CompatibilityQuestionAnswer = {
  id: CompatibilityQuestionId;
  question: string;
  short: string;
  dimensionIds: CompatibilityDimensionKey[];
  /** null when the charts give too little to answer honestly. */
  score: number | null;
  confidence: number;
  answer: CompatibilityAnswer;
  answerLabel: string;
};

type QuestionContext = Exclude<RelationshipContext, 'ex'>;

const QUESTIONS: Record<QuestionContext, CompatibilityQuestionDefinition[]> = {
  romance: [
    { id: 'romance_attraction', dimensionIds: ['attraction'], ru: 'Есть ли взаимное притяжение?', en: 'Is there mutual attraction?', shortRu: 'притяжение', shortEn: 'attraction' },
    { id: 'romance_calm', dimensionIds: ['emotional_closeness'], ru: 'Будет ли вам спокойно вместе?', en: 'Will you feel at ease together?', shortRu: 'спокойствие рядом', shortEn: 'ease together' },
    { id: 'romance_talk', dimensionIds: ['communication'], ru: 'Легко ли вам общаться?', en: 'Is it easy for you to talk?', shortRu: 'общение', shortEn: 'talking' },
    { id: 'romance_quarrels', dimensionIds: ['conflict_ease'], ru: 'Из-за чего можете поссориться?', en: 'What could you argue about?', shortRu: 'ссоры', shortEn: 'arguments' },
    { id: 'romance_trust', dimensionIds: ['trust_boundaries'], ru: 'Можно ли друг другу доверять?', en: 'Can you trust each other?', shortRu: 'доверие', shortEn: 'trust' },
    { id: 'romance_future', dimensionIds: ['stability'], ru: 'Есть ли у этого будущее?', en: 'Does this have a future?', shortRu: 'будущее', shortEn: 'the future' },
  ],
  relationship: [
    { id: 'relationship_good', dimensionIds: ['emotional_closeness'], ru: 'Насколько вам хорошо вместе?', en: 'How good are you together?', shortRu: 'близость', shortEn: 'closeness' },
    { id: 'relationship_hear', dimensionIds: ['communication'], ru: 'Слышите ли вы друг друга?', en: 'Do you hear each other?', shortRu: 'разговоры', shortEn: 'conversations' },
    { id: 'relationship_quarrels', dimensionIds: ['conflict_ease'], ru: 'Из-за чего вы ссоритесь?', en: 'What do you argue about?', shortRu: 'ссоры', shortEn: 'arguments' },
    { id: 'relationship_home', dimensionIds: ['everyday_life'], ru: 'Как вы уживаетесь в быту?', en: 'How do you get along day to day?', shortRu: 'быт', shortEn: 'daily life' },
    { id: 'relationship_freedom', dimensionIds: ['autonomy'], ru: 'Хватает ли каждому свободы?', en: 'Does each of you have enough freedom?', shortRu: 'свобода', shortEn: 'freedom' },
    { id: 'relationship_lasting', dimensionIds: ['stability'], ru: 'Надолго ли это?', en: 'Will this last?', shortRu: 'надёжность', shortEn: 'reliability' },
  ],
  friendship: [
    { id: 'friendship_yourself', dimensionIds: ['authenticity'], ru: 'Можно ли рядом быть собой?', en: 'Can you be yourselves together?', shortRu: 'быть собой', shortEn: 'being yourselves' },
    { id: 'friendship_interests', dimensionIds: ['shared_interest'], ru: 'Есть ли у вас общие интересы?', en: 'Do you share interests?', shortRu: 'общие интересы', shortEn: 'shared interests' },
    { id: 'friendship_support', dimensionIds: ['mutual_support'], ru: 'Поддержите ли друг друга в трудный момент?', en: 'Will you support each other when it is hard?', shortRu: 'поддержка', shortEn: 'support' },
    { id: 'friendship_secrets', dimensionIds: ['trust_boundaries'], ru: 'Можно ли доверить друг другу личное?', en: 'Can you trust each other with personal things?', shortRu: 'доверие', shortEn: 'trust' },
    { id: 'friendship_talk', dimensionIds: ['communication'], ru: 'Легко ли вам общаться?', en: 'Is it easy for you to talk?', shortRu: 'общение', shortEn: 'talking' },
    { id: 'friendship_quarrels', dimensionIds: ['conflict_ease'], ru: 'Из-за чего можете поссориться?', en: 'What could you fall out over?', shortRu: 'ссоры', shortEn: 'arguments' },
  ],
  family: [
    { id: 'family_close', dimensionIds: ['emotional_closeness'], ru: 'Насколько вы близки?', en: 'How close are you?', shortRu: 'близость', shortEn: 'closeness' },
    { id: 'family_support', dimensionIds: ['mutual_support'], ru: 'Помогаете ли вы друг другу?', en: 'Do you help each other?', shortRu: 'помощь', shortEn: 'help' },
    { id: 'family_roles', dimensionIds: ['role_balance'], ru: 'Кто за что отвечает?', en: 'Who takes care of what?', shortRu: 'обязанности', shortEn: 'responsibilities' },
    { id: 'family_boundaries', dimensionIds: ['trust_boundaries'], ru: 'Не вмешиваетесь ли вы в жизнь друг друга?', en: 'Do you interfere in each other’s lives?', shortRu: 'границы', shortEn: 'boundaries' },
    { id: 'family_arguments', dimensionIds: ['conflict_ease'], ru: 'Почему повторяются одни и те же споры?', en: 'Why do the same arguments repeat?', shortRu: 'споры', shortEn: 'arguments' },
    { id: 'family_agree', dimensionIds: ['communication'], ru: 'Как вам проще договариваться?', en: 'How can you agree more easily?', shortRu: 'договариваться', shortEn: 'agreeing' },
  ],
  work: [
    { id: 'work_decisions', dimensionIds: ['decision_making'], ru: 'Как вы принимаете решения вместе?', en: 'How do you make decisions together?', shortRu: 'решения', shortEn: 'decisions' },
    { id: 'work_talk', dimensionIds: ['communication'], ru: 'Понимаете ли вы друг друга в работе?', en: 'Do you understand each other at work?', shortRu: 'понимание', shortEn: 'understanding' },
    { id: 'work_pace', dimensionIds: ['work_rhythm'], ru: 'Совпадает ли ваш темп?', en: 'Does your pace match?', shortRu: 'темп', shortEn: 'pace' },
    { id: 'work_roles', dimensionIds: ['role_balance'], ru: 'Как поделить роли?', en: 'How should you split roles?', shortRu: 'роли', shortEn: 'roles' },
    { id: 'work_reliable', dimensionIds: ['responsibility'], ru: 'Можно ли друг на друга положиться?', en: 'Can you rely on each other?', shortRu: 'надёжность', shortEn: 'reliability' },
    { id: 'work_pressure', dimensionIds: ['pressure_response'], ru: 'Что будет, когда горят сроки?', en: 'What happens when deadlines are tight?', shortRu: 'сроки', shortEn: 'deadlines' },
  ],
};

export const ALL_COMPATIBILITY_QUESTION_IDS = Object.values(QUESTIONS).flatMap((items) => items.map((item) => item.id));

/** Below this, the charts do not hold enough facts for the dimension — say so instead of showing a number. */
export const MIN_ANSWER_CONFIDENCE = 20;

export function compatibilityQuestionsFor(context: RelationshipContext): CompatibilityQuestionDefinition[] {
  return QUESTIONS[context === 'ex' ? 'relationship' : context];
}

const ANSWER_LABELS: Record<CompatibilityAnswer, [string, string]> = {
  yes: ['да', 'yes'],
  likely: ['скорее да', 'mostly yes'],
  mixed: ['по-разному', 'it varies'],
  hard: ['непросто', 'not easy'],
  unknown: ['мало данных', 'not enough data'],
};

export function compatibilityAnswerFor(score: number | null): CompatibilityAnswer {
  if (score == null) return 'unknown';
  if (score >= 78) return 'yes';
  if (score >= 62) return 'likely';
  if (score >= 48) return 'mixed';
  return 'hard';
}

export function compatibilityAnswerLabel(answer: CompatibilityAnswer, language: 'ru' | 'en'): string {
  return ANSWER_LABELS[answer][language === 'en' ? 1 : 0];
}

export function answerCompatibilityQuestions(
  context: RelationshipContext,
  dimensions: CompatibilityDimensionResult[],
  language: 'ru' | 'en',
): CompatibilityQuestionAnswer[] {
  const byId = new Map(dimensions.map((item) => [item.id, item]));
  return compatibilityQuestionsFor(context).map((definition) => {
    const related = definition.dimensionIds
      .map((id) => byId.get(id))
      .filter((item): item is CompatibilityDimensionResult => item != null);
    const confidence = related.length ? Math.round(related.reduce((sum, item) => sum + item.confidence, 0) / related.length) : 0;
    const score = related.length && confidence >= MIN_ANSWER_CONFIDENCE
      ? Math.round(related.reduce((sum, item) => sum + item.score, 0) / related.length)
      : null;
    const answer = compatibilityAnswerFor(score);
    return {
      id: definition.id,
      question: language === 'en' ? definition.en : definition.ru,
      short: language === 'en' ? definition.shortEn : definition.shortRu,
      dimensionIds: definition.dimensionIds,
      score,
      confidence,
      answer,
      answerLabel: compatibilityAnswerLabel(answer, language),
    };
  });
}
