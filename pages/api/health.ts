import type { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || '';

/**
 * Health check endpoint - only checks database connectivity
 * Migrations are handled during build process (npm run migrate)
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
