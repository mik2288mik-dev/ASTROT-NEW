import fs from 'fs';
import path from 'path';

const read = (file: string) => fs.readFileSync(path.join(path.resolve(__dirname, '..'), file), 'utf8');

describe('admin panel shell', () => {
  it('navigation has two hubs covering the four working sections', () => {
    const sections = read('views/admin/adminSections.ts');
    expect(sections).toContain('ADMIN_NAV_GROUPS');
    expect(sections).toContain("id: 'home'");
    expect(sections).toContain("id: 'people'");
    for (const section of ['overview', 'analytics', 'users', 'send']) {
      expect(sections).toContain(`'${section}'`);
    }
  });

  it('renders the working tabs and mobile nav', () => {
    const panel = read('views/AdminPanel.tsx');
    expect(panel).toContain('admin-dash-bottomnav');
    expect(panel).toContain('admin-section-subnav');
    expect(panel).toContain('AdminOverviewTab');
    expect(panel).toContain('AdminAnalyticsTab');
    expect(panel).toContain('AdminUsersTab');
    expect(panel).toContain('AdminSendTab');
  });

  it('drops the removed legacy sections', () => {
    const sections = read('views/admin/adminSections.ts');
    for (const removed of ['economy', 'charts', 'templates', 'automation', 'assets']) {
      expect(sections).not.toContain(`'${removed}'`);
    }
  });
});
