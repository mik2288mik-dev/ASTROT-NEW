import {defaultDesignPreference,parseDesignPatch,sanitizeDesignPreference,mergeDesignPatch,resolveAdminPreviewAccess,readingContentVersion} from '../lib/neboDesign/contract';
describe('Legacy design preference API compatibility',()=>{
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

 test('content identity distinguishes versions and selected people',()=>{
  expect(readingContentVersion(['1','same'])).not.toBe(readingContentVersion(['2','same']));
  expect(readingContentVersion(['1','old'])).not.toBe(readingContentVersion(['1','new']));
 });

});
