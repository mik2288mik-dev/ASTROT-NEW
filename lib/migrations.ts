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
 * Run all migrations
 */
export async function runMigrations(): Promise<void> {
  if (!DATABASE_URL) {
    log.warn('DATABASE_URL is not set. Skipping migrations.');
    return;
  }

  let pool: Pool | null = null;

  try {
    log.info('Starting database migrations...');
    
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });

    // Test connection
    await pool.query('SELECT NOW()');
    log.info('Database connection established');

    // Create migrations table first
    await createMigrationsTable(pool);

    // Run migrations in order
    await migration001(pool);
    await migration002(pool);
    await migration003(pool);

    log.info('All migrations completed successfully');
  } catch (error: any) {
    log.error('Migration failed', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  } finally {
    if (pool) {
      await pool.end();
      log.info('Database connection closed');
    }
  }
}
