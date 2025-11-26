// Database connection utility for Railway
// This file handles connection to Railway Database

import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || '';

// Logging utility
const log = {
  info: (message: string, data?: any) => {
    console.log(`[DB] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[DB] ERROR: ${message}`, error || '');
  },
  warn: (message: string, data?: any) => {
    console.warn(`[DB] WARNING: ${message}`, data || '');
  }
};

// Check if DATABASE_URL is configured
if (!DATABASE_URL) {
  log.warn('DATABASE_URL is not set. Database operations will fail.');
  log.warn('Please ensure DATABASE_URL is set in Railway environment variables.');
} else {
  // Log connection info (without sensitive data)
  const urlParts = DATABASE_URL.match(/^postgres(ql)?:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
  if (urlParts) {
    const [, , user, , host, port, database] = urlParts;
    log.info(`DATABASE_URL configured: postgresql://${user}:***@${host}:${port}/${database}`);
  } else {
    log.info(`DATABASE_URL configured: ${DATABASE_URL.substring(0, 30)}...`);
  }
}

// Create connection pool
let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    if (!DATABASE_URL) {
      throw new Error('DATABASE_URL is not configured');
    }
    
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    pool.on('error', (err) => {
      log.error('Unexpected error on idle client', err);
    });

    log.info('Database connection pool created');
  }
  
  return pool;
}

/**
 * Execute a query against Railway Database
 */
export async function queryDatabase(query: string, params?: any[]): Promise<any> {
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured');
  }

  try {
    log.info(`[DB] Executing query: ${query.substring(0, 100)}...`, { params });
    
    const dbPool = getPool();
    const result = await dbPool.query(query, params);
    return result.rows;
  } catch (error: any) {
    log.error('[DB] Query failed', {
      error: error.message,
      stack: error.stack,
      query: query.substring(0, 100)
    });
    throw error;
  }
}

/**
 * Initialize database tables if they don't exist
 * NOTE: This is now handled by migrations. Use runMigrations() instead.
 * @deprecated Use runMigrations() from lib/migrations.ts
 */
export async function initializeDatabase(): Promise<void> {
  log.warn('[DB] initializeDatabase() is deprecated. Migrations are handled automatically.');
  // Migrations are now handled by lib/migrations.ts
}

/**
 * Database operations using PostgreSQL
 */
