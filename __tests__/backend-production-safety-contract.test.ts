import fs from 'node:fs';
import path from 'node:path';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('backend production safety contract', () => {
  it('never performs the historical full reset during automatic migration startup', () => {
    const migrations = read('lib/migrations.ts');
    expect(migrations).toContain('DESTRUCTIVE_MIGRATION_BLOCKED');
    expect(migrations).not.toContain('await pool.query(`DROP TABLE IF EXISTS ${table} CASCADE`)');
    expect(migrations).not.toContain("await pool.query('TRUNCATE migrations')");
  });

  it('holds the advisory lock and every migration query on one PostgreSQL client', () => {
    const migrations = read('lib/migrations.ts');
    expect(migrations).toContain('migrationClient = await pool.connect()');
    expect(migrations).toContain("await migrationClient.query('SELECT pg_advisory_lock($1)'");
    expect(migrations).toContain('const migrationDb = migrationClient as unknown as Pool');
    expect(migrations).toContain("await migrationClient.query('SELECT pg_advisory_unlock($1)'");
  });

  it('keeps every named migration unique and the auth/session sequence explicit', () => {
    const migrations = read('lib/migrations.ts');
    const names = [...migrations.matchAll(/const migrationName = '([^']+)'/g)]
      .map((match) => match[1]);
    const runner = migrations.slice(migrations.indexOf('export async function runMigrations'));
    const calls = [...runner.matchAll(/await ((?:migrationReset|lumia\w+|mvp\w+))\(migrationDb\)/g)]
      .map((match) => match[1]);

    expect(names).toHaveLength(53);
    expect(new Set(names).size).toBe(names.length);
    expect(calls).toHaveLength(53);
    expect(new Set(calls).size).toBe(calls.length);
    expect(calls.slice(calls.indexOf('mvp040AccountIdentitySessions'), calls.indexOf('mvp044PremiumEntitlementLifecycle')))
      .toEqual([
        'mvp040AccountIdentitySessions',
        'mvp041AstrologyHistoryFoundation',
        'mvp042SavedPersonIdentity',
        'mvp043PasswordAuthentication',
        'mvp044EmailIdentityUniqueness',
        'mvp045AuthExpiryTimezone',
        'mvp048AppSessionRefresh',
        'mvp049ContentReactions',
        'mvp050LegalAcknowledgements',
        'mvp051SupportDeliveryOutbox',
        'mvp052UserAppEventIdempotency',
      ]);
  });

  it('blocks the old natal reset instead of truncating charts or clearing profiles', () => {
    const migration = read('scripts/migrate-natal-v2.ts');
    expect(migration).toContain('DESTRUCTIVE_NATAL_V2_MIGRATION_BLOCKED');
    expect(migration).not.toContain("await client.query('TRUNCATE TABLE natal_charts");
    expect(migration).not.toContain('UPDATE users SET');
  });

  it('validates production env before migrations without coupling either to server startup', () => {
    const railway = JSON.parse(read('railway.json')) as {
      deploy?: { preDeployCommand?: string[]; startCommand?: string };
    };
    const preDeploy = read('scripts/railway-predeploy.sh');
    expect(preDeploy.indexOf('npm run validate:production-env')).toBeLessThan(preDeploy.indexOf('npm run migrate'));
    expect(preDeploy).not.toContain('node server.js');
    expect(railway.deploy?.preDeployCommand).toEqual(['sh scripts/railway-predeploy.sh']);
    expect(railway.deploy?.startCommand).toBe('node server.js');
  });

  it('processes durable RuStore callbacks without requiring an external cron', () => {
    const scheduler = read('lib/notificationScheduler.ts');
    expect(scheduler).toContain("import { processPendingRuStoreEvents } from './rustorePayments'");
    expect(scheduler).toContain('await processPendingRuStoreEvents(20)');
  });

  it('processes durable support delivery without requiring an external cron', () => {
    const scheduler = read('lib/notificationScheduler.ts');
    expect(scheduler).toContain("import { processSupportDeliveryOutbox } from './supportOutbox'");
    expect(scheduler).toContain('await processSupportDeliveryOutbox(20)');
  });

  it('never authorizes server owner access from a public env value in production', () => {
    for (const source of [read('lib/adminAuth.ts'), read('lib/db.ts'), read('lib/migrations.ts')]) {
      expect(source).toContain("process.env.NODE_ENV === 'production'");
    }
    expect(read('lib/db.ts')).not.toContain(
      'process.env.NEXT_PUBLIC_OWNER_ID || process.env.OWNER_ID',
    );
  });

  it('keeps legacy Telegram fallbacks bounded and unavailable in production', () => {
    const invoice = read('pages/api/telegram/create-invoice.ts');
    expect(invoice).toContain("process.env.NODE_ENV === 'production'");
    expect(invoice).toContain("code: 'TELEGRAM_PAYMENTS_UNAVAILABLE'");
    expect(invoice).toContain('isTelegramWebhookEnabled()');
    expect(invoice).toContain('getTelegramWebhookSecret()');
    expect(invoice.indexOf("code: 'TELEGRAM_PAYMENTS_UNAVAILABLE'"))
      .toBeLessThan(invoice.indexOf('simMode: true'));
    for (const source of [
      read('lib/telegramBot.ts'),
      invoice,
      read('pages/api/telegram/webhook.ts'),
      read('pages/api/telegram/setup-webhook.ts'),
      read('pages/api/telegram/webhook-info.ts'),
    ]) {
      expect(source).toContain('AbortSignal.timeout(');
    }
  });

  it('does not accept webhook setup secrets in query strings or call dependencies from liveness', () => {
    for (const route of ['pages/api/telegram/setup-webhook.ts', 'pages/api/telegram/webhook-info.ts']) {
      const source = read(route);
      expect(source).not.toContain('req.query.secret');
      expect(source).toContain("req.headers['x-webhook-setup-secret']");
    }
    const health = read('pages/api/health.ts');
    expect(health).not.toContain('getPool');
    expect(health).not.toContain('getProductionObservabilitySnapshot');
    expect(health).not.toContain('getSwissEphemerisHealth');
    expect(health).toContain('Dependency checks live at /api/readiness');
  });
});
