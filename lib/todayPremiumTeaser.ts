export type TodayPremiumTeaserInsertion = {
  afterSectionId: string;
  lockedCount: number;
};

export function resolveTodayPremiumTeaserInsertion(input: {
  premium: boolean;
  sectionIds: readonly string[];
  lockedSectionIds: ReadonlySet<string>;
}): TodayPremiumTeaserInsertion | null {
  if (input.premium) return null;

  const lockedCount = input.sectionIds.filter((id) => input.lockedSectionIds.has(id)).length;
  if (lockedCount === 0) return null;

  const openSectionIds = input.sectionIds.filter((id) => !input.lockedSectionIds.has(id));
  if (openSectionIds.length < 2) return null;

  return {
    afterSectionId: openSectionIds[1],
    lockedCount,
  };
}
