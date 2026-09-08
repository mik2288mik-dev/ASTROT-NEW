export type AdminActivityParams = {
  from?: string; to?: string; period?: 'day' | 'week' | 'month' | 'custom';
  timezone?: string; bucket?: 'hour' | 'day'; cursor?: string; limit?: number;
};
export type AdminActivityRange = {
  from: string; to: string; period: 'day' | 'week' | 'month' | 'custom';
  timezone: string; bucket: 'hour' | 'day';
};
export type AdminActivitySummary = {
  visits: number; events: number; activeMs: number | null;
  avgActiveMs: number | null; measuredVisits: number;
};
export type AdminActivityReport = {
  generatedAt: string;
  range: AdminActivityRange;
  summary: AdminActivitySummary & {
    uniqueUsers: number; newUsers: number; returningUsers: number; dau: number; wau: number; mau: number;
  };
  series: Array<{ at: string; users: number; visits: number; events: number; activeMs: number | null }>;
  funnels: Array<{ key: string; label: string; users: number; percent: number | null; pctOfPrev: number | null }>;
  topActions: Array<{ key: string; label: string; events: number; users: number }>;
  topScreens: Array<{ key: string; label: string; events: number; users: number; activeMs: number | null }>;
};
export type AdminUserActivityReport = {
  generatedAt: string; range: AdminActivityRange; summary: AdminActivitySummary;
  timeline: Array<{
    id: string; at: string; label: string; type: string; section: string | null;
    source: string | null; sessionId: string | null; activeMs?: number;
  }>;
  visits: Array<{ id: string; startedAt: string; lastSeenAt: string; device: string | null;
    platform: string | null; activeMs: number | null }>;
  nextCursor: string | null;
};
