import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('notification Premium audience source', () => {
  it.each([
    'services/notificationEngine.ts',
    'services/notificationRetentionService.ts',
  ])('%s joins the canonical entitlement ledger before Premium promotion', (file) => {
    const source = read(file);
    expect(source).toContain('FROM premium_entitlements pe');
    expect(source).toContain("pe.entitlement_state IN ('gift', 'store_trial', 'paid', 'grace', 'cancelled_active')");
    expect(source).toContain('has_active_premium_entitlement');
  });
});
