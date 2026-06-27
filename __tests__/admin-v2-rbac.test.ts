import {
  ADMIN_ROLES,
  ADMIN_PERMISSIONS,
  permissionsForRole,
  roleHasPermission,
} from '../lib/admin/rbac';

describe('admin v2 RBAC', () => {
  it('super_admin has every permission', () => {
    for (const perm of ADMIN_PERMISSIONS) {
      expect(roleHasPermission('super_admin', perm)).toBe(true);
    }
    expect(permissionsForRole('super_admin').length).toBe(ADMIN_PERMISSIONS.length);
  });

  it('only super_admin can manage roles and settings (privilege escalation guard)', () => {
    for (const role of ADMIN_ROLES) {
      if (role === 'super_admin') continue;
      expect(roleHasPermission(role, 'roles.manage')).toBe(false);
      expect(roleHasPermission(role, 'settings.manage')).toBe(false);
    }
  });

  it('only super_admin can delete users or publish AI prompts', () => {
    for (const role of ADMIN_ROLES) {
      if (role === 'super_admin') continue;
      expect(roleHasPermission(role, 'users.delete')).toBe(false);
      expect(roleHasPermission(role, 'ai.publish')).toBe(false);
    }
  });

  it('read_only cannot mutate, but can view analytics', () => {
    expect(roleHasPermission('read_only', 'analytics.view')).toBe(true);
    expect(roleHasPermission('read_only', 'users.view')).toBe(true);
    expect(roleHasPermission('read_only', 'users.edit')).toBe(false);
    expect(roleHasPermission('read_only', 'users.block')).toBe(false);
    expect(roleHasPermission('read_only', 'billing.refund')).toBe(false);
  });

  it('finance handles billing, not content or PII', () => {
    expect(roleHasPermission('finance', 'billing.view')).toBe(true);
    expect(roleHasPermission('finance', 'billing.refund')).toBe(true);
    expect(roleHasPermission('finance', 'user.pii.view')).toBe(false);
    expect(roleHasPermission('finance', 'content.publish')).toBe(false);
  });

  it('content_manager has no access to users PII or billing', () => {
    expect(roleHasPermission('content_manager', 'content.publish')).toBe(true);
    expect(roleHasPermission('content_manager', 'user.pii.view')).toBe(false);
    expect(roleHasPermission('content_manager', 'billing.view')).toBe(false);
  });
});
