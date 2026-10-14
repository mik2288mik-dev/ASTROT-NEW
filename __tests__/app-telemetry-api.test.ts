const mockAuth=jest.fn(),mockRecord=jest.fn();
jest.mock('../lib/auth/appAuth',()=>({requireAppUser:(...a:unknown[])=>mockAuth(...a)}));
jest.mock('../lib/auth/authRateLimit',()=>({consumeAuthRateLimit:jest.fn(),getAuthClientKey:()=> 'ip:test'}));
jest.mock('../lib/appTelemetryRepository',()=>({recordAppTrace:(...a:unknown[])=>mockRecord(...a)}));
jest.mock('../lib/db',()=>({getPool:()=>({query:jest.fn()})}));
import collector from '../pages/api/telemetry';
import { APP_TRACE_VERSION } from '../lib/appTelemetry';
import { AdminAuthError } from '../lib/adminAuth';
import { randomUUID } from 'crypto';
const response=()=> {const res:any={setHeader:jest.fn()};res.status=jest.fn(()=>res);res.json=jest.fn(()=>res);return res;};
const event=()=>({id:randomUUID(),sequence:0,at:Date.now(),type:'question_submit',screen:'chart',payload:{text:'Работа?',password:'secret'}});
describe('collection boundaries',()=> {
  beforeEach(()=> {jest.clearAllMocks();mockRecord.mockResolvedValue('token');});
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
  it('rejects unbounded input before recording',async()=> {
    const large=response();await collector({method:'POST',body:{version:APP_TRACE_VERSION,events:Array.from({length:101},event)}} as any,large);
    expect(large.status).toHaveBeenCalledWith(400);expect(mockRecord).not.toHaveBeenCalled();
  });
});
