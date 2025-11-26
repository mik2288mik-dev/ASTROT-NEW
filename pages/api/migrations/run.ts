import type { NextApiRequest, NextApiResponse } from 'next';
import { runMigrations } from '../../../lib/migrations';
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || '';

// Logging utility
const log = {
  info: (message: string, data?: any) => {
    console.log(`[API/migrations] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[API/migrations] ERROR: ${message}`, error || '');
  },
};

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
    log.error('Error checking tables', { error: error.message });
    return false;
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

/**
 * API endpoint to run migrations manually
 * This can be called on Railway deployment or manually
 * 
 * Supports both GET and POST methods for convenience
 * 
 * Security: In production, you might want to add authentication
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Allow both GET and POST methods
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET or POST' });
  }

  // Optional: Add authentication check here
  // const authHeader = req.headers.authorization;
  // if (authHeader !== `Bearer ${process.env.MIGRATION_SECRET}`) {
  //   return res.status(401).json({ error: 'Unauthorized' });
  // }

  try {
    // Check DATABASE_URL
    if (!DATABASE_URL) {
      return res.status(400).json({
        success: false,
        error: 'DATABASE_URL is not configured',
        message: 'Please set DATABASE_URL in environment variables'
      });
    }

    // Check current state
    const tablesExist = await checkTablesExist();
    
    log.info('Running migrations via API...', { tablesExist });

    // Run migrations
    await runMigrations();
    
    // Verify tables were created
    const tablesExistAfter = await checkTablesExist();
    
    return res.status(200).json({
      success: true,
      message: 'Migrations completed successfully',
      tables: {
        existedBefore: tablesExist,
        existAfter: tablesExistAfter,
      }
    });
  } catch (error: any) {
    log.error('Migration failed', {
      error: error.message,
      code: error.code,
      stack: error.stack
    });
    
    return res.status(500).json({
      success: false,
      error: 'Migration failed',
      message: error.message,
      code: error.code,
      details: {
        // Provide helpful troubleshooting info
        troubleshooting: error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')
          ? 'DNS resolution failed. Check DATABASE_URL hostname. If using Railway internal hostname, use public URL instead.'
          : error.message.includes('ECONNREFUSED')
          ? 'Connection refused. Check if database server is running and accessible.'
          : error.message.includes('authentication') || error.message.includes('password')
          ? 'Authentication failed. Check username and password in DATABASE_URL.'
          : 'Check DATABASE_URL configuration and database server status.'
      }
    });
  }
}

