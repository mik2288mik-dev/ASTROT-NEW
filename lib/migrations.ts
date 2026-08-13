// Database migrations for Your Horoscope
// MVP schema plus cleanup migrations

import { Pool } from 'pg';
import { resolveDatabaseUrl } from './database-url';
import { NOTIFICATION_SCENARIO_SEEDS } from './notificationScenarioCatalog';
import { RETENTION_NOTIFICATION_SCENARIO_SEEDS } from './retentionNotificationCatalog';

const DATABASE_URL = resolveDatabaseUrl();
const MIGRATION_LOCK_KEY = 20260711;

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
    'personalization_facts',
    'astrology_messages',
    'astrology_threads',
    'generated_artifacts',
    'astrology_calculation_snapshots',
    'personal_forecast_questions',
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
    'horoscope_engagement',
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
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT');

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
        'Твой Premium уже активирован. Можно возвращаться к полному разбору, личному дню и расширенным возможностям.',
        'Your Premium is now active. You can return to full readings, your personal day, and the expanded product flows.',
        'personal',
        'Premium update',
        'Premium обновлён. Можно вернуться к расширенным разборам и личному дню.',
        'Premium is updated. You can return to expanded readings and your personal day.',
        'personal',
        'Important announcement',
        'У нас есть важное обновление в приложении. Открой его, чтобы посмотреть детали.',
        'We have an important app update. Open the app to see the details.',
        'broadcast',
        'Maintenance update',
        'Сегодня в приложении идут технические работы. Если что-то временно недоступно, попробуй чуть позже.',
        'The app is undergoing maintenance today. If something is temporarily unavailable, please try again a bit later.',
        'broadcast',
        'Come back',
        'Мы сохранили твои карты и историю. Возвращайся — всё уже ждёт тебя внутри.',
        'Your charts and history are still waiting for you. Come back when you are ready.',
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
        'Morning daily',
        'Доброе утро! Открой личный день — короткий гороскоп и настроение дня уже ждут.',
        'Открыть',
        'Default seed — задайте deep link в админке (URL мини-приложения).',
        'Day daily',
        'Середина дня — загляни в приложение за персональным ориентиром.',
        'Default seed',
        'Evening daily',
        'Вечер — хорошее время свериться с картой и гороскопом.',
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
      legacy_source TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT content_interpretations_scope CHECK ((chart_id IS NOT NULL) OR (user_id IS NOT NULL)),
      CONSTRAINT content_interpretations_access_tier CHECK (access_tier IN ('free', 'premium')),
      CONSTRAINT content_interpretations_surface CHECK (content_surface IN ('natal', 'forecast', 'synastry')),
      CONSTRAINT content_interpretations_variant CHECK (content_variant IN ('anchor', 'living', 'planet_insight', 'daily', 'morning', 'day', 'evening', 'weekly', 'monthly', 'brief', 'full')),
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
      metadata JSONB,
      unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP,
      revoked_at TIMESTAMP,
      CONSTRAINT content_unlocks_access_tier CHECK (access_tier IN ('free', 'premium')),
      CONSTRAINT content_unlocks_surface CHECK (content_surface IN ('natal', 'forecast', 'synastry')),
      CONSTRAINT content_unlocks_variant CHECK (content_variant IN ('anchor', 'living', 'planet_insight', 'daily', 'morning', 'day', 'evening', 'weekly', 'monthly', 'brief', 'full')),
      CONSTRAINT content_unlocks_type CHECK (unlock_type IN ('free', 'premium'))
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_content_unlocks_lookup ON content_unlocks(user_id, content_surface, content_variant, access_tier, cache_key)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_content_unlocks_active ON content_unlocks(user_id, expires_at, revoked_at)');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS premium_entitlements (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tier_name TEXT NOT NULL DEFAULT 'premium',
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
      'premium',
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
      CHECK (content_variant IN ('anchor', 'living', 'planet_insight', 'daily', 'morning', 'day', 'evening', 'weekly', 'monthly', 'brief', 'full'))
  `);

  await pool.query(`
    ALTER TABLE content_unlocks
      DROP CONSTRAINT IF EXISTS content_unlocks_variant
  `);
  await pool.query(`
    ALTER TABLE content_unlocks
      ADD CONSTRAINT content_unlocks_variant
      CHECK (content_variant IN ('anchor', 'living', 'planet_insight', 'daily', 'morning', 'day', 'evening', 'weekly', 'monthly', 'brief', 'full'))
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

