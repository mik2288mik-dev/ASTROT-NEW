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
    'star_payments',
    'synastry_cache',
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

  await pool.query('DROP TYPE IF EXISTS interpretation_type CASCADE');

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
    CREATE TYPE interpretation_type AS ENUM (
      'natal_free',
      'natal_intro',
      'natal_amateur',
      'natal_pro',
      'daily_natal_card',
      'question_answer',
      'synastry',
      'deep_dive_personality',
      'deep_dive_love',
      'deep_dive_career',
      'deep_dive_weakness',
      'deep_dive_karma'
    );
  `);

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
      is_primary BOOLEAN DEFAULT TRUE,
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
      type interpretation_type NOT NULL,
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
    CREATE INDEX idx_lumi_transactions_reason ON lumi_transactions(reason);
    CREATE INDEX idx_astro_questions_user ON astro_questions(user_id);
    CREATE INDEX idx_astro_questions_user_date ON astro_questions(user_id, created_at);
    CREATE INDEX idx_daily_horoscopes_date ON daily_horoscopes(date);
    CREATE INDEX idx_daily_horoscopes_sign_date ON daily_horoscopes(zodiac_sign, date);
    CREATE INDEX idx_daily_natal_cards_user ON daily_natal_cards(user_id);
    CREATE INDEX idx_daily_natal_cards_user_date ON daily_natal_cards(user_id, date);
  `);

  await markMigrationApplied(pool, migrationName);
  log.info('Migration lumia_001_full_schema applied');
}

/**
 * Migration: Multi-chart support (lumia_002)
 * Run AFTER lumia_001. Alters schema for multiple natal charts per user.
 */
