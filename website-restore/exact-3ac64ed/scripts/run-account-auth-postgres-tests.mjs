import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const testDatabaseUrl = String(process.env.ACCOUNT_AUTH_TEST_DATABASE_URL || '').trim();

function validateDedicatedLocalTestDatabaseUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('ACCOUNT_AUTH_TEST_DATABASE_URL must be a valid PostgreSQL URL');
  }
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, '')).toLowerCase();
  const localHost = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(parsed.hostname.toLowerCase());
  const explicitTestToken = /(^|[_-])test($|[_-])/.test(databaseName);
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !localHost || !explicitTestToken) {
    throw new Error('PostgreSQL auth tests require a dedicated local database with a standalone "test" name token');
  }
}

try {
  validateDedicatedLocalTestDatabaseUrl(testDatabaseUrl);
} catch (error) {
  console.error(`[test:postgres] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const testEnv = {
  ...process.env,
  DATABASE_URL: testDatabaseUrl,
  ACCOUNT_AUTH_TEST_DATABASE_URL: testDatabaseUrl,
  RUN_ACCOUNT_AUTH_POSTGRES: '1',
  NODE_ENV: 'test',
};

function runNode(args) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', env: testEnv });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// Migration is part of the test contract: a guarded blank/local test database
// must be able to reach the exact schema exercised below.
runNode([require.resolve('tsx/cli'), 'scripts/migrate.ts']);
runNode([require.resolve('tsx/cli'), 'scripts/migrate-natal-v2.ts']);

runNode([
  require.resolve('jest/bin/jest'),
  '--runInBand',
  '__tests__/account-auth-postgres.integration.test.ts',
  '__tests__/account-rustore-postgres.integration.test.ts',
  ...process.argv.slice(2),
]);
