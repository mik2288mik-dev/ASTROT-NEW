import type { KnowledgeCategoryId } from './types';

export type KnowledgeLocation =
  | { screen: 'catalog' }
  | { screen: 'category'; categoryId: KnowledgeCategoryId }
  | { screen: 'article'; categoryId: KnowledgeCategoryId; topicId: string };

export type KnowledgeNavigationState = {
  current: KnowledgeLocation;
  history: readonly KnowledgeLocation[];
};

export type KnowledgeNavigationAction =
  | { type: 'open-category'; categoryId: KnowledgeCategoryId }
  | { type: 'open-article'; categoryId: KnowledgeCategoryId; topicId: string }
  | { type: 'back' }
  | { type: 'catalog' };

export const INITIAL_KNOWLEDGE_NAVIGATION: KnowledgeNavigationState = {
  current: { screen: 'catalog' },
  history: [],
};

export function knowledgeNavigationReducer(
  state: KnowledgeNavigationState,
  action: KnowledgeNavigationAction,
): KnowledgeNavigationState {
  if (action.type === 'catalog') return INITIAL_KNOWLEDGE_NAVIGATION;
  if (action.type === 'back') {
    const previous = state.history[state.history.length - 1];
    return previous
      ? { current: previous, history: state.history.slice(0, -1) }
      : INITIAL_KNOWLEDGE_NAVIGATION;
  }
  const current: KnowledgeLocation = action.type === 'open-category'
    ? { screen: 'category', categoryId: action.categoryId }
    : { screen: 'article', categoryId: action.categoryId, topicId: action.topicId };
  return { current, history: [...state.history, state.current] };
}
