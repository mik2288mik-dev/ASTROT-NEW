import fs from 'node:fs';
import path from 'node:path';

describe('Android native network hardening', () => {
  it('uses bounded explicit CapacitorHttp requests without global fetch interception', () => {
    const config = fs.readFileSync(path.join(process.cwd(), 'capacitor.config.ts'), 'utf8');
    const api = fs.readFileSync(path.join(process.cwd(), 'services/apiClient.ts'), 'utf8');
    expect(config).toContain('CapacitorHttp');
    expect(config).toMatch(/CapacitorHttp:\s*\{[\s\S]*?enabled:\s*false/);
    expect(api).toContain('CapacitorHttp.request');
    expect(api).toContain("diagnosticLog('INFO', 'native_http_start'");
    expect(api).toContain("'native_http_failed'");
    expect(api).toContain("diagnosticLog(aborted ? 'WARN' : 'ERROR'");
  });
});
