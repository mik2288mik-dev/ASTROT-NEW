const pglitePath=process.env.NEBO_ACTIVITY_TEST_PGLITE_PATH;
const postgres=pglitePath ? describe : describe.skip;
let database:any;
jest.mock('../lib/db',()=>({getPool:()=>({query:(sql:string,params?:unknown[])=>database.query(sql,params),connect:async()=>({query:(sql:string,params?:unknown[])=>database.query(sql,params),release:()=>undefined})})}));
jest.mock('../lib/admin/rbac',()=>({requireAdminPermission:async()=>({permissions:['analytics.view','users.view','user.pii.view']})}));
import { APP_TELEMETRY_SCHEMA_SQL, recordAppTrace } from '../lib/appTelemetryRepository';
import { loadAppTrace, buildAppTraceReport } from '../lib/admin/appTelemetryAnalytics';
import { loadJourneyEvents } from '../lib/admin/journeyAnalytics';
import { parseActivityRange } from '../lib/admin/activityAnalytics';
import type { AppTraceEvent } from '../lib/appTelemetry';
import { randomUUID } from 'crypto';
import adminHandler from '../pages/api/admin/v2/app-telemetry';
postgres('actual PostgreSQL trace persistence and report queries',()=> {
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
    const range=parseActivityRange({period:'day'});
    const all=await loadAppTrace(range,{version:'1.0.13'});
    expect(all.rows).toHaveLength(1);expect(all.rows[0].userId).toBe('1');
    expect(buildAppTraceReport(all.rows,range).summary.users).toBe(1);
    expect((await loadAppTrace(range,{segment:'new'})).rows).toHaveLength(0);
    expect((await loadAppTrace(range,{segment:'returning'})).rows).toHaveLength(1);
  });
  it('runs onboarding SQL against bigint identities and the unknown-version filter',async()=> {
    const now=new Date();const payload={journey_version:'onboarding-v1',attempt_id:randomUUID(),sequence:0,step:'hello'};
    await database.query(`INSERT INTO user_app_events(user_id,event_type,section,payload_json,occurred_at) VALUES(1,'onboarding_started','onboarding',$1,NOW() AT TIME ZONE 'UTC')`,[JSON.stringify(payload)]);
    const result=await loadJourneyEvents(parseActivityRange({period:'day'},now),'1','unknown');
    expect(result.events).toHaveLength(1);expect(result.events[0].userId).toBe('1');
  });
  it('keeps the starting cohort when a returning visit has another version and segment',async()=> {
    const start=Date.now()-3*86400000;
    await database.query("INSERT INTO users VALUES(3,'Новый пользователь',to_timestamp($1/1000.0) AT TIME ZONE 'UTC')",[start-3600000]);
    const first=await recordAppTrace({userId:'3',events:[{id:randomUUID(),sequence:0,at:start,type:'screen_view',screen:'dashboard',payload:{}}],metadata:{appVersion:'1.0.13'}});
    const later=await recordAppTrace({userId:'3',events:[{id:randomUUID(),sequence:0,at:start+25*3600000,type:'screen_view',screen:'chart',payload:{}}],metadata:{appVersion:'1.0.14'}});
    expect(first).not.toBe(later);
    const range=parseActivityRange({period:'week'});
    const selected=await loadAppTrace(range,{version:'1.0.13',segment:'new'});
    expect(selected.rows.filter(e=>e.inSegment)).toHaveLength(1);
    expect(selected.rows.some(e=>e.version==='1.0.14' && !e.inSegment)).toBe(true);
    const report=buildAppTraceReport(selected.rows,range);
    expect(report.summary.visits).toBe(1);expect(report.retention[0]).toEqual({day:1,eligible:1,returned:1});
  });
  it('shows only a visit\'s saved questions and warns when a person has more than 500 messages',async()=> {
    await database.exec(`INSERT INTO astrology_threads VALUES(1,'natal-question-v1'),(2,'other');
      INSERT INTO astrology_messages VALUES
        (10,1,1,'user','Вопрос этого посещения','{}',NOW() AT TIME ZONE 'UTC'),
        (11,1,1,'assistant','Ответ этого посещения','{"questionMessageId":10}',NOW() AT TIME ZONE 'UTC'),
        (12,1,1,'user','Другой вопрос того же человека','{}',NOW() AT TIME ZONE 'UTC'),
        (20,2,1,'user','Вопрос другого человека','{}',NOW() AT TIME ZONE 'UTC'),
        (30,1,2,'user','Другая переписка','{}',NOW() AT TIME ZONE 'UTC');`);
    const token=await recordAppTrace({userId:'1',metadata:{},events:[
      {id:randomUUID(),sequence:0,at:Date.now(),type:'question_submit',screen:'chart',payload:{question_id:10}},
      {id:randomUUID(),sequence:1,at:Date.now(),type:'question_result',screen:'chart',payload:{answer_id:11,outcome:'success'}},
    ]});
    async function detail(query:Record<string,string>) {
      const res:any={setHeader:jest.fn(),status:jest.fn(),json:jest.fn()};res.status.mockReturnValue(res);
      await adminHandler({method:'GET',query:{period:'day',...query}} as any,res);
      expect(res.status).toHaveBeenCalledWith(200);
      return res.json.mock.calls[0][0];
    }
    const visit=await detail({visitId:token.split('.')[0]});
    expect(visit.questions.map((q:{id:number})=>q.id)).toEqual([10,11]);
    expect(visit.questionsTruncated).toBe(false);
    const person=await detail({userId:'1'});
    expect(person.questions.map((q:{id:number})=>q.id)).toEqual([10,11,12]);
    await database.exec(`INSERT INTO astrology_messages
      SELECT id,1,1,'user','Проверочный вопрос','{}',NOW() AT TIME ZONE 'UTC' FROM generate_series(1000,1501) AS id;`);
    const limited=await detail({userId:'1'});
    expect(limited.questions).toHaveLength(500);expect(limited.questionsTruncated).toBe(true);
    expect(limited.questions[0].id).toBe(1002);expect(limited.questions.at(-1).id).toBe(1501);
  });
});
