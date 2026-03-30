// Database connection utility for Railway
// This file handles connection to Railway Database
// 
// Uses process.env.DATABASE_URL from environment variables
// DATABASE_URL should be set in Railway Variables or .env file
// Format: postgresql://user:password@host:port/database

import { Pool, Client } from 'pg';
import { LEGACY_NOTIFICATION_SEEDS, SCHEDULED_NOTIFICATION_SEEDS } from './adminNotificationSeedCatalog';

// Read DATABASE_URL from environment variables
// This is set in Railway Variables or .env file
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
  | 'need_attention';
type AdminDbUserSortBy = 'last_seen' | 'created_at' | 'lumi_balance' | 'premium_until' | 'saved_charts_count' | 'name';
type AdminDbSortOrder = 'asc' | 'desc';
type AdminDbNotificationMode = 'all' | 'personal' | 'broadcast';
type AdminDbNotificationResult = 'all' | 'success' | 'partial' | 'failed';
type AdminDbNotificationSegment =
  | 'all'
  | 'premium'
  | 'free'
  | 'active_7d'
  | 'inactive_3d'
  | 'inactive_7d'
  | 'inactive_30d'
  | 'need_attention';
type DbContentAccessTier = 'free' | 'premium' | 'lumi';
type DbContentSurface = 'natal' | 'forecast' | 'synastry' | 'question';
type DbContentVariant =
  | 'anchor'
  | 'living'
  | 'daily'
  | 'morning'
  | 'day'
  | 'evening'
  | 'weekly'
  | 'monthly'
  | 'brief'
  | 'full'
  | 'one_off';
type DbContentModelTier = 'base' | 'premium';
type DbContentUnlockType = 'free' | 'premium' | 'lumi';

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
    canRegenerateForLumi: !!row.can_regenerate_for_lumi,
    regenerationCostLumi: row.regeneration_cost_lumi ?? null,
    legacySource: row.legacy_source ?? null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
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
    lumiSpent: Number(row.lumi_spent ?? 0),
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
      u.premium_until,
      COALESCE(u.lumi_balance, 0) AS lumi_balance,
      COALESCE(u.login_streak, 0) AS login_streak,
      COALESCE(u.chart_slots, 1) AS chart_slots,
      COALESCE(u.is_admin, FALSE) AS is_admin,
      u.created_at,
      u.last_login,
      COALESCE(MAX(us.last_seen_at), u.last_login) AS last_seen_at,
      COUNT(DISTINCT nc.id)::int AS saved_charts_count
    FROM users u
    LEFT JOIN natal_charts nc ON nc.user_id = u.id
    LEFT JOIN user_sessions us ON us.user_id = u.id
    GROUP BY u.id
  )
`;

const ADMIN_NEED_ATTENTION_SQL = `(
  ((premium_until IS NULL OR premium_until <= NOW()) AND lumi_balance <= 10)
  OR saved_charts_count >= chart_slots
)`;

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
  )`;
}

