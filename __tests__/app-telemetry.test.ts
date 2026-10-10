jest.mock('../lib/db',()=>({getPool:jest.fn()}));
import { sanitizeTraceEvent, traceOperation, ViewportBlockClock } from '../lib/appTelemetry';
import { buildAppTraceReport, type TraceRow } from '../lib/admin/appTelemetryAnalytics';
import { buildJourneyReport, type JourneyEvent } from '../lib/admin/journeyAnalytics';
import { JourneyClock, JOURNEY_VERSION } from '../lib/journeyTelemetry';
import { sanitizeUserAppEvent } from '../lib/premiumAnalytics';
import type { AdminActivityRange } from '../lib/admin/activityTypes';
import { operationLabel, traceNote } from '../lib/admin/telemetryCopy';

const ID='018f1234-5678-4abc-8def-0123456789ab';
const NOW=Date.parse('2026-10-10T12:00:00Z');
const RANGE:AdminActivityRange={from:'2026-10-01',to:'2026-10-10',timezone:'Europe/Moscow',period:'custom',bucket:'day'};
function row(type:TraceRow['type'],sequence:number,payload:TraceRow['payload']={},at=NOW-3*86_400_000):TraceRow {
  return {id:`e${sequence}`,visitId:'visit1',userId:'42',name:'Тестовый пользователь',version:'1.0.13',runtime:'native',campaign:null,userCreatedAt:'2026-09-01T00:00:00Z',
    startedAt:new Date(NOW-3*86_400_000).toISOString(),at:at+sequence*1000,screen:'chart',type,sequence,payload};
}
function journey(type:string,sequence:number,payload:Record<string,unknown>={},attempt='a'):JourneyEvent {
  return {id:`${attempt}:${sequence}`,userId:'42',name:null,at:new Date(NOW-3*86_400_000+sequence*1000).toISOString(),type,section:'onboarding',
    payload:{journey_version:JOURNEY_VERSION,attempt_id:attempt,sequence,step:'birth',view_id:ID,...payload}};
}
describe('safe, bounded app telemetry',()=> {
  it('retains question text only in the explicit chart question event and rejects arbitrary form values',()=> {
    const base={id:ID,sequence:0,at:NOW,type:'field_changed',screen:'auth',payload:{password:'secret',value:'123456',text:'private',field:'email',filled:true}};
    expect(sanitizeTraceEvent(base,NOW)?.payload).toEqual({field:'email',filled:true});
    expect(sanitizeTraceEvent({...base,type:'question_submit',screen:'chart',payload:{text:'Какую работу выбрать?',length:21}},NOW)?.payload.text).toBe('Какую работу выбрать?');
    expect(sanitizeTraceEvent({...base,at:NOW-8*86_400_000},NOW)).toBeNull();
    expect(sanitizeTraceEvent({...base,id:'bad'},NOW)).toBeNull();
    expect(sanitizeTraceEvent({...base,screen:'admin'},NOW)).toBeNull();
  });
  it('never exposes API query parameters, numeric identities or recursively records collection/admin requests',()=> {
    expect(traceOperation('/api/charts/42?userId=private&token=secret')).toBe('/api/charts/:id');
    expect(traceOperation('https://api.tvoi-goroskop.ru/api/content/today/sky?userId=private')).toBe('/api/content/today/sky');
    expect(traceOperation('https://api.tvoi-goroskop.ru/api/telemetry')).toBeNull();
    for(const path of ['/api/telemetry','/api/admin/v2/users','/api/users/events','/api/users/activity']) expect(traceOperation(path)).toBeNull();
  });
  it('counts hidden time as elapsed but never as visible or primary content time',()=> {
    let now=0;const screen=new JourneyClock(0,()=>now);const block=new ViewportBlockClock(()=>now);
    block.sample(true,true);now=4000;expect(block.sample(false,false)).toEqual({visible_ms:4000,focus_ms:4000});
    screen.sample(false);now=64000;screen.sample(true);block.sample(true,false);now=69000;
    expect(screen.sample()).toEqual({elapsed_ms:69000,visible_ms:9000});
    expect(block.sample()).toEqual({visible_ms:9000,focus_ms:4000});
  });
  it('validates onboarding structural codes while removing raw birth values and errors',()=> {
    const e=sanitizeUserAppEvent({eventType:'birth_field_interaction',section:'onboarding',source:'onboarding',eventPayload:{journey_version:JOURNEY_VERSION,attempt_id:ID,field:'place',filled:true,birthDate:'1990-01-01',value:'Казань',error:'token',sequence:4}});
    expect(e?.eventPayload).toEqual({journey_version:JOURNEY_VERSION,attempt_id:ID,field:'place',filled:true,sequence:4});
  });
});
describe('reports built from evidence',()=> {
  it('builds transitions inside a visit, removes self-loops, and counts repeated transitions once per visit',()=> {
    const events=[
      {...row('screen_view',1),screen:'dashboard'},
      {...row('screen_view',2),screen:'dashboard'},
      {...row('screen_view',3),screen:'chart'},
      {...row('screen_view',4),screen:'dashboard'},
      {...row('screen_view',5),screen:'chart'},
      {...row('screen_view',1),visitId:'visit2',screen:'matrix'},
      {...row('screen_view',2),visitId:'visit2',screen:'chart'},
    ];
    const report=buildAppTraceReport(events,RANGE,NOW);
    expect(report.transitions.find(link=>link.from==='dashboard' && link.to==='chart')).toEqual({from:'dashboard',to:'chart',count:2,visits:1});
    expect(report.transitions.some(link=>link.from===link.to || link.from==='chart' && link.to==='matrix')).toBe(false);
    expect(report.visits.find(v=>v.id==='visit1')?.screensVisited).toEqual(['dashboard','chart']);
    expect(report.visits.every(v=>v.state==='stopped')).toBe(true);
    const later={...row('ui_click',6,{},NOW),at:NOW,visitId:'visit1',inSegment:false};
    expect(buildAppTraceReport([...events,later],RANGE,NOW).visits.find(v=>v.id==='visit1')?.state).toBe('continued');
    const recent={...row('screen_view',0,{},NOW),at:NOW,visitId:'recent'};
    expect(buildAppTraceReport([recent],RANGE,NOW).visits[0].state).toBe('recent');
  });
  it('shows a human feature name without technical identifiers in recommendations and history',()=> {
    const operation='/api/content/natal/questions';
    expect(operationLabel(operation)).toContain('Спросить');
    expect(operationLabel('/api/unrecognised-route')).toBe('Загрузка данных приложения');
    const events=Array.from({length:5},(_,i)=>row('request_finished',i,{operation,duration_ms:23000,outcome:'success',status:200}));
    const report=buildAppTraceReport(events,RANGE,NOW);
    const advice=report.insights.find(i=>i.title.startsWith('Долгая загрузка'))!;
    expect(advice.title).toContain('Спросить');expect(advice.evidence).toContain('23 с');
    expect(JSON.stringify(advice)).not.toMatch(/\/api\/|P90|медиана|когорта/);
    expect(traceNote({operation,status:503,outcome:'http_error',state:'hidden',event_name:'internal_code'},ms=>`${ms/1000} с`)).toBe('Вопросы и ответы в «Спросить» · Сервер не выполнил действие · Свернул приложение');
  });
  it('uses ordered steps of the same attempt; skip and pending are not failures',()=> {
    const rows=[journey('onboarding_started',0),journey('birth_data_started',1),journey('birth_data_completed',2),journey('onboarding_result_ready',3),journey('onboarding_completed',4,{outcome:'created'}),
      journey('onboarding_started',0,{},'skip'),journey('onboarding_completed',1,{outcome:'without_chart'},'skip'),
      journey('onboarding_started',0,{},'wrong'),journey('onboarding_result_ready',1,{},'wrong'),journey('birth_data_started',2,{},'wrong'),journey('birth_data_completed',3,{},'wrong'),journey('onboarding_completed',4,{outcome:'created'},'wrong')];
    const report=buildJourneyReport(rows,RANGE,NOW);
    expect(report.funnel.map(e=>e.count)).toEqual([3,2,2,1,1]);
    expect(report.attempts.find(a=>a.id==='a')?.reached).toBe(5);
    expect(report.attempts.find(a=>a.id==='skip')?.reached).toBe(1);
    expect(report.attempts.find(a=>a.id==='wrong')?.reached).toBe(3);
    expect(report.summary.withoutChart).toBe(1);expect(report.summary.noContinuation).toBe(0);
    const pending=buildJourneyReport([journey('onboarding_started',0)],RANGE,NOW-3*86_400_000+10_000);
    expect(pending.summary.pending).toBe(1);
  });
  it('does not double count cumulative dwell samples; compares shown controls within the same view',()=> {
    const rows=[row('screen_view',0,{view_id:'v'}),row('screen_progress',1,{view_id:'v',visible_ms:1000}),row('screen_exit',2,{view_id:'v',visible_ms:6000}),
      row('control_view',3,{view_id:'v',control:'ask',label:'Спросить',visible_ms:1000}),row('control_view',4,{view_id:'v',control:'ask',label:'Спросить',visible_ms:2000}),
      row('ui_click',5,{view_id:'v',control:'ask',label:'Спросить'}),row('ui_click',6,{view_id:'different',control:'ask',label:'Спросить'}),
      row('content_view',7,{view_id:'v',block:'Небо',visible_ms:10000,focus_ms:5000}),row('content_view',8,{view_id:'v',block:'Небо',visible_ms:18000,focus_ms:10000}),row('feed_position',9,{view_id:'v',block:'Небо',state:'scroll_stop',scroll_y:800}),row('feed_position',10,{view_id:'v',block:'Небо',state:'leave'})];
    const report=buildAppTraceReport(rows,RANGE,NOW);
    expect(report.screens[0].medianMs).toBe(6000);
    expect(report.controls[0]).toMatchObject({shown:1,clicked:1,percent:100});
    expect(report.content[0]).toMatchObject({views:1,medianMs:18000,medianFocusMs:10000,stops:1});
  });
  it('matches a question to its result rather than a later unrelated answer',()=> {
    const rows=[row('question_submit',0,{request_id:'q1'}),row('question_submit',1,{request_id:'q2'}),row('question_result',2,{request_id:'q2',outcome:'success',answer_id:10}),row('content_view',3,{block:'Ответ на вопрос #10',visible_ms:1500})];
    expect(buildAppTraceReport(rows,RANGE,NOW).questionFunnel.map(e=>e.count)).toEqual([2,1,1]);
  });
  it('keeps return observations outside the selected period out of activity totals',()=> {
    const range={...RANGE,to:'2026-10-07'};
    const first=row('screen_view',0);
    const returnRow={...row('screen_view',1,{},NOW-2*86_400_000),visitId:'visit2'};
    const report=buildAppTraceReport([first,returnRow],range,NOW);
    expect(report.summary.visits).toBe(1);expect(report.retention[0]).toEqual({day:1,eligible:1,returned:1});
    expect(report.retention[1].eligible).toBe(0);
  });
  it('counts returns to a starting cohort after a version or audience-segment change',()=> {
    const first=row('screen_view',0),later={...row('screen_view',1,{},NOW-2*86_400_000),version:'1.0.14',visitId:'visit2',inSegment:false};
    const report=buildAppTraceReport([first,later],RANGE,NOW);
    expect(report.summary.visits).toBe(1);expect(report.retention[0]).toEqual({day:1,eligible:1,returned:1});
    expect(report.versions).toEqual(['1.0.13']);
  });
  it('does not turn missing wait observations into a zero-second measurement',()=> {
    const report=buildJourneyReport([journey('onboarding_started',0),journey('onboarding_result_ready',1),journey('onboarding_completed',2,{outcome:'created'})],RANGE,NOW);
    expect(report.summary.medianWaitMs).toBeNull();
  });
  it('does not count a click before its measured exposure as a conversion',()=> {
    const report=buildAppTraceReport([row('ui_click',0,{view_id:'v',control:'ask'}),row('control_view',1,{view_id:'v',control:'ask',visible_ms:1200})],RANGE,NOW);
    expect(report.controls[0]).toMatchObject({shown:1,clicked:0,percent:0});
  });
});
