// Lumia Database Migrations
// Full schema replacement: Astrot -> Lumia

import { Pool } from 'pg';
import { resolveDatabaseUrl } from './database-url';
import { NOTIFICATION_SCENARIO_SEEDS } from './notificationScenarioCatalog';
import { RETENTION_NOTIFICATION_SCENARIO_SEEDS } from './retentionNotificationCatalog';

const DATABASE_URL = resolveDatabaseUrl();

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
    'content_cache',
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
    'horoscope_reactions',
    'star_payments',
    'synastry_cache',
    'astro_questions',
    'daily_natal_cards',
    'daily_task_completions',
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
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      timezone TEXT,
      sun_sign TEXT,
      moon_sign TEXT,
      ascendant_sign TEXT,
      input_hash TEXT,
      calculation_version TEXT,
      birth_date DATE,
      birth_time TIME,
      birth_place TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

async function lumia008aUsersPremiumUntilColumn(pool: Pool): Promise<void> {
  const migrationName = 'lumia_008a_users_premium_until_column';

  if (await isMigrationApplied(pool, migrationName)) {
    log.info(`Migration ${migrationName} already applied, skipping`);
    return;
  }

  log.info('Ensuring users.premium_until exists...');

  await pool.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS premium_until TIMESTAMP
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_users_premium_until ON users(premium_until)');

  await markMigrationApplied(pool, migrationName);
  log.info('Migration lumia_008a_users_premium_until_column applied');
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
      CONSTRAINT content_interpretations_variant CHECK (content_variant IN ('anchor', 'living', 'planet_insight', 'daily', 'morning', 'day', 'evening', 'weekly', 'monthly', 'brief', 'full', 'one_off')),
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
      CONSTRAINT content_unlocks_variant CHECK (content_variant IN ('anchor', 'living', 'planet_insight', 'daily', 'morning', 'day', 'evening', 'weekly', 'monthly', 'brief', 'full', 'one_off')),
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

async function lumia011RemoveDashboardAirVariant(pool: Pool): Promise<void> {
  const migrationName = 'lumia_011_remove_dashboard_air_variant';

  if (await isMigrationApplied(pool, migrationName)) {
    log.info(`Migration ${migrationName} already applied, skipping`);
    return;
  }

  log.info('Removing dashboard AIR variant schema...');

  await pool.query(`
    ALTER TABLE users
      DROP COLUMN IF EXISTS dashboard_air_variant
  `);

  await markMigrationApplied(pool, migrationName);
  log.info('Migration lumia_011_remove_dashboard_air_variant applied');
}

async function lumia012DailyLumiTasks(pool: Pool): Promise<void> {
  const migrationName = 'lumia_012_daily_lumi_tasks';

  if (await isMigrationApplied(pool, migrationName)) {
    log.info(`Migration ${migrationName} already applied, skipping`);
    return;
  }

  // Legacy migration retained for history; Lumi daily tasks removed in lumia_025_remove_lumi_economy.
  await markMigrationApplied(pool, migrationName);
  log.info('Migration lumia_012_daily_lumi_tasks applied (no-op)');
}

async function lumia013CanonicalNatalPersistence(pool: Pool): Promise<void> {
  const migrationName = 'lumia_013_canonical_natal_persistence';

  if (await isMigrationApplied(pool, migrationName)) {
    log.info(`Migration ${migrationName} already applied, skipping`);
    return;
  }

  log.info('Applying canonical natal persistence migration...');

  await pool.query(`
    ALTER TABLE natal_charts
      ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS timezone TEXT,
      ADD COLUMN IF NOT EXISTS sun_sign TEXT,
      ADD COLUMN IF NOT EXISTS moon_sign TEXT,
      ADD COLUMN IF NOT EXISTS ascendant_sign TEXT,
      ADD COLUMN IF NOT EXISTS calculation_version TEXT,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  `);

  await pool.query(`
    UPDATE natal_charts
    SET
      sun = COALESCE(sun, chart_data->'sun'),
      moon = COALESCE(moon, chart_data->'moon'),
      ascendant = COALESCE(ascendant, chart_data->'rising', chart_data->'ascendant'),
      mercury = COALESCE(mercury, chart_data->'mercury'),
      venus = COALESCE(venus, chart_data->'venus'),
      mars = COALESCE(mars, chart_data->'mars'),
      jupiter = COALESCE(jupiter, chart_data->'jupiter'),
      saturn = COALESCE(saturn, chart_data->'saturn'),
      houses = COALESCE(houses, chart_data->'houses'),
      aspects = COALESCE(aspects, chart_data->'aspects'),
      latitude = COALESCE(latitude, NULLIF(chart_data->>'latitude', '')::DOUBLE PRECISION),
      longitude = COALESCE(longitude, NULLIF(chart_data->>'longitude', '')::DOUBLE PRECISION),
      timezone = COALESCE(timezone, NULLIF(chart_data->>'timezone', '')),
      sun_sign = COALESCE(sun_sign, chart_data->'sun'->>'sign'),
      moon_sign = COALESCE(moon_sign, chart_data->'moon'->>'sign'),
      ascendant_sign = COALESCE(ascendant_sign, COALESCE(chart_data->'rising'->>'sign', chart_data->'ascendant'->>'sign')),
      calculation_version = COALESCE(calculation_version, NULLIF(chart_data->>'calculationVersion', '')),
      updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)
  `);

  await pool.query('CREATE INDEX IF NOT EXISTS idx_natal_charts_user_hash_v2 ON natal_charts(user_id, input_hash) WHERE input_hash IS NOT NULL');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_natal_charts_user_primary_v2 ON natal_charts(user_id) WHERE is_primary = TRUE');

  await markMigrationApplied(pool, migrationName);
  log.info('Migration lumia_013_canonical_natal_persistence applied');
}

async function lumia014PlanetInsightVariant(pool: Pool): Promise<void> {
  const migrationName = 'lumia_014_planet_insight_variant';

  if (await isMigrationApplied(pool, migrationName)) {
    log.info(`Migration ${migrationName} already applied, skipping`);
    return;
  }

  log.info('Applying planet insight content variant migration...');

  await pool.query(`
    ALTER TABLE content_interpretations
      DROP CONSTRAINT IF EXISTS content_interpretations_variant
  `);
  await pool.query(`
    ALTER TABLE content_interpretations
      ADD CONSTRAINT content_interpretations_variant
      CHECK (content_variant IN ('anchor', 'living', 'planet_insight', 'daily', 'morning', 'day', 'evening', 'weekly', 'monthly', 'brief', 'full', 'one_off'))
  `);

  await pool.query(`
    ALTER TABLE content_unlocks
      DROP CONSTRAINT IF EXISTS content_unlocks_variant
  `);
  await pool.query(`
    ALTER TABLE content_unlocks
      ADD CONSTRAINT content_unlocks_variant
      CHECK (content_variant IN ('anchor', 'living', 'planet_insight', 'daily', 'morning', 'day', 'evening', 'weekly', 'monthly', 'brief', 'full', 'one_off'))
  `);

  await markMigrationApplied(pool, migrationName);
  log.info('Migration lumia_014_planet_insight_variant applied');
}

async function lumia016NatalContentUnification(pool: Pool): Promise<void> {
  const migrationName = 'lumia_016_natal_content_unification';

  if (await isMigrationApplied(pool, migrationName)) {
    log.info(`Migration ${migrationName} already applied, skipping`);
    return;
  }

  log.info('Applying natal content unification migration...');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS natal_content_legacy_archive (
      id BIGSERIAL PRIMARY KEY,
      archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      source_table TEXT NOT NULL,
      source_id TEXT,
      user_id BIGINT,
      chart_id BIGINT,
      content_type TEXT,
      access_tier TEXT,
      content_surface TEXT,
      content_variant TEXT,
      cache_key TEXT,
      prompt_version TEXT,
      content JSONB,
      legacy_row JSONB
    )
  `);

  await pool.query(`
    INSERT INTO natal_content_legacy_archive
      (source_table, source_id, user_id, chart_id, content_type, cache_key, content, legacy_row)
    SELECT
      'interpretations',
      i.id::TEXT,
      i.user_id,
      i.chart_id,
      i.type::TEXT,
      i.input_hash,
      to_jsonb(i.content),
      to_jsonb(i)
    FROM interpretations i
    WHERE i.type::TEXT IN (
      'natal_intro',
      'deep_dive_personality',
      'deep_dive_love',
      'deep_dive_career',
      'deep_dive_weakness',
      'deep_dive_karma'
    )
      AND NOT EXISTS (
        SELECT 1
        FROM natal_content_legacy_archive a
        WHERE a.source_table = 'interpretations'
          AND a.source_id = i.id::TEXT
      )
  `);

  await pool.query(`
    INSERT INTO natal_content_legacy_archive
      (source_table, source_id, user_id, chart_id, content_type, access_tier, content_surface, content_variant, cache_key, prompt_version, content, legacy_row)
    SELECT
      'content_interpretations',
      c.id::TEXT,
      c.user_id,
      c.chart_id,
      c.content_variant,
      c.access_tier,
      c.content_surface,
      c.content_variant,
      c.cache_key,
      c.prompt_version,
      c.content,
      to_jsonb(c)
    FROM content_interpretations c
    WHERE c.content_surface = 'natal'
      AND c.content_variant IN ('anchor', 'living', 'full')
      AND NOT (
        (c.content_variant = 'anchor' AND c.cache_key = 'base' AND c.prompt_version = 'natal_anchor.editorial_v3')
        OR (c.content_variant = 'full' AND c.cache_key = 'personality' AND c.prompt_version = 'natal_full.editorial_v3')
        OR (c.content_variant = 'living' AND c.cache_key ~ '^\\d{4}-\\d{2}-\\d{2}$' AND c.prompt_version = 'natal_daily.editorial_v3')
      )
      AND NOT EXISTS (
        SELECT 1
        FROM natal_content_legacy_archive a
        WHERE a.source_table = 'content_interpretations'
          AND a.source_id = c.id::TEXT
      )
  `);

  await pool.query(`
    DELETE FROM interpretations
    WHERE type::TEXT IN (
      'natal_intro',
      'deep_dive_personality',
      'deep_dive_love',
      'deep_dive_career',
      'deep_dive_weakness',
      'deep_dive_karma'
    )
  `);

  await pool.query(`
    DELETE FROM content_interpretations
    WHERE content_surface = 'natal'
      AND content_variant IN ('anchor', 'living', 'full')
      AND NOT (
        (content_variant = 'anchor' AND cache_key = 'base' AND prompt_version = 'natal_anchor.editorial_v3')
        OR (content_variant = 'full' AND cache_key = 'personality' AND prompt_version = 'natal_full.editorial_v3')
        OR (content_variant = 'living' AND cache_key ~ '^\\d{4}-\\d{2}-\\d{2}$' AND prompt_version = 'natal_daily.editorial_v3')
      )
  `);

  await markMigrationApplied(pool, migrationName);
  log.info('Migration lumia_016_natal_content_unification applied');
}

async function lumia017NatalHumanReadingV4Archive(pool: Pool): Promise<void> {
  const migrationName = 'lumia_017_natal_human_reading_v4_archive';

  if (await isMigrationApplied(pool, migrationName)) {
    log.info(`Migration ${migrationName} already applied, skipping`);
    return;
  }

  log.info('Applying natal human reading v4 archive migration...');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS natal_content_legacy_archive (
      id BIGSERIAL PRIMARY KEY,
      archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      source_table TEXT NOT NULL,
      source_id TEXT,
      user_id BIGINT,
      chart_id BIGINT,
      content_type TEXT,
      access_tier TEXT,
      content_surface TEXT,
      content_variant TEXT,
      cache_key TEXT,
      prompt_version TEXT,
      content JSONB,
      legacy_row JSONB
    )
  `);

  await pool.query(`
    INSERT INTO natal_content_legacy_archive
      (source_table, source_id, user_id, chart_id, content_type, access_tier, content_surface, content_variant, cache_key, prompt_version, content, legacy_row)
    SELECT
      'content_interpretations',
      c.id::TEXT,
      c.user_id,
      c.chart_id,
      c.content_variant,
      c.access_tier,
      c.content_surface,
      c.content_variant,
      c.cache_key,
      c.prompt_version,
      c.content,
      to_jsonb(c)
    FROM content_interpretations c
    WHERE c.content_surface = 'natal'
      AND (
        (c.content_variant = 'anchor' AND c.cache_key = 'base' AND c.prompt_version = 'natal_anchor.editorial_v3')
        OR (c.content_variant = 'full' AND c.cache_key = 'personality' AND c.prompt_version = 'natal_full.editorial_v3')
      )
      AND NOT EXISTS (
        SELECT 1
        FROM natal_content_legacy_archive a
        WHERE a.source_table = 'content_interpretations'
          AND a.source_id = c.id::TEXT
      )
  `);

  await pool.query(`
    DELETE FROM content_interpretations
    WHERE content_surface = 'natal'
      AND (
        (content_variant = 'anchor' AND cache_key = 'base' AND prompt_version = 'natal_anchor.editorial_v3')
        OR (content_variant = 'full' AND cache_key = 'personality' AND prompt_version = 'natal_full.editorial_v3')
      )
  `);

  await markMigrationApplied(pool, migrationName);
  log.info('Migration lumia_017_natal_human_reading_v4_archive applied');
}

