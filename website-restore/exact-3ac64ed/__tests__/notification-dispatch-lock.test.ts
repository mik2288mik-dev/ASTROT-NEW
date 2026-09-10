import fs from 'fs';
import path from 'path';

describe('notification dispatch queue lock', () => {
  it('uses FOR UPDATE OF sn with LEFT JOIN users (Postgres outer-join rule)', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../services/notificationRetentionService.ts'),
      'utf8',
    );
    expect(source).toContain('FOR UPDATE OF sn SKIP LOCKED');
    expect(source).not.toMatch(/LEFT JOIN users[\s\S]{0,500}FOR UPDATE SKIP LOCKED/);
  });
});
