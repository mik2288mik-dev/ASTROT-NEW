import type { Language } from '../../types';

export type RelationshipContext = 'romance' | 'friendship' | 'work' | 'family';

export type RelationshipContextOption = {
  value: RelationshipContext;
  label: { ru: string; en: string };
  hint: { ru: string; en: string };
  backendValue: string;
};

export const RELATIONSHIP_CONTEXT_OPTIONS: readonly RelationshipContextOption[] = [
  {
    value: 'romance',
    label: { ru: 'Любовь', en: 'Love' },
    hint: { ru: 'Пара, симпатия, бывшие', en: 'Partners, crushes, exes' },
    backendValue: 'любовь и романтические отношения',
  },
  {
    value: 'friendship',
    label: { ru: 'Дружба', en: 'Friendship' },
    hint: { ru: 'Друг, подруга, близкий человек', en: 'Friends and close people' },
    backendValue: 'дружба',
  },
  {
    value: 'work',
    label: { ru: 'Работа', en: 'Work' },
    hint: { ru: 'Коллега, партнёр, руководитель', en: 'Colleagues and partners' },
    backendValue: 'работа и деловое партнёрство',
  },
  {
    value: 'family',
    label: { ru: 'Семья', en: 'Family' },
    hint: { ru: 'Родные и семейная динамика', en: 'Relatives and family dynamics' },
    backendValue: 'семья и отношения с родственниками',
  },
] as const;

export function normalizeRelationshipContext(value: unknown): RelationshipContext {
  return RELATIONSHIP_CONTEXT_OPTIONS.some((option) => option.value === value)
    ? value as RelationshipContext
    : 'romance';
}

export function getRelationshipContextOption(
  value: RelationshipContext,
): RelationshipContextOption {
  return RELATIONSHIP_CONTEXT_OPTIONS.find((option) => option.value === value)
    || RELATIONSHIP_CONTEXT_OPTIONS[0];
}

export function getRelationshipContextLabel(
  value: RelationshipContext,
  language: Language,
): string {
  const option = getRelationshipContextOption(value);
  return language === 'en' ? option.label.en : option.label.ru;
}
