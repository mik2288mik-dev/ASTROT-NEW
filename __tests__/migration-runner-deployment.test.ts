import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

describe('database migration deployment runner', () => {
  it('fails deployment migration runs instead of masking errors', () => {
    const source = read('scripts/migrate.ts');

    expect(source).toContain('refusing to continue deployment without a database');
    expect(source).toContain('process.exit(1)');
    expect(source).not.toContain('Continuing app startup despite migration failure');
    expect(source).not.toContain('process.exit(0);\n  }\n}');
  });

  it('runs migrations before the Railway app server starts', () => {
    const railway = JSON.parse(read('railway.json')) as { deploy?: { startCommand?: string } };
    const dockerfile = read('Dockerfile');

    expect(railway.deploy?.startCommand).toBe('npm run migrate && exec node server.js');
    expect(dockerfile).toContain('CMD ["sh", "-c", "npm run migrate && exec node server.js"]');
    expect(dockerfile).toContain('process.env.PORT||3000');
    expect(dockerfile).toContain('/app/scripts ./scripts');
    expect(dockerfile).toContain('/app/lib ./lib');
  });

  it('does not run non-blocking migrations from app database connections', () => {
    const db = read('lib/db.ts');
    const migrations = read('lib/migrations.ts');

    expect(db).not.toContain('runMigrationsInBackground');
    expect(db).not.toContain('Background migrations failed (non-blocking)');
    expect(migrations).toContain('pg_advisory_lock');
    expect(migrations).toContain('pg_advisory_unlock');
  });

  it('records admin-era migrations so reruns can skip them', () => {
    const migrations = read('lib/migrations.ts');

    for (const migrationName of [
      'lumia_031_admin_foundation',
      'lumia_032_monetization',
      'lumia_033_content_cms',
      'lumia_034_support',
      'lumia_035_feature_flags',
    ]) {
      expect(migrations).toContain(`const migrationName = '${migrationName}'`);
      expect(migrations).toContain('await markMigrationApplied(pool, migrationName);');
    }
  });

  it('keeps Railway healthcheck as HTTP liveness with dependency diagnostics', () => {
    const health = read('pages/api/health.ts');

    expect(health).toContain('HTTP server is responding');
    expect(health).toContain('warnings');
    expect(health).not.toContain("health.status === 'error' ? 503 : 200");
    expect(health).not.toContain('return res.status(503).json');
  });
});
