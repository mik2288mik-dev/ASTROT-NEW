const pglitePath=process.env.NEBO_ACTIVITY_TEST_PGLITE_PATH;
const postgres=pglitePath ? describe : describe.skip;
let database:any;
jest.mock('../lib/db',()=>({getPool:()=>({query:(sql:string,params?:unknown[])=>database.query(sql,params),connect:async()=>({query:(sql:string,params?:unknown[])=>database.query(sql,params),release:()=>undefined})})}));
import { APP_TELEMETRY_SCHEMA_SQL, recordAppTrace } from '../lib/appTelemetryRepository';
import type { AppTraceEvent } from '../lib/appTelemetry';
import { randomUUID } from 'crypto';
postgres('actual PostgreSQL trace persistence',()=> {
  beforeAll(async()=> {
    const {PGlite}=require(pglitePath!);database=new PGlite();
    await database.exec(`CREATE TABLE users(id bigint PRIMARY KEY,name text,created_at timestamp);
      INSERT INTO users VALUES(1,'Тест 1','2020-01-01'),(2,'Тест 2','2020-01-01');
      CREATE TABLE mytracker_users(user_id bigint,traffic_source text,campaign_title text);
      CREATE TABLE user_app_events(id bigserial,user_id bigint,event_type text,section text,payload_json jsonb,occurred_at timestamp);
      CREATE TABLE astrology_threads(id bigint PRIMARY KEY,thread_kind text);
      CREATE TABLE astrology_messages(id bigint PRIMARY KEY,user_id bigint,thread_id bigint,role text,content_text text,content_payload jsonb,created_at timestamp);
      ${APP_TELEMETRY_SCHEMA_SQL}`);
  },30000);
  afterAll(async()=> {await database?.close();});
  it('links a pre-auth visit only once, deduplicates retries and rejects another account',async()=> {
    const event:AppTraceEvent={id:randomUUID(),sequence:0,at:Date.now(),type:'screen_view',screen:'auth',payload:{view_id:randomUUID()}};
    const token=await recordAppTrace({userId:null,events:[event],metadata:{appVersion:'1.0.13',runtime:'native'}});
    await recordAppTrace({token,userId:'1',events:[event],metadata:{}});
    expect((await database.query('SELECT COUNT(*)::int count FROM product_trace_events')).rows[0].count).toBe(1);
    const visit=(await database.query('SELECT user_id::text,token_hash FROM product_trace_visits')).rows[0];
    expect(visit.user_id).toBe('1');expect(token).not.toContain(visit.token_hash);
    await expect(recordAppTrace({token,userId:'2',events:[],metadata:{}})).rejects.toMatchObject({status:409});
    await expect(recordAppTrace({token:`${token.slice(0,37)}${'a'.repeat(64)}`,userId:'1',events:[],metadata:{}})).rejects.toMatchObject({status:410});
  });
});
