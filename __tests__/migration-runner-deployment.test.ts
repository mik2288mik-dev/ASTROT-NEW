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

  it('runs validation and migrations in Railway pre-deploy, separate from HTTP startup', () => {
    const railway = JSON.parse(read('railway.json')) as {
      deploy?: { preDeployCommand?: string[]; startCommand?: string; healthcheckPath?: string };
    };
    const dockerfile = read('Dockerfile');
    const preDeployScript = read('scripts/railway-predeploy.sh');

    expect(railway.deploy?.preDeployCommand).toEqual(['sh scripts/railway-predeploy.sh']);
    expect(railway.deploy?.startCommand).toBe('node server.js');
    expect(railway.deploy?.healthcheckPath).toBe('/api/health');
    expect(dockerfile).toContain('CMD ["node", "server.js"]');
    expect(dockerfile).toContain('process.env.PORT||3000');
    expect(dockerfile).toContain('r.statusCode===200');
    expect(dockerfile).toContain('/app/scripts ./scripts');
    expect(dockerfile).toContain('/app/lib ./lib');
    expect(preDeployScript).toContain('npm run validate:production-env');
    expect(preDeployScript).toContain('npm run migrate');
    expect(preDeployScript).not.toContain('node server.js');
    expect(preDeployScript.indexOf('npm run validate:production-env'))
      .toBeLessThan(preDeployScript.indexOf('npm run migrate'));
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

  it('keeps Railway healthcheck as dependency-free HTTP liveness', () => {
    const health = read('pages/api/health.ts');

    expect(health).toContain('liveness: { ok: true }');
    expect(health).toContain('Dependency checks live at /api/readiness');
    expect(health).not.toContain('getSystemHealth');
    expect(health).not.toContain('getSwissEphemerisHealth');
    expect(health).not.toContain("health.status === 'error' ? 503 : 200");
    expect(health).not.toContain('return res.status(503).json');
  });
});
