// Database connection utility for Railway
// This file handles connection to Railway Database
// 
// Uses process.env.DATABASE_URL from environment variables
// DATABASE_URL should be set in Railway Variables or .env file
// Format: postgresql://user:password@host:port/database

import { Pool, Client } from 'pg';
import { LEGACY_NOTIFICATION_SEEDS, SCHEDULED_NOTIFICATION_SEEDS } from './adminNotificationSeedCatalog';
import { resolveDatabaseUrl } from './database-url';
import {
  generateReferralCode,
  normalizeReferralCode,
} from './referralEconomy';
import {
  CANONICAL_NATAL_CALCULATION_VERSION,
  buildCanonicalNatalInputHash,
  hasCanonicalNatalRowFields,
  isCanonicalNatalChartDataComplete,
  normalizeBirthDateInput,
  normalizeBirthPlaceInput,
  normalizeBirthTimeInput,
} from './natalChartCanonical';
import type {
  AdminNotificationTargetSegment,
  DailyCheckIn,
  DailyCheckInInput,
  PersonalPatternInsight,
  DailyAstroSignalLayers,
  DailyAstroSignalPhase,
} from '../types';

// Read DATABASE_URL from environment variables
// This is set in Railway Variables or .env file
const DATABASE_URL = resolveDatabaseUrl();

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

function detectDeviceLabel(telegramPlatform?: string | null, userAgent?: string | null): string {
  const platform = (telegramPlatform || '').trim().toLowerCase();
  const ua = (userAgent || '').toLowerCase();
  const parts: string[] = [];

  if (platform) {
    const platformMap: Record<string, string> = {
      android: 'Telegram Android',
      ios: 'Telegram iOS',
      macos: 'Telegram macOS',
      tdesktop: 'Telegram Desktop',
      web: 'Telegram Web',
      webk: 'Telegram Web',
      weba: 'Telegram Web',
    };
    parts.push(platformMap[platform] || `Telegram ${platform}`);
  }

  if (ua.includes('iphone')) parts.push('iPhone');
  else if (ua.includes('ipad')) parts.push('iPad');
  else if (ua.includes('android')) parts.push('Android');
  else if (ua.includes('windows')) parts.push('Windows');
  else if (ua.includes('mac os') || ua.includes('macintosh')) parts.push('macOS');
  else if (ua.includes('linux')) parts.push('Linux');

  return parts.filter(Boolean).join(' • ') || 'Unknown device';
}

function trimText(value?: string | null, maxLength = 1000): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

type AdminDbPremiumFilter = 'all' | 'premium' | 'free';
type AdminDbUserSegment =
  | 'all'
  | 'premium'
  | 'free'
  | 'active_7d'
  | 'inactive_3d'
  | 'inactive_7d'
  | 'inactive_30d'
  | 'need_attention'
  | 'new_user_no_birth_data';
type AdminDbUserSortBy = 'last_seen' | 'created_at' | 'premium_until' | 'saved_charts_count' | 'name';
type AdminDbSortOrder = 'asc' | 'desc';
type AdminDbNotificationMode = 'all' | 'personal' | 'broadcast';
type AdminDbNotificationResult = 'all' | 'success' | 'partial' | 'failed';
type AdminDbNotificationSegment = AdminNotificationTargetSegment;
type DbContentAccessTier = 'free' | 'premium';
type DbContentSurface = 'natal' | 'forecast' | 'synastry';
type DbContentVariant =
  | 'anchor'
  | 'living'
  | 'planet_insight'
  | 'daily'
  | 'morning'
  | 'day'
  | 'evening'
  | 'weekly'
  | 'monthly'
  | 'brief'
  | 'full';
type DbContentModelTier = 'base' | 'premium';
type DbContentUnlockType = 'free' | 'premium';
type DbHoroscopeReactionKey = 'spot_on' | 'funny' | 'gentle' | 'not_mine';

function normalizeJsonColumn<T = any>(value: any): T {
  if (value == null) return value;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  }
  return value as T;
}

function dateKeyFromDb(value: any): string {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
}

function isoFromDb(value: any): string {
  return value ? new Date(value).toISOString() : new Date().toISOString();
}

const EMPTY_DAILY_ASTRO_SIGNAL_LAYERS: DailyAstroSignalLayers = {
  energy: 0,
  focus: 0,
  emotions: 0,
  money: 0,
  relationships: 0,
};

function mapDailyCheckInRow(row: any): DailyCheckIn {
  return {
    id: Number(row.id),
    userId: String(row.user_id),
    chartId: row.chart_id != null ? Number(row.chart_id) : null,
    date: dateKeyFromDb(row.checkin_date),
    timezone: row.timezone || 'Europe/Moscow',
    focus: row.focus_key,
    mood: row.mood_key,
    people: row.people_key,
    forecastFit: row.forecast_fit_key,
    pulseTime: row.pulse_time || '00:00',
    pulsePhase: (row.pulse_phase || 'restore') as DailyAstroSignalPhase,
    pulseScore: Number(row.pulse_score ?? 0),
    pulseLayers: normalizeJsonColumn<DailyAstroSignalLayers>(row.pulse_layers) || EMPTY_DAILY_ASTRO_SIGNAL_LAYERS,
    createdAt: isoFromDb(row.created_at),
    updatedAt: isoFromDb(row.updated_at),
  };
}

