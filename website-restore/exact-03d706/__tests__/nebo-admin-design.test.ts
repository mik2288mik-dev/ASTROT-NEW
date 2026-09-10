import {defaultDesignPreference,parseDesignPatch,sanitizeDesignPreference,mergeDesignPatch,resolveAdminPreviewAccess,readingContentVersion} from '../lib/neboDesign/contract';
import {DesignPreferenceStore} from '../lib/neboDesign/preferenceStore';
import {surfaceStops,nearestSurfaceStop} from '../lib/neboDesign/layeredSurface';
describe('NEBO admin-only design pilot',()=>{
 test('defaults to classic and ignores unknown persisted design flags',()=>{
  expect(defaultDesignPreference().design).toBe('classic');
  expect(sanitizeDesignPreference({schemaVersion:1,design:'premium',revision:-3}).design).toBe('classic');
 });
 test('never accepts entitlements or another user id in a preference mutation',()=>{
  expect(()=>parseDesignPatch({expectedRevision:0,isPremium:true})).toThrow();
  expect(()=>parseDesignPatch({expectedRevision:0,design:'nebo-v2',userId:'2'})).toThrow();
  expect(()=>parseDesignPatch({expectedRevision:0,surface:{id:'chart',position:'expanded',scrollTop:NaN}})).toThrow();
 });
 test('merges without changing the old state and uses a revision',()=>{
  const first=defaultDesignPreference();const next=mergeDesignPatch(first,parseDesignPatch({expectedRevision:0,theme:'dark'}));
  expect(next.revision).toBe(1);expect(next.theme).toBe('dark');expect(first.theme).toBe('system');
 });
 test('blocked and revoked admin records fail closed',()=>{
  expect(resolveAdminPreviewAccess({is_admin:true,is_blocked:true},true)).toBe(false);
  expect(resolveAdminPreviewAccess({is_admin:true,role:'admin',status:'revoked'},false)).toBe(false);
  expect(resolveAdminPreviewAccess({is_admin:false,owner_identity:true},false)).toBe(true);
  expect(resolveAdminPreviewAccess({is_admin:true},false,true)).toBe(false);
 });
 test('surface stops stay ordered on short and full-height screens',()=>{
  for(const h of [0,96,400,844]){const s=surfaceStops(h);expect(s.expanded).toBeLessThan(s.middle);expect(s.middle).toBeLessThan(s.collapsed);}
  expect(nearestSurfaceStop(0,-100,surfaceStops(640))).toBe('expanded');
  expect(nearestSurfaceStop(590,1000,surfaceStops(640))).toBe('collapsed');
 });
 test('content identity distinguishes versions and selected people',()=>{
  expect(readingContentVersion(['1','same'])).not.toBe(readingContentVersion(['2','same']));
  expect(readingContentVersion(['1','old'])).not.toBe(readingContentVersion(['1','new']));
 });
 test('network failure cannot activate a cached admin mode',async()=>{
  const store=new DesignPreferenceStore(async()=>{throw new Error('offline');});await store.hydrate();
  expect(store.getSnapshot().eligible).toBe(false);expect(await store.update({design:'nebo-v2'})).toBe(false);
 });
 test('stale responses never reactivate the preview after escape',async()=>{
  let release:((value:any)=>void)|undefined;let first=true;
  const store=new DesignPreferenceStore(async(method,body)=>{
   if(method==='GET')return {status:200,data:{eligible:true,preference:defaultDesignPreference()}};
   if(first){first=false;return new Promise(resolve=>{release=resolve;});}
   return {status:200,data:{eligible:true,preference:{...defaultDesignPreference(),design:body?.design||'classic',revision:2}}};
  });
  await store.hydrate();const pending=store.update({design:'nebo-v2'});await Promise.resolve();
  store.escapeToClassic();release?.({status:200,data:{eligible:true,preference:{...defaultDesignPreference(),design:'nebo-v2',revision:1}}});
  await pending;expect(store.getSnapshot().forceClassic).toBe(true);
 });
 test('disposal blocks another account from receiving late responses',async()=>{
  let release:((value:any)=>void)|undefined;const store=new DesignPreferenceStore(()=>new Promise(resolve=>{release=resolve;}));
  const pending=store.hydrate();await Promise.resolve();store.dispose();release?.({status:200,data:{eligible:true,preference:{...defaultDesignPreference(),design:'nebo-v2'}}});
  await pending;expect(store.getSnapshot().eligible).toBe(false);
 });
});
