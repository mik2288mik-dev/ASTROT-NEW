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
    'premium_entitlements',
    'content_unlocks',
    'content_interpretations',
    'notification_delivery_log',
    'notification_rotation_state',
    'notification_schedules',
    'notification_templates',
    'notification_assets',
    'notification_deliveries',
    'notification_campaigns',
    'legacy_notification_templates',
    'user_sessions',
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
      dashboard_air_variant TEXT DEFAULT 'cloud-ribbon',
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

/**
 * Migration: Admin backoffice sessions + notifications (lumia_004)
 */
async function lumia004AdminBackoffice(pool: Pool): Promise<void> {
  const migrationName = 'lumia_004_admin_backoffice';

  if (await isMigrationApplied(pool, migrationName)) {
    log.info(`Migration ${migrationName} already applied, skipping`);
    return;
  }

  log.info('Applying admin backoffice migration...');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      id BIGSERIAL PRIMARY KEY,
      session_id TEXT NOT NULL,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      telegram_platform TEXT,
      device_label TEXT,
      user_agent TEXT,
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (session_id, user_id)
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_user_sessions_last_seen ON user_sessions(last_seen_at DESC)');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notification_templates (
      id BIGSERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      body_ru TEXT,
      body_en TEXT,
      kind TEXT NOT NULL DEFAULT 'both',
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_notification_templates_kind ON notification_templates(kind)');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notification_campaigns (
      id BIGSERIAL PRIMARY KEY,
      created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
      mode TEXT NOT NULL,
      target_segment TEXT,
      target_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
      template_id BIGINT REFERENCES notification_templates(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      body_ru TEXT,
      body_en TEXT,
      total_recipients INTEGER DEFAULT 0,
      success_count INTEGER DEFAULT 0,
      failed_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      sent_at TIMESTAMP
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_notification_campaigns_created_at ON notification_campaigns(created_at DESC)');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notification_deliveries (
      id BIGSERIAL PRIMARY KEY,
      campaign_id BIGINT NOT NULL REFERENCES notification_campaigns(id) ON DELETE CASCADE,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      language TEXT,
      message_text TEXT NOT NULL,
      status TEXT NOT NULL,
      telegram_message_id BIGINT,
      error_text TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      sent_at TIMESTAMP
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_notification_deliveries_campaign ON notification_deliveries(campaign_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_notification_deliveries_user ON notification_deliveries(user_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_notification_deliveries_status ON notification_deliveries(status)');

  const existingTemplates = await pool.query('SELECT COUNT(*)::int AS count FROM notification_templates');
  const templateCount = existingTemplates.rows[0]?.count ?? 0;
  if (templateCount === 0) {
    await pool.query(
      `INSERT INTO notification_templates (title, body_ru, body_en, kind, is_active)
       VALUES
       ($1, $2, $3, $4, TRUE),
       ($5, $6, $7, $8, TRUE),
       ($9, $10, $11, $12, TRUE),
       ($13, $14, $15, $16, TRUE),
       ($17, $18, $19, $20, TRUE)`,
      [
        'Premium granted',
        'Твой Premium в Lumia уже активирован. Можно возвращаться к полному разбору, Оракулу и расширенным возможностям.',
        'Your Lumia Premium is now active. You can return to full readings, Oracle, and the expanded product flows.',
        'personal',
        'Lumi credited',
        'Мы начислили Lumi на твой баланс. Открой Lumia Wallet, чтобы посмотреть обновление.',
        'We credited Lumi to your balance. Open Lumia Wallet to see the update.',
        'personal',
        'Important announcement',
        'У нас есть важное обновление в Lumia. Открой приложение, чтобы посмотреть детали.',
        'We have an important Lumia update. Open the app to see the details.',
        'broadcast',
        'Maintenance update',
        'Сегодня в Lumia идут технические работы. Если что-то временно недоступно, попробуй чуть позже.',
        'Lumia is undergoing maintenance today. If something is temporarily unavailable, please try again a bit later.',
        'broadcast',
        'Come back',
        'Мы сохранили твои карты и историю в Lumia. Возвращайся — всё уже ждёт тебя внутри.',
        'Your charts and history are still waiting for you in Lumia. Come back when you are ready.',
        'broadcast',
      ]
    );
  }

  await markMigrationApplied(pool, migrationName);
  log.info('Migration lumia_004_admin_backoffice applied');
}

async function lumia005AppSettings(pool: Pool): Promise<void> {
  const migrationName = 'lumia_005_app_settings';

  if (await isMigrationApplied(pool, migrationName)) {
    log.info(`Migration ${migrationName} already applied, skipping`);
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings(key)');

  await markMigrationApplied(pool, migrationName);
  log.info('Migration lumia_005_app_settings applied');
}

/**
 * Migration: Scheduled Telegram notifications CMS (lumia_006)
 * Renames legacy admin compose templates; adds assets, templates, schedules, rotation, delivery log.
 */
async function lumia006ScheduledNotifications(pool: Pool): Promise<void> {
  const migrationName = 'lumia_006_scheduled_notifications';

  if (await isMigrationApplied(pool, migrationName)) {
    log.info(`Migration ${migrationName} already applied, skipping`);
    return;
  }

  log.info('Applying scheduled notifications migration...');

  await pool.query(`
    ALTER TABLE IF EXISTS notification_templates RENAME TO legacy_notification_templates
  `);
  await pool.query(
    'ALTER INDEX IF EXISTS idx_notification_templates_kind RENAME TO idx_legacy_notification_templates_kind'
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notification_assets (
      id BIGSERIAL PRIMARY KEY,
      file_name TEXT NOT NULL,
      storage_path TEXT NOT NULL,
      public_url TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size BIGINT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      uploaded_by BIGINT REFERENCES users(id) ON DELETE SET NULL
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_notification_assets_created ON notification_assets(created_at DESC)');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notification_templates (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      slot TEXT NOT NULL,
      message_type TEXT NOT NULL DEFAULT 'text',
      text TEXT NOT NULL DEFAULT '',
      button_text TEXT NOT NULL DEFAULT '',
      deep_link TEXT NOT NULL DEFAULT '',
      asset_id BIGINT REFERENCES notification_assets(id) ON DELETE SET NULL,
      is_active BOOLEAN DEFAULT TRUE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      rotation_group TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_notification_templates_slot ON notification_templates(slot)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_notification_templates_active ON notification_templates(is_active)');
  await pool.query(
    'CREATE INDEX IF NOT EXISTS idx_notification_templates_rotation ON notification_templates(slot, rotation_group, sort_order, id)'
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notification_schedules (
      id BIGSERIAL PRIMARY KEY,
      template_id BIGINT NOT NULL REFERENCES notification_templates(id) ON DELETE CASCADE,
      send_time TIME NOT NULL,
      timezone TEXT NOT NULL DEFAULT 'Europe/Moscow',
      repeat_mode TEXT NOT NULL DEFAULT 'daily',
      is_active BOOLEAN DEFAULT TRUE,
      last_sent_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_notification_schedules_template ON notification_schedules(template_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_notification_schedules_active ON notification_schedules(is_active)');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notification_rotation_state (
      id BIGSERIAL PRIMARY KEY,
      slot TEXT NOT NULL,
      rotation_group TEXT NOT NULL DEFAULT '',
      last_template_id BIGINT REFERENCES notification_templates(id) ON DELETE SET NULL,
      last_index INTEGER NOT NULL DEFAULT -1,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_rotation_state_unique ON notification_rotation_state (slot, rotation_group)'
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notification_delivery_log (
      id BIGSERIAL PRIMARY KEY,
      template_id BIGINT REFERENCES notification_templates(id) ON DELETE SET NULL,
      scheduled_for TIMESTAMP,
      sent_at TIMESTAMP,
      recipient_count INTEGER NOT NULL DEFAULT 0,
      success_count INTEGER NOT NULL DEFAULT 0,
      failure_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      error_summary TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_notification_delivery_log_created ON notification_delivery_log(created_at DESC)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_notification_delivery_log_template ON notification_delivery_log(template_id)');

  const countResult = await pool.query('SELECT COUNT(*)::int AS c FROM notification_templates');
  if ((countResult.rows[0]?.c ?? 0) === 0) {
    await pool.query(
      `INSERT INTO notification_templates (name, slot, message_type, text, button_text, deep_link, is_active, sort_order, rotation_group, notes)
       VALUES
       ($1, 'morning', 'text', $2, $3, '', TRUE, 0, NULL, $4),
       ($5, 'day', 'text', $6, $3, '', TRUE, 0, NULL, $7),
       ($8, 'evening', 'text', $9, $3, '', TRUE, 0, NULL, $10)`,
      [
        'Morning Lumia',
        'Доброе утро! Открой Lumia — короткий гороскоп и настроение дня уже ждут.',
        'Открыть Lumia',
        'Default seed — задайте deep link в админке (URL мини-приложения).',
        'Day Lumia',
        'Середина дня — загляни в Lumia за персональным ориентиром.',
        'Default seed',
        'Evening Lumia',
        'Вечер — хорошее время свериться с картой и гороскопом в Lumia.',
        'Default seed',
      ]
    );
    const ids = await pool.query(`SELECT id, slot FROM notification_templates ORDER BY id`);
    for (const row of ids.rows) {
      const slot = String(row.slot);
      let hour = 8;
      const minute = 0;
      if (slot === 'day') {
        hour = 13;
      } else if (slot === 'evening') {
        hour = 20;
      }
      await pool.query(
        `INSERT INTO notification_schedules (template_id, send_time, timezone, repeat_mode, is_active)
         VALUES ($1, make_time($2, $3, 0), 'Europe/Moscow', 'daily', TRUE)`,
        [row.id, hour, minute]
      );
    }
  }

  await markMigrationApplied(pool, migrationName);
  log.info('Migration lumia_006_scheduled_notifications applied');
}

/**
 * Hybrid visual modes: none / uploaded / generated cards (lumia_007)
 */
async function lumia007NotificationVisualHybrid(pool: Pool): Promise<void> {
  const migrationName = 'lumia_007_notification_visual_hybrid';

  if (await isMigrationApplied(pool, migrationName)) {
    log.info(`Migration ${migrationName} already applied, skipping`);
    return;
  }

  log.info('Applying notification visual hybrid migration...');

  await pool.query(`
    ALTER TABLE notification_templates
      ADD COLUMN IF NOT EXISTS visual_mode TEXT NOT NULL DEFAULT 'none',
      ADD COLUMN IF NOT EXISTS generated_preset TEXT,
      ADD COLUMN IF NOT EXISTS generated_title TEXT,
      ADD COLUMN IF NOT EXISTS generated_subtitle TEXT,
      ADD COLUMN IF NOT EXISTS generated_accent TEXT,
      ADD COLUMN IF NOT EXISTS generated_show_date BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS generated_show_slot_label BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS generated_zodiac_mode TEXT,
      ADD COLUMN IF NOT EXISTS generated_custom_zodiac TEXT
  `);

  await pool.query(`
    UPDATE notification_templates
    SET visual_mode = 'uploaded'
    WHERE message_type = 'photo' AND asset_id IS NOT NULL
  `);

  await pool.query(`
    ALTER TABLE notification_delivery_log
      ADD COLUMN IF NOT EXISTS visual_mode TEXT,
      ADD COLUMN IF NOT EXISTS generated_preset TEXT,
      ADD COLUMN IF NOT EXISTS asset_id BIGINT,
      ADD COLUMN IF NOT EXISTS generated_cache_hit BOOLEAN
  `);

  await markMigrationApplied(pool, migrationName);
  log.info('Migration lumia_007_notification_visual_hybrid applied');
}

/**
 * Admin backoffice hardening for legacy/send templates and targeted automation (lumia_008)
 */
async function lumia008AdminNotificationEnhancements(pool: Pool): Promise<void> {
  const migrationName = 'lumia_008_admin_notification_enhancements';

  if (await isMigrationApplied(pool, migrationName)) {
    log.info(`Migration ${migrationName} already applied, skipping`);
    return;
  }

  log.info('Applying admin notification enhancements migration...');

  await pool.query(`
    ALTER TABLE legacy_notification_templates
      ADD COLUMN IF NOT EXISTS asset_id BIGINT REFERENCES notification_assets(id) ON DELETE SET NULL
  `);

  await pool.query(`
    ALTER TABLE notification_templates
      ADD COLUMN IF NOT EXISTS target_segment TEXT
  `);

  await pool.query(`
    ALTER TABLE notification_campaigns
      ADD COLUMN IF NOT EXISTS asset_id BIGINT REFERENCES notification_assets(id) ON DELETE SET NULL
  `);

  await pool.query('CREATE INDEX IF NOT EXISTS idx_notification_templates_target_segment ON notification_templates(target_segment)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_notification_campaigns_asset_id ON notification_campaigns(asset_id)');

  await markMigrationApplied(pool, migrationName);
  log.info('Migration lumia_008_admin_notification_enhancements applied');
}

/**
 * Content architecture v1: tiered interpretations, unlocks, entitlements (lumia_009)
 */
async function lumia009ContentArchitecture(pool: Pool): Promise<void> {
  const migrationName = 'lumia_009_content_architecture';

  if (await isMigrationApplied(pool, migrationName)) {
    log.info(`Migration ${migrationName} already applied, skipping`);
    return;
  }

  log.info('Applying content architecture migration...');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS content_interpretations (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
      chart_id BIGINT REFERENCES natal_charts(id) ON DELETE CASCADE,
      access_tier TEXT NOT NULL,
      content_surface TEXT NOT NULL,
      content_variant TEXT NOT NULL,
      model_tier TEXT NOT NULL DEFAULT 'base',
      cache_key TEXT NOT NULL DEFAULT 'default',
      input_hash TEXT,
      content JSONB NOT NULL,
      prompt_version TEXT,
      calculation_version TEXT,
      valid_from TIMESTAMP,
      valid_to TIMESTAMP,
      is_persistent BOOLEAN NOT NULL DEFAULT FALSE,
      can_regenerate_for_lumi BOOLEAN NOT NULL DEFAULT FALSE,
      regeneration_cost_lumi INTEGER,
      legacy_source TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT content_interpretations_scope CHECK ((chart_id IS NOT NULL) OR (user_id IS NOT NULL)),
      CONSTRAINT content_interpretations_access_tier CHECK (access_tier IN ('free', 'premium', 'lumi')),
      CONSTRAINT content_interpretations_surface CHECK (content_surface IN ('natal', 'forecast', 'synastry', 'question')),
      CONSTRAINT content_interpretations_variant CHECK (content_variant IN ('anchor', 'living', 'daily', 'morning', 'day', 'evening', 'weekly', 'monthly', 'brief', 'full', 'one_off')),
      CONSTRAINT content_interpretations_model CHECK (model_tier IN ('base', 'premium'))
    )
  `);
  await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_content_interpretations_chart_lookup ON content_interpretations(chart_id, access_tier, content_surface, content_variant, cache_key) WHERE chart_id IS NOT NULL');
  await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_content_interpretations_user_lookup ON content_interpretations(user_id, access_tier, content_surface, content_variant, cache_key) WHERE user_id IS NOT NULL AND chart_id IS NULL');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_content_interpretations_surface ON content_interpretations(content_surface, content_variant, access_tier)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_content_interpretations_validity ON content_interpretations(valid_from, valid_to)');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS content_unlocks (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      chart_id BIGINT REFERENCES natal_charts(id) ON DELETE CASCADE,
      access_tier TEXT NOT NULL,
      content_surface TEXT NOT NULL,
      content_variant TEXT NOT NULL,
      unlock_type TEXT NOT NULL,
      cache_key TEXT NOT NULL DEFAULT 'default',
      lumi_spent INTEGER NOT NULL DEFAULT 0,
      metadata JSONB,
      unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP,
      revoked_at TIMESTAMP,
      CONSTRAINT content_unlocks_access_tier CHECK (access_tier IN ('free', 'premium', 'lumi')),
      CONSTRAINT content_unlocks_surface CHECK (content_surface IN ('natal', 'forecast', 'synastry', 'question')),
      CONSTRAINT content_unlocks_variant CHECK (content_variant IN ('anchor', 'living', 'daily', 'morning', 'day', 'evening', 'weekly', 'monthly', 'brief', 'full', 'one_off')),
      CONSTRAINT content_unlocks_type CHECK (unlock_type IN ('free', 'premium', 'lumi'))
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_content_unlocks_lookup ON content_unlocks(user_id, content_surface, content_variant, access_tier, cache_key)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_content_unlocks_active ON content_unlocks(user_id, expires_at, revoked_at)');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS premium_entitlements (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tier_name TEXT NOT NULL DEFAULT 'lumia_premium',
      status TEXT NOT NULL DEFAULT 'active',
      source TEXT NOT NULL DEFAULT 'users.premium_until',
      starts_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ends_at TIMESTAMP NOT NULL,
      metadata JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT premium_entitlements_status CHECK (status IN ('active', 'expired', 'cancelled'))
    )
  `);
  await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_premium_entitlements_unique_period ON premium_entitlements(user_id, tier_name, ends_at, source)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_premium_entitlements_active ON premium_entitlements(user_id, status, ends_at)');

  await pool.query(`
    INSERT INTO premium_entitlements (user_id, tier_name, status, source, starts_at, ends_at, metadata)
    SELECT
      u.id,
      'lumia_premium',
      CASE WHEN u.premium_until > NOW() THEN 'active' ELSE 'expired' END,
      'users.premium_until',
      COALESCE(u.created_at, CURRENT_TIMESTAMP),
      u.premium_until,
      jsonb_build_object('backfilled', TRUE)
    FROM users u
    WHERE u.premium_until IS NOT NULL
    ON CONFLICT (user_id, tier_name, ends_at, source) DO NOTHING
  `);

  await markMigrationApplied(pool, migrationName);
  log.info('Migration lumia_009_content_architecture applied');
}

/**
 * Dashboard AIR variant per user (lumia_010)
 */
async function lumia010DashboardAirVariant(pool: Pool): Promise<void> {
  const migrationName = 'lumia_010_dashboard_air_variant';

  if (await isMigrationApplied(pool, migrationName)) {
    log.info(`Migration ${migrationName} already applied, skipping`);
    return;
  }

  log.info('Applying dashboard AIR variant migration...');

  await pool.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS dashboard_air_variant TEXT DEFAULT 'cloud-ribbon'
  `);

  await pool.query(`
    UPDATE users
    SET dashboard_air_variant = 'cloud-ribbon'
    WHERE dashboard_air_variant IS NULL
  `);

  await markMigrationApplied(pool, migrationName);
  log.info('Migration lumia_010_dashboard_air_variant applied');
}

async function verifyTablesExist(pool: Pool): Promise<void> {
  const required = [
    'users', 'natal_charts', 'interpretations', 'lumi_transactions', 'app_settings',
    'roulette_spins', 'daily_horoscopes', 'daily_natal_cards',
    'astro_questions', 'dictionary', 'synastry_cache', 'star_payments',
    'content_interpretations', 'content_unlocks', 'premium_entitlements',
    'user_sessions',
    'legacy_notification_templates',
    'notification_campaigns',
    'notification_deliveries',
    'notification_assets',
    'notification_templates',
    'notification_schedules',
    'notification_rotation_state',
    'notification_delivery_log',
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
    await lumia004AdminBackoffice(pool);
  await lumia005AppSettings(pool);
  await lumia006ScheduledNotifications(pool);
  await lumia007NotificationVisualHybrid(pool);
  await lumia008AdminNotificationEnhancements(pool);
  await lumia009ContentArchitecture(pool);
  await lumia010DashboardAirVariant(pool);
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
