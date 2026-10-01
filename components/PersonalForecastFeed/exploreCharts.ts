import { getCharts, type ChartListItem } from '../../services/storageService';

/**
 * Charts for the home blocks (explore cards, sky monitor, «Будущее»).
 * The last list is kept on the device, so the blocks render instantly on the
 * next launch while a fresh list loads quietly in the background.
 */
const STORAGE_PREFIX = 'nebo.explore.charts.v1:';
const chartsCache = new Map<string, Promise<ChartListItem[]>>();

type StoredChart = Pick<ChartListItem, 'id' | 'name' | 'is_primary' | 'subject_type' | 'archived_at' | 'chart_data'>;

function readStored(userId: string): ChartListItem[] | null {
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${userId}`);
    const parsed = raw ? JSON.parse(raw) as StoredChart[] : null;
    return Array.isArray(parsed) ? parsed as ChartListItem[] : null;
  } catch {
    return null;
  }
}

function writeStored(userId: string, charts: ChartListItem[]): void {
  try {
    const compact: StoredChart[] = charts.map(({ id, name, is_primary, subject_type, archived_at, chart_data }) => (
      { id, name, is_primary, subject_type, archived_at, chart_data }
    ));
    window.localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(compact));
  } catch {
    // Storage full or blocked: the blocks still work from the network.
  }
}

/** The list saved on this device last time, for an instant first render. */
export function peekExploreCharts(userId: string): ChartListItem[] | null {
  return typeof window === 'undefined' ? null : readStored(userId);
}

export function loadExploreCharts(userId: string): Promise<ChartListItem[]> {
  let pending = chartsCache.get(userId);
  if (!pending) {
    pending = getCharts(userId, { repairPrimary: false })
      .then((response) => {
        writeStored(userId, response.charts);
        return response.charts;
      })
      .catch(() => {
        chartsCache.delete(userId);
        return peekExploreCharts(userId) ?? [];
      });
    chartsCache.set(userId, pending);
  }
  return pending;
}
