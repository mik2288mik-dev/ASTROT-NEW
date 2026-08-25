import type { KnowledgeCategoryId } from './types';

export type KnowledgeHubId =
  | 'foundations'
  | 'planets-signs'
  | 'chart-structure'
  | 'moon-sky'
  | 'motion-forecasting'
  | 'other-concepts';

export type KnowledgeLocation =
  | { screen: 'catalog' }
  | { screen: 'hub'; hubId: KnowledgeHubId }
  | { screen: 'category'; categoryId: KnowledgeCategoryId }
  | { screen: 'article'; categoryId: KnowledgeCategoryId; topicId: string };

export type KnowledgeNavigationState = {
  current: KnowledgeLocation;
  history: readonly KnowledgeHistoryEntry[];
  inlinePreview: KnowledgeInlinePreview | null;
  restoreScrollTop: number | null;
};

export type KnowledgeInlinePreview = {
  targetTopicId: string;
  blockId: string;
  triggerId: string;
};

export type KnowledgeHistoryEntry = {
  location: KnowledgeLocation;
  scrollTop: number;
  inlinePreview: KnowledgeInlinePreview | null;
};

export type KnowledgeNavigationAction =
  | { type: 'open-hub'; hubId: KnowledgeHubId; scrollTop?: number }
  | { type: 'open-category'; categoryId: KnowledgeCategoryId; scrollTop?: number }
  | { type: 'open-article'; categoryId: KnowledgeCategoryId; topicId: string; scrollTop?: number }
  | { type: 'show-inline-preview'; preview: KnowledgeInlinePreview }
  | { type: 'close-inline-preview' }
  | { type: 'back' }
  | { type: 'catalog' };

export const INITIAL_KNOWLEDGE_NAVIGATION: KnowledgeNavigationState = {
  current: { screen: 'catalog' },
  history: [],
  inlinePreview: null,
  restoreScrollTop: null,
};

export function knowledgeNavigationReducer(
  state: KnowledgeNavigationState,
  action: KnowledgeNavigationAction,
): KnowledgeNavigationState {
  if (action.type === 'catalog') return INITIAL_KNOWLEDGE_NAVIGATION;
  if (action.type === 'show-inline-preview') {
    return { ...state, inlinePreview: action.preview };
  }
  if (action.type === 'close-inline-preview') {
    return { ...state, inlinePreview: null };
  }
  if (action.type === 'back') {
    const previous = state.history[state.history.length - 1];
    return previous
      ? {
        current: previous.location,
        history: state.history.slice(0, -1),
        inlinePreview: previous.inlinePreview,
        restoreScrollTop: previous.scrollTop,
      }
      : INITIAL_KNOWLEDGE_NAVIGATION;
  }
  const current: KnowledgeLocation = action.type === 'open-hub'
    ? { screen: 'hub', hubId: action.hubId }
    : action.type === 'open-category'
      ? { screen: 'category', categoryId: action.categoryId }
      : { screen: 'article', categoryId: action.categoryId, topicId: action.topicId };
  const scrollTop = Number.isFinite(action.scrollTop) && (action.scrollTop || 0) > 0
    ? action.scrollTop || 0
    : 0;
  return {
    current,
    history: [...state.history, {
      location: state.current,
      scrollTop,
      inlinePreview: state.inlinePreview,
    }],
    inlinePreview: null,
    restoreScrollTop: null,
  };
}
