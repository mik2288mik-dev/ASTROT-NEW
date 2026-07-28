import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('RuStore Pay integration contract', () => {
  it('uses the current Pay SDK only in the Rustore flavor', () => {
    const gradle = read('android/app/build.gradle');
    expect(gradle).toContain("rustoreImplementation platform('ru.rustore.sdk:bom:2026.06.01')");
    expect(gradle).toContain("rustoreImplementation 'ru.rustore.sdk:pay'");
    expect(gradle).toContain("googlePlay");
    expect(gradle).not.toContain('BillingClient');
  });

  it('keeps validation and secrets on the server', () => {
    const server = read('lib/rustorePayments.ts');
    const native = read('android/app/src/rustore/java/com/yourhoroscope/app/rustore/RuStorePayPlugin.java');
    expect(server).toContain("'Public-Token': token");
    expect(native).not.toContain('RUSTORE_PUBLIC_API_TOKEN');
    expect(native).not.toContain('RUSTORE_NOTIFICATION_AES_KEY');
  });

  it('does not treat a client success or duplicate purchase as Premium', () => {
    const client = read('services/rustorePayService.ts');
    const server = read('lib/rustorePayments.ts');
    expect(client).toContain("body?.entitlement?.isPremium ? { status: 'completed' }");
    expect(server).toContain('RUSTORE_PURCHASE_OWNED_BY_ANOTHER_USER');
    expect(server).toContain('FOR UPDATE');
    expect(server).toContain('ON CONFLICT (provider, external_event_id) DO NOTHING');
    expect(server).toContain('Never issue Premium from a callback alone');
  });
});
