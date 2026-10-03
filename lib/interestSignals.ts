/**
 * What the person keeps coming back to, counted on this device for the
 * «Для тебя» rules: compatibility visits, relationship topics, opened pairs.
 * Only counts and ids are stored, never texts.
 */

export type InterestSignals = {
  compatibilityOpens: number;
  loveReads: number;
  /** Saved-person chart ids whose pair reading was opened. */
  openedPairs: string[];
};

const PREFIX = 'nebo.interest.v1';
const EMPTY: InterestSignals = { compatibilityOpens: 0, loveReads: 0, openedPairs: [] };

function storageKey(userId: string): string {
  return `${PREFIX}:${userId}`;
}

export function readInterestSignals(userId: string): InterestSignals {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey(userId)) || 'null') as Partial<InterestSignals> | null;
    return {
      compatibilityOpens: Number(parsed?.compatibilityOpens) || 0,
      loveReads: Number(parsed?.loveReads) || 0,
      openedPairs: Array.isArray(parsed?.openedPairs) ? parsed!.openedPairs.map(String).slice(-50) : [],
    };
  } catch {
    return EMPTY;
  }
}

function update(userId: string, change: (current: InterestSignals) => InterestSignals): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(change(readInterestSignals(userId))));
  } catch {
    // Counting is a nicety; blocked storage must not break navigation.
  }
}

export function noteCompatibilityOpened(userId: string, partnerChartId?: string | number | null): void {
  update(userId, (current) => ({
    ...current,
    compatibilityOpens: current.compatibilityOpens + 1,
    openedPairs: partnerChartId != null && !current.openedPairs.includes(String(partnerChartId))
      ? [...current.openedPairs, String(partnerChartId)]
      : current.openedPairs,
  }));
}

export function noteLoveInterest(userId: string): void {
  update(userId, (current) => ({ ...current, loveReads: current.loveReads + 1 }));
}