function getAdminUserSortSql(sortBy: AdminDbUserSortBy, sortOrder: AdminDbSortOrder) {
  const direction = sortOrder === 'asc' ? 'ASC' : 'DESC';
  switch (sortBy) {
    case 'name':
      return `LOWER(COALESCE(name, '')) ${direction}, created_at DESC`;
    case 'created_at':
      return `created_at ${direction}`;
    case 'lumi_balance':
      return `lumi_balance ${direction}, created_at DESC`;
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
  if (!value) return '12:00';
  const trimmed = String(value).trim();
  const match = trimmed.match(/^(\d{2}):(\d{2})/);
  if (match) {
    return `${match[1]}:${match[2]}`;
  }
  return trimmed;
}

function normalizeBirthDateValue(value?: string | Date | null): string {
  if (!value) return '';

  if (value instanceof Date) {
    return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`;
  }

  const trimmed = String(value).trim();
  const dateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    return `${dateOnlyMatch[1]}-${dateOnlyMatch[2]}-${dateOnlyMatch[3]}`;
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, '0')}-${String(parsed.getUTCDate()).padStart(2, '0')}`;
  }

  return trimmed;
}

function normalizeOracleQuestion(value: string) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
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
    
    // Use process.env.DATABASE_URL directly for connection
    // This reads the connection string from environment variables
    pool = new Pool({
      connectionString: process.env.DATABASE_URL, // Direct use of process.env.DATABASE_URL
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
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured in environment variables');
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL, // Read from environment
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

/**
 * Lumia Database operations
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
        const isPremium = u.premium_until && new Date(u.premium_until) > new Date();
        return {
          id: String(u.id),
          name: u.name,
          birth_date: u.birth_date,
          birth_time: u.birth_time,
          birth_place: u.birth_place,
          latitude: u.latitude,
          longitude: u.longitude,
          sun_sign: u.sun_sign,
          moon_sign: u.moon_sign,
          ascendant: u.ascendant,
          lumi_balance: u.lumi_balance ?? 0,
          premium_until: u.premium_until,
          ref_code: u.ref_code,
          referred_by: u.referred_by,
          login_streak: u.login_streak ?? 0,
          last_login: u.last_login,
          language: u.language || 'ru',
          theme: u.theme || 'dark',
          is_admin: u.is_admin ?? false,
          weather_city: u.weather_city,
          created_at: u.created_at,
          is_premium: isPremium,
          is_setup: !!(u.name && u.birth_date && u.birth_place),
          chart_slots: u.chart_slots ?? 1,
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
        const weatherCity = merge('weather_city');
        const finalWeatherCity = weatherCity != null && String(weatherCity).trim()
          ? String(weatherCity).trim()
          : null;
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
            lumi_balance, premium_until, ref_code, referred_by,
            login_streak, last_login, language, theme, is_admin, weather_city
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
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
            lumi_balance = COALESCE(EXCLUDED.lumi_balance, users.lumi_balance),
            premium_until = EXCLUDED.premium_until,
            language = COALESCE(EXCLUDED.language, users.language),
            theme = COALESCE(EXCLUDED.theme, users.theme),
            is_admin = COALESCE(EXCLUDED.is_admin, users.is_admin),
            weather_city = COALESCE(EXCLUDED.weather_city, users.weather_city)
          RETURNING *`,
          [
            id,
            merge('name'),
            merge('birth_date'),
            merge('birth_time'),
            merge('birth_place'),
            merge('latitude'),
            merge('longitude'),
            merge('sun_sign'),
            merge('moon_sign'),
            merge('ascendant'),
            merge('lumi_balance', 0),
            premiumUntil,
            merge('ref_code'),
            merge('referred_by'),
            merge('login_streak', 0),
            merge('last_login'),
            merge('language', 'ru'),
            merge('theme', 'dark'),
            merge('is_admin', false),
            finalWeatherCity,
          ]
        );
        const u = result.rows[0];
        const isPremium = u.premium_until && new Date(u.premium_until) > new Date();
        return {
          id: String(u.id),
          name: u.name,
          birth_date: u.birth_date,
          birth_time: u.birth_time,
          birth_place: u.birth_place,
          is_setup: !!(u.name && u.birth_date && u.birth_place),
          language: u.language || 'ru',
          theme: u.theme || 'dark',
          is_premium: isPremium,
          is_admin: u.is_admin ?? false,
          weather_city: u.weather_city,
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
           SET premium_until = $1
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

    async buyChartSlot(userId: string, cost: number): Promise<{ success: true; newBalance: number; chartSlots: number }> {
      const id = toUserId(userId);
      if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured');
      const dbPool = getPool();
      const client = await dbPool.connect();
      try {
        await client.query('BEGIN');
        const result = await client.query(
          `UPDATE users
           SET lumi_balance = COALESCE(lumi_balance, 0) - $1,
               chart_slots = COALESCE(chart_slots, 1) + 1
           WHERE id = $2 AND COALESCE(lumi_balance, 0) >= $1
           RETURNING lumi_balance, chart_slots`,
          [cost, id]
        );
        if (result.rows.length === 0) {
          await client.query('ROLLBACK');
          throw new Error('Insufficient Lumi balance');
        }
        await client.query(
          `INSERT INTO lumi_transactions (user_id, amount, reason) VALUES ($1, $2, $3)`,
          [id, -cost, 'chart_slot']
        );
        const newBalance = result.rows[0].lumi_balance ?? 0;
        const chartSlots = result.rows[0].chart_slots ?? 1;
        await client.query('COMMIT');
        return { success: true, newBalance, chartSlots };
      } catch (error: any) {
        await client.query('ROLLBACK').catch(() => {});
        log.error('[DB] Error buyChartSlot', { error: error.message, userId });
        throw error;
      } finally {
        client.release();
      }
    },

    /**
     * Process daily login: atomic check + award + update.
     * Prevents double-award for same day. Uses UTC dates.
     */
    async processDailyLogin(userId: string): Promise<{
      awardedToday: boolean;
      dailyReward?: number;
      streakBonus?: number;
      streak: number;
      newBalance: number;
    }> {
      const id = toUserId(userId);
      if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured');

      const DAILY_REWARD = 3;
      const STREAK_BONUSES: Record<number, number> = { 3: 10, 7: 20, 30: 30 };

      const dbPool = getPool();
      const client = await dbPool.connect();
      try {
        await client.query('BEGIN');

        const row = await client.query(
          `SELECT last_login, login_streak, lumi_balance FROM users WHERE id = $1 FOR UPDATE`,
          [id]
        );
        if (row.rows.length === 0) {
          await client.query('ROLLBACK');
          throw new Error('User not found');
        }

        const lastLogin = row.rows[0].last_login;
        const currentStreak = row.rows[0].login_streak ?? 0;
        const currentBalance = row.rows[0].lumi_balance ?? 0;

        const now = new Date();
        const todayUtc = now.toISOString().slice(0, 10);
        const lastLoginDate = lastLogin ? new Date(lastLogin).toISOString().slice(0, 10) : null;

        if (lastLoginDate === todayUtc) {
          await client.query('ROLLBACK');
          return {
            awardedToday: false,
            streak: currentStreak,
            newBalance: currentBalance,
          };
        }

        const yesterday = new Date(now);
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);
        const yesterdayUtc = yesterday.toISOString().slice(0, 10);

        let newStreak: number;
        if (!lastLoginDate) {
          newStreak = 1;
        } else if (lastLoginDate === yesterdayUtc) {
          newStreak = currentStreak + 1;
        } else {
          newStreak = 1;
        }

        const dailyReward = DAILY_REWARD;
        const streakBonus = STREAK_BONUSES[newStreak] ?? 0;
        const total = dailyReward + streakBonus;

        await client.query(
          `UPDATE users SET last_login = NOW(), login_streak = $1, lumi_balance = COALESCE(lumi_balance, 0) + $2 WHERE id = $3`,
          [newStreak, total, id]
        );

        await client.query(
          `INSERT INTO lumi_transactions (user_id, amount, reason) VALUES ($1, $2, $3)`,
          [id, dailyReward, 'daily_login']
        );
        if (streakBonus > 0) {
          await client.query(
            `INSERT INTO lumi_transactions (user_id, amount, reason) VALUES ($1, $2, $3)`,
            [id, streakBonus, 'streak_bonus']
          );
        }

        const newBalance = currentBalance + total;
        await client.query('COMMIT');

        return {
          awardedToday: true,
          dailyReward,
          streakBonus: streakBonus > 0 ? streakBonus : undefined,
          streak: newStreak,
          newBalance,
        };
      } catch (error: any) {
        await client.query('ROLLBACK').catch(() => {});
        log.error('[DB] Error processDailyLogin', { error: error.message, userId });
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
          const isPremium = u.premium_until && new Date(u.premium_until) > new Date();
        return {
          id: String(u.id),
          name: u.name,
          birth_date: u.birth_date,
          birth_time: u.birth_time,
          birth_place: u.birth_place,
          is_setup: !!(u.name && u.birth_date && u.birth_place),
          language: u.language || 'ru',
          theme: u.theme || 'dark',
          is_premium: isPremium,
          is_admin: u.is_admin ?? false,
          weather_city: u.weather_city,
          lumi_balance: u.lumi_balance ?? 0,
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
    _rowToChart(row: any) {
      return {
        id: row.id,
        user_id: row.user_id,
        name: row.name || 'Моя карта',
        chart_data: row.chart_data,
        birth_date: row.birth_date,
        birth_time: row.birth_time,
        birth_place: row.birth_place,
        input_hash: row.input_hash,
        is_primary: row.is_primary ?? true,
        calculated_at: row.created_at,
        created_at: row.created_at,
        updated_at: row.created_at,
      };
    },

    /** Primary chart for user (dashboard, horoscope, onboarding) */
    async getPrimary(userId: string) {
      const id = toUserId(userId);
      if (!DATABASE_URL) return null;
      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          `SELECT id, user_id, name, chart_data, birth_date, birth_time, birth_place, input_hash, is_primary, created_at
           FROM natal_charts WHERE user_id = $1 ORDER BY is_primary DESC NULLS LAST, id ASC LIMIT 1`,
          [id]
        );
        if (result.rows.length === 0) return null;
        return this._rowToChart(result.rows[0]);
      } catch (error: any) {
        log.error('[DB] Error getting primary chart', { error: error.message, userId });
        throw error;
      }
    },

    /** All charts for user */
    async getAll(userId: string) {
      const id = toUserId(userId);
      if (!DATABASE_URL) return [];
      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          `SELECT id, user_id, name, chart_data, birth_date, birth_time, birth_place, input_hash, is_primary, created_at
           FROM natal_charts WHERE user_id = $1 ORDER BY is_primary DESC NULLS LAST, id ASC`,
          [id]
        );
        return result.rows.map((r: any) => this._rowToChart(r));
      } catch (error: any) {
        log.error('[DB] Error getting all charts', { error: error.message, userId });
        throw error;
      }
    },

    /** Chart by id */
    async getById(chartId: number) {
      if (!DATABASE_URL) return null;
      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          `SELECT id, user_id, name, chart_data, birth_date, birth_time, birth_place, input_hash, is_primary, created_at
           FROM natal_charts WHERE id = $1`,
          [chartId]
        );
        if (result.rows.length === 0) return null;
        return this._rowToChart(result.rows[0]);
      } catch (error: any) {
        log.error('[DB] Error getting chart by id', { error: error.message, chartId });
        throw error;
      }
    },

    /** Create new chart. First chart gets is_primary=true. Checks chart_slots limit. */
    async create(userId: string, data: { name: string; birthDate: string; birthTime?: string; birthPlace: string; chartData: any }) {
      const id = toUserId(userId);
      if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured');
      try {
        const dbPool = getPool();
        const charts = await this.getAll(userId);
        const user = await db.users.get(userId);
        const slots = user?.chart_slots ?? 1;
        if (charts.length >= slots) {
          throw new Error(`Chart slots limit reached (${slots}). Purchase more with Lumi.`);
        }
        const normalizedBirthDate = normalizeBirthDateValue(data.birthDate);
        const normalizedBirthTime = normalizeBirthTimeValue(data.birthTime);
        const inputHash = Buffer.from(`${normalizedBirthDate}|${normalizedBirthTime}|${data.birthPlace}`).toString('base64').substring(0, 64);
        const isPrimary = charts.length === 0;
        const chartData = data.chartData?.chart_data || data.chartData;
        const result = await dbPool.query(
          `INSERT INTO natal_charts (user_id, name, birth_date, birth_time, birth_place, chart_data, input_hash, is_primary)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id, user_id, name, chart_data, birth_date, birth_time, birth_place, input_hash, is_primary, created_at`,
          [id, data.name || 'Моя карта', data.birthDate, data.birthTime || '12:00', data.birthPlace, JSON.stringify(chartData), inputHash, isPrimary]
        );
        return this._rowToChart(result.rows[0]);
      } catch (error: any) {
        log.error('[DB] Error creating chart', { error: error.message, userId });
        throw error;
      }
    },

    /** Set chart as primary. Unsets previous primary. */
    async setPrimary(chartId: number) {
      if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured');
      try {
        const dbPool = getPool();
        const chart = await this.getById(chartId);
        if (!chart) throw new Error('Chart not found');
        await dbPool.query('UPDATE natal_charts SET is_primary = FALSE WHERE user_id = $1', [chart.user_id]);
        await dbPool.query('UPDATE natal_charts SET is_primary = TRUE WHERE id = $1', [chartId]);
        return { success: true };
      } catch (error: any) {
        log.error('[DB] Error setting primary chart', { error: error.message, chartId });
        throw error;
      }
    },

    /** Delete chart */
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
            await dbPool.query('UPDATE natal_charts SET is_primary = TRUE WHERE id = $1', [remaining[0].id]);
          }
        }
        return { success: true };
      } catch (error: any) {
        log.error('[DB] Error deleting chart', { error: error.message, chartId });
        throw error;
      }
    },

    /** Legacy: get primary chart (alias for getPrimary) */
    async get(userId: string) {
      return this.getPrimary(userId);
    },

    async needsRecalculation(userIdOrChartId: string | number, birthDate: string, birthTime: string, birthPlace: string): Promise<{ needsCalc: boolean; existingChart: any | null; reason: string }> {
      const existing = typeof userIdOrChartId === 'number'
        ? await this.getById(userIdOrChartId)
        : await this.getPrimary(userIdOrChartId);
      if (!existing) return { needsCalc: true, existingChart: null, reason: 'NO_EXISTING_CHART' };
      const inputChanged = existing.birth_date !== birthDate || existing.birth_time !== birthTime || existing.birth_place !== birthPlace;
      if (inputChanged) return { needsCalc: true, existingChart: existing, reason: 'BIRTH_DATA_CHANGED' };
      const chartData = existing.chart_data;
      if (!chartData || !chartData.sun || !chartData.moon) return { needsCalc: true, existingChart: existing, reason: 'INVALID_CHART_DATA' };
      return { needsCalc: false, existingChart: existing, reason: 'CACHE_HIT' };
    },

    /** Legacy: upsert chart for user (primary or by input_hash). For multi-chart use create(). */
    async set(userId: string, chartData: any, birthDate?: string, birthTime?: string, birthPlace?: string) {
      const id = toUserId(userId);
      if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured');
      try {
        const dbPool = getPool();
        const data = chartData.chart_data || chartData;
        const normalizedBirthDate = normalizeBirthDateValue(birthDate);
        const normalizedBirthTime = normalizeBirthTimeValue(birthTime);
        const inputHash = normalizedBirthDate && birthPlace
          ? Buffer.from(`${normalizedBirthDate}|${normalizedBirthTime}|${birthPlace}`).toString('base64').substring(0, 64)
          : null;
        const existing = await this.getPrimary(userId);
        if (existing) {
          const result = await dbPool.query(
            `UPDATE natal_charts SET chart_data = $1, birth_date = $2, birth_time = $3, birth_place = $4, input_hash = $5
             WHERE id = $6 RETURNING id, user_id, name, chart_data, birth_date, birth_time, birth_place, input_hash, is_primary, created_at`,
            [JSON.stringify(data), normalizedBirthDate || birthDate, normalizedBirthTime || birthTime, birthPlace, inputHash, existing.id]
          );
          return this._rowToChart(result.rows[0]);
        }
        const charts = await this.getAll(userId);
        const isPrimary = charts.length === 0;
        const result = await dbPool.query(
          `INSERT INTO natal_charts (user_id, name, chart_data, birth_date, birth_time, birth_place, input_hash, is_primary)
           VALUES ($1, 'Моя карта', $2, $3, $4, $5, $6, $7)
           RETURNING id, user_id, name, chart_data, birth_date, birth_time, birth_place, input_hash, is_primary, created_at`,
          [id, JSON.stringify(data), normalizedBirthDate || birthDate, normalizedBirthTime || birthTime, birthPlace, inputHash, isPrimary]
        );
        return this._rowToChart(result.rows[0]);
      } catch (error: any) {
        log.error('[DB] Error setting chart', { error: error.message, userId });
        throw error;
      }
    },
  },

  /** OpenAI cache - interpretations table (Lumia) */
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

    /** User-level cache: question_answer, oracle_chat */
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
        canRegenerateForLumi?: boolean;
        regenerationCostLumi?: number | null;
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
               can_regenerate_for_lumi = $16,
               regeneration_cost_lumi = $17,
               legacy_source = $18,
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
            !!data.canRegenerateForLumi,
            data.regenerationCostLumi ?? null,
            data.legacySource ?? null,
          ]
        );

        if ((updated.rowCount ?? 0) === 0) {
          await dbPool.query(
            `INSERT INTO content_interpretations
              (user_id, chart_id, access_tier, content_surface, content_variant, model_tier, cache_key, input_hash, content, prompt_version, calculation_version, valid_from, valid_to, is_persistent, can_regenerate_for_lumi, regeneration_cost_lumi, legacy_source)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, $14, $15, $16, $17)`,
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
              !!data.canRegenerateForLumi,
              data.regenerationCostLumi ?? null,
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
        canRegenerateForLumi?: boolean;
        regenerationCostLumi?: number | null;
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
               can_regenerate_for_lumi = $14,
               regeneration_cost_lumi = $15,
               legacy_source = $16,
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
            !!data.canRegenerateForLumi,
            data.regenerationCostLumi ?? null,
            data.legacySource ?? null,
          ]
        );

        if ((updated.rowCount ?? 0) === 0) {
          await dbPool.query(
            `INSERT INTO content_interpretations
              (user_id, access_tier, content_surface, content_variant, model_tier, cache_key, input_hash, content, prompt_version, calculation_version, valid_from, valid_to, is_persistent, can_regenerate_for_lumi, regeneration_cost_lumi, legacy_source)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13, $14, $15, $16)`,
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
              !!data.canRegenerateForLumi,
              data.regenerationCostLumi ?? null,
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
      lumiSpent?: number;
      metadata?: Record<string, any> | null;
      expiresAt?: string | Date | null;
    }) {
      const userId = toUserId(data.userId);
      if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured');
      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          `INSERT INTO content_unlocks
            (user_id, chart_id, access_tier, content_surface, content_variant, unlock_type, cache_key, lumi_spent, metadata, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)
           RETURNING *`,
          [
            userId,
            data.chartId ?? null,
            data.accessTier,
            data.contentSurface,
            data.contentVariant,
            data.unlockType,
            data.cacheKey || 'default',
            data.lumiSpent ?? 0,
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
           AND tier_name = 'lumia_premium'
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
         VALUES ($1, 'lumia_premium', $2, 'users.premium_until', $3, $4, $5::jsonb)
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

  /** lumi_transactions - balance and history (Lumia) */
  lumi_transactions: {
    /** Transactional add: ensures users.lumi_balance and lumi_transactions stay in sync */
    async addTransactional(userId: string, amount: number, reason: string): Promise<{ success: true; newBalance: number }> {
      const id = toUserId(userId);
      if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured');
      const dbPool = getPool();
      const client = await dbPool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `UPDATE users SET lumi_balance = COALESCE(lumi_balance, 0) + $1 WHERE id = $2`,
          [amount, id]
        );
        await client.query(
          `INSERT INTO lumi_transactions (user_id, amount, reason) VALUES ($1, $2, $3)`,
          [id, amount, reason]
        );
        const bal = await client.query('SELECT lumi_balance FROM users WHERE id = $1', [id]);
        const newBalance = bal.rows.length > 0 ? (bal.rows[0].lumi_balance ?? 0) : 0;
        await client.query('COMMIT');
        return { success: true, newBalance };
      } catch (error: any) {
        await client.query('ROLLBACK').catch(() => {});
        log.error('[DB] Error adding lumi (transactional)', { error: error.message, userId });
        throw error;
      } finally {
        client.release();
      }
    },

    /** Transactional deduct: ensures users.lumi_balance and lumi_transactions stay in sync. Fails if insufficient. */
    async deductTransactional(userId: string, amount: number, reason: string): Promise<{ success: true; newBalance: number }> {
      const id = toUserId(userId);
      if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured');
      const dbPool = getPool();
      const client = await dbPool.connect();
      try {
        await client.query('BEGIN');
        const result = await client.query(
          `UPDATE users SET lumi_balance = COALESCE(lumi_balance, 0) - $1
           WHERE id = $2 AND COALESCE(lumi_balance, 0) >= $1
           RETURNING lumi_balance`,
          [amount, id]
        );
        if (result.rows.length === 0) {
          await client.query('ROLLBACK');
          throw new Error('Insufficient Lumi balance');
        }
        await client.query(
          `INSERT INTO lumi_transactions (user_id, amount, reason) VALUES ($1, $2, $3)`,
          [id, -amount, reason]
        );
        const newBalance = result.rows[0].lumi_balance ?? 0;
        await client.query('COMMIT');
        return { success: true, newBalance };
      } catch (error: any) {
        await client.query('ROLLBACK').catch(() => {});
        log.error('[DB] Error deducting lumi (transactional)', { error: error.message, userId });
        throw error;
      } finally {
        client.release();
      }
    },

    async add(userId: string, amount: number, reason: string) {
      await this.addTransactional(userId, amount, reason);
      return { success: true };
    },

    async getBalance(userId: string) {
      const id = toUserId(userId);
      if (!DATABASE_URL) return 0;
      try {
        const dbPool = getPool();
        const result = await dbPool.query('SELECT lumi_balance FROM users WHERE id = $1', [id]);
        return result.rows.length === 0 ? 0 : (result.rows[0].lumi_balance ?? 0);
      } catch (error: any) {
        log.error('[DB] Error getting balance', { error: error.message, userId });
        throw error;
      }
    },

    async getHistory(userId: string, limit = 50) {
      const id = toUserId(userId);
      if (!DATABASE_URL) return [];
      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          `SELECT amount, reason, created_at FROM lumi_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
          [id, limit]
        );
        return result.rows;
      } catch (error: any) {
        log.error('[DB] Error getting history', { error: error.message, userId });
        throw error;
      }
    },

    async deduct(userId: string, amount: number, reason: string) {
      return this.deductTransactional(userId, amount, reason);
    },

    getRegenerationCountThisWeek: async (userId: string) => {
      const id = toUserId(userId);
      if (!DATABASE_URL) return 0;
      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          `SELECT COUNT(*) FROM lumi_transactions
           WHERE user_id = $1 AND reason IN ('regenerate_natal', 'regenerate_deep_dive', 'regenerate_synastry') AND created_at >= NOW() - INTERVAL '7 days'`,
          [id]
        );
        return parseInt(result.rows[0].count);
      } catch (error: any) {
        log.error('[DB] Error getting regeneration count', { error: error.message, userId });
        throw error;
      }
    },
  },

  /** star_payments - idempotency for Telegram Stars premium purchases */
  star_payments: {
    async exists(telegramPaymentChargeId: string): Promise<boolean> {
      if (!DATABASE_URL) return false;
      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          'SELECT 1 FROM star_payments WHERE telegram_payment_charge_id = $1 LIMIT 1',
          [telegramPaymentChargeId]
        );
        return result.rows.length > 0;
      } catch (error: any) {
        log.error('[DB] Error checking star payment', { error: error.message });
        throw error;
      }
    },

    /** Returns true if inserted, false if duplicate (UNIQUE constraint). DB-level idempotency. */
    async record(telegramPaymentChargeId: string, userId: string, starsAmount: number): Promise<boolean> {
      const id = toUserId(userId);
      if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured');
      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          `INSERT INTO star_payments (telegram_payment_charge_id, user_id, stars_amount) VALUES ($1, $2, $3)
           ON CONFLICT (telegram_payment_charge_id) DO NOTHING
           RETURNING id`,
          [telegramPaymentChargeId, id, starsAmount]
        );
        return result.rowCount !== null && result.rowCount > 0;
      } catch (error: any) {
        log.error('[DB] Error recording star payment', { error: error.message, userId });
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
  },

  /** roulette_spins (Lumia) */
  roulette_spins: {
    async add(userId: string, winAmount: number) {
      const id = toUserId(userId);
      if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured');
      try {
        const dbPool = getPool();
        await dbPool.query(
          `INSERT INTO roulette_spins (user_id, win_amount) VALUES ($1, $2)`,
          [id, winAmount]
        );
        return { success: true };
      } catch (error: any) {
        log.error('[DB] Error adding roulette spin', { error: error.message, userId });
        throw error;
      }
    },

    async getTodayCount(userId: string) {
      const id = toUserId(userId);
      if (!DATABASE_URL) return 0;
      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          `SELECT COUNT(*) FROM roulette_spins WHERE user_id = $1 AND created_at::date = CURRENT_DATE`,
          [id]
        );
        return parseInt(result.rows[0].count);
      } catch (error: any) {
        log.error('[DB] Error getting today spin count', { error: error.message, userId });
        throw error;
      }
    },
  },

  /** daily_horoscopes - general by zodiac sign (Lumia) */
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

  /** daily_natal_cards - personal daily card per chart (Lumia) */
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
  },

  /** astro_questions (Lumia) */
  astro_questions: {
    async add(userId: string, question: string, answer: string) {
      const id = toUserId(userId);
      if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured');
      try {
        const dbPool = getPool();
        await dbPool.query(
          `INSERT INTO astro_questions (user_id, question, answer) VALUES ($1, $2, $3)`,
          [id, question, answer]
        );
        return { success: true };
      } catch (error: any) {
        log.error('[DB] Error adding astro question', { error: error.message, userId });
        throw error;
      }
    },

    async getByUser(userId: string, limit = 10) {
      const id = toUserId(userId);
      if (!DATABASE_URL) return [];
      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          `SELECT question, answer, created_at
           FROM astro_questions
           WHERE user_id = $1
           ORDER BY created_at DESC
           LIMIT $2`,
          [id, limit]
        );
        return result.rows;
      } catch (error: any) {
        log.error('[DB] Error getting astro questions', { error: error.message, userId });
        throw error;
      }
    },

    async findRecentDuplicate(userId: string, question: string, windowSeconds = 20) {
      const id = toUserId(userId);
      const normalizedQuestion = normalizeOracleQuestion(question);
      if (!DATABASE_URL || !normalizedQuestion) return null;
      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          `SELECT question, answer, created_at
           FROM astro_questions
           WHERE user_id = $1
             AND LOWER(REGEXP_REPLACE(TRIM(question), '\s+', ' ', 'g')) = $2
             AND created_at >= NOW() - ($3 * INTERVAL '1 second')
           ORDER BY created_at DESC
           LIMIT 1`,
          [id, normalizedQuestion, windowSeconds]
        );
        return result.rows[0] || null;
      } catch (error: any) {
        log.error('[DB] Error getting recent duplicate astro question', { error: error.message, userId });
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
            lumi_balance: row.lumi_balance ?? 0,
            login_streak: row.login_streak ?? 0,
            chart_slots: row.chart_slots ?? 1,
            saved_charts_count: row.saved_charts_count ?? 0,
            created_at: row.created_at,
            last_login: row.last_login,
            last_seen_at: row.last_seen_at ?? row.last_login ?? null,
            is_admin: row.is_admin ?? false,
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
          total_lumi_balance: 0,
          active_users_7d: 0,
          need_attention_users: 0,
        };
      }

      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          `${ADMIN_USER_METRICS_CTE}
           SELECT
             COUNT(*)::int AS total_users,
             COUNT(*) FILTER (WHERE premium_until IS NOT NULL AND premium_until > NOW())::int AS active_premium_users,
             COALESCE(SUM(lumi_balance), 0)::int AS total_lumi_balance,
             COUNT(*) FILTER (WHERE last_seen_at >= NOW() - INTERVAL '7 days')::int AS active_users_7d,
             COUNT(*) FILTER (WHERE ${ADMIN_NEED_ATTENTION_SQL})::int AS need_attention_users
           FROM user_metrics`
        );

        return result.rows[0] || {
          total_users: 0,
          active_premium_users: 0,
          total_lumi_balance: 0,
          active_users_7d: 0,
          need_attention_users: 0,
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
      const recentLumiTransactions = await db.lumi_transactions.getHistory(userId, 6);
      const latestStarsPayment = await db.star_payments.getLatestByUser(userId);
      const recentSessions = await db.user_sessions.getRecentByUser(userId, 3);
      const recentOracleQuestions = await db.astro_questions.getByUser(userId, 3);
      const lastSeenAt = recentSessions[0]?.last_seen_at ?? null;
      const currentDeviceLabel = recentSessions[0]?.device_label ?? null;

      return {
        id: user.id,
        name: user.name || 'Unnamed user',
        birth_date: user.birth_date,
        birth_time: user.birth_time,
        birth_place: user.birth_place,
        premium_until: user.premium_until,
        is_premium: user.is_premium,
        lumi_balance: user.lumi_balance ?? 0,
        login_streak: user.login_streak ?? 0,
        chart_slots: user.chart_slots ?? 1,
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
        recent_lumi_transactions: recentLumiTransactions,
        recent_sessions: recentSessions,
        recent_oracle_questions: recentOracleQuestions,
        latest_stars_payment: latestStarsPayment,
      };
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

  /** Legacy compose templates (admin “Send” tab) — table legacy_notification_templates */
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

  /** dictionary (Lumia) */
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
