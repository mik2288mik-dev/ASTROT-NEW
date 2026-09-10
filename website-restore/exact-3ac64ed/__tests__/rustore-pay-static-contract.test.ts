import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('RuStore Pay integration contract', () => {
  it('uses the current Pay SDK only in the Rustore flavor', () => {
    const gradle = read('android/app/build.gradle');
    expect(gradle).toContain("rustoreImplementation platform('ru.rustore.sdk:bom:2026.08.01')");
    expect(gradle).toContain("rustoreImplementation 'ru.rustore.sdk:pay'");
    expect(gradle).toContain("googlePlay");
    expect(gradle).not.toContain('BillingClient');
  });

  it('keeps the reflectively loaded payment-return bridge in minified releases', () => {
    const activity = read('android/app/src/main/java/ru/tvoygoroskop/app/MainActivity.java');
    const bridge = read(
      'android/app/src/rustore/java/ru/tvoygoroskop/app/rustore/RuStorePayBridge.java',
    );
    const proguard = read('android/app/proguard-rules.pro');

    expect(activity).toContain(
      'Class.forName("ru.tvoygoroskop.app.rustore.RuStorePayBridge")',
    );
    expect(activity).toContain('getMethod("proceedIntent", Intent.class)');
    expect(bridge).toContain('public static void proceedIntent(Intent intent)');
    expect(proguard).toContain(
      '-keep class ru.tvoygoroskop.app.rustore.RuStorePayBridge',
    );
    expect(proguard).toContain('public static void proceedIntent(android.content.Intent);');
  });

  it('keeps validation and secrets on the server', () => {
    const server = read('lib/rustorePayments.ts');
    const native = read('android/app/src/rustore/java/ru/tvoygoroskop/app/rustore/RuStorePayPlugin.java');
    expect(server).toContain("'Public-Token': token");
    expect(native).not.toContain('RUSTORE_PUBLIC_API_TOKEN');
    expect(native).not.toContain('RUSTORE_NOTIFICATION_AES_KEY');
  });

  it('uses the new RuStore API domain with the required server trust chain', () => {
    const server = read('lib/rustorePayments.ts');
    const dockerfile = read('Dockerfile');
    const root = new crypto.X509Certificate(
      read('config/rustore-certificates/russian_trusted_root_ca.crt'),
    );
    const intermediate = new crypto.X509Certificate(
      read('config/rustore-certificates/russian_trusted_sub_ca.crt'),
    );

    expect(server).toContain("const RUSTORE_PUBLIC_API_ORIGIN = 'https://public-api-m.rustore.ru'");
    expect(server).not.toContain('https://public-api.rustore.ru');
    expect(dockerfile).toContain('NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt');
    expect(dockerfile).toContain('update-ca-certificates');
    expect(root.subject).toContain('CN=Russian Trusted Root CA');
    expect(intermediate.subject).toContain('CN=Russian Trusted Sub CA');
    expect(intermediate.verify(root.publicKey)).toBe(true);
    expect(Date.parse(intermediate.validTo)).toBeGreaterThan(
      Date.now() + 45 * 24 * 60 * 60 * 1000,
    );
  });

  it('allows current Pay SDK checkout without requiring the RuStore app', () => {
    const native = read('android/app/src/rustore/java/ru/tvoygoroskop/app/rustore/RuStorePayPlugin.java');
    expect(native).toContain('getPurchaseAvailability()');
    expect(native).not.toContain('isRuStoreInstalled');
    expect(native).not.toContain('RUSTORE_NOT_INSTALLED');
  });

  it('does not treat a client success or duplicate purchase as Premium', () => {
    const client = read('services/rustorePayService.ts');
    const server = read('lib/rustorePayments.ts');
    expect(client).toContain('parseBackendEntitlement(body?.entitlement)');
    expect(client).toContain("{ status: 'completed', entitlement }");
    expect(server).toContain('RUSTORE_PURCHASE_OWNED_BY_ANOTHER_USER');
    expect(server).toContain('FOR UPDATE');
    expect(server).toContain('ON CONFLICT (provider, external_event_id) DO NOTHING');
    expect(server).toContain('durably queues a notification');
    expect(server).toContain("processing_status = 'pending'");
    expect(server).toContain('RUSTORE_PURCHASE_NOT_LINKED');
  });

  it('uses an immutable purchase owner, a callback lease, and provider validation for initial linkage', () => {
    const server = read('lib/rustorePayments.ts');
    expect(server).toContain('ON CONFLICT (provider, external_purchase_id)');
    expect(server).toContain('DO NOTHING');
    expect(server).not.toContain("OR metadata->>'productId'");
    expect(server).toContain('processing_started_at');
    expect(server).toContain('validateRuStorePurchaseFromProviderIdentity');
  });

  it('stores provider validation and expiry instants with timezone-safe ordering', () => {
    const migrations = read('lib/migrations.ts');
    expect(migrations).toContain('last_validated_at TIMESTAMPTZ NOT NULL');
    expect(migrations).toContain("data_type = 'timestamp without time zone'");
    expect(migrations).toContain("TYPE TIMESTAMPTZ USING %I AT TIME ZONE ''UTC''");
    expect(migrations).toContain('mvp_047_rustore_absolute_timestamps');
  });
});
