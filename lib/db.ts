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

/** Explicit lumi_transactions reason values for regenerations (no LIKE) */
const REGENERATION_REASONS = ['regenerate_natal', 'regenerate_deep_dive', 'regenerate_synastry'] as const;
function contentTypeToRegenerationReason(contentType: string): string {
  if (contentType === 'natal_intro') return 'regenerate_natal';
  if (contentType.startsWith('deep_dive_')) return 'regenerate_deep_dive';
  if (contentType === 'synastry') return 'regenerate_synastry';
  return 'regenerate_natal';
}

/** Strict interpretations.type values for Deep Dive */
const DEEP_DIVE_TYPES = ['deep_dive_personality', 'deep_dive_love', 'deep_dive_career', 'deep_dive_weakness', 'deep_dive_karma'] as const;
function topicToDeepDiveType(topic: string): string {
  const t = `deep_dive_${topic}`;
  return DEEP_DIVE_TYPES.includes(t as any) ? t : 'deep_dive_personality';
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
        } catch (_e) {}
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
      let u = await this.get(userId);
      if (u) return u;
      await this.set(userId, data || {});
      return this.get(userId);
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
          };
        });
      } catch (error: any) {
        log.error('[DB] Error getting all users', { error: error.message });
        throw error;
      }
    },
  },

  charts: {
    async get(userId: string) {
      const id = toUserId(userId);
      if (!DATABASE_URL) return null;
      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          `SELECT user_id, chart_data, birth_date, birth_time, birth_place, input_hash, created_at
           FROM natal_charts WHERE user_id = $1`,
          [id]
        );
        if (result.rows.length === 0) return null;
        const row = result.rows[0];
        return {
          user_id: row.user_id,
          chart_data: row.chart_data,
          birth_date: row.birth_date,
          birth_time: row.birth_time,
          birth_place: row.birth_place,
          input_hash: row.input_hash,
          calculated_at: row.created_at,
          created_at: row.created_at,
          updated_at: row.created_at
        };
      } catch (error: any) {
        log.error('[DB] Error getting chart', { error: error.message, userId });
        throw error;
      }
    },

    async needsRecalculation(userId: string, birthDate: string, birthTime: string, birthPlace: string): Promise<{ needsCalc: boolean; existingChart: any | null; reason: string }> {
      const existing = await this.get(userId);
      if (!existing) return { needsCalc: true, existingChart: null, reason: 'NO_EXISTING_CHART' };
      const inputChanged = existing.birth_date !== birthDate || existing.birth_time !== birthTime || existing.birth_place !== birthPlace;
      if (inputChanged) return { needsCalc: true, existingChart: existing, reason: 'BIRTH_DATA_CHANGED' };
      const chartData = existing.chart_data;
      if (!chartData || !chartData.sun || !chartData.moon) return { needsCalc: true, existingChart: existing, reason: 'INVALID_CHART_DATA' };
      return { needsCalc: false, existingChart: existing, reason: 'CACHE_HIT' };
    },

    async set(userId: string, chartData: any, birthDate?: string, birthTime?: string, birthPlace?: string) {
      const id = toUserId(userId);
      if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured');
      try {
        const dbPool = getPool();
        const data = chartData.chart_data || chartData;
        const inputHash = birthDate && birthPlace
          ? Buffer.from(`${birthDate}|${birthTime || '12:00'}|${birthPlace}`).toString('base64').substring(0, 64)
          : null;
        const result = await dbPool.query(
          `INSERT INTO natal_charts (user_id, chart_data, birth_date, birth_time, birth_place, input_hash)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (user_id) DO UPDATE SET
             chart_data = EXCLUDED.chart_data,
             birth_date = EXCLUDED.birth_date,
             birth_time = EXCLUDED.birth_time,
             birth_place = EXCLUDED.birth_place,
             input_hash = EXCLUDED.input_hash
           RETURNING user_id, chart_data, birth_date, birth_time, birth_place, input_hash, created_at`,
          [id, JSON.stringify(data), birthDate, birthTime, birthPlace, inputHash]
        );
        const row = result.rows[0];
        return {
          user_id: row.user_id,
          chart_data: row.chart_data,
          birth_date: row.birth_date,
          birth_time: row.birth_time,
          birth_place: row.birth_place,
          input_hash: row.input_hash,
          calculated_at: row.created_at
        };
      } catch (error: any) {
        log.error('[DB] Error setting chart', {
          error: error.message,
          userId
        });
        throw error;
      }
    },
  },

  /** OpenAI cache - interpretations table (Lumia) */
  interpretations: {
    async getByHash(userId: string, type: string, inputHash: string) {
      const id = toUserId(userId);
      if (!DATABASE_URL) return null;
      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          `SELECT content, created_at FROM interpretations WHERE user_id = $1 AND type = $2 AND input_hash = $3`,
          [id, type, inputHash]
        );
        if (result.rows.length === 0) return null;
        return { content: result.rows[0].content, updatedAt: result.rows[0].created_at };
      } catch (error: any) {
        log.error('[DB] Error getting interpretation', { error: error.message, userId, type });
        throw error;
      }
    },

    async set(userId: string, type: string, inputHash: string, content: string) {
      const id = toUserId(userId);
      if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured');
      try {
        const dbPool = getPool();
        await dbPool.query(
          `INSERT INTO interpretations (user_id, type, input_hash, content)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id, type, input_hash) DO UPDATE SET content = EXCLUDED.content`,
          [id, type, inputHash, content]
        );
        return { success: true };
      } catch (error: any) {
        log.error('[DB] Error setting interpretation', { error: error.message, userId, type });
        throw error;
      }
    },
  },

  /** Weather - uses users.weather_city, latitude, longitude (no separate user_settings table) */
  userSettings: {
    async get(userId: string) {
      const id = toUserId(userId);
      if (!DATABASE_URL) return null;
      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          `SELECT id, weather_city, latitude, longitude FROM users WHERE id = $1`,
          [id]
        );
        if (result.rows.length === 0) return null;
        const row = result.rows[0];
        return {
          userId: String(row.id),
          weatherCity: row.weather_city,
          weatherLat: row.latitude,
          weatherLon: row.longitude,
          weatherUnits: null,
          timezone: null,
          updatedAt: null
        };
      } catch (error: any) {
        log.error('[DB] Error getting user settings', { error: error.message, userId });
        throw error;
      }
    },

    async setWeatherCity(userId: string, city: string | null, lat?: number, lon?: number) {
      const id = toUserId(userId);
      if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured');
      let validCity: string | null = null;
      if (city !== null && city !== undefined) {
        const trimmed = String(city).trim();
        if (trimmed.length >= 2 && trimmed.length <= 64) validCity = trimmed;
        else if (trimmed.length > 0) throw new Error(`City name must be 2-64 characters, got ${trimmed.length}`);
      }
      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          `INSERT INTO users (id, weather_city, latitude, longitude)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (id) DO UPDATE SET
             weather_city = EXCLUDED.weather_city,
             latitude = EXCLUDED.latitude,
             longitude = EXCLUDED.longitude
           RETURNING id, weather_city, latitude, longitude`,
          [id, validCity, lat ?? null, lon ?? null]
        );
        const row = result.rows[0];
        return {
          userId: String(row.id),
          weatherCity: row.weather_city,
          weatherLat: row.latitude,
          weatherLon: row.longitude,
          updatedAt: new Date().toISOString()
        };
      } catch (error: any) {
        log.error('[DB] Error setting weather city', {
          error: error.message,
          userId,
          city
        });
        throw error;
      }
    }
  },

  /** Daily natal card (personal horoscope per user/date) - Lumia daily_natal_cards */
  dailyHoroscope: {
    async get(userId: string, dateKey: string) {
      const id = toUserId(userId);
      if (!DATABASE_URL) return null;
      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          `SELECT content FROM daily_natal_cards WHERE user_id = $1 AND date = $2`,
          [id, dateKey]
        );
        if (result.rows.length === 0) return null;
        const row = result.rows[0];
        const content = typeof row.content === 'string' ? JSON.parse(row.content) : row.content;
        return { content, zodiacSign: content?.date ? null : null, createdAt: null };
      } catch (error: any) {
        log.error('[DB] Error getting daily horoscope', { error: error.message, userId, dateKey });
        throw error;
      }
    },

    async set(userId: string, dateKey: string, content: any, _zodiacSign?: string) {
      const id = toUserId(userId);
      if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured');
      try {
        const dbPool = getPool();
        await dbPool.query(
          `INSERT INTO daily_natal_cards (user_id, date, content)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id, date) DO UPDATE SET content = EXCLUDED.content`,
          [id, dateKey, typeof content === 'string' ? content : JSON.stringify(content)]
        );
        return { content, zodiacSign: null, createdAt: new Date().toISOString() };
      } catch (error: any) {
        log.error('[DB] Error setting daily horoscope', { error: error.message, userId, dateKey });
        throw error;
      }
    }
  },

  // Cached texts operations
  cachedTexts: {
    async getNatalSummary(userId: string) {
      log.info(`[DB] Getting cached natal summary for user: ${userId}`);
      
      if (!DATABASE_URL) return null;

      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          'SELECT natal_summary, natal_summary_updated_at FROM users WHERE id = $1',
          [userId]
        );
        
        if (result.rows.length === 0 || !result.rows[0].natal_summary) {
          return null;
        }

        return {
          data: result.rows[0].natal_summary,
          updatedAt: result.rows[0].natal_summary_updated_at
        };
      } catch (error: any) {
        log.error('[DB] Error getting cached natal summary', { error: error.message, userId });
        throw error;
      }
    },

    async setNatalSummary(userId: string, data: string) {
      log.info(`[DB] Setting cached natal summary for user: ${userId}`);
      
      if (!DATABASE_URL) {
        throw new Error('DATABASE_URL is not configured');
      }

      try {
        const dbPool = getPool();
        await dbPool.query(
          `UPDATE users 
           SET natal_summary = $1, natal_summary_updated_at = CURRENT_TIMESTAMP 
           WHERE id = $2`,
          [data, userId]
        );
        
        return { success: true };
      } catch (error: any) {
        log.error('[DB] Error setting cached natal summary', { error: error.message, userId });
        throw error;
      }
    },

    async getFullNatal(userId: string) {
      log.info(`[DB] Getting cached full natal for user: ${userId}`);
      
      if (!DATABASE_URL) return null;

      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          'SELECT full_natal, full_natal_updated_at FROM users WHERE id = $1',
          [userId]
        );
        
        if (result.rows.length === 0 || !result.rows[0].full_natal) {
          return null;
        }

        return {
          data: result.rows[0].full_natal,
          updatedAt: result.rows[0].full_natal_updated_at
        };
      } catch (error: any) {
        log.error('[DB] Error getting cached full natal', { error: error.message, userId });
        throw error;
      }
    },

    async setFullNatal(userId: string, data: string) {
      log.info(`[DB] Setting cached full natal for user: ${userId}`);
      
      if (!DATABASE_URL) {
        throw new Error('DATABASE_URL is not configured');
      }

      try {
        const dbPool = getPool();
        await dbPool.query(
          `UPDATE users 
           SET full_natal = $1, full_natal_updated_at = CURRENT_TIMESTAMP 
           WHERE id = $2`,
          [data, userId]
        );
        
        return { success: true };
      } catch (error: any) {
        log.error('[DB] Error setting cached full natal', { error: error.message, userId });
        throw error;
      }
    },
  },

  // Synastry cache operations
  synastryCache: {
    async get(userId: string, partnerData: any) {
      log.info(`[DB] Getting cached synastry for user: ${userId}`);
      
      if (!DATABASE_URL) return null;

      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          'SELECT brief_analysis, full_analysis, updated_at FROM synastry_cache WHERE user_id = $1 AND partner_data = $2',
          [userId, JSON.stringify(partnerData)]
        );
        
        if (result.rows.length === 0) {
          return null;
        }

        return {
          briefAnalysis: result.rows[0].brief_analysis,
          fullAnalysis: result.rows[0].full_analysis,
          updatedAt: result.rows[0].updated_at
        };
      } catch (error: any) {
        log.error('[DB] Error getting cached synastry', { error: error.message, userId });
        throw error;
      }
    },

    async set(userId: string, partnerData: any, briefAnalysis?: string, fullAnalysis?: string) {
      log.info(`[DB] Setting cached synastry for user: ${userId}`);
      
      if (!DATABASE_URL) {
        throw new Error('DATABASE_URL is not configured');
      }

      try {
        const dbPool = getPool();
        await dbPool.query(
          `INSERT INTO synastry_cache (user_id, partner_data, brief_analysis, full_analysis, updated_at)
           VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
           ON CONFLICT (user_id, partner_data) DO UPDATE SET
             brief_analysis = COALESCE(EXCLUDED.brief_analysis, synastry_cache.brief_analysis),
             full_analysis = COALESCE(EXCLUDED.full_analysis, synastry_cache.full_analysis),
             updated_at = CURRENT_TIMESTAMP`,
          [userId, JSON.stringify(partnerData), briefAnalysis, fullAnalysis]
        );
        
        return { success: true };
      } catch (error: any) {
        log.error('[DB] Error setting cached synastry', { error: error.message, userId });
        throw error;
      }
    },
  },

  // Forecasts cache operations
  forecastsCache: {
    async get(userId: string, periodType: 'day' | 'week' | 'month', periodDate: string) {
      log.info(`[DB] Getting cached forecast for user: ${userId}, period: ${periodType}, date: ${periodDate}`);
      
      if (!DATABASE_URL) return null;

      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          'SELECT content, created_at FROM forecasts_cache WHERE user_id = $1 AND period_type = $2 AND period_date = $3',
          [userId, periodType, periodDate]
        );
        
        if (result.rows.length === 0) {
          return null;
        }

        return {
          data: result.rows[0].content,
          createdAt: result.rows[0].created_at
        };
      } catch (error: any) {
        log.error('[DB] Error getting cached forecast', { error: error.message, userId });
        throw error;
      }
    },

    async set(userId: string, periodType: 'day' | 'week' | 'month', periodDate: string, content: any) {
      log.info(`[DB] Setting cached forecast for user: ${userId}, period: ${periodType}, date: ${periodDate}`);
      
      if (!DATABASE_URL) {
        throw new Error('DATABASE_URL is not configured');
      }

      try {
        const dbPool = getPool();
        await dbPool.query(
          `INSERT INTO forecasts_cache (user_id, period_type, period_date, content)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id, period_type, period_date) DO UPDATE SET
             content = EXCLUDED.content,
             created_at = CURRENT_TIMESTAMP`,
          [userId, periodType, periodDate, JSON.stringify(content)]
        );
        
        return { success: true };
      } catch (error: any) {
        log.error('[DB] Error setting cached forecast', { error: error.message, userId });
        throw error;
      }
    },
  },

  /** Regenerations - tracked via lumi_transactions with explicit reason values */
  regenerations: {
    async getCountToday(userId: string, contentType: string) {
      const id = toUserId(userId);
      const reason = contentTypeToRegenerationReason(contentType);
      if (!DATABASE_URL) return 0;
      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          `SELECT COUNT(*) FROM lumi_transactions
           WHERE user_id = $1 AND reason = $2 AND created_at::date = CURRENT_DATE`,
          [id, reason]
        );
        return parseInt(result.rows[0].count);
      } catch (error: any) {
        log.error('[DB] Error getting regeneration count', { error: error.message, userId });
        throw error;
      }
    },

    async getCountThisWeek(userId: string, _contentType: string) {
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
        log.error('[DB] Error getting regeneration count for week', { error: error.message, userId });
        throw error;
      }
    },

    async add(userId: string, contentType: string, _wasPaid: boolean, _starsCost: number) {
      const id = toUserId(userId);
      const reason = contentTypeToRegenerationReason(contentType);
      if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured');
      try {
        const dbPool = getPool();
        await dbPool.query(
          `INSERT INTO lumi_transactions (user_id, amount, reason) VALUES ($1, 0, $2)`,
          [id, reason]
        );
        return { success: true };
      } catch (error: any) {
        log.error('[DB] Error adding regeneration record', { error: error.message, userId });
        throw error;
      }
    },
  },

  /** Stars/Lumi balance - uses users.lumi_balance (Lumia) */
  starsBalance: {
    async get(userId: string) {
      const id = toUserId(userId);
      if (!DATABASE_URL) return 0;
      try {
        const dbPool = getPool();
        const result = await dbPool.query('SELECT lumi_balance FROM users WHERE id = $1', [id]);
        return result.rows.length === 0 ? 0 : (result.rows[0].lumi_balance ?? 0);
      } catch (error: any) {
        log.error('[DB] Error getting stars balance', { error: error.message, userId });
        throw error;
      }
    },

    async add(userId: string, amount: number) {
      const id = toUserId(userId);
      if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured');
      try {
        const dbPool = getPool();
        await dbPool.query(
          `UPDATE users SET lumi_balance = COALESCE(lumi_balance, 0) + $1 WHERE id = $2`,
          [amount, id]
        );
        await dbPool.query(
          `INSERT INTO lumi_transactions (user_id, amount, reason) VALUES ($1, $2, 'refund')`,
          [id, amount]
        );
        return { success: true };
      } catch (error: any) {
        log.error('[DB] Error adding stars', { error: error.message, userId });
        throw error;
      }
    },

    async deduct(userId: string, amount: number) {
      const id = toUserId(userId);
      if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured');
      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          `UPDATE users SET lumi_balance = GREATEST(COALESCE(lumi_balance, 0) - $1, 0)
           WHERE id = $2 AND COALESCE(lumi_balance, 0) >= $1
           RETURNING lumi_balance`,
          [amount, id]
        );
        if (result.rows.length === 0) throw new Error('Insufficient stars balance');
        await dbPool.query(
          `INSERT INTO lumi_transactions (user_id, amount, reason) VALUES ($1, $2, 'regenerate_deduct')`,
          [id, -amount]
        );
        return { success: true, newBalance: result.rows[0].lumi_balance };
      } catch (error: any) {
        log.error('[DB] Error deducting stars', { error: error.message, userId });
        throw error;
      }
    },
  },

  /** Deep dive analyses - interpretations with strict type values */
  deepDiveAnalyses: {
    async get(userId: string, topic: string) {
      const id = toUserId(userId);
      const type = topicToDeepDiveType(topic);
      if (!DATABASE_URL) return null;
      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          `SELECT content, created_at FROM interpretations
           WHERE user_id = $1 AND type = $2 AND input_hash = $3`,
          [id, type, topic]
        );
        if (result.rows.length === 0) return null;
        return { analysis: result.rows[0].content, updatedAt: result.rows[0].created_at };
      } catch (error: any) {
        log.error('[DB] Error getting deep dive analysis', { error: error.message, userId, topic });
        throw error;
      }
    },

    async set(userId: string, topic: string, analysis: string) {
      const id = toUserId(userId);
      const type = topicToDeepDiveType(topic);
      if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured');
      try {
        const dbPool = getPool();
        await dbPool.query(
          `INSERT INTO interpretations (user_id, type, input_hash, content)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id, type, input_hash) DO UPDATE SET content = EXCLUDED.content`,
          [id, type, topic, analysis]
        );
        return { success: true };
      } catch (error: any) {
        log.error('[DB] Error setting deep dive analysis', { error: error.message, userId, topic });
        throw error;
      }
    },

    async getAll(userId: string) {
      const id = toUserId(userId);
      if (!DATABASE_URL) return {};
      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          `SELECT input_hash as topic, content as analysis FROM interpretations
           WHERE user_id = $1 AND type IN ('deep_dive_personality', 'deep_dive_love', 'deep_dive_career', 'deep_dive_weakness', 'deep_dive_karma')`,
          [id]
        );
        const analyses: Record<string, string> = {};
        result.rows.forEach((row: any) => {
          analyses[row.topic] = row.analysis;
        });
        return analyses;
      } catch (error: any) {
        log.error('[DB] Error getting all deep dive analyses', { error: error.message, userId });
        return {};
      }
    }
  },

  // Daily horoscopes cache operations (by zodiac sign)
  dailyHoroscopesCache: {
    async get(zodiacSign: string, date: string) {
      log.info(`[DB] Getting cached daily horoscope for sign: ${zodiacSign}, date: ${date}`);
      
      if (!DATABASE_URL) return null;

      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          'SELECT horoscope_data, updated_at FROM daily_horoscopes_cache WHERE zodiac_sign = $1 AND date = $2',
          [zodiacSign, date]
        );
        
        if (result.rows.length === 0) {
          return null;
        }

        return {
          data: result.rows[0].horoscope_data,
          updatedAt: result.rows[0].updated_at
        };
      } catch (error: any) {
        log.error('[DB] Error getting cached daily horoscope', { error: error.message, zodiacSign, date });
        throw error;
      }
    },

    async set(zodiacSign: string, date: string, horoscopeData: any) {
      log.info(`[DB] Setting cached daily horoscope for sign: ${zodiacSign}, date: ${date}`);
      
      if (!DATABASE_URL) {
        throw new Error('DATABASE_URL is not configured');
      }

      try {
        const dbPool = getPool();
        await dbPool.query(
          `INSERT INTO daily_horoscopes_cache (zodiac_sign, date, horoscope_data, updated_at)
           VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
           ON CONFLICT (zodiac_sign, date) DO UPDATE SET
             horoscope_data = EXCLUDED.horoscope_data,
             updated_at = CURRENT_TIMESTAMP`,
          [zodiacSign, date, JSON.stringify(horoscopeData)]
        );
        
        return { success: true };
      } catch (error: any) {
        log.error('[DB] Error setting cached daily horoscope', { error: error.message, zodiacSign, date });
        throw error;
      }
    },
  },
};
