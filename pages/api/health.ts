import type { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || '';

/**
 * Health check endpoint - checks database connectivity and migrations
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const health: any = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: {
      connected: false,
      tablesExist: false,
    },
  };

  // Check DATABASE_URL configuration
  if (!DATABASE_URL) {
    return res.status(200).json({
      ...health,
      status: 'warning',
      message: 'DATABASE_URL is not configured',
    });
  }

  // Test database connection
  let pool: Pool | null = null;
  try {
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 5000,
    });

    await pool.query('SELECT 1');
    health.database.connected = true;

    // Check if migrations have been run (check for users table)
    try {
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'users'
        );
      `);
      health.database.tablesExist = tableCheck.rows[0].exists;
      
      if (!health.database.tablesExist) {
        health.status = 'warning';
        health.message = 'Database connected but migrations have not been run. Tables do not exist.';
      }
    } catch (tableError: any) {
      console.error('[Health] Table check failed:', tableError.message);
      health.database.tablesExist = false;
      health.status = 'warning';
      health.message = 'Could not verify tables exist';
    }

    return res.status(200).json(health);
  } catch (error: any) {
    console.error('[Health] Database connection failed:', error.message);
    return res.status(503).json({
      ...health,
      status: 'error',
      message: 'Database connection failed',
      error: error.message,
    });
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}
