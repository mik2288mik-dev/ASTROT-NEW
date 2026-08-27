import fs from 'node:fs';
import path from 'node:path';

describe('Android native network hardening', () => {
  it('routes fetch/XHR through CapacitorHttp to avoid WebView networking regressions', () => {
    const config = fs.readFileSync(path.join(process.cwd(), 'capacitor.config.ts'), 'utf8');
    expect(config).toContain('CapacitorHttp');
    expect(config).toMatch(/CapacitorHttp:\s*\{[\s\S]*?enabled:\s*true/);
  });
});
