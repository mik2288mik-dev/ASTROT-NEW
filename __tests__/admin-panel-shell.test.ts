import fs from 'fs';
import path from 'path';

const read = (file: string) => fs.readFileSync(path.join(path.resolve(__dirname, '..'), file), 'utf8');

describe('admin panel mobile shell', () => {
  it('groups navigation into four hubs', () => {
    const sections = read('views/admin/adminSections.ts');
    expect(sections).toContain("id: 'people'");
    expect(sections).toContain("id: 'comms'");
    expect(sections).toContain('ADMIN_NAV_GROUPS');
  });

  it('shows mission dashboard only on overview', () => {
    const panel = read('views/AdminPanel.tsx');
    expect(panel).toContain("activeSection === 'overview'");
    expect(panel).toContain('admin-dash-workspace--tool');
    expect(panel).toContain('admin-dash-bottomnav');
    expect(panel).toContain('AdminSubNav');
  });
});