async function lumia018NotificationFrequencyPreference(pool: Pool): Promise<void> {
  const migrationName = 'lumia_018_notification_frequency_preference';

  if (await isMigrationApplied(pool, migrationName)) {
    log.info(`Migration ${migrationName} already applied, skipping`);
    return;
  }

  log.info('Applying notification frequency preference migration...');

  await pool.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS notification_frequency TEXT DEFAULT 'important'
  `);

  await pool.query(`
    UPDATE users
    SET notification_frequency = 'important'
    WHERE notification_frequency IS NULL
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'users_notification_frequency_check'
      ) THEN
        ALTER TABLE users
          ADD CONSTRAINT users_notification_frequency_check
          CHECK (notification_frequency IN ('quiet', 'important', 'daily', 'twice_daily'));
      END IF;
    END $$;
  `);

  await markMigrationApplied(pool, migrationName);
  log.info('Migration lumia_018_notification_frequency_preference applied');
}

async function lumia019HoroscopeReactions(pool: Pool): Promise<void> {
  const migrationName = 'lumia_019_horoscope_reactions';

  if (await isMigrationApplied(pool, migrationName)) {
    log.info(`Migration ${migrationName} already applied, skipping`);
    return;
  }

  log.info('Applying horoscope reactions migration...');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS horoscope_reactions (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      zodiac_sign TEXT NOT NULL,
      reaction_date DATE NOT NULL,
      reaction_key TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (user_id, zodiac_sign, reaction_date),
      CONSTRAINT horoscope_reactions_key_check
        CHECK (reaction_key IN ('spot_on', 'funny', 'gentle', 'not_mine'))
    )
  `);

  await pool.query(
    'CREATE INDEX IF NOT EXISTS idx_horoscope_reactions_sign_date ON horoscope_reactions(zodiac_sign, reaction_date)'
  );
  await pool.query(
    'CREATE INDEX IF NOT EXISTS idx_horoscope_reactions_user_date ON horoscope_reactions(user_id, reaction_date)'
  );

  await markMigrationApplied(pool, migrationName);
  log.info('Migration lumia_019_horoscope_reactions applied');
}

