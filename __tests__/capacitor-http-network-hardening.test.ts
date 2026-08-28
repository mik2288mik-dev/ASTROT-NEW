import fs from 'node:fs';
import path from 'node:path';

describe('Android native network hardening', () => {
  it('routes fetch/XHR through CapacitorHttp and traces explicit native requests', () => {
    const config = fs.readFileSync(path.join(process.cwd(), 'capacitor.config.ts'), 'utf8');
    const api = fs.readFileSync(path.join(process.cwd(), 'services/apiClient.ts'), 'utf8');
    expect(config).toContain('CapacitorHttp');
    expect(config).toMatch(/CapacitorHttp:\s*\{[\s\S]*?enabled:\s*true/);
    expect(api).toContain("diagnosticLog('INFO', 'native_http_start'");
    expect(api).toContain("diagnosticLog('ERROR', 'native_http_failed'");
  });
});