async function lumia028HoroscopeEngagement(pool: Pool): Promise<void> {
  const migrationName = 'lumia_028_horoscope_engagement';

  if (await isMigrationApplied(pool, migrationName)) {
    log.info(`Migration ${migrationName} already applied, skipping`);
    return;
  }

  log.info('Applying horoscope engagement migration...');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS horoscope_engagement (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      zodiac_sign TEXT NOT NULL,
      engagement_date DATE NOT NULL,
      viewed_at TIMESTAMP,
      reposted_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (user_id, zodiac_sign, engagement_date)
    )
  `);

  await pool.query(
    'CREATE INDEX IF NOT EXISTS idx_horoscope_engagement_sign_date ON horoscope_engagement(zodiac_sign, engagement_date)'
  );

  await markMigrationApplied(pool, migrationName);
  log.info('Migration lumia_028_horoscope_engagement applied');
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

  log.info('Skipping removed stars content-unlock tier migration for MVP schema');

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
    'dictionary', 'synastry_cache', 'star_payments',
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
    'personal_forecast_questions',
    'astrology_calculation_snapshots',
    'generated_artifacts',
    'astrology_threads',
    'astrology_messages',
    'personalization_facts',
    'account_password_credentials',
    'auth_rate_limits',
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

// Сценарии ретеншн-уведомлений сидились enabled=FALSE → планнер отбрасывал всё и
// уведомления не приходили. Включаем их + ресинкаем тексты шаблонов из каталога
// (раньше шаблоны вставлялись с DO NOTHING, поэтому правки текстов не доходили).
async function lumia029EnableNotificationScenarios(pool: Pool) {
  const migrationName = 'lumia_029_enable_notification_scenarios';
  if (await isMigrationApplied(pool, migrationName)) return;

  for (const seed of RETENTION_NOTIFICATION_SCENARIO_SEEDS) {
    const scenarioResult = await pool.query(
      `UPDATE notification_scenarios SET enabled = TRUE, updated_at = CURRENT_TIMESTAMP WHERE key = $1 RETURNING id`,
      [seed.key]
    );
    const scenarioId = Number(scenarioResult.rows[0]?.id);
    if (!scenarioId) continue;
    for (let index = 0; index < seed.templates.length; index += 1) {
      const item = seed.templates[index];
      const name = `${seed.name} · ${String(index + 1).padStart(2, '0')}`;
      await pool.query(
        `UPDATE notification_templates
         SET title = $1, body = $2, text = $2, button_text = $3, is_active = TRUE, updated_at = CURRENT_TIMESTAMP
         WHERE scenario_id = $4 AND name = $5`,
        [item.title, item.body, item.buttonText, scenarioId, name]
      );
    }
  }

  await markMigrationApplied(pool, migrationName);
  log.info('Migration lumia_029_enable_notification_scenarios applied');
}

// Сценарии 'pulse_day' и 'personal_day' убраны из продукта (таких фич нет) —
// выключаем их в проде, чтобы планировщик их не слал.
async function lumia030DisableRemovedScenarios(pool: Pool) {
  const migrationName = 'lumia_030_disable_removed_notification_scenarios';
  if (await isMigrationApplied(pool, migrationName)) return;
  await pool.query(
    `UPDATE notification_scenarios SET enabled = FALSE, updated_at = CURRENT_TIMESTAMP
     WHERE key IN ('pulse_day', 'personal_day')`
  );
  await markMigrationApplied(pool, migrationName);
  log.info('Migration lumia_030_disable_removed_notification_scenarios applied');
}

// Каталог уведомлений — источник правды. При КАЖДОМ старте сервера (см.
// bootstrapNotificationDelivery + instrumentation.ts) штатные сценарии продукта
// переутверждаются как enabled=TRUE, метаданные и тексты шаблонов синхронизируются,
// устаревшие шаблоны деактивируются.
//
// ВАЖНО (исторический баг): раньше сценарии сидились enabled=FALSE (ensureScenarioSeeds)
// или ON CONFLICT не трогал enabled — и планировщик отбрасывал ВСЁ (нет ни одного
// enabled-сценария → нет кандидатов → ни одного пуша). Поэтому каталог теперь жёстко
// включает свои сценарии. Точечное отключение через админку действует в рантайме до
// следующего деплоя (для постоянного отключения нужен отдельный override-флаг — TODO).
async function syncNotificationCatalogFromSeed(pool: Pool) {
  try {
    for (const seed of RETENTION_NOTIFICATION_SCENARIO_SEEDS) {
      const scenarioResult = await pool.query(
        `INSERT INTO notification_scenarios (
           key, name, description, enabled, day_part, time_window_start, time_window_end, timezone_mode,
           priority, trigger_rule_json, audience_rule_json, max_per_day, cooldown_hours, image_mode,
           image_strategy_json, deep_link, buttons
         )
         VALUES ($1, $2, $3, TRUE, $4, $5::time, $6::time, 'user_local', $7, '{}'::jsonb, $8::jsonb,
           $9, $10, 'auto', $11::jsonb, $12, $13::jsonb)
         ON CONFLICT (key) DO UPDATE SET
           name = EXCLUDED.name, description = EXCLUDED.description, day_part = EXCLUDED.day_part,
           time_window_start = EXCLUDED.time_window_start, time_window_end = EXCLUDED.time_window_end,
           priority = EXCLUDED.priority, deep_link = EXCLUDED.deep_link, buttons = EXCLUDED.buttons,
           enabled = TRUE,
           updated_at = CURRENT_TIMESTAMP
         RETURNING id`,
        [
          seed.key, seed.name, seed.description, seed.dayPart, seed.timeWindowStart, seed.timeWindowEnd,
          seed.priority, JSON.stringify({ segment: seed.segment }), seed.maxPerDay, seed.cooldownHours,
          JSON.stringify({ tags: seed.imageTags, dayPart: seed.dayPart }), seed.deepLinkSection,
          JSON.stringify([{ text: seed.templates[0]?.buttonText || 'Открыть', section: seed.deepLinkSection }]),
        ]
      );
      const scenarioId = Number(scenarioResult.rows[0]?.id);
      if (!scenarioId) continue;
      const seedTemplateNames = seed.templates.map(
        (_, index) => `${seed.name} · ${String(index + 1).padStart(2, '0')}`
      );
      // Деактивируем устаревшие шаблоны сценария (старый текст из прежних сидов), иначе планировщик
      // продолжает случайно выбирать их вперемешку с актуальными — пуши уходят со старым текстом.
      await pool.query(
        `UPDATE notification_templates
         SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
         WHERE scenario_id = $1 AND is_active = TRUE AND name <> ALL($2::text[])`,
        [scenarioId, seedTemplateNames]
      );
      for (let index = 0; index < seed.templates.length; index += 1) {
        const item = seed.templates[index];
        const name = `${seed.name} · ${String(index + 1).padStart(2, '0')}`;
        await pool.query(
          `INSERT INTO notification_templates (
             scenario_id, name, slot, target_segment, message_type, title, body, text, button_text,
             deep_link, is_active, sort_order, tags, weight, visual_mode, notes
           )
           VALUES ($1, $2, $3, $4, 'text', $5, $6, $6, $7, $8, TRUE, $9, $10::jsonb, $11, 'none', $12)
           ON CONFLICT (scenario_id, name) WHERE scenario_id IS NOT NULL DO UPDATE SET
             title = EXCLUDED.title, body = EXCLUDED.body, text = EXCLUDED.text,
             button_text = EXCLUDED.button_text, is_active = TRUE, updated_at = CURRENT_TIMESTAMP`,
          [
            scenarioId, name, seed.dayPart === 'reactivation' ? 'custom' : seed.dayPart, seed.segment,
            item.title, item.body, item.buttonText, seed.deepLinkSection, index,
            JSON.stringify(item.tags), item.weight || 100, seed.description,
          ]
        );
      }
    }
  } catch (e: any) {
    log.warn('notification catalog sync skipped', { error: e?.message });
  }
}

// Гасим устаревший бэклог запланированных пушей: за прошлые дни или просроченные больше чем на 3 часа.
// Иначе после деплоя накопившаяся очередь начинает сливаться пользователям (старый спам). Запускается всегда.
async function cancelStaleScheduledNotifications(pool: Pool) {
  try {
    const result = await pool.query(
      `UPDATE scheduled_notifications
       SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
       WHERE status = 'scheduled'
         AND (local_date < CURRENT_DATE OR scheduled_at < NOW() - INTERVAL '3 hours')`
    );
    if (result.rowCount) log.info(`cancelled ${result.rowCount} stale scheduled notifications`);
  } catch (e: any) {
    log.warn('stale notification cleanup skipped', { error: e?.message });
  }
}

/**
 * Бут-тайм самоисцеление доставки уведомлений. Вызывается из instrumentation.ts при КАЖДОМ
 * старте сервера, ДО запуска планировщика. Идемпотентно, быстро и НИКОГДА не бросает:
 *   1) переутверждает штатный каталог сценариев как enabled=TRUE + синхронизирует тексты;
 *   2) гасит «протухшую» очередь (старые/просроченные пуши), чтобы после деплоя не было спама.
 *
 * Это гарантирует, что у планировщика всегда есть включённые сценарии для подбора кандидатов.
 * Без этого один сценарий, засиженный enabled=FALSE, тихо обнулял весь пайплайн уведомлений.
 *
 * Работает на рантайм-пуле (lib/db), без отдельного соединения. Ленивый импорт — чтобы не
 * создавать цикл зависимостей на уровне модулей.
 */
export async function bootstrapNotificationDelivery(): Promise<{ ok: boolean; scenariosEnabled?: number; error?: string }> {
  try {
    const { getPool } = await import('./db');
    const pool = getPool() as unknown as Pool;
    await syncNotificationCatalogFromSeed(pool);
    await cancelStaleScheduledNotifications(pool);
    const enabled = await pool
      .query(`SELECT COUNT(*)::int AS c FROM notification_scenarios WHERE enabled = TRUE`)
      .then((r) => Number(r.rows[0]?.c || 0))
      .catch(() => undefined);
    log.info(`notification delivery bootstrap complete (${enabled ?? '?'} scenarios enabled)`);
    return { ok: true, scenariosEnabled: enabled };
  } catch (error: any) {
    log.warn('bootstrapNotificationDelivery failed', { error: error?.message });
    return { ok: false, error: error?.message || 'error' };
  }
}

/**
 * Идемпотентная сверка колонок таблицы `users`. Защищает от «дрейфа схемы», когда
 * колонку дописывали в УЖЕ применённую миграцию (она помечена выполненной и
 * пропускается, а новый ALTER внутри неё не исполняется). Все ADD COLUMN IF NOT EXISTS
 * безопасны при повторном запуске. Каждый ALTER — отдельно, чтобы один сбой не блокировал
 * остальные. Запускается РАНО (после lumia_002) и не зависит от поздних миграций.
 */
async function reconcileUserColumns(pool: Pool): Promise<void> {
  const statements = [
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS chart_slots INTEGER DEFAULT 1",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_setup BOOLEAN DEFAULT FALSE",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS selected_zodiac_sign TEXT",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_frequency TEXT",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS weather_city TEXT",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_until TIMESTAMP",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
    // Заделы под мультиплатформу (миграция на iOS/Android позже). Default — telegram.
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'telegram'",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'telegram'",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS app_version TEXT",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS country TEXT",
  ];
  for (const sql of statements) {
    try {
      await pool.query(sql);
    } catch (error: any) {
      log.warn(`reconcileUserColumns: "${sql}" failed (continuing)`, { error: error?.message });
    }
  }
  log.info('User columns reconciled (gender/chart_slots/is_setup/…)');
}

/**
 * Фундамент новой админки: RBAC (admin_users) + неизменяемый журнал действий
 * (admin_audit_log). Идемпотентно. Owner (OWNER_ID) получает роль super_admin.
 */
async function lumia031AdminFoundation(pool: Pool): Promise<void> {
  const migrationName = 'lumia_031_admin_foundation';
  if (await isMigrationApplied(pool, migrationName)) {
    log.info(`Migration ${migrationName} already applied, skipping`);
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_users (
      user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'read_only',
      status TEXT NOT NULL DEFAULT 'active',
      created_by BIGINT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_audit_log (
      id BIGSERIAL PRIMARY KEY,
      actor_user_id BIGINT,
      actor_role TEXT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      before_json JSONB,
      after_json JSONB,
      ip TEXT,
      user_agent TEXT,
      result TEXT NOT NULL DEFAULT 'ok',
      error TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_log(created_at DESC)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_admin_audit_actor ON admin_audit_log(actor_user_id, created_at DESC)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_admin_audit_action ON admin_audit_log(action, created_at DESC)');

  // Бэк-заполнение: существующие is_admin=TRUE пользователи становятся 'admin';
  // OWNER_ID — super_admin. Не перетираем уже заданную роль.
  await pool.query(`
    INSERT INTO admin_users (user_id, role, status, created_at)
    SELECT id, 'admin', 'active', CURRENT_TIMESTAMP FROM users WHERE is_admin = TRUE
    ON CONFLICT (user_id) DO NOTHING
  `);
  const ownerId = process.env.NEXT_PUBLIC_OWNER_ID || process.env.OWNER_ID || '';
  if (ownerId && /^\d+$/.test(ownerId.trim())) {
    const ownerAdminResult = await pool.query(
      `INSERT INTO admin_users (user_id, role, status, created_at)
       SELECT id, 'super_admin', 'active', CURRENT_TIMESTAMP
       FROM users
       WHERE id = $1
       ON CONFLICT (user_id) DO UPDATE
         SET role = 'super_admin', status = 'active', updated_at = CURRENT_TIMESTAMP`,
      [ownerId.trim()]
    );
    if (ownerAdminResult.rowCount === 0) {
      log.warn('OWNER_ID does not match an existing user; skipping super_admin seed');
    }
  }
  await markMigrationApplied(pool, migrationName);
  log.info(`Migration ${migrationName} applied`);
}

/**
 * Монетизация (Admin v2 Фаза 3). Делает star_payments провайдер-агностичным журналом
 * платежей (provider/status/product/currency/platform — заделы под App Store/Google Play/
 * Stripe при миграции на native) и заводит промокоды. Идемпотентно.
 */
async function lumia032Monetization(pool: Pool): Promise<void> {
  const migrationName = 'lumia_032_monetization';
  if (await isMigrationApplied(pool, migrationName)) {
    log.info(`Migration ${migrationName} already applied, skipping`);
    return;
  }

  const cols = [
    "ALTER TABLE star_payments ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'telegram_stars'",
    "ALTER TABLE star_payments ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'paid'",
    "ALTER TABLE star_payments ADD COLUMN IF NOT EXISTS product TEXT",
    "ALTER TABLE star_payments ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'XTR'",
    "ALTER TABLE star_payments ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'telegram'",
    "ALTER TABLE star_payments ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMP",
  ];
  for (const sql of cols) {
    try { await pool.query(sql); } catch (e: any) { log.warn(`lumia032: ${sql} failed`, { error: e?.message }); }
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS promo_codes (
      code TEXT PRIMARY KEY,
      type TEXT NOT NULL DEFAULT 'premium_days',
      value INTEGER NOT NULL DEFAULT 30,
      max_uses INTEGER NOT NULL DEFAULT 0,
      used_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      starts_at TIMESTAMP,
      expires_at TIMESTAMP,
      created_by BIGINT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS promo_redemptions (
      id BIGSERIAL PRIMARY KEY,
      code TEXT NOT NULL,
      user_id BIGINT,
      redeemed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_promo_redemptions_code ON promo_redemptions(code)');
  await markMigrationApplied(pool, migrationName);
  log.info(`Migration ${migrationName} applied`);
}

/**
 * CMS + AI-промпты (Admin v2 Фаза 4). Хранилище авторского контента и промптов с
 * версионированием и статусами draft/active(published)/archived. Идемпотентно.
 */
async function lumia033ContentCms(pool: Pool): Promise<void> {
  const migrationName = 'lumia_033_content_cms';
  if (await isMigrationApplied(pool, migrationName)) {
    log.info(`Migration ${migrationName} already applied, skipping`);
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_prompts (
      id BIGSERIAL PRIMARY KEY,
      key TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'chat',
      locale TEXT NOT NULL DEFAULT 'ru',
      version INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'draft',
      body TEXT NOT NULL DEFAULT '',
      tone_rules JSONB,
      author_id BIGINT,
      approved_by BIGINT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_prompt_versions (
      id BIGSERIAL PRIMARY KEY,
      prompt_id BIGINT NOT NULL REFERENCES ai_prompts(id) ON DELETE CASCADE,
      version INTEGER NOT NULL,
      body TEXT NOT NULL,
      editor_id BIGINT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_ai_prompts_key ON ai_prompts(key, locale)');
  await pool.query("CREATE INDEX IF NOT EXISTS idx_ai_prompts_active ON ai_prompts(key, locale) WHERE status = 'active'");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS cms_content (
      id BIGSERIAL PRIMARY KEY,
      type TEXT NOT NULL,
      locale TEXT NOT NULL DEFAULT 'ru',
      status TEXT NOT NULL DEFAULT 'draft',
      title TEXT,
      body TEXT NOT NULL DEFAULT '',
      tags TEXT,
      category TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      author_id BIGINT,
      scheduled_at TIMESTAMP,
      published_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cms_content_versions (
      id BIGSERIAL PRIMARY KEY,
      content_id BIGINT NOT NULL REFERENCES cms_content(id) ON DELETE CASCADE,
      version INTEGER NOT NULL,
      body TEXT NOT NULL,
      editor_id BIGINT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_cms_content_type ON cms_content(type, locale, status)');
  await markMigrationApplied(pool, migrationName);
  log.info(`Migration ${migrationName} applied`);
}

/** Поддержка/тикеты (Admin v2 Фаза 5). Идемпотентно. */
async function lumia034Support(pool: Pool): Promise<void> {
  const migrationName = 'lumia_034_support';
  if (await isMigrationApplied(pool, migrationName)) {
    log.info(`Migration ${migrationName} already applied, skipping`);
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS support_tickets (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT,
      subject TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'open',
      priority TEXT NOT NULL DEFAULT 'normal',
      assignee_id BIGINT,
      tags TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS support_messages (
      id BIGSERIAL PRIMARY KEY,
      ticket_id BIGINT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
      author_type TEXT NOT NULL DEFAULT 'user',
      author_id BIGINT,
      body TEXT NOT NULL,
      internal BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status, updated_at DESC)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_support_messages_ticket ON support_messages(ticket_id, created_at)');
  await markMigrationApplied(pool, migrationName);
  log.info(`Migration ${migrationName} applied`);
}

/** Feature flags / настройки (Admin v2 Фаза 6). Идемпотентно. */
async function lumia035FeatureFlags(pool: Pool): Promise<void> {
  const migrationName = 'lumia_035_feature_flags';
  if (await isMigrationApplied(pool, migrationName)) {
    log.info(`Migration ${migrationName} already applied, skipping`);
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS feature_flags (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL DEFAULT 'true'::jsonb,
      description TEXT,
      updated_by BIGINT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  // Базовые флаги (не перетираем, если уже заданы).
  await pool.query(
    `INSERT INTO feature_flags (key, value, description) VALUES
       ('ai_generation_enabled', 'true'::jsonb, 'Глобальный рубильник AI-генерации (чат). Off → честный нон-AI фолбэк.'),
       ('maintenance_mode', 'false'::jsonb, 'Режим обслуживания (для будущего экрана техработ).'),
       ('min_app_version', '""'::jsonb, 'Минимальная версия приложения (для native).')
     ON CONFLICT (key) DO NOTHING`
  );
  await markMigrationApplied(pool, migrationName);
  log.info(`Migration ${migrationName} applied`);
}

async function mvp036SchemaCleanup(pool: Pool): Promise<void> {
  const migrationName = 'mvp_036_schema_cleanup';
  if (await isMigrationApplied(pool, migrationName)) {
    log.info(`Migration ${migrationName} already applied`);
    return;
  }

  log.info('Applying MVP schema cleanup...');

  await pool.query('DROP TABLE IF EXISTS astro_questions CASCADE');
  await pool.query('DROP TABLE IF EXISTS action_timing_events CASCADE');
  await pool.query('DROP TABLE IF EXISTS lumi_transactions CASCADE');
  await pool.query('DROP TABLE IF EXISTS roulette_spins CASCADE');
  await pool.query('DROP TABLE IF EXISTS daily_task_completions CASCADE');
  await pool.query('ALTER TABLE users DROP COLUMN IF EXISTS lumi_balance');

  await pool.query('ALTER TABLE content_interpretations DROP COLUMN IF EXISTS can_regenerate_for_lumi');
  await pool.query('ALTER TABLE content_interpretations DROP COLUMN IF EXISTS regeneration_cost_lumi');
  await pool.query('ALTER TABLE content_unlocks DROP COLUMN IF EXISTS lumi_spent');

  await pool.query(`
    DELETE FROM content_interpretations
    WHERE access_tier NOT IN ('free', 'premium')
       OR content_surface NOT IN ('natal', 'forecast', 'synastry')
       OR content_variant NOT IN ('anchor', 'living', 'planet_insight', 'daily', 'morning', 'day', 'evening', 'weekly', 'monthly', 'brief', 'full')
  `);

  await pool.query(`
    DELETE FROM content_unlocks
    WHERE access_tier NOT IN ('free', 'premium')
       OR unlock_type NOT IN ('free', 'premium')
       OR content_surface NOT IN ('natal', 'forecast', 'synastry')
       OR content_variant NOT IN ('anchor', 'living', 'planet_insight', 'daily', 'morning', 'day', 'evening', 'weekly', 'monthly', 'brief', 'full')
  `);

  await pool.query(`
    UPDATE star_payments
    SET content_surface = NULL,
        content_variant = NULL,
        chart_id = NULL,
        cache_key = NULL,
        consumed_at = NULL,
        consumed_by_unlock_id = NULL
    WHERE content_surface IS NOT NULL
       OR content_variant IS NOT NULL
       OR chart_id IS NOT NULL
       OR cache_key IS NOT NULL
       OR consumed_at IS NOT NULL
       OR consumed_by_unlock_id IS NOT NULL
  `);

  await pool.query(`
    UPDATE premium_entitlements
    SET tier_name = 'premium'
    WHERE tier_name = 'lumia_premium'
  `);

  await pool.query(`
    ALTER TABLE content_interpretations
      DROP CONSTRAINT IF EXISTS content_interpretations_access_tier,
      DROP CONSTRAINT IF EXISTS content_interpretations_surface,
      DROP CONSTRAINT IF EXISTS content_interpretations_variant
  `);
  await pool.query(`
    ALTER TABLE content_interpretations
      ADD CONSTRAINT content_interpretations_access_tier CHECK (access_tier IN ('free', 'premium')),
      ADD CONSTRAINT content_interpretations_surface CHECK (content_surface IN ('natal', 'forecast', 'synastry')),
      ADD CONSTRAINT content_interpretations_variant CHECK (content_variant IN ('anchor', 'living', 'planet_insight', 'daily', 'morning', 'day', 'evening', 'weekly', 'monthly', 'brief', 'full'))
  `);

  await pool.query(`
    ALTER TABLE content_unlocks
      DROP CONSTRAINT IF EXISTS content_unlocks_access_tier,
      DROP CONSTRAINT IF EXISTS content_unlocks_surface,
      DROP CONSTRAINT IF EXISTS content_unlocks_variant,
      DROP CONSTRAINT IF EXISTS content_unlocks_type
  `);
  await pool.query(`
    ALTER TABLE content_unlocks
      ADD CONSTRAINT content_unlocks_access_tier CHECK (access_tier IN ('free', 'premium')),
      ADD CONSTRAINT content_unlocks_surface CHECK (content_surface IN ('natal', 'forecast', 'synastry')),
      ADD CONSTRAINT content_unlocks_variant CHECK (content_variant IN ('anchor', 'living', 'planet_insight', 'daily', 'morning', 'day', 'evening', 'weekly', 'monthly', 'brief', 'full')),
      ADD CONSTRAINT content_unlocks_type CHECK (unlock_type IN ('free', 'premium'))
  `);

  await markMigrationApplied(pool, migrationName);
  log.info('Migration mvp_036_schema_cleanup applied');
}

/**
 * Personal forecast feed V3 questions.
 *
 * This is intentionally a new persisted workflow. The removed astro_questions
 * chat table stays removed and is not used as a compatibility layer.
 */
async function mvp038PersonalForecastQuestions(pool: Pool): Promise<void> {
  const migrationName = 'mvp_038_personal_forecast_questions';
  if (await isMigrationApplied(pool, migrationName)) {
    log.info(`Migration ${migrationName} already applied`);
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS personal_forecast_questions (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      chart_id BIGINT REFERENCES natal_charts(id) ON DELETE SET NULL,
      chart_fingerprint TEXT NOT NULL,
      forecast_input_hash TEXT NOT NULL,
      period TEXT NOT NULL,
      period_key TEXT NOT NULL,
      usage_date DATE NOT NULL,
      language TEXT NOT NULL,
      source TEXT NOT NULL,
      catalog_question_id TEXT,
      question_text TEXT NOT NULL,
      normalized_question TEXT NOT NULL,
      status TEXT NOT NULL,
      moderation_reason TEXT,
      moderation_suggestions JSONB NOT NULL DEFAULT '[]'::jsonb,
      answer_text TEXT,
      answer_meta JSONB,
      model_id TEXT,
      prompt_version TEXT NOT NULL,
      voice_version TEXT NOT NULL,
      generation_started_at TIMESTAMP,
      answered_at TIMESTAMP,
      moderated_by BIGINT,
      moderated_at TIMESTAMP,
      notification_unread BOOLEAN NOT NULL DEFAULT FALSE,
      notification_payload JSONB,
      read_at TIMESTAMP,
      last_error TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT personal_forecast_questions_period
        CHECK (period IN ('day', 'week', 'month')),
      CONSTRAINT personal_forecast_questions_language
        CHECK (language IN ('ru', 'en')),
      CONSTRAINT personal_forecast_questions_source
        CHECK (source IN ('catalog', 'custom')),
      CONSTRAINT personal_forecast_questions_status
        CHECK (status IN ('pending', 'approved', 'generating', 'answered', 'rejected')),
      CONSTRAINT personal_forecast_questions_catalog_source
        CHECK (
          (source = 'catalog' AND catalog_question_id IS NOT NULL)
          OR (source = 'custom' AND catalog_question_id IS NULL)
        ),
      CONSTRAINT personal_forecast_questions_answer
        CHECK (
          status <> 'answered'
          OR (answer_text IS NOT NULL AND answered_at IS NOT NULL)
        ),
      CONSTRAINT personal_forecast_questions_identity_nonempty
        CHECK (
          LENGTH(BTRIM(chart_fingerprint)) > 0
          AND LENGTH(BTRIM(forecast_input_hash)) > 0
          AND LENGTH(BTRIM(period_key)) > 0
          AND LENGTH(BTRIM(question_text)) > 0
          AND LENGTH(BTRIM(normalized_question)) > 0
          AND LENGTH(BTRIM(prompt_version)) > 0
          AND LENGTH(BTRIM(voice_version)) > 0
        ),
      CONSTRAINT personal_forecast_questions_unread_answered
        CHECK (
          notification_unread = FALSE
          OR (status = 'answered' AND notification_payload IS NOT NULL)
        )
    )
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_personal_forecast_questions_catalog_once
      ON personal_forecast_questions (
        user_id,
        chart_fingerprint,
        forecast_input_hash,
        period,
        period_key,
        language,
        catalog_question_id,
        normalized_question,
        prompt_version,
        voice_version
      )
      WHERE source = 'catalog'
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_personal_forecast_questions_custom_once
      ON personal_forecast_questions (
        user_id,
        chart_fingerprint,
        forecast_input_hash,
        period,
        period_key,
        language,
        normalized_question,
        prompt_version,
        voice_version
      )
      WHERE source = 'custom'
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_personal_forecast_questions_user_period
      ON personal_forecast_questions (user_id, period, period_key, created_at DESC)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_personal_forecast_questions_daily_usage
      ON personal_forecast_questions (user_id, usage_date, source, status)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_personal_forecast_questions_moderation
      ON personal_forecast_questions (status, created_at)
      WHERE source = 'custom'
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_personal_forecast_questions_unread
      ON personal_forecast_questions (user_id, created_at DESC)
      WHERE notification_unread = TRUE
  `);

  await markMigrationApplied(pool, migrationName);
  log.info(`Migration ${migrationName} applied`);
}

