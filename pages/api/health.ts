import type { NextApiRequest, NextApiResponse } from 'next';
import { runMigrations } from '../../lib/migrations';
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || '';

// Cache migration status to avoid running multiple times
let migrationsChecked = false;
let migrationsRunning = false;

/**
 * Check if required tables exist
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

    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);

    return result.rows[0].exists;
  } catch (error: any) {
    console.error('[Health] Error checking tables:', error.message);
    return false;
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

/**
 * Health check endpoint
 * Also ensures database migrations are run if tables don't exist
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: {
      connected: false,
      tablesExist: false,
      migrationsRun: false,
    },
  };

  try {
    // Check DATABASE_URL
    if (!DATABASE_URL) {
      return res.status(200).json({
        ...health,
        status: 'warning',
        message: 'DATABASE_URL is not configured',
        database: {
          connected: false,
          tablesExist: false,
          migrationsRun: false,
        },
      });
    }

    // Check if tables exist
    const tablesExist = await checkTablesExist();
    health.database.tablesExist = tablesExist;
    health.database.connected = true;

    // Run migrations if tables don't exist and not already running
    if (!tablesExist && !migrationsRunning && !migrationsChecked) {
      migrationsRunning = true;
      migrationsChecked = true;

      try {
        console.log('[Health] Tables not found, running migrations...');
        await runMigrations();
        health.database.migrationsRun = true;
        health.status = 'ok';
        console.log('[Health] Migrations completed successfully');
      } catch (error: any) {
        console.error('[Health] Migration failed:', error.message);
        health.status = 'error';
        health.database.migrationsRun = false;
        return res.status(500).json({
          ...health,
          error: 'Migration failed',
          message: error.message,
        });
      } finally {
        migrationsRunning = false;
      }
    } else if (tablesExist) {
      health.database.migrationsRun = true;
    }

    return res.status(200).json(health);
  } catch (error: any) {
    console.error('[Health] Health check failed:', error.message);
    return res.status(500).json({
      ...health,
      status: 'error',
      error: error.message,
    });
  }
}
