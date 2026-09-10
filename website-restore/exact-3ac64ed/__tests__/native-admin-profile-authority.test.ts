import fs from 'node:fs';
import path from 'node:path';

const app = fs.readFileSync(path.join(process.cwd(), 'App.tsx'), 'utf8');

describe('native administrator profile authority', () => {
  it('does not downgrade a server-marked administrator when Telegram admin probing is unavailable', () => {
    expect(app).toContain('return fallbackIsAdmin || result.isAdmin;');
    expect(app).not.toContain('return result.isAdmin;');
    expect(app).toContain('getFallbackAdminStatus(canonicalUserId, storedProfile.isAdmin)');
  });
});
