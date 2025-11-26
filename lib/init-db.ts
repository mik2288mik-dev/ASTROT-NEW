/**
 * Database initialization script
 * This runs automatically when the app starts in production
 * It ensures migrations are applied before the app serves requests
 */

import { runMigrations } from './migrations';
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || '';

let migrationsRun = false;
let migrationsRunning = false;

/**
 * Check if required tables exist in database
 */
async function checkTablesExist(): Promise<boolean> {
  if (!DATABASE_URL) {
    return false;
  }

  let pool: Pool | null = null;
  try {
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 5000,
    });

    // Check if users table exists
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);

    const tablesExist = result.rows[0].exists;
    
    if (tablesExist) {
      console.log('[Init] Database tables already exist');
    } else {
      console.log('[Init] Database tables not found, migrations needed');
    }

    return tablesExist;
  } catch (error: any) {
    console.error('[Init] Error checking tables:', error.message);
    return false;
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

/**
 * Initialize database on app start
 * This is called from _app.tsx or can be called manually
 */
export async function initializeDatabaseOnStart(): Promise<void> {
  // Only run once per process
  if (migrationsRun || migrationsRunning) {
    return;
  }

  migrationsRunning = true;

  try {
    // Check if DATABASE_URL is set
    if (!DATABASE_URL) {
      console.warn('[Init] DATABASE_URL is not set. Skipping database initialization.');
      console.warn('[Init] Database operations will not work until DATABASE_URL is configured.');
      migrationsRunning = false;
      return;
    }

    // Check if tables already exist
    const tablesExist = await checkTablesExist();

    // Run migrations if:
    // 1. In production environment, OR
    // 2. RUN_MIGRATIONS is explicitly set to 'true', OR
    // 3. Tables don't exist (first run)
    const shouldRunMigrations = 
      process.env.NODE_ENV === 'production' || 
      process.env.RUN_MIGRATIONS === 'true' ||
      !tablesExist;

    if (shouldRunMigrations) {
      console.log('[Init] Running database migrations on startup...');
      await runMigrations();
      migrationsRun = true;
      console.log('[Init] Database migrations completed successfully');
    } else {
      console.log('[Init] Skipping migrations (tables exist and not in production mode)');
      migrationsRun = true; // Mark as run to prevent retries
    }
  } catch (error: any) {
    console.error('[Init] Failed to run migrations on startup:', error.message);
    console.error('[Init] Error details:', {
      error: error.message,
      code: error.code,
      stack: error.stack
    });
    
    // Don't throw - let the app start even if migrations fail
    // They can be run manually via API endpoint or postbuild script
    console.warn('[Init] Application will start, but database may not be ready');
    console.warn('[Init] You can run migrations manually via: POST /api/migrations/run');
  } finally {
    migrationsRunning = false;
  }
}
