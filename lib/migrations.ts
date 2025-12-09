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
 * Check if a table exists in the database
 */
async function tableExists(pool: Pool, tableName: string): Promise<boolean> {
  try {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      );
    `, [tableName]);
    return result.rows[0].exists;
  } catch (error: any) {
    log.error(`Error checking if table ${tableName} exists`, { error: error.message });
    return false;
  }
}

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
  
  // Verify table was created
  const exists = await tableExists(pool, 'migrations');
  if (!exists) {
    throw new Error('Failed to create migrations table - table does not exist after CREATE TABLE');
  }
  
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
    // Verify table exists even if migration was already applied
    const exists = await tableExists(pool, 'users');
    if (!exists) {
      log.warn(`Migration ${migrationName} was marked as applied but table 'users' does not exist. Recreating...`);
    } else {
      return;
    }
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
  
  // Verify table was created
  const exists = await tableExists(pool, 'users');
  if (!exists) {
    throw new Error(`Failed to create table 'users' - table does not exist after CREATE TABLE`);
  }
  
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
    // Verify table exists even if migration was already applied
    const exists = await tableExists(pool, 'charts');
    if (!exists) {
      log.warn(`Migration ${migrationName} was marked as applied but table 'charts' does not exist. Recreating...`);
    } else {
      return;
    }
  }

  log.info(`Applying migration ${migrationName}...`);

  // Ensure users table exists before creating foreign key
  const usersExists = await tableExists(pool, 'users');
  if (!usersExists) {
    throw new Error('Cannot create charts table: users table does not exist. Run migration001 first.');
  }

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
  
  // Verify table was created
  const exists = await tableExists(pool, 'charts');
  if (!exists) {
    throw new Error(`Failed to create table 'charts' - table does not exist after CREATE TABLE`);
  }
  
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
 * Migration 004: Add cached text fields to users table
 */
async function migration004(pool: Pool): Promise<void> {
  const migrationName = '004_add_cached_texts';
  
  if (await isMigrationApplied(pool, migrationName)) {
    log.info(`Migration ${migrationName} already applied, skipping`);
    return;
  }

  log.info(`Applying migration ${migrationName}...`);

  // Add fields for caching AI-generated texts
  const addColumns = `
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS three_keys_text JSONB,
    ADD COLUMN IF NOT EXISTS three_keys_updated_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS natal_summary TEXT,
    ADD COLUMN IF NOT EXISTS natal_summary_updated_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS full_natal TEXT,
    ADD COLUMN IF NOT EXISTS full_natal_updated_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS stars_balance INTEGER DEFAULT 0;
  `;

  await pool.query(addColumns);
  
  await markMigrationApplied(pool, migrationName);
  log.info(`Migration ${migrationName} applied successfully`);
}

/**
 * Migration 005: Create synastry_cache table
 */
async function migration005(pool: Pool): Promise<void> {
  const migrationName = '005_create_synastry_cache';
  
  if (await isMigrationApplied(pool, migrationName)) {
    log.info(`Migration ${migrationName} already applied, skipping`);
    return;
  }

  log.info(`Applying migration ${migrationName}...`);

  // Ensure users table exists before creating foreign key
  const usersExists = await tableExists(pool, 'users');
  if (!usersExists) {
    throw new Error('Cannot create synastry_cache table: users table does not exist.');
  }

  const createSynastryCacheTable = `
    CREATE TABLE IF NOT EXISTS synastry_cache (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      partner_data JSONB NOT NULL,
      brief_analysis TEXT,
      full_analysis TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_synastry_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `;

  await pool.query(createSynastryCacheTable);
  
  // Create index for faster lookups
  await pool.query('CREATE INDEX IF NOT EXISTS idx_synastry_user_id ON synastry_cache(user_id)');
  
  // Verify table was created
  const exists = await tableExists(pool, 'synastry_cache');
  if (!exists) {
    throw new Error(`Failed to create table 'synastry_cache' - table does not exist after CREATE TABLE`);
  }
  
  await markMigrationApplied(pool, migrationName);
  log.info(`Migration ${migrationName} applied successfully`);
}

/**
 * Migration 006: Create forecasts_cache table
 */
async function migration006(pool: Pool): Promise<void> {
  const migrationName = '006_create_forecasts_cache';
  
  if (await isMigrationApplied(pool, migrationName)) {
    log.info(`Migration ${migrationName} already applied, skipping`);
    return;
  }

  log.info(`Applying migration ${migrationName}...`);

  // Ensure users table exists before creating foreign key
  const usersExists = await tableExists(pool, 'users');
  if (!usersExists) {
    throw new Error('Cannot create forecasts_cache table: users table does not exist.');
  }

  const createForecastsCacheTable = `
    CREATE TABLE IF NOT EXISTS forecasts_cache (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      period_type VARCHAR(20) NOT NULL, -- 'day', 'week', 'month'
      period_date DATE NOT NULL, -- The date this forecast is for
      content JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_forecast_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT unique_user_period UNIQUE (user_id, period_type, period_date)
    );
  `;

  await pool.query(createForecastsCacheTable);
  
  // Create index for faster lookups
  await pool.query('CREATE INDEX IF NOT EXISTS idx_forecasts_user_period ON forecasts_cache(user_id, period_type, period_date)');
  
  // Verify table was created
  const exists = await tableExists(pool, 'forecasts_cache');
  if (!exists) {
    throw new Error(`Failed to create table 'forecasts_cache' - table does not exist after CREATE TABLE`);
  }
  
  await markMigrationApplied(pool, migrationName);
  log.info(`Migration ${migrationName} applied successfully`);
}

/**
 * Migration 007: Create regenerations tracking table
 */
async function migration007(pool: Pool): Promise<void> {
  const migrationName = '007_create_regenerations_tracking';
  
  if (await isMigrationApplied(pool, migrationName)) {
    log.info(`Migration ${migrationName} already applied, skipping`);
    return;
  }

  log.info(`Applying migration ${migrationName}...`);

  // Ensure users table exists before creating foreign key
  const usersExists = await tableExists(pool, 'users');
  if (!usersExists) {
    throw new Error('Cannot create regenerations table: users table does not exist.');
  }

  const createRegenerationsTable = `
    CREATE TABLE IF NOT EXISTS regenerations (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      content_type VARCHAR(50) NOT NULL, -- 'three_keys', 'natal_summary', 'full_natal', 'synastry', 'forecast'
      regeneration_date DATE NOT NULL,
      was_paid BOOLEAN DEFAULT false,
      stars_cost INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_regeneration_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `;

  await pool.query(createRegenerationsTable);
  
  // Create indexes for faster lookups
  await pool.query('CREATE INDEX IF NOT EXISTS idx_regen_user_date ON regenerations(user_id, regeneration_date)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_regen_user_type_date ON regenerations(user_id, content_type, regeneration_date)');
  
  // Verify table was created
  const exists = await tableExists(pool, 'regenerations');
  if (!exists) {
    throw new Error(`Failed to create table 'regenerations' - table does not exist after CREATE TABLE`);
  }
  
  await markMigrationApplied(pool, migrationName);
  log.info(`Migration ${migrationName} applied successfully`);
}

/**
 * Migration 008: Add generated_content field to users table
 */
async function migration008(pool: Pool): Promise<void> {
  const migrationName = '008_add_generated_content';
  
  if (await isMigrationApplied(pool, migrationName)) {
    log.info(`Migration ${migrationName} already applied, skipping`);
    return;
  }

  log.info(`Applying migration ${migrationName}...`);

  // Add generated_content field for caching all AI-generated content
  const addColumn = `
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS generated_content JSONB;
  `;

  await pool.query(addColumn);
  
  await markMigrationApplied(pool, migrationName);
  log.info(`Migration ${migrationName} applied successfully`);
}

/**
 * Migration 009: Add weather_city field to users table
 */
async function migration009(pool: Pool): Promise<void> {
  const migrationName = '009_add_weather_city';
  
  if (await isMigrationApplied(pool, migrationName)) {
    log.info(`Migration ${migrationName} already applied, skipping`);
    return;
  }

  log.info(`Applying migration ${migrationName}...`);

  // Add weather_city field for storing user's weather city preference
  const addColumn = `
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS weather_city VARCHAR(255);
  `;

  await pool.query(addColumn);
  
  await markMigrationApplied(pool, migrationName);
  log.info(`Migration ${migrationName} applied successfully`);
}

/**
 * Migration 010: Create daily_horoscopes_cache table for caching horoscopes by zodiac sign
 */
async function migration010(pool: Pool): Promise<void> {
  const migrationName = '010_create_daily_horoscopes_cache';
  
  if (await isMigrationApplied(pool, migrationName)) {
    log.info(`Migration ${migrationName} already applied, skipping`);
    return;
  }

  log.info(`Applying migration ${migrationName}...`);

  // Create table for caching daily horoscopes by zodiac sign and date
  const createTable = `
    CREATE TABLE IF NOT EXISTS daily_horoscopes_cache (
      id SERIAL PRIMARY KEY,
      zodiac_sign VARCHAR(20) NOT NULL,
      date DATE NOT NULL,
      horoscope_data JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(zodiac_sign, date)
    );
    
    CREATE INDEX IF NOT EXISTS idx_daily_horoscopes_cache_sign_date 
    ON daily_horoscopes_cache(zodiac_sign, date);
  `;

  await pool.query(createTable);
  
  await markMigrationApplied(pool, migrationName);
  log.info(`Migration ${migrationName} applied successfully`);
}

/**
 * Verify that all required tables exist
 */
async function verifyTablesExist(pool: Pool): Promise<void> {
  const requiredTables = ['migrations', 'users', 'charts', 'synastry_cache', 'forecasts_cache', 'regenerations', 'daily_horoscopes_cache'];
  const missingTables: string[] = [];

  for (const tableName of requiredTables) {
    const exists = await tableExists(pool, tableName);
    if (!exists) {
      missingTables.push(tableName);
      log.error(`Table ${tableName} does not exist after migrations`);
    } else {
      log.info(`✓ Table ${tableName} exists`);
    }
  }

  if (missingTables.length > 0) {
    throw new Error(`Required tables are missing: ${missingTables.join(', ')}`);
  }

  log.info('All required tables verified successfully');
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
    // Use process.env.DATABASE_URL directly from environment variables
    pool = new Pool({
      connectionString: process.env.DATABASE_URL, // Direct use of process.env.DATABASE_URL
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
    await migration004(pool);
    await migration005(pool);
    await migration006(pool);
    await migration007(pool);
    await migration008(pool);
    await migration009(pool);
    await migration010(pool);

    // Verify that all tables were created successfully
    log.info('Verifying tables were created...');
    await verifyTablesExist(pool);

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
