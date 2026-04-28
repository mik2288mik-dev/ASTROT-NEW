import type { NextApiRequest, NextApiResponse } from 'next';
import { db, getPool } from '../../../lib/db';
import { getConfiguredOwnerId } from '../../../lib/adminAuth';
import { hasDatabaseUrl } from '../../../lib/database-url';
import { getMoscowTodayKey, toDateInputValue } from '../../../lib/date-utils';
import {
  coerceNatalAnchorReading,
  coerceNatalFullReading,
  mapNatalAnchorToLegacyIntro,
  NATAL_ANCHOR_CACHE_KEY,
  NATAL_ANCHOR_PROMPT_VERSION,
  NATAL_FULL_CACHE_KEY,
  NATAL_FULL_PROMPT_VERSION,
} from '../../../lib/natalReadings';

// Logging utility
const log = {
  info: (message: string, data?: any) => {
    console.log(`[API/users/[id]] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[API/users/[id]] ERROR: ${message}`, error || '');
  },
  warn: (message: string, error?: any) => {
    console.warn(`[API/users/[id]] WARN: ${message}`, error || '');
  },
};

function toUnixTimestamp(value?: string | Date | null): number | undefined {
  if (!value) return undefined;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

/** Owner gets isAdmin from env; otherwise use DB. Ensures Admin Panel visible even if client bundle lacks NEXT_PUBLIC_OWNER_ID. */
function resolveIsAdmin(userId: string, dbIsAdmin: boolean | undefined): boolean {
  const ownerId = getConfiguredOwnerId();
  if (ownerId && String(userId) === String(ownerId)) return true;
  return !!dbIsAdmin;
}

const NOTIFICATION_FREQUENCIES = new Set(['quiet', 'important', 'daily', 'twice_daily']);

function normalizeNotificationFrequency(value: unknown): string | null {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return NOTIFICATION_FREQUENCIES.has(normalized) ? normalized : null;
}

async function getNotificationFrequency(userId: string): Promise<string | null> {
  if (!hasDatabaseUrl()) return null;
  try {
    const result = await getPool().query(
      'SELECT notification_frequency FROM users WHERE id = $1 LIMIT 1',
      [userId]
    );
    return normalizeNotificationFrequency(result.rows[0]?.notification_frequency);
  } catch (e: any) {
    log.warn('[notificationFrequency] Failed to read preference', { userId, error: e?.message });
    return null;
  }
}

async function saveNotificationFrequency(userId: string, value: unknown): Promise<void> {
  const normalized = normalizeNotificationFrequency(value);
  if (!normalized || !hasDatabaseUrl()) return;
  try {
    await getPool().query(
      'UPDATE users SET notification_frequency = $1 WHERE id = $2',
      [normalized, userId]
    );
  } catch (e: any) {
    log.warn('[notificationFrequency] Failed to save preference', { userId, error: e?.message });
  }
}

async function hydrateGeneratedContent(userId: string) {
  const generatedContent: {
    natalIntro?: string;
    deepDiveAnalyses?: Record<string, string>;
    dailyHoroscope?: any;
    timestamps: Record<string, number>;
  } = { timestamps: {} };

  let hasContent = false;

  try {
    const primaryChart = await db.natal_charts.getPrimary(userId);
    const natalIntro = primaryChart?.id != null
      ? await db.content_interpretations.getByChart(primaryChart.id, 'free', 'natal', 'anchor', NATAL_ANCHOR_CACHE_KEY)
      : await db.content_interpretations.getByUser(userId, 'free', 'natal', 'anchor', NATAL_ANCHOR_CACHE_KEY);
    if (natalIntro?.content && natalIntro.promptVersion === NATAL_ANCHOR_PROMPT_VERSION) {
      const reading = coerceNatalAnchorReading(natalIntro.content, 'ru', primaryChart?.chart_data || null);
      generatedContent.natalIntro = mapNatalAnchorToLegacyIntro(reading);
      const generatedAt = toUnixTimestamp(natalIntro.updatedAt);
      if (generatedAt) {
        generatedContent.timestamps.natalIntroGenerated = generatedAt;
      }
      hasContent = true;
    }
  } catch (e: any) {
    log.warn('[hydrateGeneratedContent] Failed to hydrate natalIntro', { userId, error: e?.message });
  }

  try {
    const primaryChart = await db.natal_charts.getPrimary(userId);
    const full = primaryChart?.id != null
      ? await db.content_interpretations.getByChart(primaryChart.id, 'premium', 'natal', 'full', NATAL_FULL_CACHE_KEY)
      : await db.content_interpretations.getByUser(userId, 'premium', 'natal', 'full', NATAL_FULL_CACHE_KEY);
    if (full?.content && full.promptVersion === NATAL_FULL_PROMPT_VERSION) {
      const reading = coerceNatalFullReading(full.content, 'ru', primaryChart?.chart_data || null);
      const deepDiveAnalyses: Record<string, string> = {
        personality: [reading.mainConfiguration, reading.reactions, reading.choices].filter(Boolean).join('\n\n'),
        love: reading.closeness || '',
        career: [reading.choices, reading.strengths].filter(Boolean).join('\n\n'),
        weakness: [reading.tensionPattern, reading.integration].filter(Boolean).join('\n\n'),
        karma: reading.integration || '',
      };
      generatedContent.deepDiveAnalyses = deepDiveAnalyses;
      const generatedAt = toUnixTimestamp(full.updatedAt);
      generatedContent.timestamps.deepDiveGenerated = generatedAt || Date.now();
      hasContent = true;
    }
  } catch (e: any) {
    log.warn('[hydrateGeneratedContent] Failed to hydrate deepDiveAnalyses', { userId, error: e?.message });
  }

  try {
    const todayKey = getMoscowTodayKey();
    const dailyHoroscope = await db.daily_natal_cards.getForPrimaryUser(userId, todayKey);
    if (dailyHoroscope && typeof dailyHoroscope === 'object') {
      const row = dailyHoroscope as Record<string, unknown>;
      const content = row.content;
      if (typeof content === 'string' && content.length > 0) {
        generatedContent.dailyHoroscope = {
          ...row,
          date: typeof row.date === 'string' && row.date ? row.date : todayKey,
        } as typeof generatedContent.dailyHoroscope;
        generatedContent.timestamps.dailyHoroscopeGenerated = Date.now();
        hasContent = true;
      }
    }
  } catch (e: any) {
    log.warn('[hydrateGeneratedContent] Failed to hydrate dailyHoroscope', {
      userId,
      code: 'DAILY_CACHE_READ_FAILED',
      error: e?.message,
    });
  }

  return hasContent ? generatedContent : null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id } = req.query;
  const userId = Array.isArray(id) ? id[0] : id;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  log.info(`Request received`, {
    method: req.method,
    userId,
    path: req.url
  });

  try {
    if (req.method === 'GET') {
      // Get user profile
      log.info(`[GET] Fetching user: ${userId}`);
      
      // Проверяем доступность БД
      if (!hasDatabaseUrl()) {
        log.warn(`[GET] DATABASE_URL not configured, returning 404`);
        return res.status(404).json({ error: 'User not found' });
      }
      
      let user;
      try {
        user = await db.users.get(userId);
      } catch (dbError: any) {
        log.error(`[GET] Database error`, { error: dbError.message });
        return res.status(500).json({ error: 'Database error', message: dbError.message });
      }
      
      if (!user) {
        log.info(`[GET] User not found: ${userId}`);
        return res.status(404).json({ error: 'User not found' });
      }

      log.info(`[GET] User found: ${userId}`, {
        hasName: !!user.name,
        isPremium: user.is_premium,
        isSetup: user.is_setup
      });

      const generatedContent = await hydrateGeneratedContent(userId);

      const lumiBalance = user.lumi_balance ?? 0;
      const loginStreak = user.login_streak ?? 0;
      const chartSlots = user.chart_slots ?? 1;
      const notificationFrequency = await getNotificationFrequency(userId);

      let refCode: string | null = null;
      try {
        refCode = await db.users.ensureReferralCode(userId);
      } catch (e: any) {
        log.warn('[GET] ensureReferralCode failed', { userId, error: e?.message });
      }

      const clientUser = {
        id: user.id,
        name: user.name,
        birthDate: toDateInputValue(user.birth_date) || user.birth_date,
        birthTime: user.birth_time,
        birthPlace: user.birth_place,
        isSetup: user.is_setup,
        language: user.language,
        theme: user.theme,
        isPremium: user.is_premium,
        isAdmin: resolveIsAdmin(userId, user.is_admin),
        evolution: null,
        generatedContent,
        weatherCity: user.weather_city && user.weather_city.trim() ? user.weather_city.trim() : undefined,
        lumiBalance,
        loginStreak,
        chartSlots,
        notificationFrequency: notificationFrequency || undefined,
        refCode: refCode || undefined,
        referralApplied: user.referred_by != null && user.referred_by !== undefined,
      };

      return res.status(200).json(clientUser);
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      // Create or update user profile
      const userData = req.body;
      log.info(`[${req.method}] Saving user: ${userId}`, {
        hasName: !!userData.name,
        isPremium: userData.isPremium
      });

      // Проверяем доступность БД
      if (!hasDatabaseUrl()) {
        log.error(`[${req.method}] DATABASE_URL not configured`);
        return res.status(500).json({ 
          error: 'Database not configured',
          message: 'DATABASE_URL is not set. Please configure the database connection.'
        });
      }

      // ВАЖНО: Получаем существующего пользователя для правильного объединения данных
      let existingUser = null;
      try {
        existingUser = await db.users.get(userId);
      } catch (e) {
        log.warn('[API/users/[id]] Failed to get existing user, will use new values', e);
      }
      
      let weatherCityToSave: string | null = undefined as any;
      if (userData.weatherCity !== undefined) {
        weatherCityToSave = (userData.weatherCity === null || userData.weatherCity === '')
          ? null
          : (String(userData.weatherCity).trim() || null);
      } else if (existingUser?.weather_city) {
        weatherCityToSave = String(existingUser.weather_city).trim() || null;
      }

      const dbUser = {
        name: userData.name,
        birth_date: userData.birthDate,
        birth_time: userData.birthTime,
        birth_place: userData.birthPlace,
        is_setup: userData.isSetup || false,
        language: userData.language || 'ru',
        theme: userData.theme || 'dark',
        weather_city: weatherCityToSave,
      };

      const savedUser = await db.users.set(userId, dbUser);
      await saveNotificationFrequency(userId, userData.notificationFrequency);
      const refreshedUser = await db.users.get(userId);
      const notificationFrequency = await getNotificationFrequency(userId);

      const generatedContent = await hydrateGeneratedContent(userId);

      let refCodePost: string | null = null;
      try {
        refCodePost = await db.users.ensureReferralCode(userId);
      } catch (e: any) {
        log.warn('[POST] ensureReferralCode failed', { userId, error: e?.message });
      }

      const clientUser = {
        id: savedUser.id,
        name: savedUser.name,
        birthDate: toDateInputValue(savedUser.birth_date) || savedUser.birth_date,
        birthTime: savedUser.birth_time,
        birthPlace: savedUser.birth_place,
        isSetup: savedUser.is_setup,
        language: savedUser.language,
        theme: savedUser.theme,
        isPremium: savedUser.is_premium,
        isAdmin: resolveIsAdmin(userId, savedUser.is_admin),
        evolution: null,
        generatedContent,
        weatherCity: savedUser.weather_city && savedUser.weather_city.trim() ? savedUser.weather_city.trim() : undefined,
        lumiBalance: refreshedUser?.lumi_balance ?? 0,
        loginStreak: refreshedUser?.login_streak ?? 0,
        chartSlots: refreshedUser?.chart_slots ?? 1,
        notificationFrequency: notificationFrequency || undefined,
        refCode: refCodePost || undefined,
        referralApplied: refreshedUser?.referred_by != null && refreshedUser?.referred_by !== undefined,
      };

      return res.status(200).json(clientUser);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    log.error('Error processing request', {
      error: error.message,
      stack: error.stack,
      userId
    });
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