/** RuStore Pay SDK purchase ledger and idempotent server notification inbox. */
async function mvp039RuStorePay(pool: Pool): Promise<void> {
  const migrationName = 'mvp_039_rustore_pay';
  if (await isMigrationApplied(pool, migrationName)) {
    log.info(`Migration ${migrationName} already applied`);
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS store_purchases (
      id BIGSERIAL PRIMARY KEY,
      provider TEXT NOT NULL,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      external_purchase_id TEXT,
      external_invoice_id TEXT,
      external_product_id TEXT NOT NULL,
      status TEXT NOT NULL,
      purchased_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ,
      last_validated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT store_purchases_provider CHECK (provider IN ('rustore'))
    )
  `);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_store_purchases_provider_purchase
    ON store_purchases(provider, external_purchase_id) WHERE external_purchase_id IS NOT NULL`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_store_purchases_provider_invoice
    ON store_purchases(provider, external_invoice_id) WHERE external_invoice_id IS NOT NULL`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_store_purchases_user_status
    ON store_purchases(user_id, status, expires_at DESC)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS payment_provider_events (
      id BIGSERIAL PRIMARY KEY,
      provider TEXT NOT NULL,
      external_event_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      external_purchase_id TEXT,
      status TEXT,
      received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      processed_at TIMESTAMP,
      CONSTRAINT payment_provider_events_provider CHECK (provider IN ('rustore')),
      CONSTRAINT payment_provider_events_unique UNIQUE (provider, external_event_id)
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_payment_provider_events_purchase
    ON payment_provider_events(provider, external_purchase_id)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_session_revocations (
      session_id TEXT PRIMARY KEY,
      expires_at TIMESTAMP NOT NULL,
      revoked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_app_session_revocations_expiry
    ON app_session_revocations(expires_at)`);

  await markMigrationApplied(pool, migrationName);
  log.info(`Migration ${migrationName} applied`);
}

