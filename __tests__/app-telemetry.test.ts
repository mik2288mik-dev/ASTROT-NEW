jest.mock('../lib/db',()=>({getPool:jest.fn()}));
import { sanitizeTraceEvent, traceOperation, ViewportBlockClock } from '../lib/appTelemetry';
import { JourneyClock, JOURNEY_VERSION } from '../lib/journeyTelemetry';
import { sanitizeUserAppEvent } from '../lib/premiumAnalytics';

const ID='018f1234-5678-4abc-8def-0123456789ab';
const NOW=Date.parse('2026-10-10T12:00:00Z');
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
