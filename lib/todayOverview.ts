import type { HoroscopeReactionSummary, Language } from '../types';

const REACTION_LABELS: Record<
  Language,
  Record<NonNullable<HoroscopeReactionSummary['userReaction']>, string>
> = {
  ru: {
    spot_on: 'В точку',
    funny: 'Улыбнуло',
    gentle: 'Бережно',
    not_mine: 'Не мой день',
  },
  en: {
    spot_on: 'Spot on',
    funny: 'Made me smile',
    gentle: 'Gentle',
    not_mine: 'Not mine',
  },
};

export function buildEmptyReactionSummary(language: Language): HoroscopeReactionSummary {
  const labels = REACTION_LABELS[language];
  return {
    userReaction: null,
    counts: (Object.keys(labels) as Array<keyof typeof labels>).map((key) => ({
      key,
      label: labels[key],
      count: 0,
    })),
    total: 0,
  };
}

export function hydrateReactionSummaryLabels(
  summary: HoroscopeReactionSummary | null | undefined,
  language: Language
): HoroscopeReactionSummary {
  const empty = buildEmptyReactionSummary(language);
  const counts = empty.counts.map((item) => ({
    ...item,
    count: summary?.counts.find((count) => count.key === item.key)?.count ?? 0,
  }));

  return {
    userReaction: summary?.userReaction ?? null,
    counts,
    total: counts.reduce((sum, item) => sum + item.count, 0),
  };
}