/**
 * Stable app accounts: multiple verified identities, revocable sessions,
 * one-time login challenges, and a durable RuStore callback queue.
 */
async function mvp040AccountIdentitySessions(pool: Pool): Promise<void> {
  const migrationName = 'mvp_040_account_identity_sessions';
  if (await isMigrationApplied(pool, migrationName)) {
    log.info(`Migration ${migrationName} already applied`);
    return;
  }

  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_guest BOOLEAN NOT NULL DEFAULT FALSE`);
  await pool.query(`UPDATE users SET is_guest = TRUE WHERE id < 0`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS account_identities (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      provider_subject TEXT NOT NULL,
      normalized_email TEXT,
      display_name TEXT,
      verified_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_used_at TIMESTAMP,
      metadata JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT account_identities_provider
        CHECK (provider IN ('vk', 'yandex', 'google', 'email', 'telegram')),
      CONSTRAINT account_identities_provider_subject UNIQUE (provider, provider_subject)
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_account_identities_user
    ON account_identities(user_id, provider)`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_account_identities_user_provider
    ON account_identities(user_id, provider)`);

  // Existing Telegram users keep their users.id and become recoverable through
  // an explicit Telegram identity without copying any profile data.
  await pool.query(`
    INSERT INTO account_identities (user_id, provider, provider_subject, last_used_at, metadata)
    SELECT id, 'telegram', id::text, last_login, '{"backfilled":true}'::jsonb
    FROM users
    WHERE id > 0 AND COALESCE(auth_provider, 'telegram') = 'telegram'
    ON CONFLICT (provider, provider_subject) DO NOTHING
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_sessions (
      session_id TEXT PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      session_kind TEXT NOT NULL,
      device_id TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP NOT NULL,
      revoked_at TIMESTAMP,
      revoke_reason TEXT,
      CONSTRAINT app_sessions_kind CHECK (session_kind IN ('web', 'native', 'telegram'))
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_app_sessions_user_active
    ON app_sessions(user_id, expires_at DESC) WHERE revoked_at IS NULL`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_challenges (
      challenge_id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      purpose TEXT NOT NULL,
      user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
      state_hash TEXT,
      secret_hash TEXT,
      redirect_uri TEXT,
      metadata JSONB,
      expires_at TIMESTAMP NOT NULL,
      consumed_at TIMESTAMP,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT auth_challenges_provider
        CHECK (provider IN ('vk', 'yandex', 'google', 'email', 'telegram')),
      CONSTRAINT auth_challenges_purpose CHECK (purpose IN ('login', 'link'))
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_auth_challenges_expiry
    ON auth_challenges(expires_at) WHERE consumed_at IS NULL`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_exchange_codes (
      code_hash TEXT PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      session_kind TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      consumed_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT auth_exchange_codes_kind CHECK (session_kind IN ('web', 'native'))
    )
  `);

  await pool.query(`ALTER TABLE payment_provider_events
    ADD COLUMN IF NOT EXISTS processing_status TEXT NOT NULL DEFAULT 'pending'`);
  await pool.query(`ALTER TABLE payment_provider_events
    ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE payment_provider_events
    ADD COLUMN IF NOT EXISTS last_error TEXT`);
  await pool.query(`ALTER TABLE payment_provider_events
    ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`);
  await pool.query(`ALTER TABLE payment_provider_events
    ADD COLUMN IF NOT EXISTS failed_at TIMESTAMP`);
  await pool.query(`ALTER TABLE payment_provider_events
    ADD COLUMN IF NOT EXISTS event_payload JSONB`);
  await pool.query(`ALTER TABLE payment_provider_events
    ADD COLUMN IF NOT EXISTS sandbox BOOLEAN NOT NULL DEFAULT FALSE`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_payment_provider_events_pending
    ON payment_provider_events(next_attempt_at, received_at)
    WHERE processing_status = 'pending' AND processed_at IS NULL AND failed_at IS NULL`);

  await markMigrationApplied(pool, migrationName);
  log.info(`Migration ${migrationName} applied`);
}