async function lumia020DailyFeedbackAssistant(pool: Pool): Promise<void> {
  const migrationName = 'lumia_020_daily_feedback_assistant';

  if (await isMigrationApplied(pool, migrationName)) {
    log.info(`Migration ${migrationName} already applied, skipping`);
    return;
  }

  log.info('Applying daily feedback assistant migration...');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS daily_checkins (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      chart_id BIGINT REFERENCES natal_charts(id) ON DELETE CASCADE,
      checkin_date DATE NOT NULL,
      timezone TEXT NOT NULL DEFAULT 'Europe/Moscow',
      focus_key TEXT NOT NULL,
      mood_key TEXT NOT NULL,
      people_key TEXT NOT NULL,
      forecast_fit_key TEXT NOT NULL,
      pulse_time TEXT NOT NULL,
      pulse_phase TEXT NOT NULL,
      pulse_score INTEGER NOT NULL DEFAULT 0,
      pulse_layers JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT daily_checkins_focus_check CHECK (focus_key IN ('low', 'normal', 'high')),
      CONSTRAINT daily_checkins_mood_check CHECK (mood_key IN ('heavy', 'steady', 'good')),
      CONSTRAINT daily_checkins_people_check CHECK (people_key IN ('social', 'quiet')),
      CONSTRAINT daily_checkins_fit_check CHECK (forecast_fit_key IN ('yes', 'partial', 'no'))
    )
  `);
  await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_checkins_chart_date ON daily_checkins(user_id, chart_id, checkin_date) WHERE chart_id IS NOT NULL');
  await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_checkins_user_date ON daily_checkins(user_id, checkin_date) WHERE chart_id IS NULL');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_daily_checkins_user_recent ON daily_checkins(user_id, checkin_date DESC)');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS action_timing_events (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      chart_id BIGINT REFERENCES natal_charts(id) ON DELETE CASCADE,
      event_date DATE NOT NULL,
      timezone TEXT NOT NULL DEFAULT 'Europe/Moscow',
      action_key TEXT NOT NULL,
      recommendation_state TEXT NOT NULL,
      best_start TEXT NOT NULL,
      best_end TEXT NOT NULL,
      selected_hour INTEGER NOT NULL,
      confidence INTEGER NOT NULL DEFAULT 0,
      recommendation JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT action_timing_key_check CHECK (action_key IN ('message', 'money', 'purchase', 'serious_talk', 'work', 'rest')),
      CONSTRAINT action_timing_state_check CHECK (recommendation_state IN ('now', 'later', 'no_edge'))
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_action_timing_events_user_date ON action_timing_events(user_id, event_date DESC)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_action_timing_events_action ON action_timing_events(action_key, created_at DESC)');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS personal_pattern_insights (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      chart_id BIGINT REFERENCES natal_charts(id) ON DELETE CASCADE,
      insight_key TEXT NOT NULL,
      window_days INTEGER NOT NULL,
      insight JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_personal_pattern_insights_chart ON personal_pattern_insights(user_id, chart_id, insight_key) WHERE chart_id IS NOT NULL');
  await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_personal_pattern_insights_user ON personal_pattern_insights(user_id, insight_key) WHERE chart_id IS NULL');

  await markMigrationApplied(pool, migrationName);
  log.info('Migration lumia_020_daily_feedback_assistant applied');
}

async function lumia021NotificationScenarioEngine(pool: Pool): Promise<void> {
  const migrationName = 'lumia_021_notification_scenario_engine';

  if (await isMigrationApplied(pool, migrationName)) {
    log.info(`Migration ${migrationName} already applied, skipping`);
    return;
  }

  log.info('Applying notification scenario engine migration...');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notification_scenarios (
      id BIGSERIAL PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      enabled BOOLEAN NOT NULL DEFAULT FALSE,
      day_part TEXT NOT NULL,
      time_window_start TIME NOT NULL,
      time_window_end TIME NOT NULL,
      timezone_mode TEXT NOT NULL DEFAULT 'user_local',
      priority INTEGER NOT NULL DEFAULT 0,
      trigger_rule_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      audience_rule_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      max_per_day INTEGER NOT NULL DEFAULT 1,
      cooldown_hours INTEGER NOT NULL DEFAULT 20,
      image_mode TEXT NOT NULL DEFAULT 'auto',
      image_strategy_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      default_media_asset_id BIGINT REFERENCES notification_assets(id) ON DELETE SET NULL,
      deep_link TEXT NOT NULL DEFAULT 'today',
      buttons JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT notification_scenarios_day_part_check
        CHECK (day_part IN ('morning', 'day', 'evening', 'reactivation')),
      CONSTRAINT notification_scenarios_image_mode_check
        CHECK (image_mode IN ('auto', 'manual', 'none'))
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_notification_scenarios_enabled ON notification_scenarios(enabled)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_notification_scenarios_day_part ON notification_scenarios(day_part, priority DESC)');

  await pool.query(`
    ALTER TABLE notification_templates
      ADD COLUMN IF NOT EXISTS scenario_id BIGINT REFERENCES notification_scenarios(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS body TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS weight INTEGER NOT NULL DEFAULT 100,
      ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP
  `);
  await pool.query(`
    UPDATE notification_templates
    SET body = COALESCE(NULLIF(body, ''), text),
        title = COALESCE(NULLIF(title, ''), name)
    WHERE scenario_id IS NULL
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_notification_templates_scenario ON notification_templates(scenario_id, is_active)');
  await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_templates_scenario_name ON notification_templates(scenario_id, name) WHERE scenario_id IS NOT NULL');

  await pool.query(`
    ALTER TABLE notification_assets
      ADD COLUMN IF NOT EXISTS telegram_file_id TEXT,
      ADD COLUMN IF NOT EXISTS title TEXT,
      ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'day',
      ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS mood TEXT,
      ADD COLUMN IF NOT EXISTS day_part TEXT,
      ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS cooldown_days INTEGER NOT NULL DEFAULT 30
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_notification_assets_category ON notification_assets(category)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_notification_assets_enabled ON notification_assets(enabled)');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notification_logs (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
      scenario_id BIGINT REFERENCES notification_scenarios(id) ON DELETE SET NULL,
      scenario_key TEXT NOT NULL,
      template_id BIGINT REFERENCES notification_templates(id) ON DELETE SET NULL,
      media_asset_id BIGINT REFERENCES notification_assets(id) ON DELETE SET NULL,
      status TEXT NOT NULL,
      sent_at TIMESTAMP,
      clicked_at TIMESTAMP,
      opened_at TIMESTAMP,
      telegram_message_id BIGINT,
      error TEXT,
      payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_notification_logs_user_sent ON notification_logs(user_id, sent_at DESC)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_notification_logs_scenario ON notification_logs(scenario_key, created_at DESC)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_notification_logs_template ON notification_logs(template_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_notification_logs_media ON notification_logs(media_asset_id)');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_notification_settings (
      user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      morning_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      day_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      evening_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      reactivation_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      timezone TEXT,
      quiet_hours_start TIME NOT NULL DEFAULT '22:30',
      quiet_hours_end TIME NOT NULL DEFAULT '08:00',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_notification_state (
      user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      last_notification_at TIMESTAMP,
      notifications_sent_today INTEGER NOT NULL DEFAULT 0,
      sent_today_date DATE,
      last_opened_at TIMESTAMP,
      last_click_at TIMESTAMP,
      days_without_click INTEGER NOT NULL DEFAULT 0,
      last_checkin_at TIMESTAMP,
      checkin_streak INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_app_events (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      scenario_key TEXT,
      notification_log_id BIGINT REFERENCES notification_logs(id) ON DELETE SET NULL,
      section TEXT,
      source TEXT,
      occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      payload_json JSONB NOT NULL DEFAULT '{}'::jsonb
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_user_app_events_user_time ON user_app_events(user_id, occurred_at DESC)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_user_app_events_notification ON user_app_events(notification_log_id)');

  await pool.query(`
    UPDATE notification_templates
    SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
    WHERE scenario_id IS NULL
  `);

  for (const seed of NOTIFICATION_SCENARIO_SEEDS) {
    const scenarioResult = await pool.query(
      `INSERT INTO notification_scenarios (
         key, name, description, enabled, day_part, time_window_start, time_window_end, timezone_mode,
         priority, trigger_rule_json, audience_rule_json, max_per_day, cooldown_hours, image_mode,
         image_strategy_json, deep_link, buttons
       )
       VALUES ($1, $2, $3, FALSE, $4, $5::time, $6::time, 'user_local', $7, $8::jsonb, $9::jsonb,
         $10, $11, $12, $13::jsonb, $14, $15::jsonb)
       ON CONFLICT (key) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         day_part = EXCLUDED.day_part,
         time_window_start = EXCLUDED.time_window_start,
         time_window_end = EXCLUDED.time_window_end,
         priority = EXCLUDED.priority,
         trigger_rule_json = EXCLUDED.trigger_rule_json,
         audience_rule_json = EXCLUDED.audience_rule_json,
         max_per_day = EXCLUDED.max_per_day,
         cooldown_hours = EXCLUDED.cooldown_hours,
         image_strategy_json = EXCLUDED.image_strategy_json,
         deep_link = EXCLUDED.deep_link,
         buttons = EXCLUDED.buttons,
         updated_at = CURRENT_TIMESTAMP
       RETURNING id`,
      [
        seed.key,
        seed.name,
        seed.description,
        seed.dayPart,
        seed.timeWindowStart,
        seed.timeWindowEnd,
        seed.priority,
        JSON.stringify(seed.triggerRule),
        JSON.stringify(seed.audienceRule),
        seed.maxPerDay,
        seed.cooldownHours,
        seed.imageMode,
        JSON.stringify({ tags: seed.imageTags, dayPart: seed.dayPart }),
        seed.deepLinkSection,
        JSON.stringify([{ text: seed.buttonText, section: seed.deepLinkSection }]),
      ]
    );
    const scenarioId = Number(scenarioResult.rows[0]?.id);
    for (let index = 0; index < seed.templates.length; index += 1) {
      const template = seed.templates[index];
      await pool.query(
        `INSERT INTO notification_templates (
           scenario_id, name, slot, target_segment, message_type, title, body, text, button_text,
           deep_link, is_active, sort_order, tags, weight, visual_mode, notes
         )
         VALUES ($1, $2, $3, $4, 'text', $5, $6, $6, $7, $8, TRUE, $9, $10::jsonb, $11, 'none', $12)
         ON CONFLICT (scenario_id, name) WHERE scenario_id IS NOT NULL DO NOTHING`,
        [
          scenarioId,
          `${seed.name} · ${String(index + 1).padStart(2, '0')}`,
          seed.dayPart === 'reactivation' ? 'custom' : seed.dayPart,
          (seed.audienceRule.segment as string) || null,
          template.title,
          template.body,
          template.buttonText || seed.buttonText,
          seed.deepLinkSection,
          index,
          JSON.stringify(template.tags || []),
          template.weight || 100,
          seed.description,
        ]
      );
    }
  }

  await markMigrationApplied(pool, migrationName);
  log.info('Migration lumia_021_notification_scenario_engine applied');
}

async function lumia022RetentionNotificationQueue(pool: Pool): Promise<void> {
  const migrationName = 'lumia_022_retention_notification_queue';

  if (await isMigrationApplied(pool, migrationName)) {
    log.info(`Migration ${migrationName} already applied, skipping`);
    return;
  }

  log.info('Applying retention notification queue migration...');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS scheduled_notifications (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      notification_type TEXT NOT NULL,
      segment TEXT,
      campaign_id BIGINT REFERENCES notification_campaigns(id) ON DELETE SET NULL,
      scenario_id BIGINT REFERENCES notification_scenarios(id) ON DELETE SET NULL,
      template_id BIGINT REFERENCES notification_templates(id) ON DELETE SET NULL,
      notification_log_id BIGINT REFERENCES notification_logs(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'scheduled',
      scheduled_at TIMESTAMP NOT NULL,
      locked_at TIMESTAMP,
      sent_at TIMESTAMP,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      next_retry_at TIMESTAMP,
      reason TEXT,
      local_date DATE,
      dedupe_key TEXT,
      payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      telegram_message_id BIGINT,
      error TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT scheduled_notifications_status_check
        CHECK (status IN ('scheduled', 'sending', 'sent', 'failed', 'skipped', 'cancelled'))
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_due ON scheduled_notifications(status, scheduled_at, next_retry_at)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_user ON scheduled_notifications(user_id, scheduled_at DESC)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_type ON scheduled_notifications(notification_type, scheduled_at DESC)');
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_scheduled_notifications_dedupe
    ON scheduled_notifications(user_id, notification_type, local_date, dedupe_key)
    WHERE status IN ('scheduled', 'sending', 'sent')
      AND local_date IS NOT NULL
      AND dedupe_key IS NOT NULL
  `);

  await pool.query(`
    ALTER TABLE user_notification_settings
      ADD COLUMN IF NOT EXISTS daily_card_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS pulse_day_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS love_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS money_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS work_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS assistant_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS natal_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS premium_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS synastry_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS evening_summary_enabled BOOLEAN NOT NULL DEFAULT TRUE
  `);
  await pool.query(`ALTER TABLE user_notification_settings ALTER COLUMN quiet_hours_start SET DEFAULT '22:00'`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notification_events (
      id BIGSERIAL PRIMARY KEY,
      notification_id BIGINT REFERENCES scheduled_notifications(id) ON DELETE SET NULL,
      notification_log_id BIGINT REFERENCES notification_logs(id) ON DELETE SET NULL,
      campaign_id BIGINT REFERENCES notification_campaigns(id) ON DELETE SET NULL,
      user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
      notification_type TEXT,
      event_type TEXT NOT NULL,
      screen TEXT,
      source TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_notification_events_user_time ON notification_events(user_id, created_at DESC)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_notification_events_notification ON notification_events(notification_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_notification_events_type ON notification_events(notification_type, event_type, created_at DESC)');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS daily_cards (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      chart_id BIGINT REFERENCES natal_charts(id) ON DELETE SET NULL,
      date DATE NOT NULL,
      theme TEXT NOT NULL DEFAULT '',
      summary TEXT NOT NULL DEFAULT '',
      love_text TEXT NOT NULL DEFAULT '',
      work_text TEXT NOT NULL DEFAULT '',
      money_text TEXT NOT NULL DEFAULT '',
      caution_text TEXT NOT NULL DEFAULT '',
      advice_text TEXT NOT NULL DEFAULT '',
      payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (user_id, date)
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_daily_cards_user_date ON daily_cards(user_id, date DESC)');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pulse_day_entries (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      chart_id BIGINT REFERENCES natal_charts(id) ON DELETE SET NULL,
      date DATE NOT NULL,
      window_start TIME NOT NULL,
      window_end TIME NOT NULL,
      category TEXT NOT NULL DEFAULT 'general',
      recommendation TEXT NOT NULL DEFAULT '',
      score INTEGER NOT NULL DEFAULT 0,
      payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (user_id, date, window_start, category)
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_pulse_day_entries_user_date ON pulse_day_entries(user_id, date, window_start)');

  await pool.query(`
    ALTER TABLE notification_campaigns
      ADD COLUMN IF NOT EXISTS name TEXT,
      ADD COLUMN IF NOT EXISTS type TEXT,
      ADD COLUMN IF NOT EXISTS segment TEXT,
      ADD COLUMN IF NOT EXISTS schedule_rule JSONB NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft',
      ADD COLUMN IF NOT EXISTS start_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS end_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS max_sends_per_user INTEGER NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS ab_test_enabled BOOLEAN NOT NULL DEFAULT FALSE
  `);

  for (const seed of RETENTION_NOTIFICATION_SCENARIO_SEEDS) {
    const scenarioResult = await pool.query(
      `INSERT INTO notification_scenarios (
         key, name, description, enabled, day_part, time_window_start, time_window_end, timezone_mode,
         priority, trigger_rule_json, audience_rule_json, max_per_day, cooldown_hours, image_mode,
         image_strategy_json, deep_link, buttons
       )
       VALUES ($1, $2, $3, FALSE, $4, $5::time, $6::time, 'user_local', $7, '{}'::jsonb, $8::jsonb,
         $9, $10, 'auto', $11::jsonb, $12, $13::jsonb)
       ON CONFLICT (key) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         day_part = EXCLUDED.day_part,
         time_window_start = EXCLUDED.time_window_start,
         time_window_end = EXCLUDED.time_window_end,
         priority = EXCLUDED.priority,
         audience_rule_json = EXCLUDED.audience_rule_json,
         max_per_day = EXCLUDED.max_per_day,
         cooldown_hours = EXCLUDED.cooldown_hours,
         image_strategy_json = EXCLUDED.image_strategy_json,
         deep_link = EXCLUDED.deep_link,
         buttons = EXCLUDED.buttons,
         updated_at = CURRENT_TIMESTAMP
       RETURNING id`,
      [
        seed.key,
        seed.name,
        seed.description,
        seed.dayPart,
        seed.timeWindowStart,
        seed.timeWindowEnd,
        seed.priority,
        JSON.stringify({ segment: seed.segment }),
        seed.maxPerDay,
        seed.cooldownHours,
        JSON.stringify({ tags: seed.imageTags, dayPart: seed.dayPart }),
        seed.deepLinkSection,
        JSON.stringify([{ text: seed.templates[0]?.buttonText || 'Открыть', section: seed.deepLinkSection }]),
      ]
    );
    const scenarioId = Number(scenarioResult.rows[0]?.id);
    for (let index = 0; index < seed.templates.length; index += 1) {
      const item = seed.templates[index];
      await pool.query(
        `INSERT INTO notification_templates (
           scenario_id, name, slot, target_segment, message_type, title, body, text, button_text,
           deep_link, is_active, sort_order, tags, weight, visual_mode, notes
         )
         VALUES ($1, $2, $3, $4, 'text', $5, $6, $6, $7, $8, TRUE, $9, $10::jsonb, $11, 'none', $12)
         ON CONFLICT (scenario_id, name) WHERE scenario_id IS NOT NULL DO NOTHING`,
        [
          scenarioId,
          `${seed.name} · ${String(index + 1).padStart(2, '0')}`,
          seed.dayPart === 'reactivation' ? 'custom' : seed.dayPart,
          seed.segment,
          item.title,
          item.body,
          item.buttonText,
          seed.deepLinkSection,
          index,
          JSON.stringify(item.tags),
          item.weight || 100,
          seed.description,
        ]
      );
    }
  }

  await markMigrationApplied(pool, migrationName);
  log.info('Migration lumia_022_retention_notification_queue applied');
}

async function lumia023StarsAccessTier(pool: Pool): Promise<void> {
  const migrationName = 'lumia_023_stars_access_tier';
  if (await isMigrationApplied(pool, migrationName)) {
    log.info(`Migration ${migrationName} already applied`);
    return;
  }

  log.info('Applying stars access tier migration...');

  await pool.query(`
    ALTER TABLE content_interpretations
    DROP CONSTRAINT IF EXISTS content_interpretations_access_tier
  `);
  await pool.query(`
    ALTER TABLE content_interpretations
    ADD CONSTRAINT content_interpretations_access_tier
    CHECK (access_tier IN ('free', 'premium', 'lumi', 'stars'))
  `);

  await pool.query(`
    ALTER TABLE content_unlocks
    DROP CONSTRAINT IF EXISTS content_unlocks_access_tier
  `);
  await pool.query(`
    ALTER TABLE content_unlocks
    ADD CONSTRAINT content_unlocks_access_tier
    CHECK (access_tier IN ('free', 'premium', 'lumi', 'stars'))
  `);

  await pool.query(`
    ALTER TABLE content_unlocks
    DROP CONSTRAINT IF EXISTS content_unlocks_type
  `);
  await pool.query(`
    ALTER TABLE content_unlocks
    ADD CONSTRAINT content_unlocks_type
    CHECK (unlock_type IN ('free', 'premium', 'lumi', 'stars'))
  `);

  await markMigrationApplied(pool, migrationName);
  log.info('Migration lumia_023_stars_access_tier applied');
}

async function lumia024StarsOneOffPayments(pool: Pool): Promise<void> {
  const migrationName = 'lumia_024_stars_one_off_payments';
  if (await isMigrationApplied(pool, migrationName)) {
    log.info(`Migration ${migrationName} already applied`);
    return;
  }

  log.info('Applying stars one-off payments migration...');

  await pool.query(`
    ALTER TABLE star_payments
    ADD COLUMN IF NOT EXISTS payment_type TEXT
  `);
  await pool.query(`
    ALTER TABLE star_payments
    ADD COLUMN IF NOT EXISTS content_surface TEXT
  `);
  await pool.query(`
    ALTER TABLE star_payments
    ADD COLUMN IF NOT EXISTS content_variant TEXT
  `);
  await pool.query(`
    ALTER TABLE star_payments
    ADD COLUMN IF NOT EXISTS chart_id BIGINT NULL REFERENCES natal_charts(id) ON DELETE SET NULL
  `);
  await pool.query(`
    ALTER TABLE star_payments
    ADD COLUMN IF NOT EXISTS cache_key TEXT
  `);
  await pool.query(`
    ALTER TABLE star_payments
    ADD COLUMN IF NOT EXISTS payload_json JSONB NOT NULL DEFAULT '{}'::jsonb
  `);
  await pool.query(`
    ALTER TABLE star_payments
    ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMP NULL
  `);
  await pool.query(`
    ALTER TABLE star_payments
    ADD COLUMN IF NOT EXISTS consumed_by_unlock_id BIGINT NULL REFERENCES content_unlocks(id) ON DELETE SET NULL
  `);
  await pool.query(`
    ALTER TABLE star_payments
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'confirmed'
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_star_payments_user_type
    ON star_payments(user_id, payment_type)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_star_payments_consumed_at
    ON star_payments(consumed_at)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_star_payments_content_target
    ON star_payments(content_surface, content_variant, cache_key)
  `);

  await markMigrationApplied(pool, migrationName);
  log.info('Migration lumia_024_stars_one_off_payments applied');
}

async function lumia025RemoveLumiEconomy(pool: Pool): Promise<void> {
  const migrationName = 'lumia_025_remove_lumi_economy';

  if (await isMigrationApplied(pool, migrationName)) {
    log.info(`Migration ${migrationName} already applied, skipping`);
    return;
  }

  log.info('Removing Lumi economy tables and columns...');

  await pool.query('DROP TABLE IF EXISTS lumi_transactions CASCADE');
  await pool.query('DROP TABLE IF EXISTS roulette_spins CASCADE');
  await pool.query('DROP TABLE IF EXISTS daily_task_completions CASCADE');
  await pool.query('ALTER TABLE users DROP COLUMN IF EXISTS lumi_balance');

  await markMigrationApplied(pool, migrationName);
  log.info('Migration lumia_025_remove_lumi_economy applied');
}

async function lumia026AccessFoundation(pool: Pool): Promise<void> {
  const migrationName = 'lumia_026_access_foundation';

  if (await isMigrationApplied(pool, migrationName)) {
    log.info(`Migration ${migrationName} already applied, skipping`);
    return;
  }

  log.info('Applying access foundation fields on users...');

  await pool.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS is_setup BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS selected_zodiac_sign TEXT
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'users'
          AND column_name = 'premium_until'
          AND data_type = 'timestamp without time zone'
      ) THEN
        ALTER TABLE users
          ALTER COLUMN premium_until TYPE TIMESTAMPTZ
          USING premium_until AT TIME ZONE 'UTC';
      END IF;

      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'users'
          AND column_name = 'created_at'
          AND data_type = 'timestamp without time zone'
      ) THEN
        ALTER TABLE users
          ALTER COLUMN created_at TYPE TIMESTAMPTZ
          USING created_at AT TIME ZONE 'UTC';
      END IF;

      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'users'
          AND column_name = 'updated_at'
          AND data_type = 'timestamp without time zone'
      ) THEN
        ALTER TABLE users
          ALTER COLUMN updated_at TYPE TIMESTAMPTZ
          USING updated_at AT TIME ZONE 'UTC';
      END IF;
    END $$;
  `);

  await pool.query(`
    ALTER TABLE users
      ALTER COLUMN is_setup SET DEFAULT FALSE,
      ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP,
      ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP
  `);

  await pool.query(`
    UPDATE users
    SET is_setup = TRUE
    WHERE is_setup IS NOT TRUE
      AND birth_date IS NOT NULL
      AND birth_place IS NOT NULL
  `);

  await pool.query(`
    UPDATE users
    SET trial_started_at = COALESCE(created_at, CURRENT_TIMESTAMP)
    WHERE trial_started_at IS NULL
      AND premium_until IS NOT NULL
  `);

  await pool.query(`
    UPDATE users
    SET updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)
    WHERE updated_at IS NULL
  `);

  await pool.query('CREATE INDEX IF NOT EXISTS idx_users_trial_started_at ON users(trial_started_at)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_users_is_setup ON users(is_setup)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_users_selected_zodiac_sign ON users(selected_zodiac_sign)');

  await markMigrationApplied(pool, migrationName);
  log.info('Migration lumia_026_access_foundation applied');
}

async function verifyTablesExist(pool: Pool): Promise<void> {
  const required = [
    'users', 'natal_charts', 'interpretations', 'app_settings',
    'daily_horoscopes', 'daily_natal_cards',
    'astro_questions', 'dictionary', 'synastry_cache', 'star_payments',
    'content_interpretations', 'content_cache', 'content_unlocks', 'premium_entitlements',
    'user_sessions',
    'legacy_notification_templates',
    'notification_campaigns',
    'notification_deliveries',
    'notification_assets',
    'notification_templates',
    'notification_schedules',
    'notification_rotation_state',
    'notification_delivery_log',
    'horoscope_reactions',
    'daily_checkins',
    'action_timing_events',
    'personal_pattern_insights',
    'notification_scenarios',
    'notification_logs',
    'user_notification_settings',
    'user_notification_state',
    'user_app_events',
    'scheduled_notifications',
    'notification_events',
    'daily_cards',
    'pulse_day_entries',
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

/** Unified generation-policy cache: supports shared, user, and chart-version scopes. */
async function lumia027ContentMatrixCache(pool: Pool): Promise<void> {
  const migrationName = 'lumia_027_content_matrix_cache';
  if (await isMigrationApplied(pool, migrationName)) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS content_cache (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
      chart_id BIGINT REFERENCES natal_charts(id) ON DELETE CASCADE,
      content_type TEXT NOT NULL,
      content_key TEXT NOT NULL DEFAULT 'default',
      date_key DATE,
      period_key TEXT,
      zodiac_sign TEXT,
      access_level TEXT NOT NULL CHECK (access_level IN ('free', 'pro')),
      model_tier TEXT NOT NULL CHECK (model_tier IN ('fast', 'main', 'deep')),
      model_used TEXT,
      prompt_version TEXT NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      text TEXT,
      expires_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_content_cache_lookup ON content_cache (
      content_type,
      content_key,
      COALESCE(date_key, DATE '0001-01-01'),
      COALESCE(period_key, ''),
      COALESCE(zodiac_sign, ''),
      COALESCE(user_id, 0),
      COALESCE(chart_id, 0),
      prompt_version
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_content_cache_expiry ON content_cache(expires_at)');
  await markMigrationApplied(pool, migrationName);
  log.info(`Migration ${migrationName} applied`);
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
      connectionString: DATABASE_URL,
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
  await lumia008aUsersPremiumUntilColumn(pool);
  await lumia009ContentArchitecture(pool);
  await lumia011RemoveDashboardAirVariant(pool);
  await lumia012DailyLumiTasks(pool);
  await lumia013CanonicalNatalPersistence(pool);
  await lumia014PlanetInsightVariant(pool);
  await lumia016NatalContentUnification(pool);
  await lumia017NatalHumanReadingV4Archive(pool);
  await lumia018NotificationFrequencyPreference(pool);
  await lumia019HoroscopeReactions(pool);
  await lumia020DailyFeedbackAssistant(pool);
  await lumia021NotificationScenarioEngine(pool);
  await lumia022RetentionNotificationQueue(pool);
  await lumia023StarsAccessTier(pool);
  await lumia024StarsOneOffPayments(pool);
  await lumia025RemoveLumiEconomy(pool);
  await lumia026AccessFoundation(pool);
  await lumia027ContentMatrixCache(pool);
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