async function lumia002MultiChart(pool: Pool): Promise<void> {
  const migrationName = 'lumia_002_multi_chart';

  if (await isMigrationApplied(pool, migrationName)) {
    log.info(`Migration ${migrationName} already applied, skipping`);
    return;
  }

  log.info('Applying multi-chart migration...');

  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS chart_slots INTEGER DEFAULT 1');

  await pool.query('ALTER TABLE natal_charts DROP CONSTRAINT IF EXISTS natal_charts_user_id_key');
  await pool.query('ALTER TABLE natal_charts ADD COLUMN IF NOT EXISTS name TEXT');
  await pool.query('ALTER TABLE natal_charts ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT FALSE');
  await pool.query(`UPDATE natal_charts SET name = COALESCE(name, 'Моя карта'), is_primary = TRUE WHERE is_primary IS NOT TRUE`);
  await pool.query('ALTER TABLE natal_charts ALTER COLUMN name SET DEFAULT \'Моя карта\'');

  await pool.query('DROP INDEX IF EXISTS idx_natal_charts_user_input_hash');
  await pool.query('CREATE UNIQUE INDEX idx_natal_charts_user_input_hash ON natal_charts(user_id, input_hash) WHERE input_hash IS NOT NULL');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_natal_charts_user ON natal_charts(user_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_natal_charts_user_primary ON natal_charts(user_id) WHERE is_primary = TRUE');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_natal_charts_input_hash ON natal_charts(input_hash) WHERE input_hash IS NOT NULL');

  await pool.query('ALTER TABLE interpretations ADD COLUMN IF NOT EXISTS chart_id BIGINT REFERENCES natal_charts(id) ON DELETE CASCADE');
  await pool.query(`
    UPDATE interpretations i SET chart_id = (
      SELECT nc.id FROM natal_charts nc WHERE nc.user_id = i.user_id
      ORDER BY nc.is_primary DESC NULLS LAST, nc.id ASC LIMIT 1
    ) WHERE i.chart_id IS NULL AND i.user_id IS NOT NULL
  `);

  await pool.query('DROP INDEX IF EXISTS idx_interpretations_lookup');
  await pool.query('CREATE UNIQUE INDEX idx_interpretations_chart_lookup ON interpretations(chart_id, type, input_hash) WHERE chart_id IS NOT NULL');
  await pool.query('CREATE UNIQUE INDEX idx_interpretations_user_lookup ON interpretations(user_id, type, input_hash) WHERE user_id IS NOT NULL AND chart_id IS NULL');
  await pool.query('ALTER TABLE interpretations DROP CONSTRAINT IF EXISTS interpretations_chart_or_user');
  await pool.query('ALTER TABLE interpretations ADD CONSTRAINT interpretations_chart_or_user CHECK ((chart_id IS NOT NULL) OR (user_id IS NOT NULL))');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_interpretations_chart ON interpretations(chart_id) WHERE chart_id IS NOT NULL');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_interpretations_user ON interpretations(user_id) WHERE user_id IS NOT NULL');

  await pool.query('ALTER TABLE daily_natal_cards ADD COLUMN IF NOT EXISTS chart_id BIGINT REFERENCES natal_charts(id) ON DELETE CASCADE');
  await pool.query(`
    UPDATE daily_natal_cards dnc SET chart_id = (
      SELECT nc.id FROM natal_charts nc WHERE nc.user_id = dnc.user_id
      ORDER BY nc.is_primary DESC NULLS LAST, nc.id ASC LIMIT 1
    ) WHERE dnc.chart_id IS NULL AND dnc.user_id IS NOT NULL
  `);
  await pool.query('DELETE FROM daily_natal_cards WHERE chart_id IS NULL');
  await pool.query('ALTER TABLE daily_natal_cards DROP CONSTRAINT IF EXISTS daily_natal_cards_user_id_date_key');
  await pool.query('DROP INDEX IF EXISTS idx_daily_natal_cards_chart_date');
  await pool.query('CREATE UNIQUE INDEX idx_daily_natal_cards_chart_date ON daily_natal_cards(chart_id, date) WHERE chart_id IS NOT NULL');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS synastry_cache (
      id BIGSERIAL PRIMARY KEY,
      chart1_id BIGINT NOT NULL REFERENCES natal_charts(id) ON DELETE CASCADE,
      chart2_id BIGINT NOT NULL REFERENCES natal_charts(id) ON DELETE CASCADE,
      mode TEXT NOT NULL,
      input_hash TEXT NOT NULL,
      content JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT synastry_chart_order CHECK (chart1_id < chart2_id)
    )
  `);
  await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_synastry_cache_lookup ON synastry_cache(chart1_id, chart2_id, mode, input_hash)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_synastry_cache_chart1 ON synastry_cache(chart1_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_synastry_cache_chart2 ON synastry_cache(chart2_id)');

  await markMigrationApplied(pool, migrationName);
  log.info('Migration lumia_002_multi_chart applied');
}

/**
 * Migration: Star payments for idempotency (lumia_003)
 */
async function lumia003StarPayments(pool: Pool): Promise<void> {
  const migrationName = 'lumia_003_star_payments';

  if (await isMigrationApplied(pool, migrationName)) {
    log.info(`Migration ${migrationName} already applied, skipping`);
    return;
  }

  log.info('Applying star_payments migration...');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS star_payments (
      id SERIAL PRIMARY KEY,
      telegram_payment_charge_id TEXT UNIQUE NOT NULL,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      stars_amount INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_star_payments_charge_id ON star_payments(telegram_payment_charge_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_star_payments_user ON star_payments(user_id)');

  await markMigrationApplied(pool, migrationName);
  log.info('Migration lumia_003_star_payments applied');
}

async function verifyTablesExist(pool: Pool): Promise<void> {
  const required = [
    'users', 'natal_charts', 'interpretations', 'lumi_transactions',
    'roulette_spins', 'daily_horoscopes', 'daily_natal_cards',
    'astro_questions', 'dictionary', 'synastry_cache', 'star_payments'
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
    await lumia002MultiChart(pool);
    await lumia003StarPayments(pool);
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
