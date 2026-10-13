const mockQuery = jest.fn();
jest.mock('../lib/db', () => ({ getPool: () => ({ query: mockQuery }) }));
import { getActivityReport, getUserActivityReport, INTERACTIVE_EVENT_TYPES, parseActivityRange } from '../lib/admin/activityAnalytics';
const now = new Date('2026-09-08T22:30:00Z');
describe('admin activity ranges and results', () => {
  beforeEach(() => jest.clearAllMocks());
  it('uses selected timezone calendar dates, validates real dates and bounds custom ranges', () => {
    expect(parseActivityRange({ period: 'day' }, now)).toMatchObject({ from: '2026-09-09', to: '2026-09-09', bucket: 'hour' });
    expect(parseActivityRange({ period: 'week', timezone: 'America/New_York' }, now)).toMatchObject({ from: '2026-09-02', to: '2026-09-08', bucket: 'day' });
    expect(() => parseActivityRange({ from: '2026-02-30' }, now)).toThrow();
    expect(() => parseActivityRange({ from: '2025-01-01', to: '2026-09-08' }, now)).toThrow();
    expect(() => parseActivityRange({ timezone: 'nope' }, now)).toThrow();
    expect(() => parseActivityRange({ to: '2027-01-01' }, now)).toThrow();
  });
  it('does not turn background sends or generated content into active users', () => {
    expect(INTERACTIVE_EVENT_TYPES).toContain('screen_view');
    expect(INTERACTIVE_EVENT_TYPES).not.toContain('push_sent');
    expect(INTERACTIVE_EVENT_TYPES).not.toContain('purchase_success');
    expect(INTERACTIVE_EVENT_TYPES).not.toContain('first_result_ready');
  });
  it('keeps unmeasured durations null, bounds queries and returns ordered-funnel percentages', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ unique_users: 5, visits: 7, events: 8, new_users: 3, returning_users: 2, active_ms: null }] })
      .mockResolvedValueOnce({ rows: [{ dau: 2, wau: 4, mau: 5 }] })
      .mockResolvedValueOnce({ rows: [{ at: '2026-09-08T00:00:00', users: 5, visits: 7, events: 8, active_ms: null }] })
      .mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ onboarding: 4, forecast: 3, premium: 2, checkout: 1, purchase: 1 }] });
    const report = await getActivityReport(parseActivityRange({ period: 'day' }, now));
    expect(report.summary).toMatchObject({ uniqueUsers: 5, activeMs: null, avgActiveMs: null, measuredVisits: 0, dau: 2 });
    expect(report.series[0].activeMs).toBeNull();
    expect(report.funnels[1]).toMatchObject({ percent: 75, pctOfPrev: 75 });
    expect(mockQuery.mock.calls[0][1].slice(0,3)).toEqual(['2026-09-09','2026-09-09','Europe/Moscow']);
    expect(mockQuery.mock.calls[5][0]).toContain('e.occurred_at >= f.at');
  });
  it('pages a user timeline without exporting payloads, birth data or raw user agents', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 42 }] })
      .mockResolvedValueOnce({ rows: [{ visits: 1, events: 3, active_ms: 30000, measured_visits: 1, avg_active_ms: 30000 }] })
      .mockResolvedValueOnce({ rows: [2,1].map((id) => ({ id, occurred_at: '2026-09-08T12:00:00Z', event_type:'screen_view', section:'chart', source:'app', payload_json:{question:'secret'} })) })
      .mockResolvedValueOnce({ rows: [{ session_id:'visit', started_at:'2026-09-08T12:00:00Z',last_seen_at:'2026-09-08T12:00:30Z',active_ms:30000,user_agent:'secret-agent' }] });
    const report = await getUserActivityReport('42', parseActivityRange({ period:'week' },now), undefined, 1);
    expect(report.nextCursor).toBe('2');
    expect(report.timeline).toHaveLength(1);
    expect(report.summary.activeMs).toBe(30000);
    expect(JSON.stringify(report)).not.toContain('secret');
    expect(mockQuery.mock.calls[2][1][3]).toBe('42');
  });
});