function mapContentInterpretationRow(row: any) {
  return {
    id: Number(row.id),
    userId: row.user_id != null ? String(row.user_id) : null,
    chartId: row.chart_id != null ? Number(row.chart_id) : null,
    accessTier: row.access_tier,
    contentSurface: row.content_surface,
    contentVariant: row.content_variant,
    modelTier: row.model_tier,
    cacheKey: row.cache_key,
    inputHash: row.input_hash ?? null,
    content: normalizeJsonColumn(row.content),
    promptVersion: row.prompt_version ?? null,
    calculationVersion: row.calculation_version ?? null,
    validFrom: row.valid_from ? new Date(row.valid_from).toISOString() : null,
    validTo: row.valid_to ? new Date(row.valid_to).toISOString() : null,
    isPersistent: !!row.is_persistent,
    legacySource: row.legacy_source ?? null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function mapStarPaymentRow(row: any) {
  return {
    id: Number(row.id),
    telegram_payment_charge_id: String(row.telegram_payment_charge_id),
    user_id: String(row.user_id),
    stars_amount: Number(row.stars_amount),
    payment_type: row.payment_type != null ? String(row.payment_type) : null,
    content_surface: row.content_surface != null ? String(row.content_surface) : null,
    content_variant: row.content_variant != null ? String(row.content_variant) : null,
    chart_id: row.chart_id != null ? Number(row.chart_id) : null,
    cache_key: row.cache_key != null ? String(row.cache_key) : null,
    payload_json: normalizeJsonColumn<Record<string, unknown>>(row.payload_json) ?? {},
    consumed_at: row.consumed_at ? new Date(row.consumed_at).toISOString() : null,
    consumed_by_unlock_id: row.consumed_by_unlock_id != null ? Number(row.consumed_by_unlock_id) : null,
    status: String(row.status ?? 'confirmed'),
    created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
  };
}

function mapContentUnlockRow(row: any) {
  return {
    id: Number(row.id),
    userId: String(row.user_id),
    chartId: row.chart_id != null ? Number(row.chart_id) : null,
    accessTier: row.access_tier,
    contentSurface: row.content_surface,
    contentVariant: row.content_variant,
    unlockType: row.unlock_type,
    cacheKey: row.cache_key,
    metadata: normalizeJsonColumn<Record<string, any> | null>(row.metadata),
    unlockedAt: new Date(row.unlocked_at).toISOString(),
    expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
    revokedAt: row.revoked_at ? new Date(row.revoked_at).toISOString() : null,
  };
}

function mapPremiumEntitlementRow(row: any) {
  return {
    id: Number(row.id),
    userId: String(row.user_id),
    tierName: row.tier_name,
    status: row.status,
    source: row.source,
    startsAt: new Date(row.starts_at).toISOString(),
    endsAt: new Date(row.ends_at).toISOString(),
    metadata: normalizeJsonColumn<Record<string, any> | null>(row.metadata),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

const ADMIN_USER_METRICS_CTE = `
  WITH user_metrics AS (
    SELECT
      u.id,
      u.name,
      u.language,
      u.birth_date,
      u.birth_time,
      u.premium_until,
      COALESCE(u.login_streak, 0) AS login_streak,
      COALESCE(u.chart_slots, 1) AS chart_slots,
      COALESCE(u.is_admin, FALSE) AS is_admin,
      COALESCE(u.is_blocked, FALSE) AS is_blocked,
      u.created_at,
      u.last_login,
      -- Последняя активность считается по ВСЕМ сигналам: сессии (Telegram), события приложения
      -- (screen_view — есть и у веб-гостей), и last_login. GREATEST игнорирует NULL. Раньше бралось
      -- только MAX(user_sessions) → веб-гости и юзеры без сессии выглядели «никогда не заходившими».
      GREATEST(MAX(us.last_seen_at), MAX(ev.last_event), u.last_login) AS last_seen_at,
      COUNT(DISTINCT nc.id)::int AS saved_charts_count
    FROM users u
    LEFT JOIN natal_charts nc ON nc.user_id = u.id
    LEFT JOIN user_sessions us ON us.user_id = u.id
    LEFT JOIN (
      SELECT user_id, MAX(occurred_at) AS last_event
      FROM user_app_events
      GROUP BY user_id
    ) ev ON ev.user_id = u.id
    GROUP BY u.id
  )
`;

const ADMIN_NEED_ATTENTION_SQL = `(saved_charts_count >= chart_slots)`;

function getAdminPremiumFilterSql(paramIndex: number) {
  return `(
    $${paramIndex} = 'all'
    OR ($${paramIndex} = 'premium' AND premium_until IS NOT NULL AND premium_until > NOW())
    OR ($${paramIndex} = 'free' AND (premium_until IS NULL OR premium_until <= NOW()))
  )`;
}

function getAdminUserSegmentSql(paramIndex: number) {
  return `(
    $${paramIndex} = 'all'
    OR ($${paramIndex} = 'premium' AND premium_until IS NOT NULL AND premium_until > NOW())
    OR ($${paramIndex} = 'free' AND (premium_until IS NULL OR premium_until <= NOW()))
    OR ($${paramIndex} = 'active_7d' AND last_seen_at >= NOW() - INTERVAL '7 days')
    OR ($${paramIndex} = 'inactive_3d' AND (last_seen_at IS NULL OR last_seen_at < NOW() - INTERVAL '3 days'))
    OR ($${paramIndex} = 'inactive_7d' AND (last_seen_at IS NULL OR last_seen_at < NOW() - INTERVAL '7 days'))
    OR ($${paramIndex} = 'inactive_30d' AND (last_seen_at IS NULL OR last_seen_at < NOW() - INTERVAL '30 days'))
    OR ($${paramIndex} = 'need_attention' AND ${ADMIN_NEED_ATTENTION_SQL})
    OR ($${paramIndex} = 'new_user_no_birth_data' AND birth_date IS NULL)
    OR ($${paramIndex} = 'birth_data_no_time' AND birth_date IS NOT NULL AND birth_time IS NULL)
    OR ($${paramIndex} = 'free_natal_ready_not_opened' AND (premium_until IS NULL OR premium_until <= NOW()) AND saved_charts_count > 0)
    OR ($${paramIndex} = 'free_natal_opened_no_premium' AND (premium_until IS NULL OR premium_until <= NOW()) AND saved_charts_count > 0)
    OR ($${paramIndex} = 'daily_active_free' AND (premium_until IS NULL OR premium_until <= NOW()) AND last_seen_at >= NOW() - INTERVAL '7 days')
    OR ($${paramIndex} = 'daily_active_premium' AND premium_until IS NOT NULL AND premium_until > NOW() AND last_seen_at >= NOW() - INTERVAL '7 days')
    OR ($${paramIndex} = 'inactive_2_days' AND (last_seen_at IS NULL OR last_seen_at < NOW() - INTERVAL '2 days'))
    OR ($${paramIndex} = 'inactive_14_days' AND (last_seen_at IS NULL OR last_seen_at < NOW() - INTERVAL '14 days'))
    OR ($${paramIndex} IN ('love_interested', 'money_interested', 'work_interested') AND last_seen_at >= NOW() - INTERVAL '30 days')
    OR ($${paramIndex} = 'high_intent_premium' AND (premium_until IS NULL OR premium_until <= NOW()) AND saved_charts_count > 0)
  )`;
}

function getAdminUserSortSql(sortBy: AdminDbUserSortBy, sortOrder: AdminDbSortOrder) {
  const direction = sortOrder === 'asc' ? 'ASC' : 'DESC';
  switch (sortBy) {
    case 'name':
      return `LOWER(COALESCE(name, '')) ${direction}, created_at DESC`;
    case 'created_at':
      return `created_at ${direction}`;
    case 'premium_until':
      return `premium_until ${direction} NULLS LAST, created_at DESC`;
    case 'saved_charts_count':
      return `saved_charts_count ${direction}, created_at DESC`;
    case 'last_seen':
    default:
      return `last_seen_at ${direction} NULLS LAST, created_at DESC`;
  }
}

function normalizeBirthTimeValue(value?: string | null): string {
  return normalizeBirthTimeInput(value);
}

function normalizeBirthDateValue(value?: string | Date | null): string {
  return normalizeBirthDateInput(value);
}

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
let migrationsRun = false;
let dailyNatalCardsChartScopeSupported: boolean | null = null;
let interpretationsChartScopeSupported: boolean | null = null;

async function supportsInterpretationsChartScope(): Promise<boolean> {
  if (interpretationsChartScopeSupported !== null) {
    return interpretationsChartScopeSupported;
  }

  if (!DATABASE_URL) {
    interpretationsChartScopeSupported = false;
    return false;
  }

  const dbPool = getPool();
  const result = await dbPool.query(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_name = 'interpretations'
         AND column_name = 'chart_id'
     ) AS has_chart_id`
  );

  interpretationsChartScopeSupported = !!result.rows[0]?.has_chart_id;
  return interpretationsChartScopeSupported;
}

async function supportsDailyNatalCardsChartScope(): Promise<boolean> {
  if (dailyNatalCardsChartScopeSupported !== null) {
    return dailyNatalCardsChartScopeSupported;
  }

  if (!DATABASE_URL) {
    dailyNatalCardsChartScopeSupported = false;
    return false;
  }

  const dbPool = getPool();
  const result = await dbPool.query(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_name = 'daily_natal_cards'
         AND column_name = 'chart_id'
     ) AS has_chart_id`
  );

  dailyNatalCardsChartScopeSupported = !!result.rows[0]?.has_chart_id;
  return dailyNatalCardsChartScopeSupported;
}

export function getPool(): Pool {
  if (!pool) {
    if (!DATABASE_URL) {
      throw new Error('DATABASE_URL is not configured');
    }
    
    // Parse and log connection info for debugging
    const urlParts = DATABASE_URL.match(/^postgres(ql)?:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
    if (urlParts) {
      const [, , user, , host, port, database] = urlParts;
      log.info(`Creating connection pool: ${host}:${port}/${database} (user: ${user})`);
      
      // Check if using internal Railway hostname
      if (host.includes('railway.internal')) {
        log.warn('Using Railway internal hostname. This may not be accessible from Docker containers.');
      }
    }
    
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000, // 5 seconds timeout for faster startup
    });

    pool.on('error', (err) => {
      log.error('Unexpected error on idle client', {
        error: err.message,
        code: (err as any).code,
        stack: err.stack
      });
    });

    pool.on('connect', () => {
      log.info('New database connection established');
      
      // Run migrations in background on first connection
      if (!migrationsRun) {
        migrationsRun = true;
        runMigrationsInBackground();
      }
    });

    log.info('Database connection pool created');
  }
  
  return pool;
}

// Run migrations in background without blocking
async function runMigrationsInBackground() {
  try {
    log.info('Running migrations in background...');
    const { runMigrations } = await import('./migrations');
    await runMigrations();
    log.info('Background migrations completed');
  } catch (error: any) {
    log.warn('Background migrations failed (non-blocking):', error.message);
  }
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
    const errorMessage = error.message || 'Unknown error';
    const errorCode = error.code || 'UNKNOWN';
    
    log.error('[DB] Query failed', {
      error: errorMessage,
      code: errorCode,
      stack: error.stack,
      query: query.substring(0, 100)
    });

    // Provide helpful error messages for common connection issues
    if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('getaddrinfo')) {
      log.error('[DB] DNS resolution failed. Check DATABASE_URL hostname.');
    } else if (errorMessage.includes('ECONNREFUSED')) {
      log.error('[DB] Connection refused. Check if database server is running and accessible.');
    } else if (errorMessage.includes('timeout')) {
      log.error('[DB] Connection timeout. Database may be unreachable.');
    }
    
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
 * Test database connection using Client (simple connection test)
 * This is useful for testing if DATABASE_URL is correctly configured
 * 
 * Example usage:
 * ```typescript
 * import { testDatabaseConnection } from '../lib/db';
 * 
 * testDatabaseConnection()
 *   .then(() => console.log('Connected to database'))
 *   .catch(err => console.error('Database connection error:', err.stack));
 * ```
 */
export async function testDatabaseConnection(): Promise<void> {
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured in environment variables');
  }

  const client = new Client({
    connectionString: DATABASE_URL,
  });

  try {
    await client.connect();
    log.info('Database connection test successful');
    
    // Test query
    const result = await client.query('SELECT NOW()');
    log.info('Database query test successful', { serverTime: result.rows[0].now });
    
    await client.end();
  } catch (error: any) {
    log.error('Database connection test failed', {
      error: error.message,
      code: error.code,
      stack: error.stack
    });
    await client.end().catch(() => {}); // Ensure client is closed
    throw error;
  }
}

function toUserId(userId: string): string {
  return String(userId).trim();
}

function isFutureTimestamp(value: unknown): boolean {
  if (!value) return false;
  const timestamp = value instanceof Date ? value.getTime() : new Date(String(value)).getTime();
  return Number.isFinite(timestamp) && timestamp > Date.now();
}

function resolveIsSetup(row: any, birthDate?: unknown, birthPlace?: unknown): boolean {
  return !!row?.is_setup || (!!(birthDate ?? row?.birth_date) && !!(birthPlace ?? row?.birth_place));
}

/**
 * Application database operations.
 */
export const db = {
  /** Key-value settings (e.g. admin-selected OpenAI model) */
  app_settings: {
    async get(key: string): Promise<{ value: string; updated_at?: string } | null> {
      if (!DATABASE_URL) return null;
      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          'SELECT value, updated_at FROM app_settings WHERE key = $1 LIMIT 1',
          [key]
        );
        if (result.rows.length === 0) return null;
        return { value: String(result.rows[0].value), updated_at: result.rows[0].updated_at };
      } catch (error: any) {
        log.error('[DB] Error getting app_settings', { error: error.message, key });
        throw error;
      }
    },

    async set(key: string, value: string): Promise<void> {
      if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured');
      try {
        const dbPool = getPool();
        await dbPool.query(
          `INSERT INTO app_settings (key, value, updated_at)
           VALUES ($1, $2, CURRENT_TIMESTAMP)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
          [key, value]
        );
      } catch (error: any) {
        log.error('[DB] Error setting app_settings', { error: error.message, key });
        throw error;
      }
    },
  },

  users: {
    /**
     * Фиксирует вход пользователя: обновляет last_login (был мёртв — нигде не писался) и
     * реальный login_streak (подряд идущие дни). Вызывается на каждое открытие приложения
     * из /api/users/session — для ВСЕХ (Telegram и веб-гости). Идемпотентно в пределах дня.
     */
    async recordLogin(userId: string) {
      const id = toUserId(userId);
      if (!DATABASE_URL) return;
      try {
        await getPool().query(
          `UPDATE users SET
             login_streak = CASE
               WHEN last_login IS NULL THEN 1
               WHEN last_login::date = CURRENT_DATE THEN GREATEST(COALESCE(login_streak, 0), 1)
               WHEN last_login::date = CURRENT_DATE - 1 THEN COALESCE(login_streak, 0) + 1
               ELSE 1
             END,
             last_login = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [id]
        );
      } catch (error: any) {
        log.error('[DB] Error recording login', { error: error.message, userId });
      }
    },

    async get(userId: string) {
      const id = toUserId(userId);
      if (!DATABASE_URL) return null;
      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          'SELECT * FROM users WHERE id = $1',
          [id]
        );
        if (result.rows.length === 0) return null;
        const u = result.rows[0];
        let primaryChart: any = null;
        try {
          primaryChart = await db.natal_charts.getPrimary(id);
        } catch (chartError: any) {
          log.warn('[DB] Failed to hydrate user with primary chart summary', {
            userId: id,
            error: chartError?.message,
          });
        }
        const isPremium = isFutureTimestamp(u.premium_until);
        const isSetup = resolveIsSetup(u);
        return {
          id: String(u.id),
          name: u.name,
          birth_date: u.birth_date,
          birth_time: u.birth_time,
          birth_place: u.birth_place,
          latitude: primaryChart?.latitude ?? u.latitude,
          longitude: primaryChart?.longitude ?? u.longitude,
          sun_sign: primaryChart?.sun_sign ?? u.sun_sign,
          moon_sign: primaryChart?.moon_sign ?? u.moon_sign,
          ascendant: primaryChart?.ascendant_sign ?? u.ascendant,
          premium_until: u.premium_until,
          trial_started_at: u.trial_started_at,
          ref_code: u.ref_code,
          referred_by: u.referred_by,
          login_streak: u.login_streak ?? 0,
          last_login: u.last_login,
          language: u.language || 'ru',
          theme: u.theme || 'dark',
          is_admin: u.is_admin ?? false,
          created_at: u.created_at,
          updated_at: u.updated_at,
          selected_zodiac_sign: u.selected_zodiac_sign,
          gender: u.gender ?? null,
          is_premium: isPremium,
          is_setup: isSetup,
          chart_slots: u.chart_slots ?? 1,
          is_blocked: u.is_blocked ?? false,
        };
      } catch (error: any) {
        log.error('[DB] Error getting user', { error: error.message, userId });
        throw error;
      }
    },

    async set(userId: string, data: any) {
      const id = toUserId(userId);
      if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured');
      try {
        const dbPool = getPool();
        let existingUser: any = null;
        try {
          const existingResult = await dbPool.query('SELECT * FROM users WHERE id = $1', [id]);
          if (existingResult.rows.length > 0) existingUser = existingResult.rows[0];
        } catch {}
        const merge = (key: string, def?: any) =>
          data[key] !== undefined ? data[key] : (existingUser?.[key] ?? def);
        const birthDate = merge('birth_date');
        const birthTime = merge('birth_time');
        const birthPlace = merge('birth_place');
        const trialStartedAt = merge('trial_started_at');
        const selectedZodiacRaw = merge('selected_zodiac_sign');
        const selectedZodiacSign = selectedZodiacRaw != null && String(selectedZodiacRaw).trim()
          ? String(selectedZodiacRaw).trim()
          : null;
        const genderRaw = merge('gender');
        const gender = ['male', 'female', 'unspecified'].includes(String(genderRaw)) ? String(genderRaw) : null;
        const finalIsSetup = !!(data.is_setup ?? existingUser?.is_setup) || !!(birthDate && birthPlace);
        let premiumUntil = data.premium_until;
        if (premiumUntil === undefined && data.is_premium !== undefined) {
          premiumUntil = data.is_premium
            ? (existingUser?.premium_until || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000))
            : null;
        } else if (premiumUntil === undefined) {
          premiumUntil = existingUser?.premium_until ?? null;
        }
        const result = await dbPool.query(
          `INSERT INTO users (
            id, name, birth_date, birth_time, birth_place,
            latitude, longitude, sun_sign, moon_sign, ascendant,
            premium_until, trial_started_at, is_setup, selected_zodiac_sign,
            ref_code, referred_by,
            login_streak, last_login, language, theme, is_admin, gender
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
          ON CONFLICT (id) DO UPDATE SET
            name = COALESCE(EXCLUDED.name, users.name),
            birth_date = COALESCE(EXCLUDED.birth_date, users.birth_date),
            birth_time = COALESCE(EXCLUDED.birth_time, users.birth_time),
            birth_place = COALESCE(EXCLUDED.birth_place, users.birth_place),
            latitude = COALESCE(EXCLUDED.latitude, users.latitude),
            longitude = COALESCE(EXCLUDED.longitude, users.longitude),
            sun_sign = COALESCE(EXCLUDED.sun_sign, users.sun_sign),
            moon_sign = COALESCE(EXCLUDED.moon_sign, users.moon_sign),
            ascendant = COALESCE(EXCLUDED.ascendant, users.ascendant),
            premium_until = EXCLUDED.premium_until,
            trial_started_at = COALESCE(EXCLUDED.trial_started_at, users.trial_started_at),
            is_setup = EXCLUDED.is_setup,
            selected_zodiac_sign = EXCLUDED.selected_zodiac_sign,
            language = COALESCE(EXCLUDED.language, users.language),
            theme = COALESCE(EXCLUDED.theme, users.theme),
            is_admin = COALESCE(EXCLUDED.is_admin, users.is_admin),
            gender = COALESCE(EXCLUDED.gender, users.gender),
            updated_at = CURRENT_TIMESTAMP
          RETURNING *`,
          [
            id,
            merge('name'),
            birthDate,
            birthTime,
            birthPlace,
            merge('latitude'),
            merge('longitude'),
            merge('sun_sign'),
            merge('moon_sign'),
            merge('ascendant'),
            premiumUntil,
            trialStartedAt,
            finalIsSetup,
            selectedZodiacSign,
            merge('ref_code'),
            merge('referred_by'),
            merge('login_streak', 0),
            merge('last_login'),
            merge('language', 'ru'),
            merge('theme', 'dark'),
            merge('is_admin', false),
            gender,
          ]
        );
        const u = result.rows[0];
        const isPremium = isFutureTimestamp(u.premium_until);
        return {
          id: String(u.id),
          name: u.name,
          birth_date: u.birth_date,
          birth_time: u.birth_time,
          birth_place: u.birth_place,
          premium_until: u.premium_until,
          trial_started_at: u.trial_started_at,
          is_setup: resolveIsSetup(u),
          language: u.language || 'ru',
          theme: u.theme || 'dark',
          is_premium: isPremium,
          is_admin: u.is_admin ?? false,
          created_at: u.created_at,
          updated_at: u.updated_at,
          selected_zodiac_sign: u.selected_zodiac_sign,
          gender: u.gender ?? null,
        };
      } catch (error: any) {
        log.error('[DB] Error setting user', { error: error.message, userId });
        throw error;
      }
    },

    async getOrCreate(userId: string, data?: any) {
      const u = await this.get(userId);
      if (u) return u;
      await this.set(userId, data || {});
      return this.get(userId);
    },

    async setPremiumUntil(userId: string, premiumUntil: string | null) {
      const id = toUserId(userId);
      if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured');
      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          `UPDATE users
           SET premium_until = $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2
           RETURNING id`,
          [premiumUntil, id]
        );

        if (result.rows.length === 0) {
          throw new Error('User not found');
        }

        return this.get(userId);
      } catch (error: any) {
        log.error('[DB] Error setting premium_until', { error: error.message, userId });
        throw error;
      }
    },

    async ensureReferralCode(userId: string): Promise<string | null> {
      const id = toUserId(userId);
      if (!DATABASE_URL) return null;
      const dbPool = getPool();
      const existing = await dbPool.query('SELECT ref_code FROM users WHERE id = $1', [id]);
      if (existing.rows.length === 0) return null;
      const cur = existing.rows[0].ref_code;
      if (cur && String(cur).trim()) return String(cur).trim().toUpperCase();

      for (let attempt = 0; attempt < 12; attempt++) {
        const code = generateReferralCode();
        try {
          const up = await dbPool.query(
            `UPDATE users SET ref_code = $2 WHERE id = $1 AND (ref_code IS NULL OR btrim(ref_code::text) = '') RETURNING ref_code`,
            [id, code]
          );
          if (up.rows.length > 0) return String(up.rows[0].ref_code).toUpperCase();
          const again = await dbPool.query('SELECT ref_code FROM users WHERE id = $1', [id]);
          if (again.rows[0]?.ref_code) return String(again.rows[0].ref_code).toUpperCase();
        } catch (error: any) {
          if (error.code === '23505') continue;
          log.error('[DB] ensureReferralCode', { error: error.message, userId });
          throw error;
        }
      }
      return null;
    },

    /**
     * One-time: invitee claims an inviter's ref_code. Credits both parties.
     */
    async claimReferralBonus(
      inviteeId: string,
      rawCode: string
    ): Promise<{ referralApplied: true }> {
      const id = toUserId(inviteeId);
      const code = normalizeReferralCode(rawCode);
      if (!code) {
        const err = new Error('REFERRAL_INVALID_CODE');
        (err as any).code = 'REFERRAL_INVALID_CODE';
        throw err;
      }

      if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured');
      const dbPool = getPool();

      const inviterQ = await dbPool.query('SELECT id FROM users WHERE UPPER(ref_code) = $1', [code]);
      if (inviterQ.rows.length === 0) {
        const err = new Error('REFERRAL_INVALID_CODE');
        (err as any).code = 'REFERRAL_INVALID_CODE';
        throw err;
      }
      const inviterId = String(inviterQ.rows[0].id);
      if (inviterId === id) {
        const err = new Error('REFERRAL_SELF');
        (err as any).code = 'REFERRAL_SELF';
        throw err;
      }

      const client = await dbPool.connect();
      try {
        await client.query('BEGIN');

        const inv = await client.query(
          `SELECT id, referred_by FROM users WHERE id = $1 FOR UPDATE`,
          [id]
        );
        if (inv.rows.length === 0) {
          await client.query('ROLLBACK');
          throw new Error('User not found');
        }
        if (inv.rows[0].referred_by != null) {
          await client.query('ROLLBACK');
          const err = new Error('REFERRAL_ALREADY_CLAIMED');
          (err as any).code = 'REFERRAL_ALREADY_CLAIMED';
          throw err;
        }

        const upd = await client.query(
          `UPDATE users SET referred_by = $1 WHERE id = $2 AND referred_by IS NULL RETURNING id`,
          [inviterId, id]
        );
        if (upd.rows.length === 0) {
          await client.query('ROLLBACK');
          const err = new Error('REFERRAL_ALREADY_CLAIMED');
          (err as any).code = 'REFERRAL_ALREADY_CLAIMED';
          throw err;
        }

        await client.query('COMMIT');
        return { referralApplied: true };
      } catch (error: any) {
        await client.query('ROLLBACK').catch(() => {});
        if (error?.code === 'REFERRAL_ALREADY_CLAIMED' || error?.code === 'REFERRAL_INVALID_CODE' || error?.code === 'REFERRAL_SELF') {
          throw error;
        }
        log.error('[DB] claimReferralBonus', { error: error.message, inviteeId });
        throw error;
      } finally {
        client.release();
      }
    },

    async getAll() {
      if (!DATABASE_URL) return [];
      try {
        const dbPool = getPool();
        const result = await dbPool.query('SELECT * FROM users ORDER BY created_at DESC');
        return result.rows.map((u: any) => {
          const isPremium = isFutureTimestamp(u.premium_until);
        return {
          id: String(u.id),
          name: u.name,
          birth_date: u.birth_date,
          birth_time: u.birth_time,
          birth_place: u.birth_place,
          premium_until: u.premium_until,
          trial_started_at: u.trial_started_at,
          is_setup: resolveIsSetup(u),
          language: u.language || 'ru',
          theme: u.theme || 'dark',
          is_premium: isPremium,
          is_admin: u.is_admin ?? false,
          created_at: u.created_at,
          updated_at: u.updated_at,
          selected_zodiac_sign: u.selected_zodiac_sign,
          login_streak: u.login_streak ?? 0,
        };
        });
      } catch (error: any) {
        log.error('[DB] Error getting all users', { error: error.message });
        throw error;
      }
    },
  },

  natal_charts: {
    _selectColumns: `
      id, user_id, name,
      sun, moon, ascendant, mercury, venus, mars, jupiter, saturn,
      houses, aspects, chart_data,
      latitude, longitude, timezone,
      sun_sign, moon_sign, ascendant_sign,
      input_hash, calculation_version,
      birth_date, birth_time, birth_place,
      is_primary, created_at, updated_at
    `,

    _hydrateChartData(row: any) {
      const chartData = normalizeJsonColumn<any>(row.chart_data) || {};
      const rising = chartData.rising || chartData.ascendant || normalizeJsonColumn(row.ascendant) || null;
      return {
        ...chartData,
        sun: chartData.sun || normalizeJsonColumn(row.sun) || null,
        moon: chartData.moon || normalizeJsonColumn(row.moon) || null,
        rising,
        mercury: chartData.mercury || normalizeJsonColumn(row.mercury) || null,
        venus: chartData.venus || normalizeJsonColumn(row.venus) || null,
        mars: chartData.mars || normalizeJsonColumn(row.mars) || null,
        jupiter: chartData.jupiter || normalizeJsonColumn(row.jupiter) || null,
        saturn: chartData.saturn || normalizeJsonColumn(row.saturn) || null,
        houses: Array.isArray(chartData.houses) ? chartData.houses : normalizeJsonColumn(row.houses) || [],
        aspects: Array.isArray(chartData.aspects) ? chartData.aspects : normalizeJsonColumn(row.aspects) || [],
        latitude: typeof chartData.latitude === 'number' ? chartData.latitude : row.latitude,
        longitude: typeof chartData.longitude === 'number' ? chartData.longitude : row.longitude,
        timezone: chartData.timezone || row.timezone || null,
        calculationVersion: chartData.calculationVersion || row.calculation_version || null,
      };
    },

    _rowToChart(row: any) {
      const chartData = this._hydrateChartData(row);
      return {
        id: row.id,
        user_id: row.user_id,
        name: row.name || 'Моя карта',
        sun: normalizeJsonColumn(row.sun) || chartData.sun || null,
        moon: normalizeJsonColumn(row.moon) || chartData.moon || null,
        ascendant: normalizeJsonColumn(row.ascendant) || chartData.rising || null,
        mercury: normalizeJsonColumn(row.mercury) || chartData.mercury || null,
        venus: normalizeJsonColumn(row.venus) || chartData.venus || null,
        mars: normalizeJsonColumn(row.mars) || chartData.mars || null,
        jupiter: normalizeJsonColumn(row.jupiter) || chartData.jupiter || null,
        saturn: normalizeJsonColumn(row.saturn) || chartData.saturn || null,
        houses: normalizeJsonColumn(row.houses) || chartData.houses || [],
        aspects: normalizeJsonColumn(row.aspects) || chartData.aspects || [],
        chart_data: chartData,
        birth_date: row.birth_date,
        birth_time: row.birth_time,
        birth_place: row.birth_place,
        latitude: row.latitude ?? chartData.latitude ?? null,
        longitude: row.longitude ?? chartData.longitude ?? null,
        timezone: row.timezone || chartData.timezone || null,
        sun_sign: row.sun_sign || chartData.sun?.sign || null,
        moon_sign: row.moon_sign || chartData.moon?.sign || null,
        ascendant_sign: row.ascendant_sign || chartData.rising?.sign || null,
        input_hash: row.input_hash,
        calculation_version: row.calculation_version || chartData.calculationVersion || null,
        is_primary: row.is_primary ?? true,
        calculated_at: row.updated_at || row.created_at,
        created_at: row.created_at,
        updated_at: row.updated_at || row.created_at,
      };
    },

    _toPersistencePayload(data: { name?: string; birthDate: string; birthTime?: string; birthPlace: string; inputHash: string; chartData: any }) {
      const chartData = data.chartData?.chart_data || data.chartData;
      if (!chartData?.sun || !chartData?.moon || !chartData?.rising) {
        throw new Error('Canonical natal chart data is incomplete');
      }

      const normalizedBirthDate = normalizeBirthDateValue(data.birthDate);
      const normalizedBirthTime = normalizeBirthTimeValue(data.birthTime);
      const normalizedBirthPlace = normalizeBirthPlaceInput(data.birthPlace);

      return {
        name: trimText(data.name, 120) || 'Моя карта',
        birthDate: normalizedBirthDate || data.birthDate,
        birthTime: normalizedBirthTime || data.birthTime || '12:00',
        birthPlace: normalizedBirthPlace || data.birthPlace,
        inputHash: data.inputHash,
        chartData,
        sun: chartData.sun,
        moon: chartData.moon,
        ascendant: chartData.rising || chartData.ascendant,
        mercury: chartData.mercury || null,
        venus: chartData.venus || null,
        mars: chartData.mars || null,
        jupiter: chartData.jupiter || null,
        saturn: chartData.saturn || null,
        houses: chartData.houses || [],
        aspects: chartData.aspects || [],
        latitude: chartData.latitude ?? null,
        longitude: chartData.longitude ?? null,
        timezone: chartData.timezone || null,
        sunSign: chartData.sun?.sign || null,
        moonSign: chartData.moon?.sign || null,
        ascendantSign: (chartData.rising || chartData.ascendant)?.sign || null,
        calculationVersion: chartData.calculationVersion || CANONICAL_NATAL_CALCULATION_VERSION,
      };
    },

    async _queryOne(query: string, params: any[]) {
      const dbPool = getPool();
      const result = await dbPool.query(query, params);
      if (result.rows.length === 0) return null;
      return this._rowToChart(result.rows[0]);
    },

    async findByInputHash(userId: string, inputHash: string) {
      const id = toUserId(userId);
      if (!DATABASE_URL || !inputHash) return null;
      try {
        return await this._queryOne(
          `SELECT ${this._selectColumns}
           FROM natal_charts
           WHERE user_id = $1 AND input_hash = $2
           ORDER BY is_primary DESC NULLS LAST, id ASC
           LIMIT 1`,
          [id, inputHash]
        );
      } catch (error: any) {
        log.error('[DB] Error finding chart by input hash', { error: error.message, userId });
        throw error;
      }
    },

    async getPrimary(userId: string) {
      const id = toUserId(userId);
      if (!DATABASE_URL) return null;
      try {
        return await this._queryOne(
          `SELECT ${this._selectColumns}
           FROM natal_charts
           WHERE user_id = $1
           ORDER BY is_primary DESC NULLS LAST, id ASC
           LIMIT 1`,
          [id]
        );
      } catch (error: any) {
        log.error('[DB] Error getting primary chart', { error: error.message, userId });
        throw error;
      }
    },

    async getAll(userId: string) {
      const id = toUserId(userId);
      if (!DATABASE_URL) return [];
      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          `SELECT ${this._selectColumns}
           FROM natal_charts
           WHERE user_id = $1
           ORDER BY is_primary DESC NULLS LAST, id ASC`,
          [id]
        );
        return result.rows.map((r: any) => this._rowToChart(r));
      } catch (error: any) {
        log.error('[DB] Error getting all charts', { error: error.message, userId });
        throw error;
      }
    },

    async getById(chartId: number) {
      if (!DATABASE_URL) return null;
      try {
        return await this._queryOne(
          `SELECT ${this._selectColumns}
           FROM natal_charts
           WHERE id = $1`,
          [chartId]
        );
      } catch (error: any) {
        log.error('[DB] Error getting chart by id', { error: error.message, chartId });
        throw error;
      }
    },

    async _updateChartRow(client: any, chartId: number, payload: any, isPrimary: boolean) {
      const result = await client.query(
        `UPDATE natal_charts
         SET name = $1,
             sun = $2,
             moon = $3,
             ascendant = $4,
             mercury = $5,
             venus = $6,
             mars = $7,
             jupiter = $8,
             saturn = $9,
             houses = $10,
             aspects = $11,
             chart_data = $12,
             latitude = $13,
             longitude = $14,
             timezone = $15,
             sun_sign = $16,
             moon_sign = $17,
             ascendant_sign = $18,
             input_hash = $19,
             calculation_version = $20,
             birth_date = $21,
             birth_time = $22,
             birth_place = $23,
             is_primary = $24,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $25
         RETURNING ${this._selectColumns}`,
        [
          payload.name,
          JSON.stringify(payload.sun),
          JSON.stringify(payload.moon),
          JSON.stringify(payload.ascendant),
          JSON.stringify(payload.mercury),
          JSON.stringify(payload.venus),
          JSON.stringify(payload.mars),
          JSON.stringify(payload.jupiter),
          JSON.stringify(payload.saturn),
          JSON.stringify(payload.houses),
          JSON.stringify(payload.aspects),
          JSON.stringify(payload.chartData),
          payload.latitude,
          payload.longitude,
          payload.timezone,
          payload.sunSign,
          payload.moonSign,
          payload.ascendantSign,
          payload.inputHash,
          payload.calculationVersion,
          payload.birthDate,
          payload.birthTime,
          payload.birthPlace,
          isPrimary,
          chartId
        ]
      );
      return this._rowToChart(result.rows[0]);
    },

    async _insertChartRow(client: any, userId: string, payload: any, isPrimary: boolean) {
      const id = toUserId(userId);
      const result = await client.query(
        `INSERT INTO natal_charts (
          user_id, name,
          sun, moon, ascendant, mercury, venus, mars, jupiter, saturn,
          houses, aspects, chart_data,
          latitude, longitude, timezone,
          sun_sign, moon_sign, ascendant_sign,
          input_hash, calculation_version,
          birth_date, birth_time, birth_place,
          is_primary
        ) VALUES (
          $1, $2,
          $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13,
          $14, $15, $16,
          $17, $18, $19,
          $20, $21,
          $22, $23, $24,
          $25
        )
        RETURNING ${this._selectColumns}`,
        [
          id,
          payload.name,
          JSON.stringify(payload.sun),
          JSON.stringify(payload.moon),
          JSON.stringify(payload.ascendant),
          JSON.stringify(payload.mercury),
          JSON.stringify(payload.venus),
          JSON.stringify(payload.mars),
          JSON.stringify(payload.jupiter),
          JSON.stringify(payload.saturn),
          JSON.stringify(payload.houses),
          JSON.stringify(payload.aspects),
          JSON.stringify(payload.chartData),
          payload.latitude,
          payload.longitude,
          payload.timezone,
          payload.sunSign,
          payload.moonSign,
          payload.ascendantSign,
          payload.inputHash,
          payload.calculationVersion,
          payload.birthDate,
          payload.birthTime,
          payload.birthPlace,
          isPrimary
        ]
      );
      return this._rowToChart(result.rows[0]);
    },

    async persistPrimary(userId: string, data: { name?: string; birthDate: string; birthTime?: string; birthPlace: string; inputHash: string; chartData: any }) {
      if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured');
      const id = toUserId(userId);
      const payload = this._toPersistencePayload(data);
      const client = await getPool().connect();

      try {
        await client.query('BEGIN');

        const sameHashResult = await client.query(
          `SELECT ${this._selectColumns}
           FROM natal_charts
           WHERE user_id = $1 AND input_hash = $2
           ORDER BY is_primary DESC NULLS LAST, id ASC
           LIMIT 1`,
          [id, payload.inputHash]
        );
        const sameHash = sameHashResult.rows[0] ? this._rowToChart(sameHashResult.rows[0]) : null;

        const primaryResult = await client.query(
          `SELECT ${this._selectColumns}
           FROM natal_charts
           WHERE user_id = $1
           ORDER BY is_primary DESC NULLS LAST, id ASC
           LIMIT 1`,
          [id]
        );
        const primary = primaryResult.rows[0] ? this._rowToChart(primaryResult.rows[0]) : null;
        const previousInputHash = primary?.input_hash ?? null;
        const chartIdToInvalidate = primary?.id ?? null;

        await client.query('UPDATE natal_charts SET is_primary = FALSE WHERE user_id = $1', [id]);

        const saved = sameHash
          ? await this._updateChartRow(client, sameHash.id, payload, true)
          : primary
            ? await this._updateChartRow(client, primary.id, payload, true)
            : await this._insertChartRow(client, userId, payload, true);

        if (
          chartIdToInvalidate != null
          && previousInputHash
          && previousInputHash !== payload.inputHash
        ) {
          await client.query(
            `DELETE FROM content_interpretations WHERE chart_id = $1`,
            [chartIdToInvalidate]
          );
          await client.query(
            `DELETE FROM synastry_cache WHERE chart1_id = $1 OR chart2_id = $1`,
            [chartIdToInvalidate]
          );
          log.info('[DB] Invalidated cached interpretations after primary chart input change', {
            chartId: chartIdToInvalidate,
            previousInputHash,
            nextInputHash: payload.inputHash,
          });
        }

        await client.query('COMMIT');
        return saved;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },

    async create(userId: string, data: { name: string; birthDate: string; birthTime?: string; birthPlace: string; chartData: any; inputHash?: string }) {
      if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured');
      const id = toUserId(userId);
      const chartData = data.chartData?.chart_data || data.chartData;
      const inferredInputHash = data.inputHash || (
        typeof chartData?.latitude === 'number' &&
        typeof chartData?.longitude === 'number' &&
        typeof chartData?.timezone === 'string'
          ? buildCanonicalNatalInputHash({
              birthDate: data.birthDate,
              birthTime: data.birthTime,
              birthTimeQuality: chartData.birthTimeQuality || chartData.chartQuality?.birthTimeQuality || undefined,
              latitude: chartData.latitude,
              longitude: chartData.longitude,
              timezone: chartData.timezone,
            })
          : null
      );

      if (!inferredInputHash) {
        throw new Error('Canonical chart input hash is required');
      }

      const payload = this._toPersistencePayload({ ...data, inputHash: inferredInputHash });
      const client = await getPool().connect();

      try {
        await client.query('BEGIN');

        const existingSameHashResult = await client.query(
          `SELECT ${this._selectColumns}
           FROM natal_charts
           WHERE user_id = $1 AND input_hash = $2
           ORDER BY is_primary DESC NULLS LAST, id ASC
           LIMIT 1`,
          [id, payload.inputHash]
        );

        if (existingSameHashResult.rows.length > 0) {
          const existing = this._rowToChart(existingSameHashResult.rows[0]);
          const saved = await this._updateChartRow(client, existing.id, payload, existing.is_primary);
          await client.query('COMMIT');
          return saved;
        }

        const countResult = await client.query('SELECT COUNT(*)::int AS total FROM natal_charts WHERE user_id = $1', [id]);
        const chartsCount = countResult.rows[0]?.total ?? 0;
        const user = await db.users.get(userId);
        const slots = user?.chart_slots ?? 1;
        if (chartsCount >= slots) {
          throw new Error(`Chart slots limit reached (${slots}). Upgrade to Premium for more slots.`);
        }

        const saved = await this._insertChartRow(client, userId, payload, chartsCount === 0);
        await client.query('COMMIT');
        return saved;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },

    async setPrimary(chartId: number) {
      if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured');
      try {
        const dbPool = getPool();
        const chart = await this.getById(chartId);
        if (!chart) throw new Error('Chart not found');
        await dbPool.query('UPDATE natal_charts SET is_primary = FALSE WHERE user_id = $1', [chart.user_id]);
        await dbPool.query('UPDATE natal_charts SET is_primary = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [chartId]);
        return { success: true };
      } catch (error: any) {
        log.error('[DB] Error setting primary chart', { error: error.message, chartId });
        throw error;
      }
    },

    async delete(chartId: number) {
      if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured');
      try {
        const dbPool = getPool();
        const chart = await this.getById(chartId);
        if (!chart) throw new Error('Chart not found');
        await dbPool.query('DELETE FROM natal_charts WHERE id = $1', [chartId]);
        if (chart.is_primary) {
          const remaining = await this.getAll(String(chart.user_id));
          if (remaining.length > 0) {
            await dbPool.query('UPDATE natal_charts SET is_primary = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [remaining[0].id]);
          }
        }
        return { success: true };
      } catch (error: any) {
        log.error('[DB] Error deleting chart', { error: error.message, chartId });
        throw error;
      }
    },

    async get(userId: string) {
      return this.getPrimary(userId);
    },

    async needsRecalculation(userIdOrChartId: string | number, birthDate: string, birthTime: string, birthPlace: string, inputHash?: string): Promise<{ needsCalc: boolean; existingChart: any | null; reason: string }> {
      const existing = typeof userIdOrChartId === 'number'
        ? await this.getById(userIdOrChartId)
        : await this.getPrimary(userIdOrChartId);
      if (!existing) return { needsCalc: true, existingChart: null, reason: 'NO_EXISTING_CHART' };

      const normalizedBirthDate = normalizeBirthDateValue(birthDate);
      const normalizedBirthTime = normalizeBirthTimeValue(birthTime);
      const normalizedBirthPlace = normalizeBirthPlaceInput(birthPlace);
      const inputChanged = inputHash
        ? existing.input_hash !== inputHash
        : normalizeBirthDateValue(existing.birth_date) !== normalizedBirthDate ||
          normalizeBirthTimeValue(existing.birth_time) !== normalizedBirthTime ||
          normalizeBirthPlaceInput(existing.birth_place) !== normalizedBirthPlace;

      if (inputChanged) {
        return { needsCalc: true, existingChart: existing, reason: 'BIRTH_DATA_CHANGED' };
      }

      const chartData = existing.chart_data;
      const isCanonical = isCanonicalNatalChartDataComplete(chartData) && hasCanonicalNatalRowFields(existing);
      if (!isCanonical) {
        return { needsCalc: true, existingChart: existing, reason: 'INCOMPLETE_CANONICAL_CHART' };
      }
      if (existing.calculation_version !== CANONICAL_NATAL_CALCULATION_VERSION) {
        return { needsCalc: true, existingChart: existing, reason: 'CALCULATION_VERSION_CHANGED' };
      }

      return { needsCalc: false, existingChart: existing, reason: 'CACHE_HIT' };
    },

    async set(userId: string, chartData: any, birthDate?: string, birthTime?: string, birthPlace?: string, inputHash?: string) {
      const data = chartData.chart_data || chartData;
      if (!birthDate || !birthPlace) {
        throw new Error('birthDate and birthPlace are required for canonical chart persistence');
      }

      const resolvedInputHash = inputHash || (
        typeof data?.latitude === 'number' &&
        typeof data?.longitude === 'number' &&
        typeof data?.timezone === 'string'
          ? buildCanonicalNatalInputHash({
              birthDate,
              birthTime,
              birthTimeQuality: data.birthTimeQuality || data.chartQuality?.birthTimeQuality || undefined,
              latitude: data.latitude,
              longitude: data.longitude,
              timezone: data.timezone,
            })
          : null
      );

      if (!resolvedInputHash) {
        throw new Error('Canonical chart input hash is required');
      }

      return this.persistPrimary(userId, {
        name: chartData?.name,
        birthDate,
        birthTime,
        birthPlace,
        inputHash: resolvedInputHash,
        chartData: data,
      });
    },

    async listRepairCandidates(limit = 200) {
      if (!DATABASE_URL) return [];
      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          `WITH incomplete_charts AS (
             SELECT
               u.id AS user_id,
               COALESCE(nc.name, u.name, 'Chart') AS display_name,
               COALESCE(nc.birth_date, u.birth_date) AS birth_date,
               COALESCE(nc.birth_time, u.birth_time, '12:00') AS birth_time,
               COALESCE(nc.birth_place, u.birth_place) AS birth_place,
               nc.id AS chart_id
             FROM users u
             JOIN natal_charts nc ON nc.user_id = u.id
             WHERE COALESCE(nc.birth_date, u.birth_date) IS NOT NULL
               AND COALESCE(nc.birth_place, u.birth_place) IS NOT NULL
               AND (
                 nc.latitude IS NULL OR
                 nc.longitude IS NULL OR
                 nc.timezone IS NULL OR
                 nc.sun_sign IS NULL OR
                 nc.moon_sign IS NULL OR
                 nc.ascendant_sign IS NULL OR
                 nc.calculation_version IS DISTINCT FROM $1
               )
           ),
           missing_primary AS (
             SELECT
               u.id AS user_id,
               COALESCE(u.name, 'Chart') AS display_name,
               u.birth_date,
               COALESCE(u.birth_time, '12:00') AS birth_time,
               u.birth_place,
               NULL::bigint AS chart_id
             FROM users u
             WHERE u.birth_date IS NOT NULL
               AND u.birth_place IS NOT NULL
               AND NOT EXISTS (
                 SELECT 1 FROM natal_charts nc WHERE nc.user_id = u.id
               )
           )
           SELECT *
           FROM (
             SELECT * FROM incomplete_charts
             UNION ALL
             SELECT * FROM missing_primary
           ) candidates
           ORDER BY user_id ASC, chart_id ASC NULLS FIRST
           LIMIT $2`,
          [CANONICAL_NATAL_CALCULATION_VERSION, limit]
        );
        return result.rows.map((row: any) => ({
          userId: String(row.user_id),
          name: row.display_name || 'Chart',
          birthDate: row.birth_date ? normalizeBirthDateValue(row.birth_date) : '',
          birthTime: normalizeBirthTimeValue(row.birth_time || '12:00'),
          birthPlace: row.birth_place || '',
          chartId: row.chart_id ? Number(row.chart_id) : null,
        }));
      } catch (error: any) {
        log.error('[DB] Error listing canonical chart repair candidates', { error: error.message });
        throw error;
      }
    },
  },

  /** OpenAI cache - interpretations table */
  interpretations: {
    async supportsChartScope() {
      return supportsInterpretationsChartScope();
    },

    async _getLegacyUserScoped(userId: string, type: string, inputHash: string, primaryChartId?: number) {
      const id = toUserId(userId);
      if (!DATABASE_URL) return null;
      try {
        const dbPool = getPool();
        const supportsChartScope = await this.supportsChartScope();
        const result = supportsChartScope
          ? await dbPool.query(
              `SELECT content, created_at
               FROM interpretations
               WHERE user_id = $1
                 AND type = $2
                 AND input_hash = $3
                 AND (${primaryChartId != null ? 'chart_id IS NULL OR chart_id = $4' : 'chart_id IS NULL'})
               ORDER BY ${primaryChartId != null ? 'CASE WHEN chart_id = $4 THEN 0 ELSE 1 END,' : ''} created_at DESC
               LIMIT 1`,
              primaryChartId != null ? [id, type, inputHash, primaryChartId] : [id, type, inputHash]
            )
          : await dbPool.query(
              `SELECT content, created_at
               FROM interpretations
               WHERE user_id = $1 AND type = $2 AND input_hash = $3
               ORDER BY created_at DESC
               LIMIT 1`,
              [id, type, inputHash]
            );
        if (result.rows.length === 0) return null;
        return { content: result.rows[0].content, updatedAt: result.rows[0].created_at };
      } catch (error: any) {
        log.error('[DB] Error getting interpretation by user fallback', { error: error.message, userId, type, primaryChartId });
        throw error;
      }
    },

    /** Chart-level cache: natal_intro, deep_dive_*, daily_natal_card */
    async getByChart(chartId: number, type: string, inputHash: string) {
      if (!DATABASE_URL) return null;
      try {
        const supportsChartScope = await this.supportsChartScope();
        if (!supportsChartScope) {
          const chart = await db.natal_charts.getById(chartId);
          return chart?.user_id ? this._getLegacyUserScoped(String(chart.user_id), type, inputHash) : null;
        }

        const dbPool = getPool();
        const result = await dbPool.query(
          `SELECT content, created_at
           FROM interpretations
           WHERE chart_id = $1 AND type = $2 AND input_hash = $3
           ORDER BY created_at DESC
           LIMIT 1`,
          [chartId, type, inputHash]
        );
        if (result.rows.length === 0) return null;
        return { content: result.rows[0].content, updatedAt: result.rows[0].created_at };
      } catch (error: any) {
        log.error('[DB] Error getting interpretation by chart', { error: error.message, chartId, type });
        throw error;
      }
    },

    async setByChart(chartId: number, type: string, inputHash: string, content: string, ownerUserId?: string) {
      if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured');
      try {
        const supportsChartScope = await this.supportsChartScope();
        if (!supportsChartScope) {
          const chart = ownerUserId ? { user_id: ownerUserId } : await db.natal_charts.getById(chartId);
          if (!chart?.user_id) throw new Error('INTERPRETATION_OWNER_NOT_FOUND');
          return this.setByUser(String(chart.user_id), type, inputHash, content);
        }

        const dbPool = getPool();
        const ownerId = ownerUserId ? toUserId(ownerUserId) : null;
        const updated = ownerId
          ? await dbPool.query(
              `UPDATE interpretations
               SET content = $4, user_id = COALESCE(user_id, $5)
               WHERE chart_id = $1 AND type = $2 AND input_hash = $3`,
              [chartId, type, inputHash, content, ownerId]
            )
          : await dbPool.query(
              `UPDATE interpretations
               SET content = $4
               WHERE chart_id = $1 AND type = $2 AND input_hash = $3`,
              [chartId, type, inputHash, content]
            );

        if ((updated.rowCount ?? 0) === 0) {
          if (ownerId) {
            await dbPool.query(
              `INSERT INTO interpretations (user_id, chart_id, type, input_hash, content)
               VALUES ($1, $2, $3, $4, $5)`,
              [ownerId, chartId, type, inputHash, content]
            );
          } else {
            await dbPool.query(
              `INSERT INTO interpretations (chart_id, type, input_hash, content)
               VALUES ($1, $2, $3, $4)`,
              [chartId, type, inputHash, content]
            );
          }
        }
        return { success: true };
      } catch (error: any) {
        log.error('[DB] Error setting interpretation by chart', { error: error.message, chartId, type });
        throw error;
      }
    },

    /** User-level cache for non-chart scoped content */
    async getByUser(userId: string, type: string, inputHash: string) {
      return this._getLegacyUserScoped(userId, type, inputHash);
    },

    async setByUser(userId: string, type: string, inputHash: string, content: string) {
      const id = toUserId(userId);
      if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured');
      try {
        const dbPool = getPool();
        const supportsChartScope = await this.supportsChartScope();
        const updated = supportsChartScope
          ? await dbPool.query(
              `UPDATE interpretations
               SET content = $4
               WHERE user_id = $1 AND type = $2 AND input_hash = $3 AND chart_id IS NULL`,
              [id, type, inputHash, content]
            )
          : await dbPool.query(
              `UPDATE interpretations
               SET content = $4
               WHERE user_id = $1 AND type = $2 AND input_hash = $3`,
              [id, type, inputHash, content]
            );

        if ((updated.rowCount ?? 0) === 0) {
          await dbPool.query(
            `INSERT INTO interpretations (user_id, type, input_hash, content)
             VALUES ($1, $2, $3, $4)`,
            [id, type, inputHash, content]
          );
        }
        return { success: true };
      } catch (error: any) {
        log.error('[DB] Error setting interpretation by user', { error: error.message, userId, type });
        throw error;
      }
    },

    /** Resolve by chartId or userId (for chart-level types). Uses primary chart when chartId not provided. */
    async getByHash(chartIdOrUserId: number | string, type: string, inputHash: string) {
      if (typeof chartIdOrUserId === 'number') {
        return this.getByChart(chartIdOrUserId, type, inputHash);
      }

      const supportsChartScope = await this.supportsChartScope();
      const chart = supportsChartScope ? await db.natal_charts.getPrimary(chartIdOrUserId) : null;
      if (chart) {
        const chartScoped = await this.getByChart(chart.id, type, inputHash);
        if (chartScoped) return chartScoped;
      }

      return this._getLegacyUserScoped(chartIdOrUserId, type, inputHash, chart?.id);
    },

    async set(chartIdOrUserId: number | string, type: string, inputHash: string, content: string) {
      if (typeof chartIdOrUserId === 'number') {
        return this.setByChart(chartIdOrUserId, type, inputHash, content);
      }

      const supportsChartScope = await this.supportsChartScope();
      const chart = supportsChartScope ? await db.natal_charts.getPrimary(chartIdOrUserId) : null;
      if (chart) {
        try {
          return await this.setByChart(chart.id, type, inputHash, content, chartIdOrUserId);
        } catch (error: any) {
          log.warn('[DB] Falling back to user-scoped interpretation save', {
            userId: chartIdOrUserId,
            chartId: chart.id,
            type,
            error: error.message,
          });
        }
      }

      return this.setByUser(chartIdOrUserId, type, inputHash, content);
    },
  },

  /** Content architecture v1 - tiered interpretations */
  content_interpretations: {
    async deleteByChartId(chartId: number): Promise<number> {
      if (!DATABASE_URL) return 0;
      try {
        const result = await getPool().query(
          `DELETE FROM content_interpretations WHERE chart_id = $1`,
          [chartId]
        );
        return result.rowCount ?? 0;
      } catch (error: any) {
        log.error('[DB] Error deleting content interpretations for chart', {
          error: error.message,
          chartId,
        });
        throw error;
      }
    },

    async getByChart(
      chartId: number,
      accessTier: DbContentAccessTier,
      contentSurface: DbContentSurface,
      contentVariant: DbContentVariant,
      cacheKey = 'default'
    ) {
      if (!DATABASE_URL) return null;
      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          `SELECT *
           FROM content_interpretations
           WHERE chart_id = $1
             AND access_tier = $2
             AND content_surface = $3
             AND content_variant = $4
             AND cache_key = $5
             AND (valid_to IS NULL OR valid_to >= NOW())
           ORDER BY updated_at DESC
           LIMIT 1`,
          [chartId, accessTier, contentSurface, contentVariant, cacheKey]
        );
        return result.rows[0] ? mapContentInterpretationRow(result.rows[0]) : null;
      } catch (error: any) {
        log.error('[DB] Error getting content interpretation by chart', {
          error: error.message,
          chartId,
          accessTier,
          contentSurface,
          contentVariant,
          cacheKey,
        });
        throw error;
      }
    },

    async getByUser(
      userId: string,
      accessTier: DbContentAccessTier,
      contentSurface: DbContentSurface,
      contentVariant: DbContentVariant,
      cacheKey = 'default'
    ) {
      const id = toUserId(userId);
      if (!DATABASE_URL) return null;
      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          `SELECT *
           FROM content_interpretations
           WHERE user_id = $1
             AND access_tier = $2
             AND content_surface = $3
             AND content_variant = $4
             AND cache_key = $5
             AND chart_id IS NULL
             AND (valid_to IS NULL OR valid_to >= NOW())
           ORDER BY updated_at DESC
           LIMIT 1`,
          [id, accessTier, contentSurface, contentVariant, cacheKey]
        );
        return result.rows[0] ? mapContentInterpretationRow(result.rows[0]) : null;
      } catch (error: any) {
        log.error('[DB] Error getting content interpretation by user', {
          error: error.message,
          userId,
          accessTier,
          contentSurface,
          contentVariant,
          cacheKey,
        });
        throw error;
      }
    },

    async get(
      chartIdOrUserId: number | string,
      accessTier: DbContentAccessTier,
      contentSurface: DbContentSurface,
      contentVariant: DbContentVariant,
      cacheKey = 'default'
    ) {
      if (typeof chartIdOrUserId === 'number') {
        return this.getByChart(chartIdOrUserId, accessTier, contentSurface, contentVariant, cacheKey);
      }

      const primaryChart = await db.natal_charts.getPrimary(chartIdOrUserId);
      if (primaryChart) {
        const chartScoped = await this.getByChart(primaryChart.id, accessTier, contentSurface, contentVariant, cacheKey);
        if (chartScoped) return chartScoped;
      }

      return this.getByUser(chartIdOrUserId, accessTier, contentSurface, contentVariant, cacheKey);
    },

    async upsertByChart(
      chartId: number,
      data: {
        accessTier: DbContentAccessTier;
        contentSurface: DbContentSurface;
        contentVariant: DbContentVariant;
        cacheKey?: string;
        inputHash?: string | null;
        content: any;
        modelTier?: DbContentModelTier;
        promptVersion?: string | null;
        calculationVersion?: string | null;
        validFrom?: string | Date | null;
        validTo?: string | Date | null;
        isPersistent?: boolean;
        legacySource?: string | null;
      },
      ownerUserId?: string | null
    ) {
      if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured');
      const cacheKey = data.cacheKey || 'default';
      const payload = JSON.stringify(data.content);
      const ownerId = ownerUserId ? toUserId(ownerUserId) : null;
      try {
        const dbPool = getPool();
        const updated = await dbPool.query(
          `UPDATE content_interpretations
           SET user_id = COALESCE(user_id, $10),
               input_hash = $6,
               content = $7::jsonb,
               model_tier = $8,
               prompt_version = $11,
               calculation_version = $12,
               valid_from = $13,
               valid_to = $14,
               is_persistent = $15,
               legacy_source = $16,
               updated_at = CURRENT_TIMESTAMP
           WHERE chart_id = $1
             AND access_tier = $2
             AND content_surface = $3
             AND content_variant = $4
             AND cache_key = $5`,
          [
            chartId,
            data.accessTier,
            data.contentSurface,
            data.contentVariant,
            cacheKey,
            data.inputHash ?? null,
            payload,
            data.modelTier || 'base',
            ownerId,
            data.promptVersion ?? null,
            data.calculationVersion ?? null,
            data.validFrom ?? null,
            data.validTo ?? null,
            !!data.isPersistent,
            data.legacySource ?? null,
          ]
        );

        if ((updated.rowCount ?? 0) === 0) {
          await dbPool.query(
            `INSERT INTO content_interpretations
              (user_id, chart_id, access_tier, content_surface, content_variant, model_tier, cache_key, input_hash, content, prompt_version, calculation_version, valid_from, valid_to, is_persistent, legacy_source)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, $14, $15)`,
            [
              ownerId,
              chartId,
              data.accessTier,
              data.contentSurface,
              data.contentVariant,
              data.modelTier || 'base',
              cacheKey,
              data.inputHash ?? null,
              payload,
              data.promptVersion ?? null,
              data.calculationVersion ?? null,
              data.validFrom ?? null,
              data.validTo ?? null,
              !!data.isPersistent,
              data.legacySource ?? null,
            ]
          );
        }

        return this.getByChart(chartId, data.accessTier, data.contentSurface, data.contentVariant, cacheKey);
      } catch (error: any) {
        log.error('[DB] Error upserting content interpretation by chart', {
          error: error.message,
          chartId,
          accessTier: data.accessTier,
          contentSurface: data.contentSurface,
          contentVariant: data.contentVariant,
          cacheKey,
        });
        throw error;
      }
    },

    async upsertByUser(
      userId: string,
      data: {
        accessTier: DbContentAccessTier;
        contentSurface: DbContentSurface;
        contentVariant: DbContentVariant;
        cacheKey?: string;
        inputHash?: string | null;
        content: any;
        modelTier?: DbContentModelTier;
        promptVersion?: string | null;
        calculationVersion?: string | null;
        validFrom?: string | Date | null;
        validTo?: string | Date | null;
        isPersistent?: boolean;
        legacySource?: string | null;
      }
    ) {
      const id = toUserId(userId);
      if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured');
      const cacheKey = data.cacheKey || 'default';
      const payload = JSON.stringify(data.content);
      try {
        const dbPool = getPool();
        const updated = await dbPool.query(
          `UPDATE content_interpretations
           SET input_hash = $6,
               content = $7::jsonb,
               model_tier = $8,
               prompt_version = $9,
               calculation_version = $10,
               valid_from = $11,
               valid_to = $12,
               is_persistent = $13,
               legacy_source = $14,
               updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $1
             AND access_tier = $2
             AND content_surface = $3
             AND content_variant = $4
             AND cache_key = $5
             AND chart_id IS NULL`,
          [
            id,
            data.accessTier,
            data.contentSurface,
            data.contentVariant,
            cacheKey,
            data.inputHash ?? null,
            payload,
            data.modelTier || 'base',
            data.promptVersion ?? null,
            data.calculationVersion ?? null,
            data.validFrom ?? null,
            data.validTo ?? null,
            !!data.isPersistent,
            data.legacySource ?? null,
          ]
        );

        if ((updated.rowCount ?? 0) === 0) {
          await dbPool.query(
            `INSERT INTO content_interpretations
              (user_id, access_tier, content_surface, content_variant, model_tier, cache_key, input_hash, content, prompt_version, calculation_version, valid_from, valid_to, is_persistent, legacy_source)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13, $14)`,
            [
              id,
              data.accessTier,
              data.contentSurface,
              data.contentVariant,
              data.modelTier || 'base',
              cacheKey,
              data.inputHash ?? null,
              payload,
              data.promptVersion ?? null,
              data.calculationVersion ?? null,
              data.validFrom ?? null,
              data.validTo ?? null,
              !!data.isPersistent,
              data.legacySource ?? null,
            ]
          );
        }

        return this.getByUser(userId, data.accessTier, data.contentSurface, data.contentVariant, cacheKey);
      } catch (error: any) {
        log.error('[DB] Error upserting content interpretation by user', {
          error: error.message,
          userId,
          accessTier: data.accessTier,
          contentSurface: data.contentSurface,
          contentVariant: data.contentVariant,
          cacheKey,
        });
        throw error;
      }
    },
  },

  /** Content architecture v1 - unlock log and current access */
  content_unlocks: {
    async add(data: {
      userId: string;
      chartId?: number | null;
      accessTier: DbContentAccessTier;
      contentSurface: DbContentSurface;
      contentVariant: DbContentVariant;
      unlockType: DbContentUnlockType;
      cacheKey?: string;
      metadata?: Record<string, any> | null;
      expiresAt?: string | Date | null;
    }) {
      const userId = toUserId(data.userId);
      if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured');
      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          `INSERT INTO content_unlocks
            (user_id, chart_id, access_tier, content_surface, content_variant, unlock_type, cache_key, metadata, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
           RETURNING *`,
          [
            userId,
            data.chartId ?? null,
            data.accessTier,
            data.contentSurface,
            data.contentVariant,
            data.unlockType,
            data.cacheKey || 'default',
            JSON.stringify(data.metadata ?? null),
            data.expiresAt ?? null,
          ]
        );
        return result.rows[0] ? mapContentUnlockRow(result.rows[0]) : null;
      } catch (error: any) {
        log.error('[DB] Error adding content unlock', {
          error: error.message,
          userId: data.userId,
          accessTier: data.accessTier,
          contentSurface: data.contentSurface,
          contentVariant: data.contentVariant,
        });
        throw error;
      }
    },

    async getLatestActive(
      userId: string,
      filters: {
        accessTier?: DbContentAccessTier;
        contentSurface?: DbContentSurface;
        contentVariant?: DbContentVariant;
        chartId?: number | null;
        cacheKey?: string;
      } = {}
    ) {
      const id = toUserId(userId);
      if (!DATABASE_URL) return null;
      try {
        const dbPool = getPool();
        const params: any[] = [id];
        const clauses = [
          'user_id = $1',
          'revoked_at IS NULL',
          '(expires_at IS NULL OR expires_at > NOW())',
        ];

        if (filters.accessTier) {
          params.push(filters.accessTier);
          clauses.push(`access_tier = $${params.length}`);
        }
        if (filters.contentSurface) {
          params.push(filters.contentSurface);
          clauses.push(`content_surface = $${params.length}`);
        }
        if (filters.contentVariant) {
          params.push(filters.contentVariant);
          clauses.push(`content_variant = $${params.length}`);
        }
        if (filters.chartId != null) {
          params.push(filters.chartId);
          clauses.push(`chart_id = $${params.length}`);
        }
        if (filters.cacheKey) {
          params.push(filters.cacheKey);
          clauses.push(`cache_key = $${params.length}`);
        }

        const result = await dbPool.query(
          `SELECT *
           FROM content_unlocks
           WHERE ${clauses.join(' AND ')}
           ORDER BY unlocked_at DESC
           LIMIT 1`,
          params
        );
        return result.rows[0] ? mapContentUnlockRow(result.rows[0]) : null;
      } catch (error: any) {
        log.error('[DB] Error getting latest active content unlock', {
          error: error.message,
          userId,
          filters,
        });
        throw error;
      }
    },

    async getById(unlockId: number) {
      if (!DATABASE_URL) return null;
      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          'SELECT * FROM content_unlocks WHERE id = $1 LIMIT 1',
          [unlockId]
        );
        return result.rows[0] ? mapContentUnlockRow(result.rows[0]) : null;
      } catch (error: any) {
        log.error('[DB] Error getting content unlock by id', { error: error.message, unlockId });
        throw error;
      }
    },

    async hasAccess(userId: string, filters: {
      accessTier: DbContentAccessTier;
      contentSurface: DbContentSurface;
      contentVariant: DbContentVariant;
      chartId?: number | null;
      cacheKey?: string;
    }) {
      if (filters.accessTier === 'free') return true;
      if (filters.accessTier === 'premium') {
        return !!(await db.premium_entitlements.getActive(userId));
      }
      return !!(await this.getLatestActive(userId, filters));
    },

    async listActive(userId: string, chartId?: number | null) {
      const id = toUserId(userId);
      if (!DATABASE_URL) return [];
      try {
        const dbPool = getPool();
        const params: any[] = [id];
        const clauses = [
          'user_id = $1',
          'revoked_at IS NULL',
          '(expires_at IS NULL OR expires_at > NOW())',
        ];

        if (chartId != null) {
          params.push(chartId);
          clauses.push(`(chart_id IS NULL OR chart_id = $${params.length})`);
        }

        const result = await dbPool.query(
          `SELECT *
           FROM content_unlocks
           WHERE ${clauses.join(' AND ')}
           ORDER BY unlocked_at DESC`,
          params
        );
        return result.rows.map(mapContentUnlockRow);
      } catch (error: any) {
        log.error('[DB] Error listing active content unlocks', {
          error: error.message,
          userId,
          chartId,
        });
        throw error;
      }
    },
  },

  /** Content architecture v1 - premium periods */
  premium_entitlements: {
    async syncFromUsersTable(userId: string) {
      const user = await db.users.get(userId);
      if (!user?.premium_until || !DATABASE_URL) return null;

      const endsAt = new Date(user.premium_until);
      if (Number.isNaN(endsAt.getTime())) return null;

      const dbPool = getPool();
      const existing = await dbPool.query(
        `SELECT *
         FROM premium_entitlements
         WHERE user_id = $1
           AND tier_name = 'premium'
           AND ends_at = $2
           AND source = 'users.premium_until'
         LIMIT 1`,
        [toUserId(userId), endsAt.toISOString()]
      );
      if (existing.rows[0]) {
        return mapPremiumEntitlementRow(existing.rows[0]);
      }

      const inserted = await dbPool.query(
        `INSERT INTO premium_entitlements (user_id, tier_name, status, source, starts_at, ends_at, metadata)
         VALUES ($1, 'premium', $2, 'users.premium_until', $3, $4, $5::jsonb)
         RETURNING *`,
        [
          toUserId(userId),
          endsAt.getTime() > Date.now() ? 'active' : 'expired',
          user.created_at || new Date().toISOString(),
          endsAt.toISOString(),
          JSON.stringify({ syncedFromUsersTable: true }),
        ]
      );
      return inserted.rows[0] ? mapPremiumEntitlementRow(inserted.rows[0]) : null;
    },

    async getActive(userId: string) {
      const id = toUserId(userId);
      if (!DATABASE_URL) return null;
      try {
        const dbPool = getPool();
        await dbPool.query(
          `UPDATE premium_entitlements
           SET status = 'expired', updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $1 AND status = 'active' AND ends_at <= NOW()`,
          [id]
        );

        await this.syncFromUsersTable(userId);

        const result = await dbPool.query(
          `SELECT *
           FROM premium_entitlements
           WHERE user_id = $1
             AND status = 'active'
             AND ends_at > NOW()
           ORDER BY ends_at DESC
           LIMIT 1`,
          [id]
        );
        return result.rows[0] ? mapPremiumEntitlementRow(result.rows[0]) : null;
      } catch (error: any) {
        log.error('[DB] Error getting active premium entitlement', { error: error.message, userId });
        throw error;
      }
    },
  },

  /** star_payments - idempotency for Telegram Stars premium purchases */
  star_payments: {
    async exists(telegramPaymentChargeId: string): Promise<boolean> {
      const row = await this.getByChargeId(telegramPaymentChargeId);
      return !!row;
    },

    async getByChargeId(telegramPaymentChargeId: string) {
      if (!DATABASE_URL) return null;
      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          `SELECT *
           FROM star_payments
           WHERE telegram_payment_charge_id = $1
           LIMIT 1`,
          [telegramPaymentChargeId]
        );
        return result.rows[0] ? mapStarPaymentRow(result.rows[0]) : null;
      } catch (error: any) {
        log.error('[DB] Error getting star payment by charge id', { error: error.message });
        throw error;
      }
    },

    /** Returns true if inserted, false if duplicate (UNIQUE constraint). DB-level idempotency. */
    async recordFromWebhook(data: {
      telegramPaymentChargeId: string;
      userId: string;
      starsAmount: number;
      paymentType?: string | null;
      contentSurface?: string | null;
      contentVariant?: string | null;
      chartId?: number | null;
      cacheKey?: string | null;
      payloadJson?: Record<string, unknown>;
      status?: string;
    }): Promise<{ inserted: boolean; row: ReturnType<typeof mapStarPaymentRow> | null }> {
      const id = toUserId(data.userId);
      if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured');
      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          `INSERT INTO star_payments (
             telegram_payment_charge_id,
             user_id,
             stars_amount,
             payment_type,
             content_surface,
             content_variant,
             chart_id,
             cache_key,
             payload_json,
             status
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)
           ON CONFLICT (telegram_payment_charge_id) DO NOTHING
           RETURNING *`,
          [
            data.telegramPaymentChargeId,
            id,
            data.starsAmount,
            data.paymentType ?? null,
            data.contentSurface ?? null,
            data.contentVariant ?? null,
            data.chartId ?? null,
            data.cacheKey ?? null,
            JSON.stringify(data.payloadJson ?? {}),
            data.status ?? 'confirmed',
          ]
        );

        if (result.rows[0]) {
          return { inserted: true, row: mapStarPaymentRow(result.rows[0]) };
        }

        const existing = await this.getByChargeId(data.telegramPaymentChargeId);
        return { inserted: false, row: existing };
      } catch (error: any) {
        log.error('[DB] Error recording star payment', { error: error.message, userId: data.userId });
        throw error;
      }
    },

    /** @deprecated Use recordFromWebhook from Telegram webhook only. */
    async record(telegramPaymentChargeId: string, userId: string, starsAmount: number): Promise<boolean> {
      const result = await this.recordFromWebhook({
        telegramPaymentChargeId,
        userId,
        starsAmount,
        paymentType: 'premium_week',
        payloadJson: {},
        status: 'confirmed',
      });
      return result.inserted;
    },

    async markConsumed(paymentId: number, unlockId: number): Promise<boolean> {
      if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured');
      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          `UPDATE star_payments
           SET consumed_at = COALESCE(consumed_at, NOW()),
               consumed_by_unlock_id = COALESCE(consumed_by_unlock_id, $2),
               status = CASE WHEN status = 'confirmed' THEN 'consumed' ELSE status END
           WHERE id = $1
             AND (status = 'confirmed' OR consumed_by_unlock_id = $2)
           RETURNING id`,
          [paymentId, unlockId]
        );
        return result.rowCount !== null && result.rowCount > 0;
      } catch (error: any) {
        log.error('[DB] Error marking star payment consumed', { error: error.message, paymentId, unlockId });
        throw error;
      }
    },

    async getLatestByUser(userId: string) {
      const id = toUserId(userId);
      if (!DATABASE_URL) return null;
      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          `SELECT telegram_payment_charge_id, user_id, stars_amount, created_at
           FROM star_payments
           WHERE user_id = $1
           ORDER BY created_at DESC
           LIMIT 1`,
          [id]
        );
        return result.rows[0] || null;
      } catch (error: any) {
        log.error('[DB] Error getting latest star payment', { error: error.message, userId });
        throw error;
      }
    },

    async findConfirmedUnconsumedForPayload(options: {
      userId: string;
      paymentType: string;
      contentSurface: string;
      contentVariant: string;
      starsAmount: number;
      nonce: string;
      cacheKey?: string | null;
    }) {
      const id = toUserId(options.userId);
      const nonce = String(options.nonce || '').trim();
      if (!nonce) return null;
      if (!DATABASE_URL) return null;
      const cacheKey = options.cacheKey != null && String(options.cacheKey).trim()
        ? String(options.cacheKey).trim()
        : null;
      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          `SELECT *
           FROM star_payments
           WHERE user_id = $1
             AND status = 'confirmed'
             AND consumed_at IS NULL
             AND stars_amount = $2
             AND payment_type = $3
             AND content_surface = $4
             AND content_variant = $5
             AND (
               payload_json->>'n' = $6
               OR payload_json->>'nonce' = $6
             )
             AND ($7::text IS NULL OR cache_key IS NULL OR cache_key = $7)
           ORDER BY created_at DESC
           LIMIT 1`,
          [
            id,
            options.starsAmount,
            options.paymentType,
            options.contentSurface,
            options.contentVariant,
            nonce,
            cacheKey,
          ]
        );
        return result.rows[0] ? mapStarPaymentRow(result.rows[0]) : null;
      } catch (error: any) {
        log.error('[DB] Error finding star payment by payload', {
          error: error.message,
          userId: options.userId,
        });
        throw error;
      }
    },
  },


  /** daily_horoscopes - general by zodiac sign */
  daily_horoscopes: {
    async get(zodiacSign: string, date: string) {
      if (!DATABASE_URL) return null;
      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          `SELECT content FROM daily_horoscopes WHERE zodiac_sign = $1 AND date = $2`,
          [zodiacSign, date]
        );
        return result.rows.length === 0 ? null : result.rows[0].content;
      } catch (error: any) {
        log.error('[DB] Error getting daily horoscope', { error: error.message, zodiacSign, date });
        throw error;
      }
    },

    async set(zodiacSign: string, date: string, content: string) {
      if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured');
      try {
        const dbPool = getPool();
        await dbPool.query(
          `INSERT INTO daily_horoscopes (zodiac_sign, date, content) VALUES ($1, $2, $3)
           ON CONFLICT (zodiac_sign, date) DO UPDATE SET content = EXCLUDED.content`,
          [zodiacSign, date, content]
        );
        return { success: true };
      } catch (error: any) {
        log.error('[DB] Error setting daily horoscope', { error: error.message, zodiacSign, date });
        throw error;
      }
    },
  },

  /** horoscope_reactions - one daily reaction per user/sign/date */
  horoscope_reactions: {
    _emptySummary(userReaction: DbHoroscopeReactionKey | null = null) {
      const keys: DbHoroscopeReactionKey[] = ['spot_on', 'funny', 'gentle', 'not_mine'];
      return {
        userReaction,
        counts: keys.map((key) => ({ key, label: key, count: 0 })),
        total: 0,
      };
    },

    async getSummary(userId: string, zodiacSign: string, date: string) {
      const id = toUserId(userId);
      const sign = String(zodiacSign || '').trim();
      if (!DATABASE_URL) return this._emptySummary();

      try {
        const dbPool = getPool();
        const [countsResult, ownResult] = await Promise.all([
          dbPool.query(
            `SELECT reaction_key, COUNT(*)::int AS count
             FROM horoscope_reactions
             WHERE zodiac_sign = $1 AND reaction_date = $2::date
             GROUP BY reaction_key`,
            [sign, date]
          ),
          dbPool.query(
            `SELECT reaction_key
             FROM horoscope_reactions
             WHERE user_id = $1 AND zodiac_sign = $2 AND reaction_date = $3::date
             LIMIT 1`,
            [id, sign, date]
          ),
        ]);

        const summary = this._emptySummary((ownResult.rows[0]?.reaction_key ?? null) as DbHoroscopeReactionKey | null);
        const countMap = new Map(countsResult.rows.map((row: any) => [String(row.reaction_key), Number(row.count ?? 0)]));
        summary.counts = summary.counts.map((item) => ({
          ...item,
          count: countMap.get(item.key) ?? 0,
        }));
        summary.total = summary.counts.reduce((sum, item) => sum + item.count, 0);
        return summary;
      } catch (error: any) {
        log.error('[DB] Error getting horoscope reactions summary', { error: error.message, userId, zodiacSign, date });
        throw error;
      }
    },

    async set(userId: string, zodiacSign: string, date: string, reactionKey: DbHoroscopeReactionKey) {
      const id = toUserId(userId);
      const sign = String(zodiacSign || '').trim();
      if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured');

      try {
        const dbPool = getPool();
        await dbPool.query(
          `INSERT INTO horoscope_reactions (user_id, zodiac_sign, reaction_date, reaction_key)
           VALUES ($1, $2, $3::date, $4)
           ON CONFLICT (user_id, zodiac_sign, reaction_date)
           DO UPDATE SET reaction_key = EXCLUDED.reaction_key, updated_at = CURRENT_TIMESTAMP`,
          [id, sign, date, reactionKey]
        );
        return this.getSummary(userId, sign, date);
      } catch (error: any) {
        log.error('[DB] Error setting horoscope reaction', {
          error: error.message,
          userId,
          zodiacSign,
          date,
          reactionKey,
        });
        throw error;
      }
    },

    /** Снять реакцию (тоггл лайка off) — удаляет строку пользователя. */
    async unset(userId: string, zodiacSign: string, date: string) {
      const id = toUserId(userId);
      const sign = String(zodiacSign || '').trim();
      if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured');

      try {
        const dbPool = getPool();
        await dbPool.query(
          `DELETE FROM horoscope_reactions
           WHERE user_id = $1 AND zodiac_sign = $2 AND reaction_date = $3::date`,
          [id, sign, date]
        );
        return this.getSummary(userId, sign, date);
      } catch (error: any) {
        log.error('[DB] Error unsetting horoscope reaction', { error: error.message, userId, zodiacSign, date });
        throw error;
      }
    },
  },

  /** horoscope_engagement - aggregate views/reposts per user/sign/date (deduped per user) */
  horoscope_engagement: {
    _empty(reposted = false) {
      return { views: 0, reposts: 0, reposted };
    },

    async getSummary(userId: string, zodiacSign: string, date: string) {
      const id = toUserId(userId);
      const sign = String(zodiacSign || '').trim();
      if (!DATABASE_URL) return this._empty();

      try {
        const dbPool = getPool();
        const [countsResult, ownResult] = await Promise.all([
          dbPool.query(
            `SELECT
               COUNT(*) FILTER (WHERE viewed_at IS NOT NULL)::int AS views,
               COUNT(*) FILTER (WHERE reposted_at IS NOT NULL)::int AS reposts
             FROM horoscope_engagement
             WHERE zodiac_sign = $1 AND engagement_date = $2::date`,
            [sign, date]
          ),
          dbPool.query(
            `SELECT reposted_at
             FROM horoscope_engagement
             WHERE user_id = $1 AND zodiac_sign = $2 AND engagement_date = $3::date
             LIMIT 1`,
            [id, sign, date]
          ),
        ]);

        return {
          views: Number(countsResult.rows[0]?.views ?? 0),
          reposts: Number(countsResult.rows[0]?.reposts ?? 0),
          reposted: !!ownResult.rows[0]?.reposted_at,
        };
      } catch (error: any) {
        log.error('[DB] Error getting horoscope engagement summary', { error: error.message, userId, zodiacSign, date });
        throw error;
      }
    },

    async markViewed(userId: string, zodiacSign: string, date: string) {
      const id = toUserId(userId);
      const sign = String(zodiacSign || '').trim();
      if (!DATABASE_URL) return this._empty();

      try {
        const dbPool = getPool();
        await dbPool.query(
          `INSERT INTO horoscope_engagement (user_id, zodiac_sign, engagement_date, viewed_at)
           VALUES ($1, $2, $3::date, CURRENT_TIMESTAMP)
           ON CONFLICT (user_id, zodiac_sign, engagement_date)
           DO UPDATE SET viewed_at = COALESCE(horoscope_engagement.viewed_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP`,
          [id, sign, date]
        );
        return this.getSummary(userId, sign, date);
      } catch (error: any) {
        log.error('[DB] Error marking horoscope view', { error: error.message, userId, zodiacSign, date });
        throw error;
      }
    },

    async markReposted(userId: string, zodiacSign: string, date: string) {
      const id = toUserId(userId);
      const sign = String(zodiacSign || '').trim();
      if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured');

      try {
        const dbPool = getPool();
        await dbPool.query(
          `INSERT INTO horoscope_engagement (user_id, zodiac_sign, engagement_date, viewed_at, reposted_at)
           VALUES ($1, $2, $3::date, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON CONFLICT (user_id, zodiac_sign, engagement_date)
           DO UPDATE SET reposted_at = COALESCE(horoscope_engagement.reposted_at, CURRENT_TIMESTAMP),
                         viewed_at = COALESCE(horoscope_engagement.viewed_at, CURRENT_TIMESTAMP),
                         updated_at = CURRENT_TIMESTAMP`,
          [id, sign, date]
        );
        return this.getSummary(userId, sign, date);
      } catch (error: any) {
        log.error('[DB] Error marking horoscope repost', { error: error.message, userId, zodiacSign, date });
        throw error;
      }
    },
  },

  /** daily_checkins - evening feedback loop for personal day calibration */
  daily_checkins: {
    async getForDate(userId: string, chartId: number | null, date: string) {
      const id = toUserId(userId);
      if (!DATABASE_URL) return null;
      try {
        const dbPool = getPool();
        const result = chartId != null
          ? await dbPool.query(
              `SELECT *
               FROM daily_checkins
               WHERE user_id = $1 AND chart_id = $2 AND checkin_date = $3::date
               LIMIT 1`,
              [id, chartId, date]
            )
          : await dbPool.query(
              `SELECT *
               FROM daily_checkins
               WHERE user_id = $1 AND chart_id IS NULL AND checkin_date = $2::date
               LIMIT 1`,
              [id, date]
            );
        return result.rows[0] ? mapDailyCheckInRow(result.rows[0]) : null;
      } catch (error: any) {
        log.error('[DB] Error getting daily check-in', { error: error.message, userId, chartId, date });
        throw error;
      }
    },

    async listRecent(userId: string, chartId: number | null, limit = 30) {
      const id = toUserId(userId);
      if (!DATABASE_URL) return [];
      try {
        const dbPool = getPool();
        const cappedLimit = Math.max(1, Math.min(90, Math.floor(limit)));
        const result = chartId != null
          ? await dbPool.query(
              `SELECT *
               FROM daily_checkins
               WHERE user_id = $1 AND chart_id = $2
               ORDER BY checkin_date DESC
               LIMIT $3`,
              [id, chartId, cappedLimit]
            )
          : await dbPool.query(
              `SELECT *
               FROM daily_checkins
               WHERE user_id = $1
               ORDER BY checkin_date DESC
               LIMIT $2`,
              [id, cappedLimit]
            );
        return result.rows.map(mapDailyCheckInRow);
      } catch (error: any) {
        log.error('[DB] Error listing recent daily check-ins', { error: error.message, userId, chartId });
        throw error;
      }
    },

    async upsert(
      userId: string,
      chartId: number | null,
      date: string,
      timezone: string,
      input: DailyCheckInInput,
      pulse: {
        time: string;
        phase: DailyAstroSignalPhase;
        score: number;
        layers: DailyAstroSignalLayers;
      }
    ) {
      const id = toUserId(userId);
      if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured');
      try {
        const dbPool = getPool();
        const params = [
          id,
          chartId,
          date,
          timezone || 'Europe/Moscow',
          input.focus,
          input.mood,
          input.people,
          input.forecastFit,
          pulse.time,
          pulse.phase,
          pulse.score,
          JSON.stringify(pulse.layers),
        ];
        const result = chartId != null
          ? await dbPool.query(
              `INSERT INTO daily_checkins
                (user_id, chart_id, checkin_date, timezone, focus_key, mood_key, people_key, forecast_fit_key, pulse_time, pulse_phase, pulse_score, pulse_layers)
               VALUES ($1, $2, $3::date, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
               ON CONFLICT (user_id, chart_id, checkin_date) WHERE chart_id IS NOT NULL
               DO UPDATE SET
                 timezone = EXCLUDED.timezone,
                 focus_key = EXCLUDED.focus_key,
                 mood_key = EXCLUDED.mood_key,
                 people_key = EXCLUDED.people_key,
                 forecast_fit_key = EXCLUDED.forecast_fit_key,
                 pulse_time = EXCLUDED.pulse_time,
                 pulse_phase = EXCLUDED.pulse_phase,
                 pulse_score = EXCLUDED.pulse_score,
                 pulse_layers = EXCLUDED.pulse_layers,
                 updated_at = CURRENT_TIMESTAMP
               RETURNING *`,
              params
            )
          : await dbPool.query(
              `INSERT INTO daily_checkins
                (user_id, chart_id, checkin_date, timezone, focus_key, mood_key, people_key, forecast_fit_key, pulse_time, pulse_phase, pulse_score, pulse_layers)
               VALUES ($1, NULL, $3::date, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
               ON CONFLICT (user_id, checkin_date) WHERE chart_id IS NULL
               DO UPDATE SET
                 timezone = EXCLUDED.timezone,
                 focus_key = EXCLUDED.focus_key,
                 mood_key = EXCLUDED.mood_key,
                 people_key = EXCLUDED.people_key,
                 forecast_fit_key = EXCLUDED.forecast_fit_key,
                 pulse_time = EXCLUDED.pulse_time,
                 pulse_phase = EXCLUDED.pulse_phase,
                 pulse_score = EXCLUDED.pulse_score,
                 pulse_layers = EXCLUDED.pulse_layers,
                 updated_at = CURRENT_TIMESTAMP
               RETURNING *`,
              params
            );
        return mapDailyCheckInRow(result.rows[0]);
      } catch (error: any) {
        log.error('[DB] Error upserting daily check-in', { error: error.message, userId, chartId, date });
        throw error;
      }
    },
  },

  /** personal_pattern_insights - cached pattern cards derived from check-ins */
  personal_pattern_insights: {
    async upsertMany(userId: string, chartId: number | null, insights: PersonalPatternInsight[]) {
      const id = toUserId(userId);
      if (!DATABASE_URL || insights.length === 0) return [];
      try {
        const dbPool = getPool();
        const saved: PersonalPatternInsight[] = [];
        for (const insight of insights) {
          const params = [
            id,
            chartId,
            insight.id,
            insight.windowDays,
            JSON.stringify(insight),
          ];
          const result = chartId != null
            ? await dbPool.query(
                `INSERT INTO personal_pattern_insights (user_id, chart_id, insight_key, window_days, insight)
                 VALUES ($1, $2, $3, $4, $5::jsonb)
                 ON CONFLICT (user_id, chart_id, insight_key) WHERE chart_id IS NOT NULL
                 DO UPDATE SET window_days = EXCLUDED.window_days, insight = EXCLUDED.insight, updated_at = CURRENT_TIMESTAMP
                 RETURNING insight`,
                params
              )
            : await dbPool.query(
                `INSERT INTO personal_pattern_insights (user_id, chart_id, insight_key, window_days, insight)
                 VALUES ($1, NULL, $3, $4, $5::jsonb)
                 ON CONFLICT (user_id, insight_key) WHERE chart_id IS NULL
                 DO UPDATE SET window_days = EXCLUDED.window_days, insight = EXCLUDED.insight, updated_at = CURRENT_TIMESTAMP
                 RETURNING insight`,
                params
              );
          saved.push(normalizeJsonColumn<PersonalPatternInsight>(result.rows[0]?.insight));
        }
        return saved.filter(Boolean);
      } catch (error: any) {
        log.error('[DB] Error upserting personal pattern insights', { error: error.message, userId, chartId });
        throw error;
      }
    },
  },

  /** daily_natal_cards - personal daily card per chart */
  daily_natal_cards: {
    async supportsChartScope() {
      return supportsDailyNatalCardsChartScope();
    },

    async getByChart(chartId: number, date: string) {
      if (!DATABASE_URL) return null;
      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          `SELECT content FROM daily_natal_cards WHERE chart_id = $1 AND date = $2`,
          [chartId, date]
        );
        if (result.rows.length === 0) return null;
        const c = result.rows[0].content;
        return typeof c === 'string' ? JSON.parse(c) : c;
      } catch (error: any) {
        log.error('[DB] Error getting daily natal card by chart', { error: error.message, chartId, date });
        throw error;
      }
    },

    async setByChart(chartId: number, date: string, content: any) {
      if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured');
      try {
        const dbPool = getPool();
        const payload = typeof content === 'string' ? content : JSON.stringify(content);
        // Partial unique index idx_daily_natal_cards_chart_date uses WHERE chart_id IS NOT NULL —
        // ON CONFLICT must repeat that predicate or PostgreSQL rejects the upsert.
        // user_id comes from the chart row because legacy schema has NOT NULL on user_id.
        const result = await dbPool.query(
          `INSERT INTO daily_natal_cards (user_id, chart_id, date, content)
           SELECT nc.user_id, $1::bigint, $2::date, $3
           FROM natal_charts nc WHERE nc.id = $1::bigint
           ON CONFLICT (chart_id, date) WHERE chart_id IS NOT NULL
           DO UPDATE SET content = EXCLUDED.content`,
          [chartId, date, payload]
        );
        if (result.rowCount === 0) {
          throw new Error('No natal chart row for chart_id; cannot save daily natal card');
        }
        return { success: true };
      } catch (error: any) {
        log.error('[DB] Error setting daily natal card by chart', { error: error.message, chartId, date });
        throw error;
      }
    },

    /** Legacy: resolve via primary chart */
    async get(userId: string, date: string) {
      const chart = await db.natal_charts.getPrimary(userId);
      if (!chart) return null;
      return this.getByChart(chart.id, date);
    },

    async set(userId: string, date: string, content: any) {
      const chart = await db.natal_charts.getPrimary(userId);
      if (!chart) throw new Error('No primary chart for user');
      return this.setByChart(chart.id, date, content);
    },

    async getForPrimaryUser(userId: string, date: string) {
      const supportsChartScope = await this.supportsChartScope();
      if (!supportsChartScope) {
        return this.get(userId, date);
      }

      const chart = await db.natal_charts.getPrimary(userId);
      if (!chart) return null;
      return this.getByChart(chart.id, date);
    },

    async setForPrimaryUser(userId: string, date: string, content: any) {
      const supportsChartScope = await this.supportsChartScope();
      if (!supportsChartScope) {
        return this.set(userId, date, content);
      }

      const chart = await db.natal_charts.getPrimary(userId);
      if (!chart) {
        throw new Error('No primary chart for user');
      }
      return this.setByChart(chart.id, date, content);
    },
  },

  /** synastry_cache - AI cache for synastry (chart1_id < chart2_id) */
  synastry: {
    _normalize(chartA: number, chartB: number): [number, number] {
      const chart1 = Math.min(chartA, chartB);
      const chart2 = Math.max(chartA, chartB);
      return [chart1, chart2];
    },

    async get(chartA: number, chartB: number, mode: string, inputHash: string) {
      if (!DATABASE_URL) return null;
      const [chart1, chart2] = this._normalize(chartA, chartB);
      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          `SELECT content FROM synastry_cache WHERE chart1_id = $1 AND chart2_id = $2 AND mode = $3 AND input_hash = $4`,
          [chart1, chart2, mode, inputHash]
        );
        if (result.rows.length === 0) return null;
        return result.rows[0].content;
      } catch (error: any) {
        log.error('[DB] Error getting synastry', { error: error.message, chart1, chart2 });
        throw error;
      }
    },

    async set(chartA: number, chartB: number, mode: string, inputHash: string, content: any) {
      if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured');
      const [chart1, chart2] = this._normalize(chartA, chartB);
      try {
        const dbPool = getPool();
        await dbPool.query(
          `INSERT INTO synastry_cache (chart1_id, chart2_id, mode, input_hash, content)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (chart1_id, chart2_id, mode, input_hash) DO UPDATE SET content = EXCLUDED.content`,
          [chart1, chart2, mode, inputHash, typeof content === 'string' ? content : JSON.stringify(content)]
        );
        return { success: true };
      } catch (error: any) {
        log.error('[DB] Error setting synastry', { error: error.message, chart1, chart2 });
        throw error;
      }
    },

    async listRecentForUser(userId: string, chartId: number | null, limit = 3) {
      const id = toUserId(userId);
      if (!DATABASE_URL) return [];
      try {
        const dbPool = getPool();
        const cappedLimit = Math.max(1, Math.min(10, Math.floor(limit)));
        const result = chartId != null
          ? await dbPool.query(
              `SELECT content, cache_key, updated_at, created_at
               FROM content_interpretations
               WHERE user_id = $1
                 AND content_surface = 'synastry'
                 AND (chart_id = $2 OR chart_id IS NULL)
               ORDER BY updated_at DESC
               LIMIT $3`,
              [id, chartId, cappedLimit]
            )
          : await dbPool.query(
              `SELECT content, cache_key, updated_at, created_at
               FROM content_interpretations
               WHERE user_id = $1
                 AND content_surface = 'synastry'
               ORDER BY updated_at DESC
               LIMIT $2`,
              [id, cappedLimit]
            );
        return result.rows.map((row: any) => ({
          ...row,
          content: normalizeJsonColumn(row.content),
        }));
      } catch (error: any) {
        log.error('[DB] Error listing recent synastry context', { error: error.message, userId, chartId });
        throw error;
      }
    },
  },

  user_sessions: {
    async upsert(userId: string, sessionId: string, options?: { telegramPlatform?: string | null; userAgent?: string | null }) {
      const id = toUserId(userId);
      const safeSessionId = trimText(sessionId, 128);
      if (!safeSessionId) {
        throw new Error('SESSION_ID_REQUIRED');
      }
      if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured');

      const telegramPlatform = trimText(options?.telegramPlatform, 64);
      const userAgent = trimText(options?.userAgent, 1000);
      const deviceLabel = detectDeviceLabel(telegramPlatform, userAgent);

      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          `INSERT INTO user_sessions (session_id, user_id, telegram_platform, device_label, user_agent)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (session_id, user_id) DO UPDATE SET
             telegram_platform = COALESCE(EXCLUDED.telegram_platform, user_sessions.telegram_platform),
             device_label = COALESCE(EXCLUDED.device_label, user_sessions.device_label),
             user_agent = COALESCE(EXCLUDED.user_agent, user_sessions.user_agent),
             last_seen_at = CURRENT_TIMESTAMP
           RETURNING session_id, user_id, telegram_platform, device_label, user_agent, started_at, last_seen_at`,
          [safeSessionId, id, telegramPlatform, deviceLabel, userAgent]
        );

        return result.rows[0] || null;
      } catch (error: any) {
        log.error('[DB] Error upserting user session', { error: error.message, userId });
        throw error;
      }
    },

    async getRecentByUser(userId: string, limit = 10) {
      const id = toUserId(userId);
      if (!DATABASE_URL) return [];
      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          `SELECT session_id, telegram_platform, device_label, user_agent, started_at, last_seen_at
           FROM user_sessions
           WHERE user_id = $1
           ORDER BY last_seen_at DESC
           LIMIT $2`,
          [id, limit]
        );
        return result.rows;
      } catch (error: any) {
        log.error('[DB] Error getting recent sessions', { error: error.message, userId });
        throw error;
      }
    },
  },

  admin: {
    async listUsers(options?: {
      q?: string;
      premium?: AdminDbPremiumFilter;
      segment?: AdminDbUserSegment;
      page?: number;
      pageSize?: number;
      sortBy?: AdminDbUserSortBy;
      sortOrder?: AdminDbSortOrder;
      limit?: number;
    }) {
      if (!DATABASE_URL) {
        return {
          users: [],
          pagination: { page: 1, pageSize: 25, total: 0, totalPages: 1 },
        };
      }

      const queryText = (options?.q || '').trim();
      const premium = options?.premium || 'all';
      const segment = options?.segment || 'all';
      const pageSize = Math.min(Math.max(options?.pageSize || options?.limit || 25, 1), 100);
      const page = Math.max(options?.page || 1, 1);
      const offset = (page - 1) * pageSize;
      const sortBy = options?.sortBy || 'last_seen';
      const sortOrder = options?.sortOrder || 'desc';
      const like = `%${queryText}%`;
      const orderBySql = getAdminUserSortSql(sortBy, sortOrder);

      try {
        const dbPool = getPool();
        const [countResult, usersResult] = await Promise.all([
          dbPool.query(
            `${ADMIN_USER_METRICS_CTE}
             SELECT COUNT(*)::int AS total
             FROM user_metrics
             WHERE
               ($1 = '' OR COALESCE(name, '') ILIKE $2 OR CAST(id AS TEXT) ILIKE $2)
               AND ${getAdminPremiumFilterSql(3)}
               AND ${getAdminUserSegmentSql(4)}`,
            [queryText, like, premium, segment]
          ),
          dbPool.query(
            `${ADMIN_USER_METRICS_CTE}
             SELECT *
             FROM user_metrics
             WHERE
               ($1 = '' OR COALESCE(name, '') ILIKE $2 OR CAST(id AS TEXT) ILIKE $2)
               AND ${getAdminPremiumFilterSql(3)}
               AND ${getAdminUserSegmentSql(4)}
             ORDER BY ${orderBySql}
             LIMIT $5
             OFFSET $6`,
            [queryText, like, premium, segment, pageSize, offset]
          ),
        ]);

        const total = Number(countResult.rows[0]?.total || 0);
        return {
          users: usersResult.rows.map((row: any) => ({
            id: String(row.id),
            name: row.name || 'Unnamed user',
            premium_until: row.premium_until,
            is_premium: !!(row.premium_until && new Date(row.premium_until) > new Date()),
            login_streak: row.login_streak ?? 0,
            chart_slots: row.chart_slots ?? 1,
            saved_charts_count: row.saved_charts_count ?? 0,
            birth_date: row.birth_date ?? null,
            created_at: row.created_at,
            last_login: row.last_login,
            last_seen_at: row.last_seen_at ?? row.last_login ?? null,
            is_admin: row.is_admin ?? false,
            is_blocked: row.is_blocked ?? false,
          })),
          pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.max(1, Math.ceil(total / pageSize)),
          },
        };
      } catch (error: any) {
        log.error('[DB] Error listing admin users', { error: error.message });
        throw error;
      }
    },

    async getUsersOverview() {
      if (!DATABASE_URL) {
        return {
          total_users: 0,
          active_premium_users: 0,
          active_users_7d: 0,
          need_attention_users: 0,
          users_without_birth_data: 0,
        };
      }

      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          `${ADMIN_USER_METRICS_CTE}
           SELECT
             COUNT(*)::int AS total_users,
             COUNT(*) FILTER (WHERE premium_until IS NOT NULL AND premium_until > NOW())::int AS active_premium_users,
             COUNT(*) FILTER (WHERE last_seen_at >= NOW() - INTERVAL '7 days')::int AS active_users_7d,
             COUNT(*) FILTER (WHERE ${ADMIN_NEED_ATTENTION_SQL})::int AS need_attention_users,
             COUNT(*) FILTER (WHERE birth_date IS NULL)::int AS users_without_birth_data
           FROM user_metrics`
        );

        return result.rows[0] || {
          total_users: 0,
          active_premium_users: 0,
          active_users_7d: 0,
          need_attention_users: 0,
          users_without_birth_data: 0,
        };
      } catch (error: any) {
        log.error('[DB] Error getting admin users overview', { error: error.message });
        throw error;
      }
    },

    async getUserDetail(userId: string) {
      const user = await db.users.get(userId);
      if (!user) return null;

      const charts = await db.natal_charts.getAll(userId);
      const primaryChart = charts.find((chart: any) => chart.is_primary) || null;
      const latestStarsPayment = await db.star_payments.getLatestByUser(userId);
      const recentSessions = await db.user_sessions.getRecentByUser(userId, 3);
      // Последняя активность — по всем сигналам (сессии + события приложения + last_login),
      // чтобы карточка веб-гостя (у него нет Telegram-сессии) показывала реальный последний вход.
      const lastEvent = await getPool()
        .query(`SELECT MAX(occurred_at) AS last_event FROM user_app_events WHERE user_id = $1`, [toUserId(userId)])
        .then((r) => r.rows[0]?.last_event ?? null)
        .catch(() => null);
      const lastSeenCandidates = [recentSessions[0]?.last_seen_at ?? null, lastEvent, user.last_login ?? null]
        .filter(Boolean)
        .map((d: any) => new Date(d).getTime());
      const lastSeenAt = lastSeenCandidates.length ? new Date(Math.max(...lastSeenCandidates)).toISOString() : null;
      const currentDeviceLabel = recentSessions[0]?.device_label ?? null;

      return {
        id: user.id,
        name: user.name || 'Unnamed user',
        birth_date: user.birth_date,
        birth_time: user.birth_time,
        birth_place: user.birth_place,
        premium_until: user.premium_until,
        is_premium: user.is_premium,
        login_streak: user.login_streak ?? 0,
        chart_slots: user.chart_slots ?? 1,
        is_blocked: user.is_blocked ?? false,
        saved_charts_count: charts.length,
        is_admin: user.is_admin ?? false,
        created_at: user.created_at,
        last_login: user.last_login,
        last_seen_at: lastSeenAt,
        current_device_label: currentDeviceLabel,
        primary_chart: primaryChart
          ? {
              id: primaryChart.id,
              name: primaryChart.name,
              birth_date: primaryChart.birth_date,
              birth_time: primaryChart.birth_time,
              birth_place: primaryChart.birth_place,
            }
          : null,
        recent_sessions: recentSessions,
        latest_stars_payment: latestStarsPayment,
      };
    },

    async updateUser(userId: string, patch: {
      name?: string;
      birthDate?: string | null;
      language?: string;
      chartSlots?: number;
      isBlocked?: boolean;
    }) {
      const id = toUserId(userId);
      const sets: string[] = [];
      const vals: any[] = [];
      let i = 1;
      if (patch.name !== undefined) { sets.push(`name = $${i++}`); vals.push(patch.name); }
      if (patch.birthDate !== undefined) { sets.push(`birth_date = $${i++}`); vals.push(patch.birthDate || null); }
      if (patch.language !== undefined) { sets.push(`language = $${i++}`); vals.push(patch.language); }
      if (patch.chartSlots !== undefined) { sets.push(`chart_slots = $${i++}`); vals.push(patch.chartSlots); }
      if (patch.isBlocked !== undefined) { sets.push(`is_blocked = $${i++}`); vals.push(patch.isBlocked); }
      if (!sets.length) return;
      vals.push(id);
      await getPool().query(`UPDATE users SET ${sets.join(', ')} WHERE id = $${i}`, vals);
    },

    async deleteUser(userId: string) {
      await getPool().query('DELETE FROM users WHERE id = $1', [toUserId(userId)]);
    },

      async getNotificationRecipients(segment: AdminDbNotificationSegment) {
        if (!DATABASE_URL) return [];
  
        try {
          const dbPool = getPool();
          const result = await dbPool.query(
            `${ADMIN_USER_METRICS_CTE}
             SELECT
               id,
               COALESCE(name, 'Unnamed user') AS name,
               COALESCE(language, 'ru') AS language,
               premium_until,
               last_seen_at
             FROM user_metrics
             WHERE ${getAdminUserSegmentSql(1)}
             ORDER BY created_at DESC`,
            [segment]
          );

        return result.rows.map((row: any) => ({
          id: String(row.id),
          name: row.name || 'Unnamed user',
          language: row.language || 'ru',
          last_seen_at: row.last_seen_at ?? null,
          is_premium: !!(row.premium_until && new Date(row.premium_until) > new Date()),
        }));
      } catch (error: any) {
        log.error('[DB] Error getting notification recipients', { error: error.message, segment });
        throw error;
      }
    },
  },

  /** Legacy compose templates (admin "Send" tab) — table legacy_notification_templates */
  legacy_notification_templates: {
    async ensureSeeded() {
      if (!DATABASE_URL) return;
      try {
        const dbPool = getPool();
        for (const seed of LEGACY_NOTIFICATION_SEEDS) {
          const existing = await dbPool.query(
            `SELECT id FROM legacy_notification_templates WHERE LOWER(title) = LOWER($1) LIMIT 1`,
            [seed.title]
          );
          if (existing.rows.length > 0) continue;
          await dbPool.query(
            `INSERT INTO legacy_notification_templates (title, body_ru, body_en, kind, asset_id, is_active)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              trimText(seed.title, 120),
              trimText(seed.bodyRu, 4000),
              trimText(seed.bodyEn, 4000),
              seed.kind,
              seed.assetId ?? null,
              seed.isActive ?? true,
            ]
          );
        }
      } catch (error: any) {
        log.error('[DB] Error seeding legacy notification templates', { error: error.message });
        throw error;
      }
    },

    async getAll() {
      if (!DATABASE_URL) return [];
      try {
        await this.ensureSeeded();
        const dbPool = getPool();
        const result = await dbPool.query(
          `SELECT
             t.id,
             t.title,
             t.body_ru,
             t.body_en,
             t.kind,
             t.asset_id,
             a.public_url AS asset_public_url,
             t.is_active,
             t.created_at,
             t.updated_at
           FROM legacy_notification_templates t
           LEFT JOIN notification_assets a ON a.id = t.asset_id
           ORDER BY t.updated_at DESC, t.id DESC`
        );
        return result.rows;
      } catch (error: any) {
        log.error('[DB] Error getting legacy notification templates', { error: error.message });
        throw error;
      }
    },

    async create(data: {
      title: string;
      bodyRu?: string | null;
      bodyEn?: string | null;
      kind: 'personal' | 'broadcast' | 'both';
      assetId?: number | null;
      isActive?: boolean;
    }) {
      if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured');
      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          `INSERT INTO legacy_notification_templates (title, body_ru, body_en, kind, asset_id, is_active)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, title, body_ru, body_en, kind, asset_id, is_active, created_at, updated_at`,
          [
            trimText(data.title, 120),
            trimText(data.bodyRu, 4000),
            trimText(data.bodyEn, 4000),
            data.kind,
            data.assetId ?? null,
            data.isActive ?? true,
          ]
        );
        return result.rows[0];
      } catch (error: any) {
        log.error('[DB] Error creating legacy notification template', { error: error.message });
        throw error;
      }
    },

    async update(templateId: number, data: {
      title: string;
      bodyRu?: string | null;
      bodyEn?: string | null;
      kind: 'personal' | 'broadcast' | 'both';
      assetId?: number | null;
      isActive: boolean;
    }) {
      if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured');
      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          `UPDATE legacy_notification_templates
           SET title = $2,
               body_ru = $3,
               body_en = $4,
               kind = $5,
               asset_id = $6,
               is_active = $7,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1
           RETURNING id, title, body_ru, body_en, kind, asset_id, is_active, created_at, updated_at`,
          [
            templateId,
            trimText(data.title, 120),
            trimText(data.bodyRu, 4000),
            trimText(data.bodyEn, 4000),
            data.kind,
            data.assetId ?? null,
            data.isActive,
          ]
        );
        return result.rows[0] || null;
      } catch (error: any) {
        log.error('[DB] Error updating legacy notification template', { error: error.message, templateId });
        throw error;
      }
    },
  },

  notification_assets: {
    async create(data: {
      fileName: string;
      storagePath: string;
      publicUrl: string;
      mimeType: string;
      fileSize: number;
      uploadedBy?: string | null;
    }) {
      if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured');
      const dbPool = getPool();
      const result = await dbPool.query(
        `INSERT INTO notification_assets (file_name, storage_path, public_url, mime_type, file_size, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          trimText(data.fileName, 255) || 'file',
          trimText(data.storagePath, 500) || '',
          trimText(data.publicUrl, 1000) || '',
          trimText(data.mimeType, 120) || 'application/octet-stream',
          data.fileSize,
          data.uploadedBy ? toUserId(data.uploadedBy) : null,
        ]
      );
      return result.rows[0];
    },

    async getAll() {
      if (!DATABASE_URL) return [];
      const dbPool = getPool();
      const result = await dbPool.query(
        `SELECT a.*,
                (
                  (SELECT COUNT(*)::int FROM notification_templates t WHERE t.asset_id = a.id)
                  + (SELECT COUNT(*)::int FROM legacy_notification_templates lt WHERE lt.asset_id = a.id)
                ) AS ref_count
         FROM notification_assets a
         ORDER BY a.created_at DESC`
      );
      return result.rows;
    },

    async getById(id: number) {
      if (!DATABASE_URL) return null;
      const dbPool = getPool();
      const result = await dbPool.query(`SELECT * FROM notification_assets WHERE id = $1`, [id]);
      return result.rows[0] || null;
    },

    async deleteIfUnused(id: number) {
      if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured');
      const dbPool = getPool();
      const use = await dbPool.query(
        `SELECT
           (
             (SELECT COUNT(*)::int FROM notification_templates WHERE asset_id = $1)
             + (SELECT COUNT(*)::int FROM legacy_notification_templates WHERE asset_id = $1)
           ) AS c`,
        [id]
      );
      if ((use.rows[0]?.c ?? 0) > 0) {
        throw new Error('ASSET_IN_USE');
      }
      const row = await dbPool.query(`DELETE FROM notification_assets WHERE id = $1 RETURNING storage_path`, [id]);
      return row.rows[0] || null;
    },
  },

  /** Scheduled / CMS notification templates — table notification_templates */
  scheduled_notification_templates: {
    async ensureSeeded() {
      if (!DATABASE_URL) return;
      try {
        const dbPool = getPool();
        for (const seed of SCHEDULED_NOTIFICATION_SEEDS) {
          const existing = await dbPool.query(
            `SELECT id FROM notification_templates WHERE LOWER(name) = LOWER($1) LIMIT 1`,
            [seed.name]
          );
          if (existing.rows.length > 0) continue;

          const created = await dbPool.query(
            `INSERT INTO notification_templates (
               name, slot, target_segment, message_type, text, button_text, deep_link, is_active, sort_order, rotation_group, notes, visual_mode
             ) VALUES ($1, $2, $3, 'text', $4, $5, $6, $7, $8, NULL, $9, 'none')
             RETURNING id`,
            [
              trimText(seed.name, 200) || 'Untitled',
              trimText(seed.slot, 32) || 'custom',
              seed.targetSegment ?? null,
              trimText(seed.text, 4000) || '',
              trimText(seed.buttonText, 64) || '',
              trimText(seed.deepLink, 2000) || '',
              seed.isActive,
              await this.nextSortOrderForSlot(seed.slot),
              trimText(seed.notes, 2000),
            ]
          );

          const templateId = Number(created.rows[0]?.id);
          if (!Number.isFinite(templateId)) continue;

          for (const schedule of seed.schedules) {
            await dbPool.query(
              `INSERT INTO notification_schedules (template_id, send_time, timezone, repeat_mode, is_active)
               VALUES ($1, $2, $3, $4, $5)`,
              [
                templateId,
                schedule.sendTime,
                schedule.timezone,
                schedule.repeatMode,
                schedule.isActive,
              ]
            );
          }
        }
      } catch (error: any) {
        log.error('[DB] Error seeding scheduled notification templates', { error: error.message });
        throw error;
      }
    },

    async listWithAsset() {
      if (!DATABASE_URL) return [];
      await this.ensureSeeded();
      const dbPool = getPool();
      const result = await dbPool.query(
        `SELECT t.*, a.public_url AS asset_public_url, a.mime_type AS asset_mime_type
         FROM notification_templates t
         LEFT JOIN notification_assets a ON a.id = t.asset_id
         ORDER BY t.slot ASC, t.sort_order ASC, t.id ASC`
      );
      return result.rows;
    },

    async getById(id: number) {
      if (!DATABASE_URL) return null;
      await this.ensureSeeded();
      const dbPool = getPool();
      const result = await dbPool.query(
        `SELECT t.*, a.public_url AS asset_public_url, a.mime_type AS asset_mime_type, a.file_name AS asset_file_name
         FROM notification_templates t
         LEFT JOIN notification_assets a ON a.id = t.asset_id
         WHERE t.id = $1`,
        [id]
      );
      return result.rows[0] || null;
    },

    async create(data: {
      name: string;
      slot: string;
      targetSegment?: AdminDbNotificationSegment | null;
      messageType: 'text' | 'photo';
      text: string;
      buttonText: string;
      deepLink: string;
      assetId?: number | null;
      isActive?: boolean;
      sortOrder?: number;
      rotationGroup?: string | null;
      notes?: string | null;
      visualMode?: 'none' | 'uploaded' | 'generated';
      generatedPreset?: string | null;
      generatedTitle?: string | null;
      generatedSubtitle?: string | null;
      generatedAccent?: string | null;
      generatedShowDate?: boolean;
      generatedShowSlotLabel?: boolean;
      generatedZodiacMode?: string | null;
      generatedCustomZodiac?: string | null;
    }) {
      if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured');
      const dbPool = getPool();
      const vm = data.visualMode || 'none';
      const result = await dbPool.query(
        `INSERT INTO notification_templates (
           name, slot, target_segment, message_type, text, button_text, deep_link, asset_id, is_active, sort_order, rotation_group, notes,
           visual_mode, generated_preset, generated_title, generated_subtitle, generated_accent,
           generated_show_date, generated_show_slot_label, generated_zodiac_mode, generated_custom_zodiac
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
         RETURNING *`,
        [
          trimText(data.name, 200) || 'Untitled',
          trimText(data.slot, 32) || 'custom',
          data.targetSegment ?? null,
          data.messageType === 'photo' ? 'photo' : 'text',
          trimText(data.text, 4000) || '',
          trimText(data.buttonText, 64) || '',
          trimText(data.deepLink, 2000) || '',
          data.assetId ?? null,
          data.isActive !== false,
          data.sortOrder ?? 0,
          data.rotationGroup != null ? trimText(data.rotationGroup, 120) : null,
          data.notes != null ? trimText(data.notes, 2000) : null,
          trimText(vm, 16) || 'none',
          data.generatedPreset != null ? trimText(data.generatedPreset, 64) : null,
          data.generatedTitle != null ? trimText(data.generatedTitle, 200) : null,
          data.generatedSubtitle != null ? trimText(data.generatedSubtitle, 300) : null,
          data.generatedAccent != null ? trimText(data.generatedAccent, 120) : null,
          !!data.generatedShowDate,
          !!data.generatedShowSlotLabel,
          data.generatedZodiacMode != null ? trimText(data.generatedZodiacMode, 32) : null,
          data.generatedCustomZodiac != null ? trimText(data.generatedCustomZodiac, 80) : null,
        ]
      );
      return result.rows[0];
    },

    async update(
      id: number,
      data: {
        name: string;
        slot: string;
        targetSegment?: AdminDbNotificationSegment | null;
        messageType: 'text' | 'photo';
        text: string;
        buttonText: string;
        deepLink: string;
        assetId?: number | null;
        isActive: boolean;
        sortOrder: number;
        rotationGroup?: string | null;
        notes?: string | null;
        visualMode: 'none' | 'uploaded' | 'generated';
        generatedPreset?: string | null;
        generatedTitle?: string | null;
        generatedSubtitle?: string | null;
        generatedAccent?: string | null;
        generatedShowDate: boolean;
        generatedShowSlotLabel: boolean;
        generatedZodiacMode?: string | null;
        generatedCustomZodiac?: string | null;
      }
    ) {
      if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured');
      const dbPool = getPool();
      const result = await dbPool.query(
        `UPDATE notification_templates SET
           name = $2, slot = $3, target_segment = $4, message_type = $5, text = $6, button_text = $7, deep_link = $8,
           asset_id = $9, is_active = $10, sort_order = $11, rotation_group = $12, notes = $13,
           visual_mode = $14, generated_preset = $15, generated_title = $16, generated_subtitle = $17,
           generated_accent = $18, generated_show_date = $19, generated_show_slot_label = $20,
           generated_zodiac_mode = $21, generated_custom_zodiac = $22,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [
          id,
          trimText(data.name, 200) || 'Untitled',
          trimText(data.slot, 32) || 'custom',
          data.targetSegment ?? null,
          data.messageType === 'photo' ? 'photo' : 'text',
          trimText(data.text, 4000) || '',
          trimText(data.buttonText, 64) || '',
          trimText(data.deepLink, 2000) || '',
          data.assetId ?? null,
          data.isActive,
          data.sortOrder ?? 0,
          data.rotationGroup != null ? trimText(data.rotationGroup, 120) : null,
          data.notes != null ? trimText(data.notes, 2000) : null,
          trimText(data.visualMode, 16) || 'none',
          data.generatedPreset != null ? trimText(data.generatedPreset, 64) : null,
          data.generatedTitle != null ? trimText(data.generatedTitle, 200) : null,
          data.generatedSubtitle != null ? trimText(data.generatedSubtitle, 300) : null,
          data.generatedAccent != null ? trimText(data.generatedAccent, 120) : null,
          data.generatedShowDate,
          data.generatedShowSlotLabel,
          data.generatedZodiacMode != null ? trimText(data.generatedZodiacMode, 32) : null,
          data.generatedCustomZodiac != null ? trimText(data.generatedCustomZodiac, 80) : null,
        ]
      );
      return result.rows[0] || null;
    },

    async delete(id: number) {
      if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured');
      const dbPool = getPool();
      await dbPool.query(`DELETE FROM notification_schedules WHERE template_id = $1`, [id]);
      const result = await dbPool.query(`DELETE FROM notification_templates WHERE id = $1 RETURNING id`, [id]);
      return !!result.rows[0];
    },

    /** Next sort_order for new template in slot (append to queue for rotation). */
    async nextSortOrderForSlot(slot: string): Promise<number> {
      if (!DATABASE_URL) return 0;
      const dbPool = getPool();
      const s = trimText(slot, 32) || 'custom';
      const result = await dbPool.query(
        `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM notification_templates WHERE slot = $1`,
        [s]
      );
      const n = Number(result.rows[0]?.next_order);
      return Number.isFinite(n) ? n : 0;
    },

    async listActiveForSlot(slot: string, rotationGroup: string | null, targetSegment?: AdminDbNotificationSegment | null) {
      if (!DATABASE_URL) return [];
      const dbPool = getPool();
      const rg = rotationGroup || null;
      const result = await dbPool.query(
        `SELECT t.*, a.public_url AS asset_public_url
         FROM notification_templates t
         LEFT JOIN notification_assets a ON a.id = t.asset_id
         WHERE t.is_active = TRUE AND t.slot = $1
           AND ($3::text IS NULL OR t.target_segment IS NULL OR t.target_segment = $3)
           AND (
             ($2::text IS NULL AND t.rotation_group IS NULL)
             OR ($2::text IS NOT NULL AND t.rotation_group = $2)
           )
         ORDER BY t.sort_order ASC, t.id ASC`,
        [slot, rg, targetSegment ?? null]
      );
      return result.rows;
    },
  },

  notification_schedules: {
    async listAll() {
      if (!DATABASE_URL) return [];
      const dbPool = getPool();
      const result = await dbPool.query(
        `SELECT s.*, t.name AS template_name, t.slot AS template_slot
         FROM notification_schedules s
         JOIN notification_templates t ON t.id = s.template_id
         ORDER BY t.slot, s.send_time`
      );
      return result.rows;
    },

    async listByTemplate(templateId: number) {
      if (!DATABASE_URL) return [];
      const dbPool = getPool();
      const result = await dbPool.query(
        `SELECT * FROM notification_schedules WHERE template_id = $1 ORDER BY send_time`,
        [templateId]
      );
      return result.rows;
    },

    async upsert(data: {
      id?: number | null;
      templateId: number;
      sendTime: string;
      timezone: string;
      repeatMode: string;
      isActive: boolean;
    }) {
      if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured');
      const dbPool = getPool();
      if (data.id) {
        const result = await dbPool.query(
          `UPDATE notification_schedules SET
             send_time = $2::time, timezone = $3, repeat_mode = $4, is_active = $5, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1 AND template_id = $6
           RETURNING *`,
          [
            data.id,
            data.sendTime,
            trimText(data.timezone, 64) || 'Europe/Moscow',
            trimText(data.repeatMode, 32) || 'daily',
            data.isActive,
            data.templateId,
          ]
        );
        return result.rows[0] || null;
      }
      const result = await dbPool.query(
        `INSERT INTO notification_schedules (template_id, send_time, timezone, repeat_mode, is_active)
         VALUES ($1, $2::time, $3, $4, $5)
         RETURNING *`,
        [
          data.templateId,
          data.sendTime,
          trimText(data.timezone, 64) || 'Europe/Moscow',
          trimText(data.repeatMode, 32) || 'daily',
          data.isActive,
        ]
      );
      return result.rows[0];
    },

    async delete(scheduleId: number) {
      if (!DATABASE_URL) return false;
      const dbPool = getPool();
      const result = await dbPool.query(`DELETE FROM notification_schedules WHERE id = $1 RETURNING id`, [scheduleId]);
      return !!result.rows[0];
    },

    async updateLastSent(scheduleId: number) {
      if (!DATABASE_URL) return;
      const dbPool = getPool();
      await dbPool.query(
        `UPDATE notification_schedules SET last_sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [scheduleId]
      );
    },
  },

  notification_rotation_state: {
    async get(slot: string, rotationGroup: string) {
      if (!DATABASE_URL) return null;
      const dbPool = getPool();
      const result = await dbPool.query(
        `SELECT * FROM notification_rotation_state WHERE slot = $1 AND rotation_group = $2`,
        [slot, rotationGroup || '']
      );
      return result.rows[0] || null;
    },

    async upsert(slot: string, rotationGroup: string, lastTemplateId: number | null, lastIndex: number) {
      if (!DATABASE_URL) return;
      const dbPool = getPool();
      const rg = rotationGroup || '';
      await dbPool.query(
        `INSERT INTO notification_rotation_state (slot, rotation_group, last_template_id, last_index, updated_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
         ON CONFLICT (slot, rotation_group) DO UPDATE SET
           last_template_id = EXCLUDED.last_template_id,
           last_index = EXCLUDED.last_index,
           updated_at = CURRENT_TIMESTAMP`,
        [slot, rg, lastTemplateId, lastIndex]
      );
    },
  },

  notification_delivery_log: {
    async create(data: {
      templateId?: number | null;
      scheduledFor?: Date | null;
      sentAt?: Date | null;
      recipientCount: number;
      successCount: number;
      failureCount: number;
      status: string;
      errorSummary?: string | null;
      visualMode?: string | null;
      generatedPreset?: string | null;
      assetId?: number | null;
      generatedCacheHit?: boolean | null;
    }) {
      if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured');
      const dbPool = getPool();
      const result = await dbPool.query(
        `INSERT INTO notification_delivery_log (
           template_id, scheduled_for, sent_at, recipient_count, success_count, failure_count, status, error_summary,
           visual_mode, generated_preset, asset_id, generated_cache_hit
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [
          data.templateId ?? null,
          data.scheduledFor ?? null,
          data.sentAt ?? null,
          data.recipientCount,
          data.successCount,
          data.failureCount,
          trimText(data.status, 32) || 'unknown',
          data.errorSummary != null ? trimText(data.errorSummary, 2000) : null,
          data.visualMode != null ? trimText(data.visualMode, 32) : null,
          data.generatedPreset != null ? trimText(data.generatedPreset, 64) : null,
          data.assetId ?? null,
          data.generatedCacheHit ?? null,
        ]
      );
      return result.rows[0];
    },

    async listRecent(limit = 50) {
      if (!DATABASE_URL) return [];
      const dbPool = getPool();
      const result = await dbPool.query(
        `SELECT l.*, t.name AS template_name
         FROM notification_delivery_log l
         LEFT JOIN notification_templates t ON t.id = l.template_id
         ORDER BY l.created_at DESC
         LIMIT $1`,
        [Math.min(Math.max(limit, 1), 200)]
      );
      return result.rows;
    },
  },

  notifications: {
    async createCampaign(data: {
      createdBy: string;
      mode: 'personal' | 'broadcast';
      targetSegment?: AdminDbNotificationSegment | null;
      targetUserId?: string | null;
      templateId?: number | null;
      assetId?: number | null;
      title: string;
      bodyRu?: string | null;
      bodyEn?: string | null;
      totalRecipients: number;
    }) {
      if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured');
      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          `INSERT INTO notification_campaigns (
             created_by, mode, target_segment, target_user_id, template_id, asset_id, title, body_ru, body_en, total_recipients
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id, created_at`,
          [
            toUserId(data.createdBy),
            data.mode,
            data.targetSegment ?? null,
            data.targetUserId ? toUserId(data.targetUserId) : null,
            data.templateId ?? null,
            data.assetId ?? null,
            trimText(data.title, 120),
            trimText(data.bodyRu, 4000),
            trimText(data.bodyEn, 4000),
            data.totalRecipients,
          ]
        );
        return result.rows[0];
      } catch (error: any) {
        log.error('[DB] Error creating notification campaign', { error: error.message });
        throw error;
      }
    },

    async addDelivery(data: {
      campaignId: number;
      userId: string;
      language: string;
      messageText: string;
      status: 'sent' | 'failed';
      telegramMessageId?: number | null;
      errorText?: string | null;
    }) {
      if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured');
      try {
        const dbPool = getPool();
        await dbPool.query(
          `INSERT INTO notification_deliveries (
             campaign_id, user_id, language, message_text, status, telegram_message_id, error_text, sent_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, CASE WHEN $5 = 'sent' THEN CURRENT_TIMESTAMP ELSE NULL END)`,
          [
            data.campaignId,
            toUserId(data.userId),
            trimText(data.language, 10),
            trimText(data.messageText, 4000) || '',
            data.status,
            data.telegramMessageId ?? null,
            trimText(data.errorText, 500),
          ]
        );
        return { success: true };
      } catch (error: any) {
        log.error('[DB] Error adding notification delivery', { error: error.message, campaignId: data.campaignId });
        throw error;
      }
    },

    async finalizeCampaign(campaignId: number, counts: { successCount: number; failedCount: number; totalRecipients: number }) {
      if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured');
      try {
        const dbPool = getPool();
        await dbPool.query(
          `UPDATE notification_campaigns
           SET success_count = $2,
               failed_count = $3,
               total_recipients = $4,
               sent_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [campaignId, counts.successCount, counts.failedCount, counts.totalRecipients]
        );
        return { success: true };
      } catch (error: any) {
        log.error('[DB] Error finalizing notification campaign', { error: error.message, campaignId });
        throw error;
      }
    },

    async getRecentCampaigns(options?: {
      page?: number;
      pageSize?: number;
      mode?: AdminDbNotificationMode;
      result?: AdminDbNotificationResult;
      limit?: number;
    }) {
      if (!DATABASE_URL) {
        return {
          history: [],
          pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
        };
      }

      const pageSize = Math.min(Math.max(options?.pageSize || options?.limit || 20, 1), 50);
      const page = Math.max(options?.page || 1, 1);
      const offset = (page - 1) * pageSize;
      const mode = options?.mode || 'all';
      const result = options?.result || 'all';

      const whereClauses = [
        `($1 = 'all' OR nc.mode = $1)`,
        `($2 = 'all'
          OR ($2 = 'success' AND COALESCE(nc.failed_count, 0) = 0 AND COALESCE(nc.success_count, 0) > 0)
          OR ($2 = 'partial' AND COALESCE(nc.failed_count, 0) > 0 AND COALESCE(nc.success_count, 0) > 0)
          OR ($2 = 'failed' AND COALESCE(nc.failed_count, 0) > 0 AND COALESCE(nc.success_count, 0) = 0)
        )`,
      ];

      try {
        const dbPool = getPool();
        const [countResult, rowsResult] = await Promise.all([
          dbPool.query(
            `SELECT COUNT(*)::int AS total
             FROM notification_campaigns nc
             WHERE ${whereClauses.join(' AND ')}`,
            [mode, result]
          ),
          dbPool.query(
            `SELECT
               nc.id,
               nc.mode,
               nc.target_segment,
               nc.target_user_id,
               target_user.name AS target_user_name,
               nc.template_id,
               nc.asset_id,
               asset.public_url AS asset_public_url,
                nc.title,
                nc.body_ru,
                nc.body_en,
               COALESCE(nc.total_recipients, 0) AS total_recipients,
               COALESCE(nc.success_count, 0) AS success_count,
               COALESCE(nc.failed_count, 0) AS failed_count,
               nc.created_at,
               nc.sent_at
             FROM notification_campaigns nc
             LEFT JOIN users target_user ON target_user.id = nc.target_user_id
             LEFT JOIN notification_assets asset ON asset.id = nc.asset_id
             WHERE ${whereClauses.join(' AND ')}
             ORDER BY nc.created_at DESC
             LIMIT $3
             OFFSET $4`,
            [mode, result, pageSize, offset]
          ),
        ]);

        const history = [];
        for (const row of rowsResult.rows) {
          const failures = await dbPool.query(
            `SELECT nd.user_id, COALESCE(u.name, 'Unnamed user') AS user_name, nd.error_text, nd.created_at
             FROM notification_deliveries nd
             LEFT JOIN users u ON u.id = nd.user_id
             WHERE nd.campaign_id = $1 AND nd.status = 'failed'
             ORDER BY nd.created_at DESC
             LIMIT 3`,
            [row.id]
          );

          history.push({
            ...row,
            recent_failures: failures.rows,
          });
        }

        const total = Number(countResult.rows[0]?.total || 0);
        return {
          history,
          pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.max(1, Math.ceil(total / pageSize)),
          },
        };
      } catch (error: any) {
        log.error('[DB] Error getting recent notification campaigns', { error: error.message });
        throw error;
      }
    },
  },

  /** dictionary */
  dictionary: {
    async getByTerm(term: string) {
      if (!DATABASE_URL) return null;
      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          `SELECT term, title, description, category FROM dictionary WHERE term = $1`,
          [term]
        );
        return result.rows.length === 0 ? null : result.rows[0];
      } catch (error: any) {
        log.error('[DB] Error getting dictionary term', { error: error.message, term });
        throw error;
      }
    },

    async getAll() {
      if (!DATABASE_URL) return [];
      try {
        const dbPool = getPool();
        const result = await dbPool.query(`SELECT term, title, description, category FROM dictionary ORDER BY term`);
        return result.rows;
      } catch (error: any) {
        log.error('[DB] Error getting all dictionary', { error: error.message });
        throw error;
      }
    },

    async search(query: string) {
      if (!DATABASE_URL) return [];
      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          `SELECT term, title, description, category FROM dictionary WHERE term ILIKE $1 OR title ILIKE $1 OR description ILIKE $1`,
          [`%${query}%`]
        );
        return result.rows;
      } catch (error: any) {
        log.error('[DB] Error searching dictionary', { error: error.message, query });
        throw error;
      }
    },
  },

};
