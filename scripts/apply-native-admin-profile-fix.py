#!/usr/bin/env python3
from pathlib import Path

root = Path(__file__).resolve().parents[1]
app_path = root / 'App.tsx'
source = app_path.read_text(encoding='utf-8')
old = """            return result.isAdmin;
"""
new = """            // Native account sessions do not have Telegram initData. In that
            // runtime getAdminStatus() returns false by design, so it must not
            // downgrade the server profile or configured owner fallback.
            return fallbackIsAdmin || result.isAdmin;
"""
if source.count(old) != 1:
    raise RuntimeError(f'Expected one admin status return, found {source.count(old)}')
app_path.write_text(source.replace(old, new, 1), encoding='utf-8')

(root / '__tests__/native-admin-profile-authority.test.ts').write_text(r'''import fs from 'node:fs';
import path from 'node:path';

const app = fs.readFileSync(path.join(process.cwd(), 'App.tsx'), 'utf8');

describe('native administrator profile authority', () => {
  it('does not downgrade a server-marked administrator when Telegram admin probing is unavailable', () => {
    expect(app).toContain('return fallbackIsAdmin || result.isAdmin;');
    expect(app).not.toContain('return result.isAdmin;');
    expect(app).toContain('getFallbackAdminStatus(canonicalUserId, storedProfile.isAdmin)');
  });
});
''', encoding='utf-8')
print('Native admin profile authority fix applied.')
