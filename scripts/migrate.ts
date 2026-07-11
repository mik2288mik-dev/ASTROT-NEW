#!/usr/bin/env node
/**
 * Migration script for Railway.
 * In deployment/production, missing DB config or migration failure is fatal.
 */

import { loadEnvConfig } from '@next/env';
import { resolveDatabaseUrl } from '../lib/database-url';

loadEnvConfig(process.cwd());

const RAILWAY_RUNTIME_ENV_KEYS = [
  'RAILWAY_PROJECT_ID',
  'RAILWAY_SERVICE_ID',
  'RAILWAY_ENVIRONMENT_ID',
  'RAILWAY_DEPLOYMENT_ID',
  'RAILWAY_REPLICA_ID',
];

function isDeploymentEnvironment(): boolean {
  return process.env.NODE_ENV === 'production'
    || process.env.CI === 'true'
    || RAILWAY_RUNTIME_ENV_KEYS.some((key) => !!String(process.env[key] || '').trim());
}

function safeDatabaseInfo(dbUrl: string): string {
  try {
    const url = new URL(dbUrl);
    const user = decodeURIComponent(url.username || '');
    const database = url.pathname.replace(/^\//, '');
    const port = url.port || '(default)';
    const sslMode = url.searchParams.get('sslmode');
    return `${url.hostname}:${port}/${database} (user: ${user || '(none)'})${sslMode ? ` sslmode=${sslMode}` : ''}`;
  } catch {
    return '(unparseable database URL; value hidden)';
  }
}

function logConnectionHint(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error || '');
  if (!/ENOTFOUND|getaddrinfo|ECONNREFUSED|timeout/i.test(message)) return;

  console.error('Connection troubleshooting:');
  console.error('  1. Verify DATABASE_URL/DATABASE_PUBLIC_URL points to the intended Railway PostgreSQL service.');
  console.error('  2. Use Railway internal hostnames only inside Railway runtime.');
  console.error('  3. Check that the PostgreSQL service is running and reachable.');
}

async function main() {
  console.log('[migrate] Starting database migrations');

  const dbUrl = resolveDatabaseUrl();
  if (!dbUrl) {
    const message = 'DATABASE_URL is not configured';
    if (isDeploymentEnvironment()) {
      console.error(`[migrate] ${message}; refusing to continue deployment without a database`);
      process.exit(1);
    }

    console.warn(`[migrate] ${message}; skipping local migration run`);
    process.exit(0);
  }

  console.log(`[migrate] Database: ${safeDatabaseInfo(dbUrl)}`);

  try {
    const { runMigrations } = await import('../lib/migrations');
    await runMigrations();
    console.log('[migrate] Migrations completed successfully');
    process.exit(0);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error || 'unknown error');
    console.error(`[migrate] Migration failed: ${message}`);
    logConnectionHint(error);
    process.exit(1);
  }
}

void main();
