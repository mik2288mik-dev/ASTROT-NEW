const mockAuth=jest.fn(),mockRecord=jest.fn(),mockPermission=jest.fn(),mockLoad=jest.fn(),mockQuery=jest.fn();
jest.mock('../lib/auth/appAuth',()=>({requireAppUser:(...a:unknown[])=>mockAuth(...a)}));
jest.mock('../lib/auth/authRateLimit',()=>({consumeAuthRateLimit:jest.fn(),getAuthClientKey:()=> 'ip:test'}));
jest.mock('../lib/appTelemetryRepository',()=>({recordAppTrace:(...a:unknown[])=>mockRecord(...a)}));
jest.mock('../lib/admin/rbac',()=>({requireAdminPermission:(...a:unknown[])=>mockPermission(...a)}));
jest.mock('../lib/db',()=>({getPool:()=>({query:(...a:unknown[])=>mockQuery(...a)})}));
jest.mock('../lib/admin/appTelemetryAnalytics',()=>({
  ...jest.requireActual('../lib/admin/appTelemetryAnalytics'),loadAppTrace:(...a:unknown[])=>mockLoad(...a),
}));
import collector from '../pages/api/telemetry';
import adminHandler from '../pages/api/admin/v2/app-telemetry';
import { APP_TRACE_VERSION } from '../lib/appTelemetry';
import { AdminAuthError } from '../lib/adminAuth';
import { randomUUID } from 'crypto';
const response=()=> {const res:any={setHeader:jest.fn()};res.status=jest.fn(()=>res);res.json=jest.fn(()=>res);return res;};
const event=()=>({id:randomUUID(),sequence:0,at:Date.now(),type:'question_submit',screen:'chart',payload:{text:'Работа?',password:'secret'}});
describe('collection and admin access boundaries',()=> {
  beforeEach(()=> {jest.clearAllMocks();mockRecord.mockResolvedValue('token');mockLoad.mockResolvedValue({rows:[],truncated:false});mockQuery.mockResolvedValue({rows:[]});});
  it('accepts a visitor without login but strips question contents; never trusts a client userId',async()=> {
    mockAuth.mockRejectedValue(new AdminAuthError(401,'APP_AUTH_REQUIRED','No account'));
    const res=response();await collector({method:'POST',headers:{},body:{version:APP_TRACE_VERSION,userId:'999',events:[event()]}} as any,res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockRecord.mock.calls[0][0]).toMatchObject({userId:null,events:[{payload:{}}]});
    mockRecord.mockClear();mockAuth.mockResolvedValue({userId:'42'});
    await collector({method:'POST',headers:{},body:{version:APP_TRACE_VERSION,userId:'999',events:[event()]}} as any,response());
    expect(mockRecord.mock.calls[0][0]).toMatchObject({userId:'42',events:[{payload:{text:'Работа?'}}]});
  });
  it('does not treat a revoked/invalid session as an anonymous visitor',async()=> {
    mockAuth.mockRejectedValue(new AdminAuthError(401,'APP_SESSION_REVOKED','Revoked'));
    const res=response();await collector({method:'POST',headers:{},body:{version:APP_TRACE_VERSION,events:[event()]}} as any,res);
    expect(res.status).toHaveBeenCalledWith(401);expect(mockRecord).not.toHaveBeenCalled();
  });
  it('uses trusted native context for installed app version metadata',async()=> {
    mockAuth.mockResolvedValue({userId:'42',provider:'native'});
    await collector({method:'POST',headers:{'x-nebo-client':encodeURIComponent(JSON.stringify({runtime:'native',appVersion:'1.0.13',versionCode:18,osName:'Android'}))},body:{version:APP_TRACE_VERSION,events:[event()]}} as any,response());
    expect(mockRecord.mock.calls[0][0].metadata).toMatchObject({runtime:'native',appVersion:'1.0.13',versionCode:18,osName:'Android'});
  });
  it('requires analytics and user permissions before opening any individual trace',async()=> {
    mockPermission.mockResolvedValue({permissions:['analytics.view']});
    const res=response();await adminHandler({method:'GET',query:{userId:'42'}} as any,res);
    expect(res.status).toHaveBeenCalledWith(403);expect(mockLoad).not.toHaveBeenCalled();
  });
  it('hides all free text from a user trace without the PII permission',async()=> {
    mockPermission.mockResolvedValue({permissions:['analytics.view','users.view']});
    mockLoad.mockResolvedValue({truncated:false,rows:[{...event(),userId:'42',visitId:randomUUID(),version:'1.0.13',name:'Имя',startedAt:new Date().toISOString(),payload:{text:'private',label:'private button',block:'private block',duration_ms:1000}}]});
    const res=response();await adminHandler({method:'GET',query:{userId:'42'}} as any,res);
    expect(res.status).toHaveBeenCalledWith(200);const body=res.json.mock.calls[0][0];
    expect(body.canReadText).toBe(false);expect(body.events[0].payload).toEqual({duration_ms:1000});expect(mockQuery).not.toHaveBeenCalled();
  });
  it('rejects unbounded and invalid input before executing SQL',async()=> {
    mockPermission.mockResolvedValue({permissions:['analytics.view','users.view']});
    const res=response();await adminHandler({method:'GET',query:{visitId:"x';DROP TABLE users"}} as any,res);
    expect(res.status).toHaveBeenCalledWith(400);expect(mockLoad).not.toHaveBeenCalled();
    const large=response();await collector({method:'POST',body:{version:APP_TRACE_VERSION,events:Array.from({length:101},event)}} as any,large);
    expect(large.status).toHaveBeenCalledWith(400);expect(mockRecord).not.toHaveBeenCalled();
  });
});
