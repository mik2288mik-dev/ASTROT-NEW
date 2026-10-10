function memoryStorage():Storage {const values=new Map<string,string>();return {get length(){return values.size;},getItem:k=>values.get(k) ?? null,setItem:(k,v)=>{values.set(k,v);},removeItem:k=>{values.delete(k);},clear:()=>values.clear(),key:i=>[...values.keys()][i] || null};}
describe('queued visits and identity changes',()=> {
  let client:typeof import('../services/appTelemetryClient');let transport:jest.Mock;
  beforeEach(()=> {jest.resetModules();Object.defineProperty(globalThis,'window',{value:{sessionStorage:memoryStorage()},configurable:true});client=require('../services/appTelemetryClient');transport=jest.fn().mockResolvedValue({ok:true,status:200,json:async()=>({token:'test-token'})});});
  afterEach(()=> {client.stopAppTrace();Reflect.deleteProperty(globalThis,'window');});
  it('retries stable IDs, keeps events arriving during a send and drops an old account queue',async()=> {
    client.traceScreen('startup');client.startAppTrace(transport);client.captureAppTrace('screen_view');
    transport.mockResolvedValueOnce({ok:false,status:503});await client.flushAppTrace();
    const first=transport.mock.calls[0][0].events;
    await client.flushAppTrace();expect(transport.mock.calls[1][0].events).toEqual(first);
    client.bindTraceAccount('42');await Promise.resolve();await Promise.resolve();
    client.captureAppTrace('question_submit',{text:'Private question'},'chart');
    const generation=client.traceGeneration();client.bindTraceAccount('99');await Promise.resolve();await Promise.resolve();
    expect(client.traceGeneration()).toBeGreaterThan(generation);
    await client.flushAppTrace();
    const payloads=transport.mock.calls.slice(2).flatMap(([body])=>body.events);
    expect(payloads.some(e=>e.payload.text==='Private question')).toBe(false);
  });
  it('does not collect the admin interface and keeps pre-auth observations when an account first appears',async()=> {
    client.startAppTrace(transport);client.traceScreen('auth');client.captureAppTrace('ui_click',{label:'Гость'});
    client.bindTraceAccount('42');await Promise.resolve();await Promise.resolve();await client.flushAppTrace();
    const events=transport.mock.calls.flatMap(([body])=>body.events);
    expect(events.some(e=>e.type==='ui_click' && e.screen==='auth')).toBe(true);
    expect(events.some(e=>e.type==='identity_ready')).toBe(true);
    client.traceScreen('admin');client.captureAppTrace('ui_click',{label:'Delete account'});await client.flushAppTrace();
    expect(transport.mock.calls.flatMap(([body])=>body.events).some(e=>e.payload.label==='Delete account')).toBe(false);
  });
});
export {};
