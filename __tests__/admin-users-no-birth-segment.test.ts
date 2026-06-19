import fs from 'fs';
import path from 'path';

const read = (file: string) => fs.readFileSync(path.join(path.resolve(__dirname, '..'), file), 'utf8');

describe('admin users without birth data tracking', () => {
  it('exposes no-birth segment in admin API and UI', () => {
    expect(read('pages/api/admin/users/index.ts')).toContain("'new_user_no_birth_data'");
    expect(read('views/admin/AdminUsersTab.tsx')).toContain("'new_user_no_birth_data'");
    expect(read('types.ts')).toContain('usersWithoutBirthData');
  });

  it('counts users without birth date in overview query', () => {
    expect(read('lib/db.ts')).toContain('users_without_birth_data');
    expect(read('lib/db.ts')).toContain('birth_date IS NULL');
  });

  it('marks list rows without birth data', () => {
    expect(read('lib/adminSerializers.ts')).toContain('hasBirthData');
    expect(read('views/admin/AdminUsersTab.tsx')).toContain("badge_no_chart");
  });
});
