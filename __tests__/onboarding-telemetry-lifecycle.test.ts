const effects:Array<()=>void | (()=>void)>=[];
const refs:Array<{current:any}>=[];
let cursor=0;
const mockEvent=jest.fn();
let mockVisible=true;
jest.mock('react',()=>({useEffect:(effect:()=>void)=>effects.push(effect),useRef:(value:unknown)=>refs[cursor++] ||= {current:value}}));
jest.mock('../services/sessionService',()=>({recordUserAppEvent:(...args:unknown[])=>mockEvent(...args)}));
jest.mock('../services/appTelemetryClient',()=>({isTraceForeground:()=>mockVisible}));
import { useOnboardingTelemetry } from '../services/useOnboardingTelemetry';

describe('onboarding timing, retries and account boundaries',()=> {
  let win:EventTarget & Record<string,any>,doc:EventTarget & Record<string,any>,cleanup:()=>void;
  const render=(step:string,account='42')=> {cursor=0;effects.length=0;const hook=useOnboardingTelemetry(step,account);effects[0]();return hook;};
  const events=(type:string)=>mockEvent.mock.calls.map(([e])=>e).filter(e=>e.eventType===type);
  beforeEach(()=> {
    jest.useFakeTimers();jest.setSystemTime(new Date('2026-10-10T12:00:00Z'));mockEvent.mockClear();refs.length=0;mockVisible=true;
    win=Object.assign(new EventTarget(),{setInterval,clearInterval});doc=Object.assign(new EventTarget(),{hidden:false});
    Object.defineProperty(globalThis,'window',{configurable:true,value:win});Object.defineProperty(globalThis,'document',{configurable:true,value:doc});
  });
  afterEach(()=> {cleanup?.();jest.useRealTimers();Reflect.deleteProperty(globalThis,'window');Reflect.deleteProperty(globalThis,'document');});
  it('keeps one attempt across windows and excludes native background time',()=> {
    render('hello');cleanup=effects[1]() as ()=>void;
    jest.advanceTimersByTime(4000);render('natal');
    expect(events('onboarding_step_exit')[0].eventPayload.visible_ms).toBe(4000);
    jest.advanceTimersByTime(6000);mockVisible=false;win.dispatchEvent(new Event('nebo-app-visibility'));
    jest.advanceTimersByTime(40000);mockVisible=true;win.dispatchEvent(new Event('nebo-app-visibility'));
    const last=events('onboarding_step_progress').at(-1).eventPayload;
    expect(last).toMatchObject({step:'natal',visible_ms:6000,elapsed_ms:46000});
    expect(new Set(mockEvent.mock.calls.map(([e])=>e.eventPayload.attempt_id)).size).toBe(1);
  });
  it('finishes each wait once, starts a distinct retry and keeps a completed attempt terminal',()=> {
    const hook=render('birth');cleanup=effects[1]() as ()=>void;
    hook.wait('chart');jest.advanceTimersByTime(3000);hook.wait('reading');jest.advanceTimersByTime(7000);hook.finishWait('failed');
    hook.wait('chart');jest.advanceTimersByTime(2000);hook.wait('reading');jest.advanceTimersByTime(4000);hook.finishWait('ready');
    hook.event('onboarding_result_ready');hook.finish('created');render('birth');
    expect(events('onboarding_wait_finished').map(e=>[e.eventPayload.phase,e.eventPayload.outcome,e.eventPayload.elapsed_ms]))
      .toEqual([['chart','ready',3000],['reading','failed',7000],['chart','ready',2000],['reading','ready',4000]]);
    expect(events('onboarding_started')).toHaveLength(1);expect(events('onboarding_completed')).toHaveLength(1);
  });
  it('does not allow a previous account callback to finish the new account wait',()=> {
    const previous=render('birth');cleanup=effects[1]() as ()=>void;
    previous.wait('chart');cleanup();const next=render('birth','99');cleanup=effects[1]() as ()=>void;next.wait('chart');
    const count=mockEvent.mock.calls.length;previous.finishWait('failed');previous.action('retry');previous.finish('created');
    expect(mockEvent).toHaveBeenCalledTimes(count);
    jest.advanceTimersByTime(1500);next.finishWait('ready');expect(events('onboarding_wait_finished').at(-1).eventPayload.elapsed_ms).toBe(1500);
  });
  it('does not enqueue callbacks after the onboarding screen has unmounted',()=> {
    const hook=render('birth');cleanup=effects[1]() as ()=>void;hook.wait('chart');cleanup();
    const count=mockEvent.mock.calls.length;hook.finishWait('cancelled');hook.finish('created');hook.event('onboarding_result_ready');
    expect(mockEvent).toHaveBeenCalledTimes(count);
  });
});
