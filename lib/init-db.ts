/**
 * Database initialization script
 * This runs automatically when the app starts in production
 * It ensures migrations are applied before the app serves requests
 */

import { runMigrations } from './migrations';

let migrationsRun = false;
let migrationsRunning = false;

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

  // Only run in production or when explicitly enabled
  if (process.env.NODE_ENV === 'production' || process.env.RUN_MIGRATIONS === 'true') {
    try {
      console.log('[Init] Running database migrations on startup...');
      await runMigrations();
      migrationsRun = true;
      console.log('[Init] Database migrations completed');
    } catch (error: any) {
      console.error('[Init] Failed to run migrations on startup:', error.message);
      // Don't throw - let the app start even if migrations fail
      // They can be run manually via API endpoint or postbuild script
    } finally {
      migrationsRunning = false;
    }
  } else {
    migrationsRunning = false;
  }
}
