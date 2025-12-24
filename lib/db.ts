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
      connectionTimeoutMillis: 10000, // Increased timeout to 10 seconds
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

/**
 * Database operations using PostgreSQL
 */
export const db = {
  users: {
    async get(userId: string) {
      log.info(`[DB] Getting user: ${userId}`);
      
      if (!DATABASE_URL) {
        log.warn('[DB] DATABASE_URL not set, returning null');
        return null;
      }

      try {
        const dbPool = getPool();
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
          try {
            evolution = JSON.parse(evolution);
          } catch (e) {
            log.warn('[DB] Failed to parse evolution JSON', { error: e });
            evolution = null;
          }
        }
        
        let generatedContent = user.generated_content;
        if (typeof generatedContent === 'string') {
          try {
            generatedContent = JSON.parse(generatedContent);
          } catch (e) {
            log.warn('[DB] Failed to parse generated_content JSON', { error: e });
            generatedContent = null;
          }
        }
        
        // Transform database format to client format
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
        log.error('[DB] Error getting user', {
          error: error.message,
          userId
        });
        throw error;
      }
    },

    async set(userId: string, data: any) {
      log.info(`[DB] Setting user: ${userId}`, { hasName: !!data.name });
      
      if (!DATABASE_URL) {
        throw new Error('DATABASE_URL is not configured');
      }

      try {
        const dbPool = getPool();
        
        // ВАЖНО: При обновлении получаем существующего пользователя и объединяем данные
        // Это предотвращает случайную перезапись существующих данных
        let existingUser = null;
        try {
          const existingResult = await dbPool.query('SELECT * FROM users WHERE id = $1', [userId]);
          if (existingResult.rows.length > 0) {
            existingUser = existingResult.rows[0];
          }
        } catch (e) {
          log.warn('[DB] Failed to get existing user, will use new values', { error: e });
        }
        
        // Объединяем generatedContent: если передан и не пустой - используем его, иначе сохраняем существующий
        let finalGeneratedContent = null;
        if (data.generated_content !== undefined && data.generated_content !== null) {
          // Если передан объект с данными - используем его
          if (typeof data.generated_content === 'object' && Object.keys(data.generated_content).length > 0) {
            finalGeneratedContent = JSON.stringify(data.generated_content);
          } else if (data.generated_content === null) {
            // Если явно передан null - сохраняем null (удаляем)
            finalGeneratedContent = null;
          } else {
            // Если передан пустой объект - сохраняем существующий
            const existingContent = existingUser?.generated_content;
            // Убеждаемся что существующий контент сериализован
            if (existingContent !== null && existingContent !== undefined) {
              finalGeneratedContent = typeof existingContent === 'string' ? existingContent : JSON.stringify(existingContent);
            } else {
              finalGeneratedContent = null;
            }
          }
        } else {
          // Если не передан - сохраняем существующий
          const existingContent = existingUser?.generated_content;
          // Убеждаемся что существующий контент сериализован
          if (existingContent !== null && existingContent !== undefined) {
            finalGeneratedContent = typeof existingContent === 'string' ? existingContent : JSON.stringify(existingContent);
          } else {
            finalGeneratedContent = null;
          }
        }
        
        // Объединяем weatherCity: если передан - используем его, иначе сохраняем существующий
        log.info('[DB] ===== PROCESSING WEATHER CITY IN DB =====');
        log.info('[DB] data.weather_city:', data.weather_city);
        log.info('[DB] data.weather_city type:', typeof data.weather_city);
        log.info('[DB] data.weather_city !== undefined:', data.weather_city !== undefined);
        log.info('[DB] existingUser?.weather_city:', existingUser?.weather_city);
        log.info('[DB] existingUser?.weather_city type:', typeof existingUser?.weather_city);
        
        const finalWeatherCity = data.weather_city !== undefined
          ? (data.weather_city && String(data.weather_city).trim() ? String(data.weather_city).trim() : null)
          : (existingUser?.weather_city || null);
        
        log.info('[DB] finalWeatherCity (calculated):', finalWeatherCity);
        log.info('[DB] finalWeatherCity type:', typeof finalWeatherCity);
        log.info('[DB] finalWeatherCity length:', finalWeatherCity ? finalWeatherCity.length : 0);
        
        log.info('[DB] ===== MERGING USER DATA =====');
        log.info('[DB] hasExistingGeneratedContent:', !!existingUser?.generated_content);
        log.info('[DB] hasNewGeneratedContent:', !!data.generated_content);
        log.info('[DB] finalGeneratedContentType:', finalGeneratedContent ? typeof finalGeneratedContent : 'null');
        log.info('[DB] finalWeatherCity:', finalWeatherCity);
        log.info('[DB] existingUser generatedContent keys:', existingUser?.generated_content ? Object.keys(existingUser.generated_content) : []);
        log.info('[DB] new data generatedContent keys:', data.generated_content ? Object.keys(data.generated_content) : []);
        
        log.info('[DB] ===== EXECUTING SQL INSERT/UPDATE =====');
        log.info('[DB] SQL params weather_city (finalWeatherCity):', finalWeatherCity);
        log.info('[DB] SQL params weather_city type:', typeof finalWeatherCity);
        log.info('[DB] SQL params generated_content exists:', !!finalGeneratedContent);
        log.info('[DB] SQL params generated_content type:', typeof finalGeneratedContent);
        log.info('[DB] SQL params generated_content length:', finalGeneratedContent ? finalGeneratedContent.length : 0);
        
        const queryStartTime = Date.now();
        try {
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
          const queryDuration = Date.now() - queryStartTime;
          
          log.info('[DB] ===== SQL QUERY COMPLETED =====');
          log.info(`[DB] Query duration: ${queryDuration} ms`);
          log.info('[DB] Result rows count:', result.rows.length);
          if (result.rows.length > 0) {
            const savedRow = result.rows[0];
            log.info('[DB] Saved row.weather_city:', savedRow.weather_city);
            log.info('[DB] Saved row.weather_city type:', typeof savedRow.weather_city);
            log.info('[DB] Saved row.hasGeneratedContent:', !!savedRow.generated_content);
            log.info('[DB] Saved row.generatedContent type:', typeof savedRow.generated_content);
            if (savedRow.generated_content) {
              try {
                const parsed = typeof savedRow.generated_content === 'string' 
                  ? JSON.parse(savedRow.generated_content) 
                  : savedRow.generated_content;
                log.info('[DB] Saved row.generatedContent keys:', Object.keys(parsed));
              } catch (e) {
                log.warn('[DB] Failed to parse saved generated_content:', e);
              }
            }
          }

          const user = result.rows[0];
          
          let evolution = user.evolution;
          if (typeof evolution === 'string') {
            try {
              evolution = JSON.parse(evolution);
            } catch (e) {
              log.warn('[DB] Failed to parse evolution JSON in set', { error: e });
              evolution = null;
            }
          }
          
          let generatedContent = user.generated_content;
          if (typeof generatedContent === 'string') {
            try {
              generatedContent = JSON.parse(generatedContent);
            } catch (e) {
              log.warn('[DB] Failed to parse generated_content JSON in set', { error: e });
              generatedContent = null;
            }
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
        } catch (dbError: any) {
          log.error('[DB] ===== SQL QUERY FAILED =====');
          log.error('[DB] Error message:', dbError.message);
          log.error('[DB] Error code:', dbError.code);
          log.error('[DB] Error detail:', dbError.detail);
          log.error('[DB] Error hint:', dbError.hint);
          log.error('[DB] SQL params:', {
            userId,
            weather_city: finalWeatherCity,
            hasGeneratedContent: !!finalGeneratedContent,
            generatedContentType: typeof finalGeneratedContent
          });
          throw new Error(`Database error: ${dbError.message || 'Failed to save user data'}`);
        }
      } catch (error: any) {
        log.error('[DB] Error setting user', {
          error: error.message,
          userId
        });
        throw error;
      }
    },

    async getAll() {
      log.info('[DB] Getting all users');
      
      if (!DATABASE_URL) {
        log.warn('[DB] DATABASE_URL not set, returning empty array');
        return [];
      }

      try {
        const dbPool = getPool();
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
        log.error('[DB] Error getting all users', {
          error: error.message
        });
        throw error;
      }
    },
  },

  charts: {
    async get(userId: string) {
      log.info(`[DB] Getting chart for user: ${userId}`);
      
      if (!DATABASE_URL) {
        log.warn('[DB] DATABASE_URL not set, returning null');
        return null;
      }

      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          'SELECT chart_data FROM charts WHERE user_id = $1',
          [userId]
        );
        
        if (result.rows.length === 0) {
          return null;
        }

        return result.rows[0].chart_data;
      } catch (error: any) {
        log.error('[DB] Error getting chart', {
          error: error.message,
          userId
        });
        throw error;
      }
    },

    async set(userId: string, data: any) {
      log.info(`[DB] Setting chart for user: ${userId}`);
      
      if (!DATABASE_URL) {
        throw new Error('DATABASE_URL is not configured');
      }

      try {
        const dbPool = getPool();
        const chartData = data.chart_data || data;
        
        const result = await dbPool.query(
          `INSERT INTO charts (user_id, chart_data, updated_at)
           VALUES ($1, $2, CURRENT_TIMESTAMP)
           ON CONFLICT (user_id) DO UPDATE SET
             chart_data = EXCLUDED.chart_data,
             updated_at = CURRENT_TIMESTAMP
           RETURNING *`,
          [userId, JSON.stringify(chartData)]
        );

        return {
          user_id: result.rows[0].user_id,
          chart_data: result.rows[0].chart_data,
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

  // Regenerations tracking operations
  regenerations: {
    async getCountToday(userId: string, contentType: string) {
      log.info(`[DB] Getting regeneration count for user: ${userId}, type: ${contentType}`);
      
      if (!DATABASE_URL) return 0;

      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          'SELECT COUNT(*) FROM regenerations WHERE user_id = $1 AND content_type = $2 AND regeneration_date = CURRENT_DATE',
          [userId, contentType]
        );
        
        return parseInt(result.rows[0].count);
      } catch (error: any) {
        log.error('[DB] Error getting regeneration count', { error: error.message, userId });
        throw error;
      }
    },

    async getCountThisWeek(userId: string, contentType: string) {
      log.info(`[DB] Getting regeneration count for this week: user ${userId}, type: ${contentType}`);
      
      if (!DATABASE_URL) return 0;

      try {
        const dbPool = getPool();
        // Считаем регенерации за последние 7 дней
        const result = await dbPool.query(
          `SELECT COUNT(*) FROM regenerations 
           WHERE user_id = $1 
           AND content_type = $2 
           AND regeneration_date >= CURRENT_DATE - INTERVAL '7 days'`,
          [userId, contentType]
        );
        
        return parseInt(result.rows[0].count);
      } catch (error: any) {
        log.error('[DB] Error getting regeneration count for week', { error: error.message, userId });
        throw error;
      }
    },

    async add(userId: string, contentType: string, wasPaid: boolean, starsCost: number) {
      log.info(`[DB] Adding regeneration record for user: ${userId}, type: ${contentType}, paid: ${wasPaid}`);
      
      if (!DATABASE_URL) {
        throw new Error('DATABASE_URL is not configured');
      }

      try {
        const dbPool = getPool();
        await dbPool.query(
          `INSERT INTO regenerations (user_id, content_type, regeneration_date, was_paid, stars_cost)
           VALUES ($1, $2, CURRENT_DATE, $3, $4)`,
          [userId, contentType, wasPaid, starsCost]
        );
        
        return { success: true };
      } catch (error: any) {
        log.error('[DB] Error adding regeneration record', { error: error.message, userId });
        throw error;
      }
    },
  },

  // Stars balance operations
  starsBalance: {
    async get(userId: string) {
      log.info(`[DB] Getting stars balance for user: ${userId}`);
      
      if (!DATABASE_URL) return 0;

      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          'SELECT stars_balance FROM users WHERE id = $1',
          [userId]
        );
        
        if (result.rows.length === 0) {
          return 0;
        }

        return result.rows[0].stars_balance || 0;
      } catch (error: any) {
        log.error('[DB] Error getting stars balance', { error: error.message, userId });
        throw error;
      }
    },

    async add(userId: string, amount: number) {
      log.info(`[DB] Adding ${amount} stars to user: ${userId}`);
      
      if (!DATABASE_URL) {
        throw new Error('DATABASE_URL is not configured');
      }

      try {
        const dbPool = getPool();
        await dbPool.query(
          `UPDATE users 
           SET stars_balance = COALESCE(stars_balance, 0) + $1 
           WHERE id = $2`,
          [amount, userId]
        );
        
        return { success: true };
      } catch (error: any) {
        log.error('[DB] Error adding stars', { error: error.message, userId });
        throw error;
      }
    },

    async deduct(userId: string, amount: number) {
      log.info(`[DB] Deducting ${amount} stars from user: ${userId}`);
      
      if (!DATABASE_URL) {
        throw new Error('DATABASE_URL is not configured');
      }

      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          `UPDATE users 
           SET stars_balance = GREATEST(COALESCE(stars_balance, 0) - $1, 0)
           WHERE id = $2 AND COALESCE(stars_balance, 0) >= $1
           RETURNING stars_balance`,
          [amount, userId]
        );
        
        if (result.rows.length === 0) {
          throw new Error('Insufficient stars balance');
        }
        
        return { success: true, newBalance: result.rows[0].stars_balance };
      } catch (error: any) {
        log.error('[DB] Error deducting stars', { error: error.message, userId });
        throw error;
      }
    },
  },

  // Deep dive analyses operations
  deepDiveAnalyses: {
    async get(userId: string, topic: string) {
      log.info(`[DB] Getting deep dive analysis for user: ${userId}, topic: ${topic}`);
      
      if (!DATABASE_URL) return null;

      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          'SELECT analysis, updated_at FROM deep_dive_analyses WHERE user_id = $1 AND topic = $2',
          [userId, topic]
        );
        
        if (result.rows.length === 0) {
          return null;
        }

        return {
          analysis: result.rows[0].analysis,
          updatedAt: result.rows[0].updated_at
        };
      } catch (error: any) {
        log.error('[DB] Error getting deep dive analysis', { error: error.message, userId, topic });
        throw error;
      }
    },

    async set(userId: string, topic: string, analysis: string) {
      log.info(`[DB] Setting deep dive analysis for user: ${userId}, topic: ${topic}`);
      
      if (!DATABASE_URL) {
        throw new Error('DATABASE_URL is not configured');
      }

      try {
        const dbPool = getPool();
        await dbPool.query(
          `INSERT INTO deep_dive_analyses (user_id, topic, analysis, updated_at)
           VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
           ON CONFLICT (user_id, topic) DO UPDATE SET
             analysis = EXCLUDED.analysis,
             updated_at = CURRENT_TIMESTAMP`,
          [userId, topic, analysis]
        );
        
        return { success: true };
      } catch (error: any) {
        log.error('[DB] Error setting deep dive analysis', { error: error.message, userId, topic });
        throw error;
      }
    },

    async getAll(userId: string) {
      log.info(`[DB] Getting all deep dive analyses for user: ${userId}`);
      
      if (!DATABASE_URL) return {};

      try {
        const dbPool = getPool();
        const result = await dbPool.query(
          'SELECT topic, analysis, updated_at FROM deep_dive_analyses WHERE user_id = $1',
          [userId]
        );
        
        const analyses: Record<string, string> = {};
        result.rows.forEach(row => {
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
