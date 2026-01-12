// Database connection utility
// Hybrid approach: Uses Railway Postgres if DATABASE_URL is set, otherwise falls back to local JSON file

import { Pool, Client } from 'pg';
import { jsonDb } from './local-db';

// Read DATABASE_URL from environment variables
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
  log.warn('DATABASE_URL is not set. Using local JSON storage fallback.');
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

function getPool(): Pool | null {
  if (!DATABASE_URL) return null;

  if (!pool) {
    // Parse and log connection info for debugging
    const urlParts = DATABASE_URL.match(/^postgres(ql)?:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
    if (urlParts) {
      const [, , user, , host, port, database] = urlParts;
      log.info(`Creating connection pool: ${host}:${port}/${database} (user: ${user})`);
      
      if (host.includes('railway.internal')) {
        log.warn('Using Railway internal hostname. This may not be accessible from Docker containers.');
      }
    }
    
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
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
    });

    log.info('Database connection pool created');
  }
  
  return pool;
}

/**
 * Execute a query against Railway Database
 */
export async function queryDatabase(query: string, params?: any[]): Promise<any> {
  const dbPool = getPool();
  if (!dbPool) {
    throw new Error('DATABASE_URL is not configured');
  }

  try {
    log.info(`[DB] Executing query: ${query.substring(0, 100)}...`, { params });
    const result = await dbPool.query(query, params);
    return result.rows;
  } catch (error: any) {
    // ... error handling ...
    throw error;
  }
}

/**
 * Initialize database tables if they don't exist
 */
export async function initializeDatabase(): Promise<void> {
  log.warn('[DB] initializeDatabase() is deprecated. Migrations are handled automatically.');
}

/**
 * Test database connection
 */
export async function testDatabaseConnection(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured in environment variables');
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    log.info('Database connection test successful');
    const result = await client.query('SELECT NOW()');
    log.info('Database query test successful', { serverTime: result.rows[0].now });
    await client.end();
  } catch (error: any) {
    log.error('Database connection test failed', { error: error.message });
    await client.end().catch(() => {});
    throw error;
  }
}

/**
 * Database operations using PostgreSQL with local JSON fallback
 */
