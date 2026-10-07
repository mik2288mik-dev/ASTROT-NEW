/**
 * Access to story episodes: only the free series (Тихий переулок) opens without NEBO Premium. In it the first
 * three episodes are free; after that one episode per day opens free. Every other series, and everything
 * else in all series, is open with NEBO Premium.
 */
export const FREE_STORY_EPISODES = 3;
/** The series open for everyone. A new series every month joins the premium ones. */
export const FREE_STORY_SERIES: readonly string[] = ['quiet-lane'];

export function isFreeStorySeries(seriesId: string | null | undefined): boolean {
  return !seriesId || FREE_STORY_SERIES.includes(seriesId);
}

export type EpisodeAccess = 'open' | 'free_unlock_available' | 'locked';

export function episodeAccess(input: {
  /** The series of the episode; omitted only in code that does not know it (treated as a free series). */
  seriesId?: string;
  number: number;
  premium: boolean;
  /** Already unlocked by this person earlier. */
  unlocked: boolean;
  /** A free unlock in this series was already used today. */
  usedTodayInSeries: boolean;
}): EpisodeAccess {
  if (input.premium) return 'open';
  if (!isFreeStorySeries(input.seriesId)) return 'locked';
  if (input.number <= FREE_STORY_EPISODES || input.unlocked) return 'open';
  return input.usedTodayInSeries ? 'locked' : 'free_unlock_available';
}

export type EpisodeRow = { number: number; releaseDate: string; status: 'ready' | 'needs_review' | 'approved' | 'hold' };

/**
 * Episodes visible to readers: released by date and cleared for release, in a
 * row from number 1 — a held episode stops the ones after it, so order stays.
 */
export function releasedEpisodeNumbers(rows: readonly EpisodeRow[], todayKey: string): number[] {
  const sorted = [...rows].sort((a, b) => a.number - b.number);
  const result: number[] = [];
  for (const [index, row] of sorted.entries()) {
    if (row.number !== index + 1) break;
    if (row.releaseDate > todayKey || (row.status !== 'ready' && row.status !== 'approved')) break;
    result.push(row.number);
  }
  return result;
}
