const mockPermission = jest.fn();
const mockRolePermission = jest.fn();
const mockReport = jest.fn();
const mockUserReport = jest.fn();
jest.mock('../lib/admin/rbac', () => ({ requireAdminPermission: (...args: unknown[]) => mockPermission(...args), roleHasPermission: (...args: unknown[]) => mockRolePermission(...args) }));
jest.mock('../lib/admin/activityAnalytics', () => ({ parseActivityRange: (q: unknown) => q,
  getActivityReport: (...args: unknown[]) => mockReport(...args), getUserActivityReport: (...args: unknown[]) => mockUserReport(...args) }));
import handler from '../pages/api/admin/v2/activity';
import userHandler from '../pages/api/admin/v2/users/[id]/activity';
import { AdminAuthError } from '../lib/adminAuth';
function response() { const res: any = { setHeader: jest.fn() }; res.status = jest.fn(() => res); res.json = jest.fn(() => res); return res; }
describe('admin activity RBAC', () => {
  beforeEach(() => { jest.clearAllMocks(); mockPermission.mockResolvedValue({ role:'admin' }); mockRolePermission.mockReturnValue(true); });
  it('requires analytics permission before accessing any aggregate', async () => {
    mockPermission.mockRejectedValue(new AdminAuthError(403,'FORBIDDEN','Нет доступа'));
    const res = response();
    await handler({ method:'GET', query:{} } as any,res);
    expect(res.status).toHaveBeenCalledWith(403); expect(mockReport).not.toHaveBeenCalled();
  });
  it('requires both user access and analytics access for an identified timeline', async () => {
    mockRolePermission.mockReturnValue(false);
    const res = response();
    await userHandler({ method:'GET',query:{id:'42'} } as any,res);
    expect(mockPermission).toHaveBeenCalledWith(expect.anything(),'users.view');
    expect(res.status).toHaveBeenCalledWith(403); expect(mockUserReport).not.toHaveBeenCalled();
  });
  it('forwards only a valid target and bounded pagination to user analytics', async () => {
    mockUserReport.mockResolvedValue({ timeline:[] });
    const res = response();
    await userHandler({ method:'GET',query:{id:'42',limit:'40',cursor:'10'} } as any,res);
    expect(mockUserReport).toHaveBeenCalledWith('42',expect.anything(),'10',40);
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control','private, no-store');
  });
});