export const db = {
  users: {
    async get(userId: string) {
      log.info(`[DB] Getting user: ${userId}`);
      
      if (!DATABASE_URL) {
        log.warn('[DB] DATABASE_URL not set, returning null');
        return null;
      }

      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          'SELECT * FROM users WHERE id = $1',
          [userId]
        );
        
        if (result.rows.length === 0) {
          return null;
        }

        const user = result.rows[0];
        // Transform database format to client format
        return {
          id: user.id,
          name: user.name,
          birth_date: user.birth_date,
          birth_time: user.birth_time,
          birth_place: user.birth_place,
          is_setup: user.is_setup,
          language: user.language,
          theme: user.theme,
          is_premium: user.is_premium,
          is_admin: user.is_admin,
          three_keys: user.three_keys,
          evolution: user.evolution,
          premium_activated_at: user.premium_activated_at,
          premium_stars_amount: user.premium_stars_amount,
          premium_transaction_id: user.premium_transaction_id,
          created_at: user.created_at,
          updated_at: user.updated_at,
        };
      } catch (error: any) {
        log.error('[DB] Error getting user', {
          error: error.message,
          userId
        });
        throw error;
      }
    },

    async set(userId: string, data: any) {
      log.info(`[DB] Setting user: ${userId}`, { hasName: !!data.name });
      
      if (!DATABASE_URL) {
        throw new Error('DATABASE_URL is not configured');
      }

      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          `INSERT INTO users (
            id, name, birth_date, birth_time, birth_place,
            is_setup, language, theme, is_premium, is_admin,
            three_keys, evolution, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            birth_date = EXCLUDED.birth_date,
            birth_time = EXCLUDED.birth_time,
            birth_place = EXCLUDED.birth_place,
            is_setup = EXCLUDED.is_setup,
            language = EXCLUDED.language,
            theme = EXCLUDED.theme,
            is_premium = EXCLUDED.is_premium,
            is_admin = EXCLUDED.is_admin,
            three_keys = EXCLUDED.three_keys,
            evolution = EXCLUDED.evolution,
            updated_at = CURRENT_TIMESTAMP
          RETURNING *`,
          [
            userId,
            data.name,
            data.birth_date,
            data.birth_time,
            data.birth_place,
            data.is_setup || false,
            data.language || 'ru',
            data.theme || 'dark',
            data.is_premium || false,
            data.is_admin || false,
            data.three_keys ? JSON.stringify(data.three_keys) : null,
            data.evolution ? JSON.stringify(data.evolution) : null,
          ]
        );

        const user = result.rows[0];
        return {
          id: user.id,
          name: user.name,
          birth_date: user.birth_date,
          birth_time: user.birth_time,
          birth_place: user.birth_place,
          is_setup: user.is_setup,
          language: user.language,
          theme: user.theme,
          is_premium: user.is_premium,
          is_admin: user.is_admin,
          three_keys: user.three_keys,
          evolution: user.evolution,
        };
      } catch (error: any) {
        log.error('[DB] Error setting user', {
          error: error.message,
          userId
        });
        throw error;
      }
    },

    async getAll() {
      log.info('[DB] Getting all users');
      
      if (!DATABASE_URL) {
        log.warn('[DB] DATABASE_URL not set, returning empty array');
        return [];
      }

      try {
        const dbPool = getPool();
        const result = await dbPool.query('SELECT * FROM users ORDER BY created_at DESC');
        
        return result.rows.map((user: any) => ({
          id: user.id,
          name: user.name,
          birth_date: user.birth_date,
          birth_time: user.birth_time,
          birth_place: user.birth_place,
          is_setup: user.is_setup,
          language: user.language,
          theme: user.theme,
          is_premium: user.is_premium,
          is_admin: user.is_admin,
          three_keys: user.three_keys,
          evolution: user.evolution,
        }));
      } catch (error: any) {
        log.error('[DB] Error getting all users', {
          error: error.message
        });
        throw error;
      }
    },
  },

  charts: {
    async get(userId: string) {
      log.info(`[DB] Getting chart for user: ${userId}`);
      
      if (!DATABASE_URL) {
        log.warn('[DB] DATABASE_URL not set, returning null');
        return null;
      }

      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          'SELECT chart_data FROM charts WHERE user_id = $1',
          [userId]
        );
        
        if (result.rows.length === 0) {
          return null;
        }

        return result.rows[0].chart_data;
      } catch (error: any) {
        log.error('[DB] Error getting chart', {
          error: error.message,
          userId
        });
        throw error;
      }
    },

    async set(userId: string, data: any) {
      log.info(`[DB] Setting chart for user: ${userId}`);
      
      if (!DATABASE_URL) {
        throw new Error('DATABASE_URL is not configured');
      }

      try {
        const dbPool = getPool();
        const chartData = data.chart_data || data;
        
        const result = await dbPool.query(
          `INSERT INTO charts (user_id, chart_data, updated_at)
           VALUES ($1, $2, CURRENT_TIMESTAMP)
           ON CONFLICT (user_id) DO UPDATE SET
             chart_data = EXCLUDED.chart_data,
             updated_at = CURRENT_TIMESTAMP
           RETURNING *`,
          [userId, JSON.stringify(chartData)]
        );

        return {
          user_id: result.rows[0].user_id,
          chart_data: result.rows[0].chart_data,
        };
      } catch (error: any) {
        log.error('[DB] Error setting chart', {
          error: error.message,
          userId
        });
        throw error;
      }
    },
  },
};
