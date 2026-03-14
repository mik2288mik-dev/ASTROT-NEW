// Lumia Database Migrations
// Full schema replacement: Astrot -> Lumia

import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || '';

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

async function tableExists(pool: Pool, tableName: string): Promise<boolean> {
  try {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = $1
      );
    `, [tableName]);
    return result.rows[0].exists;
  } catch (error: any) {
    log.error(`Error checking table ${tableName}`, { error: error.message });
    return false;
  }
}

async function createMigrationsTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  log.info('Migrations table created/verified');
}

async function isMigrationApplied(pool: Pool, migrationName: string): Promise<boolean> {
  const result = await pool.query(
    'SELECT COUNT(*) FROM migrations WHERE name = $1',
    [migrationName]
  );
  return parseInt(result.rows[0].count) > 0;
}

async function markMigrationApplied(pool: Pool, migrationName: string): Promise<void> {
  await pool.query(
    'INSERT INTO migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
    [migrationName]
  );
}

/**
 * Migration: Full database reset - DROP all tables
 */
async function migrationReset(pool: Pool): Promise<void> {
  const migrationName = 'lumia_reset';

  if (await isMigrationApplied(pool, migrationName)) {
    log.info(`Migration ${migrationName} already applied, skipping`);
    return;
  }

  log.info('Applying full database reset...');

  const dropOrder = [
    'astro_questions',
    'daily_natal_cards',
    'daily_horoscopes',
    'roulette_spins',
    'lumi_transactions',
    'interpretations',
    'natal_charts',
    'dictionary',
    'daily_horoscope',
    'user_settings',
    'deep_dive_analyses',
    'daily_horoscopes_cache',
    'regenerations',
    'forecasts_cache',
    'synastry_cache',
    'charts',
    'users'
  ];

  for (const table of dropOrder) {
    try {
      await pool.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
      log.info(`Dropped table ${table}`);
    } catch (e: any) {
      log.warn(`Drop ${table} failed (may not exist):`, e.message);
    }
  }

  await pool.query('TRUNCATE migrations');
  log.info('Migrations history cleared');

  await markMigrationApplied(pool, migrationName);
  log.info('Migration lumia_reset applied');
}

/**
 * Migration: Lumia full schema
 */
async function lumia001FullSchema(pool: Pool): Promise<void> {
  const migrationName = 'lumia_001_full_schema';

  if (await isMigrationApplied(pool, migrationName)) {
    log.info(`Migration ${migrationName} already applied, skipping`);
    return;
  }

  log.info('Applying Lumia schema...');

  await pool.query(`
    CREATE TABLE users (
      id BIGINT PRIMARY KEY,
      name TEXT,
      birth_date DATE,
      birth_time TIME,
      birth_place TEXT,
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      sun_sign TEXT,
      moon_sign TEXT,
      ascendant TEXT,
      lumi_balance INTEGER DEFAULT 0,
      premium_until TIMESTAMP,
      ref_code TEXT UNIQUE,
      referred_by BIGINT,
      login_streak INTEGER DEFAULT 0,
      last_login TIMESTAMP,
      language TEXT DEFAULT 'ru',
      theme TEXT DEFAULT 'dark',
      is_admin BOOLEAN DEFAULT FALSE,
      weather_city TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE natal_charts (
      id SERIAL PRIMARY KEY,
      user_id BIGINT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      sun JSONB,
      moon JSONB,
      ascendant JSONB,
      mercury JSONB,
      venus JSONB,
      mars JSONB,
      jupiter JSONB,
      saturn JSONB,
      houses JSONB,
      aspects JSONB,
      chart_data JSONB,
      input_hash TEXT,
      birth_date DATE,
      birth_time TIME,
      birth_place TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE interpretations (
      id SERIAL PRIMARY KEY,
      user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      input_hash TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE lumi_transactions (
      id SERIAL PRIMARY KEY,
      user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
      amount INTEGER NOT NULL,
      reason TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE roulette_spins (
      id SERIAL PRIMARY KEY,
      user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
      win_amount INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE daily_horoscopes (
      id SERIAL PRIMARY KEY,
      zodiac_sign TEXT NOT NULL,
      date DATE NOT NULL,
      content TEXT NOT NULL,
      UNIQUE (zodiac_sign, date)
    );
  `);

  await pool.query(`
    CREATE TABLE daily_natal_cards (
      id SERIAL PRIMARY KEY,
      user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
      date DATE,
      content TEXT NOT NULL,
      UNIQUE (user_id, date)
    );
  `);

  await pool.query(`
    CREATE TABLE astro_questions (
      id SERIAL PRIMARY KEY,
      user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE dictionary (
      id SERIAL PRIMARY KEY,
      term TEXT UNIQUE,
      title TEXT,
      description TEXT,
      category TEXT
    );
  `);

  await pool.query(`
    CREATE INDEX idx_interpretations_hash ON interpretations(input_hash);
    CREATE INDEX idx_interpretations_user ON interpretations(user_id);
    CREATE INDEX idx_interpretations_user_type ON interpretations(user_id, type);
    CREATE UNIQUE INDEX idx_interpretations_lookup ON interpretations(user_id, type, input_hash);
    CREATE INDEX idx_lumi_transactions_user ON lumi_transactions(user_id);
    CREATE INDEX idx_astro_questions_user ON astro_questions(user_id);
    CREATE INDEX idx_daily_horoscopes_date ON daily_horoscopes(date);
    CREATE INDEX idx_daily_horoscopes_sign_date ON daily_horoscopes(zodiac_sign, date);
    CREATE INDEX idx_daily_natal_cards_user ON daily_natal_cards(user_id);
    CREATE INDEX idx_daily_natal_cards_user_date ON daily_natal_cards(user_id, date);
  `);

  await markMigrationApplied(pool, migrationName);
  log.info('Migration lumia_001_full_schema applied');
}

async function verifyTablesExist(pool: Pool): Promise<void> {
  const required = [
    'users', 'natal_charts', 'interpretations', 'lumi_transactions',
    'roulette_spins', 'daily_horoscopes', 'daily_natal_cards',
    'astro_questions', 'dictionary'
  ];
  const missing: string[] = [];
  for (const t of required) {
    if (!(await tableExists(pool, t))) missing.push(t);
    else log.info(`✓ Table ${t} exists`);
  }
  if (missing.length > 0) {
    throw new Error(`Missing tables: ${missing.join(', ')}`);
  }
}

async function testConnection(pool: Pool, retries = 3, delay = 2000): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query('SELECT NOW()');
      log.info('Database connection established');
      return;
    } catch (error: any) {
      if (i < retries - 1) {
        log.warn(`Connection attempt ${i + 1} failed, retrying...`, { error: error.message });
        await new Promise(r => setTimeout(r, delay));
      } else throw error;
    }
  }
}

export async function runMigrations(): Promise<void> {
  if (!DATABASE_URL) {
    log.warn('DATABASE_URL not set. Skipping migrations.');
    return;
  }

  let pool: Pool | null = null;

  try {
    log.info('Starting Lumia database migrations...');

    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 10000,
      max: 3,
    });

    await testConnection(pool, 1, 1000);
    await createMigrationsTable(pool);

    await migrationReset(pool);
    await lumia001FullSchema(pool);
    await verifyTablesExist(pool);

    log.info('All Lumia migrations completed successfully');
  } catch (error: any) {
    log.error('Migration failed', { error: error.message, stack: error.stack });
    throw error;
  } finally {
    if (pool) {
      try {
        await pool.end();
        log.info('Database connection closed');
      } catch (e: any) {
        log.warn('Error closing pool', { error: e.message });
      }
    }
  }
}
