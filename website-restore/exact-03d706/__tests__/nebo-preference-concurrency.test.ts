import {defaultDesignPreference,parseDesignPatch,mergeDesignPatch} from '../lib/neboDesign/contract';
import {DesignPreferenceStore} from '../lib/neboDesign/preferenceStore';

describe('NEBO preference concurrency and recovery', () => {
 test('serializes a refresh before a new mutation so stale GET cannot undo a save', async () => {
  let reads = 0;
  let release: ((value: import('../lib/neboDesign/preferenceStore').DesignResponse) => void) | undefined;
  const calls: string[] = [];
  const store = new DesignPreferenceStore(async (method, body) => {
   calls.push(method);
   if (method === 'GET' && ++reads === 2) return new Promise(resolve => { release = resolve; });
   if (method === 'GET') return {status:200,data:{eligible:true,preference:defaultDesignPreference()}};
   return {status:200,data:{eligible:true,preference:{...defaultDesignPreference(),design:body?.design,revision:1}}};
  });
  await store.hydrate();
  const refreshing = store.hydrate();
  await Promise.resolve();
  const saving = store.update({design:'nebo-v2'});
  await Promise.resolve();
  expect(calls).toEqual(['GET','GET']);
  release?.({status:200,data:{eligible:true,preference:defaultDesignPreference()}});
  await refreshing; expect(await saving).toBe(true);
  expect(store.getSnapshot().preference.design).toBe('nebo-v2');
 });
 test('rebases a conflicting change onto the current server revision', async () => {
  let conflict = true;
  const calls: number[] = [];
  const store = new DesignPreferenceStore(async (method, body) => {
   if(method === 'GET') return {status:200,data:{eligible:true,preference:{...defaultDesignPreference(),revision:conflict?0:2}}};
   calls.push(body!.expectedRevision);
   if(conflict){conflict=false;return {status:409,data:{code:'DESIGN_REVISION_CONFLICT'}};}
   return {status:200,data:{eligible:true,preference:{...defaultDesignPreference(),theme:body?.theme,revision:3}}};
  });
  await store.hydrate();expect(await store.update({theme:'dark'})).toBe(true);
  expect(calls).toEqual([0,2]);expect(store.getSnapshot().preference.theme).toBe('dark');
 });
 test('server revocation immediately closes preview and blocks subsequent writes', async () => {
  const store = new DesignPreferenceStore(async method => method === 'GET'
   ? {status:200,data:{eligible:true,preference:{...defaultDesignPreference(),design:'nebo-v2'}}}
   : {status:403});
  await store.hydrate();expect(await store.update({theme:'dark'})).toBe(false);
  expect(store.getSnapshot().eligible).toBe(false);
  expect(store.getSnapshot().preference.design).toBe('classic');
  expect(await store.update({design:'nebo-v2'})).toBe(false);
 });
 test('keeps at most 30 per-chart reading positions and never stores raw report text', () => {
  let state=defaultDesignPreference();
  for(let index=0;index<35;index++)state=mergeDesignPatch(state,parseDesignPatch({expectedRevision:state.revision,reading:{entityKey:`chart:${index}`,category:'main',contentVersion:'v1',blockIndex:2,blockOffset:10}}));
  expect(state.readings).toHaveLength(30);
  expect(state.readings[0].entityKey).toBe('chart:5');
  expect(()=>parseDesignPatch({expectedRevision:state.revision,reading:{...state.readings[0],text:'private content'}})).toThrow();
 });
});
