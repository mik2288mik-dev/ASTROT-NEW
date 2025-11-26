// Database migrations utility
// This file handles automatic database migrations on Railway deployment

import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || '';

// Logging utility
const log = {
  info: (message: string, data?: any) => {
    console.log(`[Migrations] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[Migrations] ERROR: ${message}`, error || '');
  },
  warn: (message: string, data?: any) => {
    console.warn(`[Migrations] WARNING: ${message}`, data || '');
  }
};

/**
 * Create migrations table to track applied migrations
 */
async function createMigrationsTable(pool: Pool): Promise<void> {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  
  await pool.query(createTableQuery);
  log.info('Migrations table created/verified');
}

/**
 * Check if migration was already applied
 */
async function isMigrationApplied(pool: Pool, migrationName: string): Promise<boolean> {
  const result = await pool.query(
    'SELECT COUNT(*) FROM migrations WHERE name = $1',
    [migrationName]
  );
  return parseInt(result.rows[0].count) > 0;
}

/**
 * Mark migration as applied
 */
async function markMigrationApplied(pool: Pool, migrationName: string): Promise<void> {
  await pool.query(
    'INSERT INTO migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
    [migrationName]
  );
}

/**
 * Migration 001: Create users table
 */
async function migration001(pool: Pool): Promise<void> {
  const migrationName = '001_create_users_table';
  
  if (await isMigrationApplied(pool, migrationName)) {
    log.info(`Migration ${migrationName} already applied, skipping`);
    return;
  }

  log.info(`Applying migration ${migrationName}...`);

  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255),
      birth_date VARCHAR(50),
      birth_time VARCHAR(50),
      birth_place VARCHAR(255),
      is_setup BOOLEAN DEFAULT false,
      language VARCHAR(10) DEFAULT 'ru',
      theme VARCHAR(10) DEFAULT 'dark',
      is_premium BOOLEAN DEFAULT false,
      is_admin BOOLEAN DEFAULT false,
      three_keys JSONB,
      evolution JSONB,
      premium_activated_at TIMESTAMP,
      premium_stars_amount INTEGER,
      premium_transaction_id VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  await pool.query(createUsersTable);
  await markMigrationApplied(pool, migrationName);
  log.info(`Migration ${migrationName} applied successfully`);
}

/**
 * Migration 002: Create charts table
 */
async function migration002(pool: Pool): Promise<void> {
  const migrationName = '002_create_charts_table';
  
  if (await isMigrationApplied(pool, migrationName)) {
    log.info(`Migration ${migrationName} already applied, skipping`);
    return;
  }

  log.info(`Applying migration ${migrationName}...`);

  const createChartsTable = `
    CREATE TABLE IF NOT EXISTS charts (
      user_id VARCHAR(255) PRIMARY KEY,
      chart_data JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `;

  await pool.query(createChartsTable);
  await markMigrationApplied(pool, migrationName);
  log.info(`Migration ${migrationName} applied successfully`);
}

/**
 * Migration 003: Create indexes for better performance
 */
async function migration003(pool: Pool): Promise<void> {
  const migrationName = '003_create_indexes';
  
  if (await isMigrationApplied(pool, migrationName)) {
    log.info(`Migration ${migrationName} already applied, skipping`);
    return;
  }

  log.info(`Applying migration ${migrationName}...`);

  const createIndexes = [
    'CREATE INDEX IF NOT EXISTS idx_users_is_premium ON users(is_premium)',
    'CREATE INDEX IF NOT EXISTS idx_users_is_setup ON users(is_setup)',
    'CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at)',
  ];

  for (const indexQuery of createIndexes) {
    await pool.query(indexQuery);
  }

  await markMigrationApplied(pool, migrationName);
  log.info(`Migration ${migrationName} applied successfully`);
}

/**
 * Test database connection with retry logic
 */
async function testConnection(pool: Pool, retries = 3, delay = 2000): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query('SELECT NOW()');
      log.info('Database connection established');
      return;
    } catch (error: any) {
      if (i < retries - 1) {
        log.warn(`Connection attempt ${i + 1} failed, retrying in ${delay}ms...`, {
          error: error.message
        });
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}

/**
 * Run all migrations
 */
export async function runMigrations(): Promise<void> {
  if (!DATABASE_URL) {
    log.warn('DATABASE_URL is not set. Skipping migrations.');
    log.warn('Please ensure Railway Database is connected and DATABASE_URL is set in environment variables.');
    return;
  }
  
  // Log connection info for debugging
  const urlParts = DATABASE_URL.match(/^postgres(ql)?:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
  if (urlParts) {
    const [, , user, , host, port, database] = urlParts;
    log.info(`Connecting to database: ${host}:${port}/${database} (user: ${user})`);
    
    // Check if using internal Railway hostname
    if (host.includes('railway.internal')) {
      log.warn('Using Railway internal hostname. This may not be accessible from Docker containers.');
      log.warn('If running outside Railway network, use the public database URL instead.');
    }
  } else {
    log.warn('Could not parse DATABASE_URL format. Please check the connection string.');
  }

  let pool: Pool | null = null;

  try {
    log.info('Starting database migrations...');
    
    // Configure pool with better timeout settings
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 10000, // 10 seconds timeout
      idleTimeoutMillis: 30000,
      max: 5, // Limit connections for migrations
    });

    // Test connection with retry logic
    await testConnection(pool, 3, 2000);
    log.info('Database connection test passed');

    // Create migrations table first
    await createMigrationsTable(pool);

    // Run migrations in order
    await migration001(pool);
    await migration002(pool);
    await migration003(pool);

    log.info('All migrations completed successfully');
  } catch (error: any) {
    const errorMessage = error.message || 'Unknown error';
    const errorCode = error.code || 'UNKNOWN';
    
    log.error('Migration failed', {
      error: errorMessage,
      code: errorCode,
      stack: error.stack
    });

    // Provide helpful error messages for common issues
    if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('getaddrinfo')) {
      log.error('DNS resolution failed. Possible causes:');
      log.error('1. Database hostname is incorrect or not accessible');
      log.error('2. If using Railway internal hostname (postgres.railway.internal), ensure you are running inside Railway network');
      log.error('3. If running in Docker, use Railway public database URL instead of internal');
      log.error('4. Check network connectivity and DNS settings');
    } else if (errorMessage.includes('ECONNREFUSED')) {
      log.error('Connection refused. Possible causes:');
      log.error('1. Database server is not running');
      log.error('2. Port number is incorrect');
      log.error('3. Firewall is blocking the connection');
    } else if (errorMessage.includes('authentication') || errorMessage.includes('password')) {
      log.error('Authentication failed. Check username and password in DATABASE_URL');
    } else if (errorMessage.includes('timeout')) {
      log.error('Connection timeout. Database server may be unreachable or overloaded');
    }

    throw error;
  } finally {
    if (pool) {
      try {
        await pool.end();
        log.info('Database connection closed');
      } catch (closeError: any) {
        log.warn('Error closing connection pool', { error: closeError.message });
      }
    }
  }
}