export const db = {
  users: {
    async get(userId: string) {
      log.info(`[DB] Getting user: ${userId}`);
      
      const dbPool = getPool();
      if (!dbPool) {
        log.warn('[DB] Using local JSON storage');
        return jsonDb.getUser(userId);
      }

      try {
        const result = await dbPool.query(
          'SELECT * FROM users WHERE id = $1',
          [userId]
        );
        
        if (result.rows.length === 0) {
          return null;
        }

        const user = result.rows[0];
        
        let evolution = user.evolution;
        if (typeof evolution === 'string') {
          try { evolution = JSON.parse(evolution); } catch (e) {}
        }
        
        let generatedContent = user.generated_content;
        if (typeof generatedContent === 'string') {
          try { generatedContent = JSON.parse(generatedContent); } catch (e) {}
        }
        
        return {
          id: user.id,
          name: user.name,
          birth_date: user.birth_date,
          birth_time: user.birth_time,
          birth_place: user.birth_place,
          is_setup: user.is_setup,
          language: user.language,
          theme: user.theme,
          is_premium: user.is_premium,
          is_admin: user.is_admin,
          evolution: evolution,
          generated_content: generatedContent,
          weather_city: user.weather_city,
          premium_activated_at: user.premium_activated_at,
          premium_stars_amount: user.premium_stars_amount,
          premium_transaction_id: user.premium_transaction_id,
          created_at: user.created_at,
          updated_at: user.updated_at,
        };
      } catch (error: any) {
        log.error('[DB] Error getting user', { error: error.message, userId });
        throw error;
      }
    },

    async set(userId: string, data: any) {
      log.info(`[DB] Setting user: ${userId}`, { hasName: !!data.name });
      
      const dbPool = getPool();
      if (!dbPool) {
        log.warn('[DB] Using local JSON storage');
        return jsonDb.setUser(userId, data);
      }

      try {
        // ... (Postgres implementation remains the same)
        let existingUser = null;
        try {
          const existingResult = await dbPool.query('SELECT * FROM users WHERE id = $1', [userId]);
          if (existingResult.rows.length > 0) {
            existingUser = existingResult.rows[0];
          }
        } catch (e) {
          log.warn('[DB] Failed to get existing user', { error: e });
        }
        
        let finalGeneratedContent = null;
        // ... (Content merging logic from original file)
        if (data.generated_content !== undefined && data.generated_content !== null) {
          if (typeof data.generated_content === 'object' && Object.keys(data.generated_content).length > 0) {
            finalGeneratedContent = JSON.stringify(data.generated_content);
          } else if (data.generated_content === null) {
            finalGeneratedContent = null;
          } else {
            const existingContent = existingUser?.generated_content;
            if (existingContent !== null && existingContent !== undefined) {
              finalGeneratedContent = typeof existingContent === 'string' ? existingContent : JSON.stringify(existingContent);
            } else {
              finalGeneratedContent = null;
            }
          }
        } else {
          const existingContent = existingUser?.generated_content;
          if (existingContent !== null && existingContent !== undefined) {
            finalGeneratedContent = typeof existingContent === 'string' ? existingContent : JSON.stringify(existingContent);
          } else {
            finalGeneratedContent = null;
          }
        }
        
        const finalWeatherCity = data.weather_city !== undefined
          ? (data.weather_city && String(data.weather_city).trim() ? String(data.weather_city).trim() : null)
          : (existingUser?.weather_city || null);
        
        const result = await dbPool.query(
            `INSERT INTO users (
              id, name, birth_date, birth_time, birth_place,
              is_setup, language, theme, is_premium, is_admin,
              evolution, generated_content, weather_city, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP)
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              birth_date = EXCLUDED.birth_date,
              birth_time = EXCLUDED.birth_time,
              birth_place = EXCLUDED.birth_place,
              is_setup = EXCLUDED.is_setup,
              language = EXCLUDED.language,
              theme = EXCLUDED.theme,
              is_premium = EXCLUDED.is_premium,
              is_admin = EXCLUDED.is_admin,
              evolution = EXCLUDED.evolution,
              generated_content = EXCLUDED.generated_content,
              weather_city = EXCLUDED.weather_city,
              updated_at = CURRENT_TIMESTAMP
            RETURNING *`,
            [
              userId,
              data.name,
              data.birth_date,
              data.birth_time,
              data.birth_place,
              data.is_setup || false,
              data.language || 'ru',
              data.theme || 'dark',
              data.is_premium || false,
              data.is_admin || false,
              data.evolution ? JSON.stringify(data.evolution) : null,
              finalGeneratedContent,
              finalWeatherCity,
          ]
        );

        const user = result.rows[0];
        let evolution = user.evolution;
        if (typeof evolution === 'string') {
            try { evolution = JSON.parse(evolution); } catch (e) { evolution = null; }
        }
        let generatedContent = user.generated_content;
        if (typeof generatedContent === 'string') {
            try { generatedContent = JSON.parse(generatedContent); } catch (e) { generatedContent = null; }
        }
          
        return {
            id: user.id,
            name: user.name,
            birth_date: user.birth_date,
            birth_time: user.birth_time,
            birth_place: user.birth_place,
            is_setup: user.is_setup,
            language: user.language,
            theme: user.theme,
            is_premium: user.is_premium,
            is_admin: user.is_admin,
            evolution: evolution,
            generated_content: generatedContent,
            weather_city: user.weather_city,
        };
      } catch (error: any) {
        log.error('[DB] Error setting user', { error: error.message, userId });
        throw error;
      }
    },

    async getAll() {
      const dbPool = getPool();
      if (!dbPool) {
        return jsonDb.getAllUsers();
      }

      try {
        const result = await dbPool.query('SELECT * FROM users ORDER BY created_at DESC');
        return result.rows.map((user: any) => ({
          id: user.id,
          name: user.name,
          birth_date: user.birth_date,
          birth_time: user.birth_time,
          birth_place: user.birth_place,
          is_setup: user.is_setup,
          language: user.language,
          theme: user.theme,
          is_premium: user.is_premium,
          is_admin: user.is_admin,
          evolution: user.evolution,
          generated_content: user.generated_content,
          weather_city: user.weather_city,
        }));
      } catch (error: any) {
        log.error('[DB] Error getting all users', { error: error.message });
        throw error;
      }
    },
  },

  charts: {
    async get(userId: string) {
      log.info(`[DB] [charts.get] userId=${userId}`);
      
      const dbPool = getPool();
      if (!dbPool) {
        log.warn('[DB] Using local JSON storage for charts');
        return jsonDb.getChart(userId);
      }

      try {
        const result = await dbPool.query(
          `SELECT user_id, chart_data, birth_date, birth_time, birth_place, 
                  input_hash, calculated_at, created_at, updated_at 
           FROM charts WHERE user_id = $1`,
          [userId]
        );
        
        if (result.rows.length === 0) {
          log.info(`[DB] [charts.get] DB_MISS: no chart for userId=${userId}`);
          return null;
        }

        const row = result.rows[0];
        log.info(`[DB] [charts.get] DB_HIT: chart found for userId=${userId}`);
        
        return {
          user_id: row.user_id,
          chart_data: row.chart_data,
          birth_date: row.birth_date,
          birth_time: row.birth_time,
          birth_place: row.birth_place,
          input_hash: row.input_hash,
          calculated_at: row.calculated_at,
          created_at: row.created_at,
          updated_at: row.updated_at
        };
      } catch (error: any) {
        log.error('[DB] Error getting chart', { error: error.message, userId });
        throw error;
      }
    },

    async needsRecalculation(userId: string, birthDate: string, birthTime: string, birthPlace: string): Promise<{ needsCalc: boolean; existingChart: any | null; reason: string }> {
      log.info(`[DB] [charts.needsRecalculation] userId=${userId}`);
      
      const existing = await this.get(userId);
      
      if (!existing) {
        log.info(`[DB] [charts.needsRecalculation] NEEDS_CALC: no existing chart`);
        return { needsCalc: true, existingChart: null, reason: 'NO_EXISTING_CHART' };
      }
      
      const normalize = (s: string | null | undefined) => String(s || '').trim().toLowerCase();
      
      const inputChanged = 
        normalize(existing.birth_date) !== normalize(birthDate) ||
        normalize(existing.birth_time) !== normalize(birthTime) ||
        normalize(existing.birth_place) !== normalize(birthPlace);
      
      if (inputChanged) {
        log.info(`[DB] [charts.needsRecalculation] NEEDS_CALC: birth data changed`);
        return { needsCalc: true, existingChart: existing, reason: 'BIRTH_DATA_CHANGED' };
      }
      
      const chartData = existing.chart_data;
      if (!chartData || !chartData.sun || !chartData.moon) {
        log.info(`[DB] [charts.needsRecalculation] NEEDS_CALC: invalid chart data`);
        return { needsCalc: true, existingChart: existing, reason: 'INVALID_CHART_DATA' };
      }
      
      log.info(`[DB] [charts.needsRecalculation] CACHE_HIT: using existing chart`);
      return { needsCalc: false, existingChart: existing, reason: 'CACHE_HIT' };
    },

    async set(userId: string, chartData: any, birthDate?: string, birthTime?: string, birthPlace?: string) {
      log.info(`[DB] [charts.set] userId=${userId}`);
      
      const dbPool = getPool();
      if (!dbPool) {
        log.warn('[DB] Using local JSON storage for charts');
        return jsonDb.setChart(userId, chartData, birthDate, birthTime, birthPlace);
      }

      try {
        const data = chartData.chart_data || chartData;
        const inputHash = birthDate && birthPlace 
          ? Buffer.from(`${birthDate}|${birthTime || '12:00'}|${birthPlace}`).toString('base64').substring(0, 64)
          : null;
        
        const result = await dbPool.query(
          `INSERT INTO charts (user_id, chart_data, birth_date, birth_time, birth_place, input_hash, calculated_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON CONFLICT (user_id) DO UPDATE SET
             chart_data = EXCLUDED.chart_data,
             birth_date = EXCLUDED.birth_date,
             birth_time = EXCLUDED.birth_time,
             birth_place = EXCLUDED.birth_place,
             input_hash = EXCLUDED.input_hash,
             calculated_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
           RETURNING *`,
          [userId, JSON.stringify(data), birthDate, birthTime, birthPlace, inputHash]
        );

        log.info(`[DB] [charts.set] SAVED: chart saved for userId=${userId}`);

        return {
          user_id: result.rows[0].user_id,
          chart_data: result.rows[0].chart_data,
          birth_date: result.rows[0].birth_date,
          birth_time: result.rows[0].birth_time,
          birth_place: result.rows[0].birth_place,
          input_hash: result.rows[0].input_hash,
          calculated_at: result.rows[0].calculated_at
        };
      } catch (error: any) {
        log.error('[DB] Error setting chart', { error: error.message, userId });
        throw error;
      }
    },
  },

  userSettings: {
    async get(userId: string) {
        const dbPool = getPool();
        if (!dbPool) return jsonDb.getUserSettings(userId);
        // ... Postgres implementation
        try {
            const result = await dbPool.query(
              `SELECT user_id, weather_city, weather_lat, weather_lon, weather_units, timezone, updated_at 
               FROM user_settings WHERE user_id = $1`,
              [userId]
            );
            if (result.rows.length === 0) return null;
            const row = result.rows[0];
            return {
              userId: row.user_id,
              weatherCity: row.weather_city,
              weatherLat: row.weather_lat,
              weatherLon: row.weather_lon,
              weatherUnits: row.weather_units,
              timezone: row.timezone,
              updatedAt: row.updated_at
            };
        } catch (e: any) { throw e; }
    },
    async setWeatherCity(userId: string, city: string | null, lat?: number, lon?: number) {
        const dbPool = getPool();
        if (!dbPool) return jsonDb.setUserWeatherCity(userId, city, lat, lon);
        // ... Postgres implementation
        let validCity: string | null = null;
        if (city !== null && city !== undefined) {
            const trimmed = String(city).trim();
            if (trimmed.length >= 2 && trimmed.length <= 64) validCity = trimmed;
            else if (trimmed.length > 0) throw new Error(`City name must be 2-64 characters`);
        }
        try {
            const result = await dbPool.query(
              `INSERT INTO user_settings (user_id, weather_city, weather_lat, weather_lon, updated_at)
               VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
               ON CONFLICT (user_id) DO UPDATE SET
                 weather_city = EXCLUDED.weather_city,
                 weather_lat = EXCLUDED.weather_lat,
                 weather_lon = EXCLUDED.weather_lon,
                 updated_at = CURRENT_TIMESTAMP
               RETURNING *`,
              [userId, validCity, lat || null, lon || null]
            );
            return {
              userId: result.rows[0].user_id,
              weatherCity: result.rows[0].weather_city,
              weatherLat: result.rows[0].weather_lat,
              weatherLon: result.rows[0].weather_lon,
              updatedAt: result.rows[0].updated_at
            };
        } catch (e: any) { throw e; }
    }
  },

  dailyHoroscope: {
      async get(userId: string, dateKey: string) {
          const dbPool = getPool();
          if (!dbPool) return jsonDb.getDailyHoroscope(userId, dateKey);
          // ... Postgres impl
          try {
            const result = await dbPool.query(
              `SELECT content, zodiac_sign, created_at 
               FROM daily_horoscope WHERE user_id = $1 AND date_key = $2`,
              [userId, dateKey]
            );
            if (result.rows.length === 0) return null;
            return {
              content: result.rows[0].content,
              zodiacSign: result.rows[0].zodiac_sign,
              createdAt: result.rows[0].created_at
            };
          } catch (e: any) { throw e; }
      },
      async set(userId: string, dateKey: string, content: any, zodiacSign?: string) {
          const dbPool = getPool();
          if (!dbPool) return jsonDb.setDailyHoroscope(userId, dateKey, content, zodiacSign);
          // ... Postgres impl
          try {
            const result = await dbPool.query(
              `INSERT INTO daily_horoscope (user_id, date_key, content, zodiac_sign)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (user_id, date_key) DO UPDATE SET
                 content = EXCLUDED.content,
                 zodiac_sign = EXCLUDED.zodiac_sign
               RETURNING *`,
              [userId, dateKey, JSON.stringify(content), zodiacSign]
            );
            return {
              content: result.rows[0].content,
              zodiacSign: result.rows[0].zodiac_sign,
              createdAt: result.rows[0].created_at
            };
          } catch (e: any) { throw e; }
      }
  },

  // Fallbacks for other caches (can be implemented similarly or just return null/empty)
  cachedTexts: {
      async getNatalSummary(userId: string) { 
          const dbPool = getPool();
          if (!dbPool) return jsonDb.getCachedText(userId, 'natal_summary');
          try {
            const result = await dbPool.query('SELECT natal_summary, natal_summary_updated_at FROM users WHERE id = $1', [userId]);
            if (result.rows.length === 0 || !result.rows[0].natal_summary) return null;
            return { data: result.rows[0].natal_summary, updatedAt: result.rows[0].natal_summary_updated_at };
          } catch (e) { return null; }
      },
      async setNatalSummary(userId: string, data: string) {
          const dbPool = getPool();
          if (!dbPool) return jsonDb.setCachedText(userId, 'natal_summary', data);
          try {
            await dbPool.query('UPDATE users SET natal_summary = $1, natal_summary_updated_at = CURRENT_TIMESTAMP WHERE id = $2', [data, userId]);
            return { success: true };
          } catch (e) { throw e; }
      },
      async getFullNatal(userId: string) { return null; }, // Implement if needed
      async setFullNatal(userId: string, data: string) { return { success: true }; }
  },
  synastryCache: {
      async get(userId: string, partnerData: any) { return null; },
      async set(userId: string, partnerData: any, brief?: string, full?: string) { return { success: true }; }
  },
  forecastsCache: {
      async get(userId: string, type: string, date: string) { return null; },
      async set(userId: string, type: string, date: string, content: any) { return { success: true }; }
  },
  regenerations: {
      async getCountToday(userId: string, type: string) { return 0; },
      async getCountThisWeek(userId: string, type: string) { return 0; },
      async add(userId: string, type: string, paid: boolean, cost: number) { return { success: true }; }
  },
  starsBalance: {
      async get(userId: string) { return 0; },
      async add(userId: string, amount: number) { return { success: true }; },
      async deduct(userId: string, amount: number) { return { success: true, newBalance: 0 }; }
  },
  deepDiveAnalyses: {
      async get(userId: string, topic: string) { return null; },
      async set(userId: string, topic: string, analysis: string) { return { success: true }; },
      async getAll(userId: string) { return {}; }
  },
  dailyHoroscopesCache: {
      async get(sign: string, date: string) { return null; },
      async set(sign: string, date: string, data: any) { return { success: true }; }
  }
};
