// Database connection utility for Railway
// This file handles connection to Railway Database
// 
// Uses process.env.DATABASE_URL from environment variables
// DATABASE_URL should be set in Railway Variables or .env file
// Format: postgresql://user:password@host:port/database

import { Pool, Client } from 'pg';

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

function normalizeOracleQuestion(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
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

function getPool(): Pool {
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

function serializeDailyNatalCardContent(content: any): string {
  return typeof content === 'string' ? content : JSON.stringify(content);
}

function parseDailyNatalCardContent(raw: any) {
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

/**
 * Lumia Database operations
 */
export const db = {
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
          const r = await dbPool.query('SELECT * FROM users WHERE id = $1', [id]);
          if (r.rows.length > 0) existingUser = r.rows[0];
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

    /** Buy one chart slot with Lumi. Atomic: deduct + increment chart_slots. */
    async buyChartSlot(userId: string, cost: number): Promise<{ success: true; newBalance: number; chartSlots: number }> {
      const id = toUserId(userId);
      if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured');
      const dbPool = getPool();
      const client = await dbPool.connect();
      try {
        await client.query('BEGIN');
        const result = await client.query(
          `UPDATE users SET lumi_balance = COALESCE(lumi_balance, 0) - $1, chart_slots = COALESCE(chart_slots, 1) + 1
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
      const normalizedExistingBirthDate = normalizeBirthDateValue(existing.birth_date);
      const normalizedRequestedBirthDate = normalizeBirthDateValue(birthDate);
      const normalizedExistingBirthTime = normalizeBirthTimeValue(existing.birth_time);
      const normalizedRequestedBirthTime = normalizeBirthTimeValue(birthTime);
      const inputChanged =
        normalizedExistingBirthDate !== normalizedRequestedBirthDate ||
        normalizedExistingBirthTime !== normalizedRequestedBirthTime ||
        existing.birth_place !== birthPlace;
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
          `SELECT stars_amount, created_at
           FROM star_payments
           WHERE user_id = $1
           ORDER BY created_at DESC
           LIMIT 1`,
          [id]
        );
        return result.rows.length > 0 ? result.rows[0] : null;
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
          `SELECT content FROM daily_natal_cards
           WHERE chart_id = $1 AND date = $2
           ORDER BY id DESC
           LIMIT 1`,
          [chartId, date]
        );
        if (result.rows.length === 0) return null;
        return parseDailyNatalCardContent(result.rows[0].content);
      } catch (error: any) {
        log.error('[DB] Error getting daily natal card by chart', { error: error.message, chartId, date });
        throw error;
      }
    },

    async setByChart(chartId: number, date: string, content: any) {
      if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured');
      try {
        const dbPool = getPool();
        const serializedContent = serializeDailyNatalCardContent(content);
        const updated = await dbPool.query(
          `UPDATE daily_natal_cards
           SET content = $3
           WHERE chart_id = $1 AND date = $2`,
          [chartId, date, serializedContent]
        );

        if ((updated.rowCount ?? 0) === 0) {
          await dbPool.query(
            `INSERT INTO daily_natal_cards (chart_id, date, content) VALUES ($1, $2, $3)`,
            [chartId, date, serializedContent]
          );
        }
        return { success: true };
      } catch (error: any) {
        log.error('[DB] Error setting daily natal card by chart', { error: error.message, chartId, date });
        throw error;
      }
    },

    async getByUser(userId: string, date: string) {
      const id = toUserId(userId);
      if (!DATABASE_URL) return null;
      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          `SELECT content FROM daily_natal_cards
           WHERE user_id = $1 AND date = $2
           ORDER BY id DESC
           LIMIT 1`,
          [id, date]
        );
        if (result.rows.length === 0) return null;
        return parseDailyNatalCardContent(result.rows[0].content);
      } catch (error: any) {
        log.error('[DB] Error getting daily natal card by user', { error: error.message, userId, date });
        throw error;
      }
    },

    async setByUser(userId: string, date: string, content: any) {
      const id = toUserId(userId);
      if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured');
      try {
        const dbPool = getPool();
        const serializedContent = serializeDailyNatalCardContent(content);
        const updated = await dbPool.query(
          `UPDATE daily_natal_cards
           SET content = $3
           WHERE user_id = $1 AND date = $2`,
          [id, date, serializedContent]
        );

        if ((updated.rowCount ?? 0) === 0) {
          await dbPool.query(
            `INSERT INTO daily_natal_cards (user_id, date, content) VALUES ($1, $2, $3)`,
            [id, date, serializedContent]
          );
        }
        return { success: true };
      } catch (error: any) {
        log.error('[DB] Error setting daily natal card by user', { error: error.message, userId, date });
        throw error;
      }
    },

    async getForPrimaryUser(userId: string, date: string) {
      const usesChartScope = await this.supportsChartScope();
      if (usesChartScope) {
        const chart = await db.natal_charts.getPrimary(userId);
        if (!chart) return null;
        return this.getByChart(chart.id, date);
      }
      return this.getByUser(userId, date);
    },

    async setForPrimaryUser(userId: string, date: string, content: any) {
      const usesChartScope = await this.supportsChartScope();
      if (usesChartScope) {
        const chart = await db.natal_charts.getPrimary(userId);
        if (!chart) throw new Error('PRIMARY_CHART_MISSING');
        return this.setByChart(chart.id, date, content);
      }
      return this.setByUser(userId, date, content);
    },

    /** Compatibility wrapper: resolves by chart scope when available, otherwise legacy user scope. */
    async get(userId: string, date: string) {
      return this.getForPrimaryUser(userId, date);
    },

    async set(userId: string, date: string, content: any) {
      return this.setForPrimaryUser(userId, date, content);
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

    async getByUser(userId: string, limit = 20) {
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
      if (!DATABASE_URL) return null;

      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          `SELECT question, answer, created_at
           FROM astro_questions
           WHERE user_id = $1
             AND created_at >= NOW() - ($2 * INTERVAL '1 second')
           ORDER BY created_at DESC
           LIMIT 10`,
          [id, windowSeconds]
        );

        const normalizedQuestion = normalizeOracleQuestion(question);
        const match = result.rows.find((row: any) => normalizeOracleQuestion(row.question) === normalizedQuestion);
        return match || null;
      } catch (error: any) {
        log.error('[DB] Error finding duplicate astro question', { error: error.message, userId });
        throw error;
      }
    },
  },

  admin: {
    async listUsers(options?: { q?: string; premium?: 'all' | 'premium' | 'free'; limit?: number }) {
      if (!DATABASE_URL) return [];

      const queryText = (options?.q || '').trim();
      const premium = options?.premium || 'all';
      const limit = Math.min(Math.max(options?.limit || 100, 1), 200);
      const like = `%${queryText}%`;

      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          `SELECT
             u.id,
             u.name,
             u.premium_until,
             COALESCE(u.lumi_balance, 0) AS lumi_balance,
             COALESCE(u.login_streak, 0) AS login_streak,
             COALESCE(u.chart_slots, 1) AS chart_slots,
             COALESCE(u.is_admin, FALSE) AS is_admin,
             u.created_at,
             u.last_login,
             COUNT(nc.id)::int AS saved_charts_count
           FROM users u
           LEFT JOIN natal_charts nc ON nc.user_id = u.id
           WHERE
             ($1 = '' OR COALESCE(u.name, '') ILIKE $2 OR CAST(u.id AS TEXT) ILIKE $2)
             AND (
               $3 = 'all'
               OR ($3 = 'premium' AND u.premium_until IS NOT NULL AND u.premium_until > NOW())
               OR ($3 = 'free' AND (u.premium_until IS NULL OR u.premium_until <= NOW()))
             )
           GROUP BY u.id
           ORDER BY u.created_at DESC
           LIMIT $4`,
          [queryText, like, premium, limit]
        );

        return result.rows.map((row: any) => ({
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
          is_admin: row.is_admin ?? false,
        }));
      } catch (error: any) {
        log.error('[DB] Error listing admin users', { error: error.message });
        throw error;
      }
    },

    async getUserDetail(userId: string) {
      const user = await db.users.get(userId);
      if (!user) return null;

      const charts = await db.natal_charts.getAll(userId);
      const primaryChart = charts.find((chart: any) => chart.is_primary) || null;
      const recentLumiTransactions = await db.lumi_transactions.getHistory(userId, 20);
      const latestStarsPayment = await db.star_payments.getLatestByUser(userId);

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
        latest_stars_payment: latestStarsPayment,
      };
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
