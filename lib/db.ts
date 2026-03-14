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
        const inputHash = Buffer.from(`${data.birthDate}|${data.birthTime || '12:00'}|${data.birthPlace}`).toString('base64').substring(0, 64);
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
        const inputHash = birthDate && birthPlace
          ? Buffer.from(`${birthDate}|${birthTime || '12:00'}|${birthPlace}`).toString('base64').substring(0, 64)
          : null;
        const existing = await this.getPrimary(userId);
        if (existing) {
          const result = await dbPool.query(
            `UPDATE natal_charts SET chart_data = $1, birth_date = $2, birth_time = $3, birth_place = $4, input_hash = $5
             WHERE id = $6 RETURNING id, user_id, name, chart_data, birth_date, birth_time, birth_place, input_hash, is_primary, created_at`,
            [JSON.stringify(data), birthDate, birthTime, birthPlace, inputHash, existing.id]
          );
          return this._rowToChart(result.rows[0]);
        }
        const charts = await this.getAll(userId);
        const isPrimary = charts.length === 0;
        const result = await dbPool.query(
          `INSERT INTO natal_charts (user_id, name, chart_data, birth_date, birth_time, birth_place, input_hash, is_primary)
           VALUES ($1, 'Моя карта', $2, $3, $4, $5, $6, $7)
           RETURNING id, user_id, name, chart_data, birth_date, birth_time, birth_place, input_hash, is_primary, created_at`,
          [id, JSON.stringify(data), birthDate, birthTime, birthPlace, inputHash, isPrimary]
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
    /** Chart-level cache: natal_intro, deep_dive_*, daily_natal_card */
    async getByChart(chartId: number, type: string, inputHash: string) {
      if (!DATABASE_URL) return null;
      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          `SELECT content, created_at FROM interpretations WHERE chart_id = $1 AND type = $2 AND input_hash = $3`,
          [chartId, type, inputHash]
        );
        if (result.rows.length === 0) return null;
        return { content: result.rows[0].content, updatedAt: result.rows[0].created_at };
      } catch (error: any) {
        log.error('[DB] Error getting interpretation by chart', { error: error.message, chartId, type });
        throw error;
      }
    },

    async setByChart(chartId: number, type: string, inputHash: string, content: string) {
      if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured');
      try {
        const dbPool = getPool();
        await dbPool.query(
          `INSERT INTO interpretations (chart_id, type, input_hash, content)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (chart_id, type, input_hash) DO UPDATE SET content = EXCLUDED.content`,
          [chartId, type, inputHash, content]
        );
        return { success: true };
      } catch (error: any) {
        log.error('[DB] Error setting interpretation by chart', { error: error.message, chartId, type });
        throw error;
      }
    },

    /** User-level cache: question_answer, oracle_chat */
    async getByUser(userId: string, type: string, inputHash: string) {
      const id = toUserId(userId);
      if (!DATABASE_URL) return null;
      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          `SELECT content, created_at FROM interpretations WHERE user_id = $1 AND type = $2 AND input_hash = $3 AND chart_id IS NULL`,
          [id, type, inputHash]
        );
        if (result.rows.length === 0) return null;
        return { content: result.rows[0].content, updatedAt: result.rows[0].created_at };
      } catch (error: any) {
        log.error('[DB] Error getting interpretation by user', { error: error.message, userId, type });
        throw error;
      }
    },

    async setByUser(userId: string, type: string, inputHash: string, content: string) {
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
        log.error('[DB] Error setting interpretation by user', { error: error.message, userId, type });
        throw error;
      }
    },

    /** Resolve by chartId or userId (for chart-level types). Uses primary chart when chartId not provided. */
    async getByHash(chartIdOrUserId: number | string, type: string, inputHash: string) {
      if (typeof chartIdOrUserId === 'number') {
        return this.getByChart(chartIdOrUserId, type, inputHash);
      }
      const chart = await db.natal_charts.getPrimary(chartIdOrUserId);
      if (chart) return this.getByChart(chart.id, type, inputHash);
      return this.getByUser(chartIdOrUserId, type, inputHash);
    },

    async set(chartIdOrUserId: number | string, type: string, inputHash: string, content: string) {
      if (typeof chartIdOrUserId === 'number') {
        return this.setByChart(chartIdOrUserId, type, inputHash, content);
      }
      const chart = await db.natal_charts.getPrimary(chartIdOrUserId);
      if (chart) return this.setByChart(chart.id, type, inputHash, content);
      return this.setByUser(chartIdOrUserId, type, inputHash, content);
    },
  },

  /** lumi_transactions - balance and history (Lumia) */
  lumi_transactions: {
    async add(userId: string, amount: number, reason: string) {
      const id = toUserId(userId);
      if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured');
      try {
        const dbPool = getPool();
        await dbPool.query(
          `UPDATE users SET lumi_balance = COALESCE(lumi_balance, 0) + $1 WHERE id = $2`,
          [amount, id]
        );
        await dbPool.query(
          `INSERT INTO lumi_transactions (user_id, amount, reason) VALUES ($1, $2, $3)`,
          [id, amount, reason]
        );
        return { success: true };
      } catch (error: any) {
        log.error('[DB] Error adding lumi transaction', { error: error.message, userId });
        throw error;
      }
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
          `INSERT INTO lumi_transactions (user_id, amount, reason) VALUES ($1, $2, $3)`,
          [id, -amount, reason]
        );
        return { success: true, newBalance: result.rows[0].lumi_balance };
      } catch (error: any) {
        log.error('[DB] Error deducting', { error: error.message, userId });
        throw error;
      }
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
        await dbPool.query(
          `INSERT INTO daily_natal_cards (chart_id, date, content) VALUES ($1, $2, $3)
           ON CONFLICT (chart_id, date) DO UPDATE SET content = EXCLUDED.content`,
          [chartId, date, typeof content === 'string' ? content : JSON.stringify(content)]
        );
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

    async getByUser(userId: string) {
      const id = toUserId(userId);
      if (!DATABASE_URL) return [];
      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          `SELECT question, answer, created_at FROM astro_questions WHERE user_id = $1 ORDER BY created_at DESC`,
          [id]
        );
        return result.rows;
      } catch (error: any) {
        log.error('[DB] Error getting astro questions', { error: error.message, userId });
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