/**
 * Durable, append-only astrology history and explicit chart ownership.
 *
 * Generated text is retained for display and continuity only. It is never
 * eligible to become factual evidence; only calculation snapshots and
 * explicit personalization facts can enter the factual history context.
 */
async function mvp041AstrologyHistoryFoundation(pool: Pool): Promise<void> {
  const migrationName = 'mvp_041_astrology_history_foundation';
  if (await isMigrationApplied(pool, migrationName)) {
    log.info(`Migration ${migrationName} already applied`);
    return;
  }

  await pool.query(`
    ALTER TABLE natal_charts
      ADD COLUMN IF NOT EXISTS subject_type TEXT,
      ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS relation_label TEXT
  `);

  // Select exactly one active legacy chart per account as "self". The order is
  // deterministic even when legacy rows incorrectly have multiple primaries.
  await pool.query(`
    WITH ranked AS (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY user_id
          ORDER BY is_primary DESC NULLS LAST, created_at ASC NULLS LAST, id ASC
        ) AS position
      FROM natal_charts
      WHERE archived_at IS NULL
    )
    UPDATE natal_charts AS chart
    SET subject_type = CASE WHEN ranked.position = 1 THEN 'self' ELSE 'saved_person' END
    FROM ranked
    WHERE chart.id = ranked.id
  `);
  await pool.query(`
    UPDATE natal_charts
    SET subject_type = COALESCE(subject_type, 'saved_person')
    WHERE subject_type IS NULL
  `);
  await pool.query(`
    UPDATE natal_charts
    SET
      is_primary = (subject_type = 'self' AND archived_at IS NULL),
      relation_label = CASE
        WHEN subject_type = 'self' THEN NULL
        ELSE COALESCE(NULLIF(BTRIM(relation_label), ''), 'other')
      END
  `);
  await pool.query(`
    ALTER TABLE natal_charts
      ALTER COLUMN subject_type SET DEFAULT 'saved_person',
      ALTER COLUMN subject_type SET NOT NULL,
      DROP CONSTRAINT IF EXISTS natal_charts_subject_type
  `);
  await pool.query(`
    ALTER TABLE natal_charts
      ADD CONSTRAINT natal_charts_subject_type
      CHECK (subject_type IN ('self', 'saved_person'))
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_natal_charts_one_active_self
      ON natal_charts(user_id)
      WHERE subject_type = 'self' AND archived_at IS NULL
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_natal_charts_user_subject_active
      ON natal_charts(user_id, subject_type, created_at, id)
      WHERE archived_at IS NULL
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS astrology_calculation_snapshots (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      subject_chart_id BIGINT NOT NULL REFERENCES natal_charts(id) ON DELETE CASCADE,
      counterpart_chart_id BIGINT REFERENCES natal_charts(id) ON DELETE CASCADE,
      surface TEXT NOT NULL,
      period TEXT,
      period_key TEXT,
      input_hash TEXT NOT NULL,
      calculation_version TEXT NOT NULL,
      semantic_version TEXT,
      ephemeris_source TEXT NOT NULL,
      house_system TEXT,
      birth_time_status TEXT NOT NULL,
      calculation_payload JSONB NOT NULL,
      evidence_payload JSONB NOT NULL,
      provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
      schema_version TEXT NOT NULL,
      calculated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT astrology_calc_surface
        CHECK (surface IN ('natal', 'forecast', 'synastry', 'question')),
      CONSTRAINT astrology_calc_birth_time_status
        CHECK (birth_time_status IN ('exact', 'approximate', 'unknown')),
      CONSTRAINT astrology_calc_distinct_charts
        CHECK (counterpart_chart_id IS NULL OR counterpart_chart_id <> subject_chart_id),
      CONSTRAINT astrology_calc_identity_nonempty
        CHECK (
          LENGTH(BTRIM(input_hash)) > 0
          AND LENGTH(BTRIM(calculation_version)) > 0
          AND LENGTH(BTRIM(ephemeris_source)) > 0
          AND LENGTH(BTRIM(schema_version)) > 0
        )
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_astro_calc_user_chart_created
      ON astrology_calculation_snapshots(user_id, subject_chart_id, created_at DESC, id DESC)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_astro_calc_input_hash
      ON astrology_calculation_snapshots(user_id, subject_chart_id, input_hash, created_at DESC)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_astro_calc_counterpart
      ON astrology_calculation_snapshots(user_id, counterpart_chart_id, created_at DESC)
      WHERE counterpart_chart_id IS NOT NULL
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS generated_artifacts (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      subject_chart_id BIGINT NOT NULL REFERENCES natal_charts(id) ON DELETE CASCADE,
      counterpart_chart_id BIGINT REFERENCES natal_charts(id) ON DELETE CASCADE,
      calculation_snapshot_id BIGINT
        REFERENCES astrology_calculation_snapshots(id) ON DELETE SET NULL,
      surface TEXT NOT NULL,
      variant TEXT NOT NULL,
      period TEXT,
      period_key TEXT,
      language TEXT NOT NULL,
      content_payload JSONB NOT NULL,
      semantic_fingerprints JSONB NOT NULL DEFAULT '[]'::jsonb,
      provider TEXT NOT NULL,
      model_id TEXT NOT NULL,
      prompt_version TEXT NOT NULL,
      voice_version TEXT NOT NULL,
      semantic_version TEXT NOT NULL,
      contract_version TEXT NOT NULL,
      validation_status TEXT NOT NULL,
      generation_attempts INTEGER NOT NULL,
      input_hash TEXT NOT NULL,
      provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
      schema_version TEXT NOT NULL,
      is_factual_evidence BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT generated_artifacts_surface
        CHECK (surface IN ('natal', 'forecast', 'synastry', 'question')),
      CONSTRAINT generated_artifacts_language CHECK (language IN ('ru', 'en')),
      CONSTRAINT generated_artifacts_validation
        CHECK (validation_status IN ('valid', 'deterministic_fallback', 'legacy_unvalidated')),
      CONSTRAINT generated_artifacts_attempts CHECK (generation_attempts BETWEEN 0 AND 2),
      CONSTRAINT generated_artifacts_display_only CHECK (is_factual_evidence = FALSE),
      CONSTRAINT generated_artifacts_distinct_charts
        CHECK (counterpart_chart_id IS NULL OR counterpart_chart_id <> subject_chart_id),
      CONSTRAINT generated_artifacts_identity_nonempty
        CHECK (
          LENGTH(BTRIM(variant)) > 0
          AND LENGTH(BTRIM(provider)) > 0
          AND LENGTH(BTRIM(model_id)) > 0
          AND LENGTH(BTRIM(prompt_version)) > 0
          AND LENGTH(BTRIM(voice_version)) > 0
          AND LENGTH(BTRIM(semantic_version)) > 0
          AND LENGTH(BTRIM(contract_version)) > 0
          AND LENGTH(BTRIM(input_hash)) > 0
          AND LENGTH(BTRIM(schema_version)) > 0
        )
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_generated_artifacts_user_chart_created
      ON generated_artifacts(user_id, subject_chart_id, created_at DESC, id DESC)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_generated_artifacts_period
      ON generated_artifacts(user_id, subject_chart_id, surface, period, period_key, created_at DESC)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_generated_artifacts_snapshot
      ON generated_artifacts(calculation_snapshot_id)
      WHERE calculation_snapshot_id IS NOT NULL
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS astrology_threads (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      subject_chart_id BIGINT NOT NULL REFERENCES natal_charts(id) ON DELETE CASCADE,
      counterpart_chart_id BIGINT REFERENCES natal_charts(id) ON DELETE CASCADE,
      thread_kind TEXT NOT NULL,
      title TEXT,
      provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
      schema_version TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT astrology_threads_distinct_charts
        CHECK (counterpart_chart_id IS NULL OR counterpart_chart_id <> subject_chart_id),
      CONSTRAINT astrology_threads_identity_nonempty
        CHECK (LENGTH(BTRIM(thread_kind)) > 0 AND LENGTH(BTRIM(schema_version)) > 0)
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_astro_threads_user_chart_created
      ON astrology_threads(user_id, subject_chart_id, created_at DESC, id DESC)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS astrology_messages (
      id BIGSERIAL PRIMARY KEY,
      thread_id BIGINT NOT NULL REFERENCES astrology_threads(id) ON DELETE CASCADE,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      subject_chart_id BIGINT NOT NULL REFERENCES natal_charts(id) ON DELETE CASCADE,
      counterpart_chart_id BIGINT REFERENCES natal_charts(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content_text TEXT NOT NULL,
      content_payload JSONB,
      generated_artifact_id BIGINT REFERENCES generated_artifacts(id) ON DELETE SET NULL,
      provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
      schema_version TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT astrology_messages_role CHECK (role IN ('user', 'assistant')),
      CONSTRAINT astrology_messages_content_nonempty CHECK (LENGTH(BTRIM(content_text)) > 0),
      CONSTRAINT astrology_messages_schema_nonempty CHECK (LENGTH(BTRIM(schema_version)) > 0),
      CONSTRAINT astrology_messages_artifact_role
        CHECK (generated_artifact_id IS NULL OR role = 'assistant'),
      CONSTRAINT astrology_messages_distinct_charts
        CHECK (counterpart_chart_id IS NULL OR counterpart_chart_id <> subject_chart_id)
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_astro_messages_thread_created
      ON astrology_messages(thread_id, created_at ASC, id ASC)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_astro_messages_user_chart_created
      ON astrology_messages(user_id, subject_chart_id, created_at DESC, id DESC)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS personalization_facts (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      chart_id BIGINT REFERENCES natal_charts(id) ON DELETE CASCADE,
      scope TEXT NOT NULL,
      fact_key TEXT NOT NULL,
      fact_value JSONB,
      operation TEXT NOT NULL,
      provenance_type TEXT NOT NULL,
      provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
      source_message_id BIGINT REFERENCES astrology_messages(id) ON DELETE SET NULL,
      calculation_snapshot_id BIGINT
        REFERENCES astrology_calculation_snapshots(id) ON DELETE SET NULL,
      provenance_version TEXT NOT NULL,
      schema_version TEXT NOT NULL,
      recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT personalization_facts_scope
        CHECK (
          (scope = 'account' AND chart_id IS NULL)
          OR (scope = 'chart' AND chart_id IS NOT NULL)
        ),
      CONSTRAINT personalization_facts_operation CHECK (operation IN ('assert', 'retract')),
      CONSTRAINT personalization_facts_provenance
        CHECK (provenance_type IN ('user_statement', 'verified_profile', 'calculation')),
      CONSTRAINT personalization_facts_calculation_source
        CHECK (
          provenance_type <> 'calculation'
          OR (scope = 'chart' AND calculation_snapshot_id IS NOT NULL)
        ),
      CONSTRAINT personalization_facts_message_source
        CHECK (source_message_id IS NULL OR provenance_type = 'user_statement'),
      CONSTRAINT personalization_facts_value
        CHECK (operation = 'retract' OR fact_value IS NOT NULL),
      CONSTRAINT personalization_facts_identity_nonempty
        CHECK (
          LENGTH(BTRIM(fact_key)) > 0
          AND LENGTH(BTRIM(provenance_version)) > 0
          AND LENGTH(BTRIM(schema_version)) > 0
        )
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_personalization_facts_user_chart_key
      ON personalization_facts(user_id, chart_id, fact_key, recorded_at DESC, id DESC)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_personalization_facts_user_scope_created
      ON personalization_facts(user_id, scope, recorded_at DESC, id DESC)
  `);

  await markMigrationApplied(pool, migrationName);
  log.info(`Migration ${migrationName} applied`);
}

