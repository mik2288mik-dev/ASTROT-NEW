/** Optional real PostgreSQL-in-WASM exercise; installs no repository dependency and never opens DATABASE_URL. */
const pglitePath = process.env.NEBO_ACTIVITY_TEST_PGLITE_PATH;
const postgres = pglitePath ? describe : describe.skip;
let database: any;
jest.mock('../lib/db', () => ({ getPool: () => ({
  query: (sql: string, params?: unknown[]) => database.query(sql, params),
  connect: async () => ({ query: (sql: string, params?: unknown[]) => database.query(sql, params), release: () => undefined }),
}) }));
import { getActivityReport, getUserActivityReport, parseActivityRange } from '../lib/admin/activityAnalytics';
import { recordActivityPulse } from '../lib/productActivityRepository';

postgres('actual PostgreSQL activity queries', () => {
  beforeAll(async () => {
    const { PGlite } = require(pglitePath!);
    database = new PGlite();
    await database.exec(`
      SET TIME ZONE 'UTC';
      CREATE TABLE users (id bigint PRIMARY KEY, created_at timestamp NOT NULL);
      CREATE TABLE user_sessions (session_id text, user_id bigint REFERENCES users(id), telegram_platform text,
        device_label text, started_at timestamp DEFAULT CURRENT_TIMESTAMP, last_seen_at timestamp DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(session_id,user_id));
      CREATE TABLE user_app_events (id bigserial PRIMARY KEY,user_id bigint REFERENCES users(id),event_id text,
        event_type text,section text,source text,payload_json jsonb DEFAULT '{}',occurred_at timestamp DEFAULT CURRENT_TIMESTAMP);
      CREATE UNIQUE INDEX event_id_unique ON user_app_events(event_id) WHERE event_id IS NOT NULL;
      INSERT INTO users VALUES (1,'2026-09-07 00:00'),(2,'2026-09-01'),(3,'2026-09-01'),(4,'2026-09-01');
      INSERT INTO user_sessions(session_id,user_id,started_at,last_seen_at) VALUES
        ('018f1234-5678-4abc-8def-0123456789ab',1,'2026-09-07 08:00','2026-09-07 08:02');
      INSERT INTO user_app_events(user_id,event_type,section,source,occurred_at,payload_json) VALUES
        (1,'onboarding_started','onboarding','app','2026-09-07 08:00','{}'),
        (1,'screen_view','dashboard','app','2026-09-07 08:00:01','{}'),
        (1,'horoscope_opened','personal_forecast','app','2026-09-07 08:00:10','{}'),
        (1,'paywall_view','premium','app','2026-09-07 08:00:20','{}'),
        (1,'checkout_start','premium','app','2026-09-07 08:00:25','{}'),
        (1,'purchase_success','premium','app','2026-09-07 08:00:30','{}'),
        (1,'activity_heartbeat','dashboard','app','2026-09-07 08:00:30','{"measurement_version":1,"active_ms":30000,"session_id":"018f1234-5678-4abc-8def-0123456789ab"}'),
        (1,'activity_heartbeat','dashboard','app','2026-09-07 08:01:00','{"measurement_version":1,"active_ms":30000,"session_id":"018f1234-5678-4abc-8def-0123456789ab"}'),
        (2,'screen_view','chart','app','2026-09-06 21:01:00','{}'),
        (3,'push_sent','dashboard','server','2026-09-07 08:00:00','{}'),
        (4,'screen_view','chart','app','2026-09-06 20:59:59','{}'),
        (4,'screen_view','chart','app','2026-09-07 21:00:00','{}');
    `);
  }, 30_000);
  afterAll(async () => { await database?.close(); });
  const range = () => parseActivityRange({ from:'2026-09-07',to:'2026-09-07',timezone:'Europe/Moscow' },new Date('2026-09-08T12:00Z'));
  it('executes aggregates with local date boundaries, genuine durations and an ordered cohort funnel', async () => {
    const report = await getActivityReport(range());
    expect(report.summary).toMatchObject({ uniqueUsers:2,newUsers:1,returningUsers:1,visits:1,events:6,activeMs:60000,avgActiveMs:60000,measuredVisits:1 });
    expect(report.series).toHaveLength(24);
    expect(report.series.reduce((sum,row)=>sum+row.events,0)).toBe(6);
    expect(report.series.find(row=>row.at==='2026-09-07T00:00:00')?.users).toBe(1);
    expect(report.funnels.map(row=>row.users)).toEqual([1,1,1,1,1]);
    expect(report.topScreens.find(row=>row.key==='dashboard')?.activeMs).toBe(60000);
  });
  it('isolates identified history and preserves unmeasured history as null', async () => {
    const one = await getUserActivityReport('1',range(),undefined,2);
    expect(one.timeline).toHaveLength(2);
    expect(one.nextCursor).not.toBeNull();
    expect(one.visits[0].activeMs).toBe(60000);
    const next = await getUserActivityReport('1',range(),one.nextCursor!,2);
    expect(new Set([...one.timeline,...next.timeline].map(row=>row.id)).size).toBe(4);
    expect(next.timeline.every(row=>row.section!=='chart')).toBe(true);
    const two = await getUserActivityReport('2',range());
    expect(two.summary.activeMs).toBeNull();
    expect(two.timeline).toHaveLength(1);
  });
  it('atomically records a bounded heartbeat, then ignores its duplicate', async () => {
    const sessionId = '018f1234-5678-4abc-8def-0123456789ad';
    await database.query(`INSERT INTO user_app_events(user_id,event_type,payload_json,occurred_at)
      VALUES (2,'activity_heartbeat',$1::jsonb,CURRENT_TIMESTAMP-INTERVAL '30 seconds')`, [JSON.stringify({session_id:sessionId,sequence:0,total_active_ms:0})]);
    const pulse = { sessionId,eventId:'018f1234-5678-4abc-8def-0123456789ae',sequence:1,totalActiveMs:30000,screen:'dashboard' as const,state:'active' as const };
    const first = await recordActivityPulse('2',pulse,{runtime:'web'});
    expect(first).toEqual({ accepted:true,activeMs:30000 });
    const again = await recordActivityPulse('2',pulse,{runtime:'web'});
    expect(again.accepted).toBe(false);
    const stored = await database.query('SELECT * FROM user_sessions WHERE user_id=2 AND session_id=$1',[sessionId]);
    expect(stored.rows).toHaveLength(1);
  });
});