/**
 * A calculation hash identifies astronomical inputs, not a person. Different
 * saved people may legitimately share those inputs (for example twins), so it
 * cannot remain a per-account uniqueness constraint.
 */
async function mvp042SavedPersonIdentity(pool: Pool): Promise<void> {
  const migrationName = 'mvp_042_saved_person_identity';
  if (await isMigrationApplied(pool, migrationName)) {
    log.info(`Migration ${migrationName} already applied`);
    return;
  }

  await pool.query(`DROP INDEX IF EXISTS idx_natal_charts_user_input_hash`);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_natal_charts_active_identity_hash
      ON natal_charts(user_id, subject_type, input_hash, id)
      WHERE archived_at IS NULL AND input_hash IS NOT NULL
  `);

  await markMigrationApplied(pool, migrationName);
  log.info(`Migration ${migrationName} applied`);
}

/**
 * Email/password credentials remain attached to the canonical users.id and
 * reuse the existing identity, challenge and revocable-session model.
 */
async function mvp043PasswordAuthentication(pool: Pool): Promise<void> {
  const migrationName = 'mvp_043_password_authentication';
  if (await isMigrationApplied(pool, migrationName)) {
    log.info(`Migration ${migrationName} already applied`);
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS account_password_credentials (
      user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      password_hash TEXT NOT NULL,
      hash_algorithm TEXT NOT NULL DEFAULT 'scrypt',
      password_version INTEGER NOT NULL DEFAULT 1,
      password_changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT account_password_credentials_algorithm CHECK (hash_algorithm IN ('scrypt')),
      CONSTRAINT account_password_credentials_version CHECK (password_version > 0)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_rate_limits (
      scope TEXT NOT NULL,
      key_hash TEXT NOT NULL,
      window_started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      attempts INTEGER NOT NULL DEFAULT 0,
      expires_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (scope, key_hash),
      CONSTRAINT auth_rate_limits_attempts CHECK (attempts >= 0)
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_expiry
    ON auth_rate_limits(expires_at)`);

  await pool.query(`ALTER TABLE auth_challenges
    ADD COLUMN IF NOT EXISTS credential_hash TEXT`);
  await pool.query(`ALTER TABLE auth_challenges
    ADD COLUMN IF NOT EXISTS delivery_status TEXT NOT NULL DEFAULT 'not_required'`);
  await pool.query(`ALTER TABLE auth_challenges
    ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE auth_challenges
    ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE auth_challenges
    ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE auth_challenges
    ADD COLUMN IF NOT EXISTS client_key_hash TEXT`);
  await pool.query(`ALTER TABLE auth_challenges
    DROP CONSTRAINT IF EXISTS auth_challenges_purpose`);
  await pool.query(`ALTER TABLE auth_challenges
    ADD CONSTRAINT auth_challenges_purpose
    CHECK (purpose IN ('login', 'link', 'register', 'password_reset'))`);
  await pool.query(`ALTER TABLE auth_challenges
    DROP CONSTRAINT IF EXISTS auth_challenges_delivery_status`);
  await pool.query(`ALTER TABLE auth_challenges
    ADD CONSTRAINT auth_challenges_delivery_status
    CHECK (delivery_status IN ('not_required', 'pending', 'sent', 'failed', 'suppressed'))`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_auth_challenges_email_recent
    ON auth_challenges(provider, purpose, (metadata->>'email'), created_at DESC)`);

  await markMigrationApplied(pool, migrationName);
  log.info(`Migration ${migrationName} applied`);
}

/** Canonical Premium states and crash-safe RuStore callback processing. */
async function mvp044PremiumEntitlementLifecycle(pool: Pool): Promise<void> {
  const migrationName = 'mvp_044_premium_entitlement_lifecycle';
  if (await isMigrationApplied(pool, migrationName)) {
    log.info(`Migration ${migrationName} already applied`);
    return;
  }

  await pool.query(`ALTER TABLE premium_entitlements
    ADD COLUMN IF NOT EXISTS entitlement_state TEXT NOT NULL DEFAULT 'gift'`);
  await pool.query(`
    UPDATE premium_entitlements pe
    SET entitlement_state = CASE
      WHEN pe.ends_at <= NOW() OR pe.status = 'expired' THEN 'expired'
      -- Before lifecycle states existed, RuStore HOLD/paused rows were stored
      -- as cancelled and deliberately excluded from access. Never re-grant
      -- those rows during backfill; future cancellations use explicit state.
      WHEN pe.source = 'rustore' AND pe.status = 'cancelled' THEN 'expired'
      WHEN pe.status = 'cancelled' AND pe.ends_at > NOW() THEN 'cancelled_active'
      WHEN pe.source = 'rustore' THEN 'paid'
      WHEN pe.source IN ('telegram_stars', 'stars') THEN 'paid'
      WHEN pe.source <> 'users.premium_until' AND pe.metadata->>'legacyKind' = 'paid' THEN 'paid'
      ELSE 'gift'
    END
    WHERE pe.entitlement_state = 'gift'
  `);
  await pool.query(`
    UPDATE premium_entitlements
    SET status = 'expired', updated_at = CURRENT_TIMESTAMP
    WHERE source = 'rustore'
      AND entitlement_state = 'expired'
      AND status <> 'expired'
  `);
  await pool.query(`ALTER TABLE premium_entitlements
    DROP CONSTRAINT IF EXISTS premium_entitlements_lifecycle_state`);
  await pool.query(`ALTER TABLE premium_entitlements
    ADD CONSTRAINT premium_entitlements_lifecycle_state
    CHECK (entitlement_state IN (
      'free', 'gift', 'store_trial', 'paid', 'grace', 'cancelled_active', 'expired'
    ))`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_premium_entitlements_lifecycle
    ON premium_entitlements(user_id, entitlement_state, ends_at DESC)`);

  await pool.query(`ALTER TABLE store_purchases
    ADD COLUMN IF NOT EXISTS entitlement_state TEXT NOT NULL DEFAULT 'expired'`);
  await pool.query(`ALTER TABLE store_purchases
    ADD COLUMN IF NOT EXISTS auto_renewing BOOLEAN`);
  await pool.query(`
    UPDATE store_purchases
    SET entitlement_state = CASE
      WHEN expires_at IS NULL OR expires_at <= NOW() OR status = 'expired' THEN 'expired'
      WHEN status IN ('paused', 'hold') THEN 'expired'
      WHEN status IN ('cancelled', 'cancelled_active') THEN 'cancelled_active'
      ELSE 'paid'
    END
    WHERE entitlement_state = 'expired'
  `);
  await pool.query(`ALTER TABLE store_purchases
    DROP CONSTRAINT IF EXISTS store_purchases_entitlement_state`);
  await pool.query(`ALTER TABLE store_purchases
    ADD CONSTRAINT store_purchases_entitlement_state
    CHECK (entitlement_state IN (
      'store_trial', 'paid', 'grace', 'cancelled_active', 'expired'
    ))`);

  await pool.query(`ALTER TABLE payment_provider_events
    ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_payment_provider_events_processing_lease
    ON payment_provider_events(processing_started_at)
    WHERE processing_status = 'processing' AND processed_at IS NULL AND failed_at IS NULL`);

  await markMigrationApplied(pool, migrationName);
  log.info(`Migration ${migrationName} applied`);
}

/** Monotonic provider time prevents an older RuStore callback from regressing access. */
async function mvp045RuStoreCallbackOrdering(pool: Pool): Promise<void> {
  const migrationName = 'mvp_045_rustore_callback_ordering';
  if (await isMigrationApplied(pool, migrationName)) {
    log.info(`Migration ${migrationName} already applied`);
    return;
  }

  await pool.query(`ALTER TABLE store_purchases
    ADD COLUMN IF NOT EXISTS provider_event_time TIMESTAMPTZ`);

  await markMigrationApplied(pool, migrationName);
  log.info(`Migration ${migrationName} applied`);
}

/** Provider-only GRACE/HOLD facts survive manual validation until a newer callback. */
async function mvp046RuStoreProviderOverlay(pool: Pool): Promise<void> {
  const migrationName = 'mvp_046_rustore_provider_overlay';
  if (await isMigrationApplied(pool, migrationName)) {
    log.info(`Migration ${migrationName} already applied`);
    return;
  }

  await pool.query(`ALTER TABLE store_purchases
    ADD COLUMN IF NOT EXISTS provider_period TEXT`);
  await pool.query(`ALTER TABLE store_purchases
    ADD COLUMN IF NOT EXISTS provider_status TEXT`);
  await pool.query(`ALTER TABLE store_purchases
    ADD COLUMN IF NOT EXISTS provider_subscription_event_type TEXT`);

  await markMigrationApplied(pool, migrationName);
  log.info(`Migration ${migrationName} applied`);
}

/** RuStore timestamps are provider-issued absolute instants, never local wall time. */
async function mvp047RuStoreAbsoluteTimestamps(pool: Pool): Promise<void> {
  const migrationName = 'mvp_047_rustore_absolute_timestamps';
  if (await isMigrationApplied(pool, migrationName)) {
    log.info(`Migration ${migrationName} already applied`);
    return;
  }

  // Historical TIMESTAMP values were written from ISO instants while production
  // PostgreSQL ran in UTC. Convert only old timezone-less columns: on a fresh
  // schema these are already TIMESTAMPTZ and must not be reinterpreted.
  await pool.query(`
    DO $$
    DECLARE target_column TEXT;
    BEGIN
      FOREACH target_column IN ARRAY ARRAY[
        'purchased_at', 'expires_at', 'last_validated_at', 'created_at', 'updated_at'
      ] LOOP
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'store_purchases'
            AND information_schema.columns.column_name = target_column
            AND data_type = 'timestamp without time zone'
        ) THEN
          EXECUTE format(
            'ALTER TABLE store_purchases ALTER COLUMN %I TYPE TIMESTAMPTZ USING %I AT TIME ZONE ''UTC''',
            target_column,
            target_column
          );
        END IF;
      END LOOP;
    END $$
  `);

  await markMigrationApplied(pool, migrationName);
  log.info(`Migration ${migrationName} applied`);
}

/**
 * Enforce the email canonicalization already used by the application at the
 * database boundary. Existing case-fold collisions stop the migration for
 * manual recovery; accounts are never selected or merged automatically.
 */
async function mvp044EmailIdentityUniqueness(pool: Pool): Promise<void> {
  const migrationName = 'mvp_044_email_identity_uniqueness';
  if (await isMigrationApplied(pool, migrationName)) {
    log.info(`Migration ${migrationName} already applied`);
    return;
  }

  const collisions = await pool.query(`
    SELECT lower(btrim(provider_subject)) AS canonical_email,
           array_agg(user_id ORDER BY user_id) AS user_ids
    FROM account_identities
    WHERE provider = 'email'
    GROUP BY lower(btrim(provider_subject))
    HAVING COUNT(*) > 1
    LIMIT 10
  `);
  if (collisions.rowCount) {
    throw new Error(
      'Email identity case-fold collisions require manual account recovery; automatic merge is forbidden',
    );
  }

  await pool.query(`
    UPDATE account_identities
    SET provider_subject = lower(btrim(provider_subject)),
        normalized_email = lower(btrim(COALESCE(normalized_email, provider_subject))),
        updated_at = CURRENT_TIMESTAMP
    WHERE provider = 'email'
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_account_identities_email_canonical
      ON account_identities (lower(btrim(provider_subject)))
      WHERE provider = 'email'
  `);

  await markMigrationApplied(pool, migrationName);
  log.info(`Migration ${migrationName} applied`);
}

/**
 * Auth deadlines are written by Node as ISO-8601 UTC instants. The original
 * tables used TIMESTAMP WITHOUT TIME ZONE, which discards the `Z` offset and
 * can make short-lived codes expire immediately when PostgreSQL is not on UTC.
 * Existing values came from UTC ISO strings, so attach UTC before changing the
 * columns to TIMESTAMPTZ.
 */
async function mvp045AuthExpiryTimezone(pool: Pool): Promise<void> {
  const migrationName = 'mvp_045_auth_expiry_timezone';
  if (await isMigrationApplied(pool, migrationName)) {
    log.info(`Migration ${migrationName} already applied`);
    return;
  }

  const expiryColumns = [
    ['app_sessions', 'expires_at'],
    ['app_session_revocations', 'expires_at'],
    ['auth_challenges', 'expires_at'],
    ['auth_exchange_codes', 'expires_at'],
  ] as const;
  for (const [table, column] of expiryColumns) {
    const current = await pool.query(
      `SELECT data_type
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
      [table, column],
    );
    if (current.rows[0]?.data_type === 'timestamp without time zone') {
      await pool.query(
        `ALTER TABLE ${table}
         ALTER COLUMN ${column} TYPE TIMESTAMPTZ
         USING ${column} AT TIME ZONE 'UTC'`,
      );
    }
  }

  await markMigrationApplied(pool, migrationName);
  log.info(`Migration ${migrationName} applied`);
}

export async function runMigrations(): Promise<void> {
  if (!DATABASE_URL) {
    log.warn('DATABASE_URL not set. Skipping migrations.');
    return;
  }

  let pool: Pool | null = null;
  let migrationLockAcquired = false;

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
    await pool.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);
    migrationLockAcquired = true;
    log.info('Migration advisory lock acquired');
    await createMigrationsTable(pool);

    await migrationReset(pool);
    await lumia001FullSchema(pool);
    await lumia002MultiChart(pool);
    // КРИТИЧНО и РАНО: сверяем колонки users сразу после базовой схемы, ДО длинной
    // цепочки миграций (любая из которых может упасть). Колонки вроде `gender` были
    // дописаны в уже применённую lumia_002 и потому отсутствовали в проде — из-за чего
    // db.users.set падал и НИ ОДИН новый пользователь не мог создать карту.
    await reconcileUserColumns(pool);
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
  await lumia028HoroscopeEngagement(pool);
  await lumia029EnableNotificationScenarios(pool);
  await lumia030DisableRemovedScenarios(pool);
  await lumia031AdminFoundation(pool);
  await lumia032Monetization(pool);
  await lumia033ContentCms(pool);
  await lumia034Support(pool);
  await lumia035FeatureFlags(pool);
  await mvp036SchemaCleanup(pool);
  await mvp038PersonalForecastQuestions(pool);
  await mvp039RuStorePay(pool);
  await mvp040AccountIdentitySessions(pool);
  await mvp041AstrologyHistoryFoundation(pool);
  await mvp042SavedPersonIdentity(pool);
  await mvp043PasswordAuthentication(pool);
  await mvp044EmailIdentityUniqueness(pool);
  await mvp045AuthExpiryTimezone(pool);
  await mvp044PremiumEntitlementLifecycle(pool);
  await mvp045RuStoreCallbackOrdering(pool);
  await mvp046RuStoreProviderOverlay(pool);
  await mvp047RuStoreAbsoluteTimestamps(pool);
  await syncNotificationCatalogFromSeed(pool);
  await cancelStaleScheduledNotifications(pool);
  await verifyTablesExist(pool);

    log.info('All Lumia migrations completed successfully');
  } catch (error: any) {
    log.error('Migration failed', { error: error.message, stack: error.stack });
    throw error;
  } finally {
    if (pool) {
      try {
        if (migrationLockAcquired) {
          await pool.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]);
          log.info('Migration advisory lock released');
        }
        await pool.end();
        log.info('Database connection closed');
      } catch (e: any) {
        log.warn('Error closing pool', { error: e.message });
      }
    }
  }
}
