import type { NextApiRequest, NextApiResponse } from 'next';
import { db, getPool } from '../../../lib/db';
import { AdminAuthError, getConfiguredOwnerId, handleAdminError } from '../../../lib/adminAuth';
import { requireAppUser } from '../../../lib/auth/appAuth';
import { hasDatabaseUrl } from '../../../lib/database-url';
import { toDateInputValue } from '../../../lib/date-utils';
import { invalidUserIdPayload, isValidUserId } from '../../../lib/userId';

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

/** Owner gets isAdmin from env; otherwise use DB. Ensures Admin Panel visible even if client bundle lacks NEXT_PUBLIC_OWNER_ID. */
function resolveIsAdmin(userId: string, dbIsAdmin: boolean | undefined): boolean {
  const ownerId = getConfiguredOwnerId();
  if (ownerId && String(userId) === String(ownerId)) return true;
  return !!dbIsAdmin;
}

const NOTIFICATION_FREQUENCIES = new Set(['quiet', 'important', 'daily', 'twice_daily']);
const NEW_USER_TRIAL_DAYS = 14;

function getNewUserTrialWindow(): { trialStartedAt: string; premiumUntil: string } {
  const startedAt = Date.now();
  return {
    trialStartedAt: new Date(startedAt).toISOString(),
    premiumUntil: new Date(startedAt + NEW_USER_TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString(),
  };
}

function normalizeNullableString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id } = req.query;
  const rawUserId = Array.isArray(id) ? id[0] : id;

  if (!isValidUserId(rawUserId)) {
    return res.status(400).json(invalidUserIdPayload('ru'));
  }
  const userId = String(rawUserId).trim();

  log.info(`Request received`, {
    method: req.method,
    userId,
    path: req.url
  });

  try {
    const appUser = await requireAppUser(req, { expectedUserId: userId, allowGuest: true });

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
        premiumUntil: user.premium_until ? new Date(user.premium_until).toISOString() : null,
        trialStartedAt: user.trial_started_at ? new Date(user.trial_started_at).toISOString() : null,
        selectedZodiacSign: user.selected_zodiac_sign || null,
        gender: user.gender || null,
        createdAt: user.created_at ? new Date(user.created_at).toISOString() : null,
        updatedAt: user.updated_at ? new Date(user.updated_at).toISOString() : null,
        isAdmin: resolveIsAdmin(userId, user.is_admin),
        evolution: null,
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
      } catch (e: any) {
        log.warn('[API/users/[id]] Failed to get existing user before save', e);
        return res.status(500).json({
          error: 'Database error',
          message: e?.message || 'Failed to load existing user before save',
        });
      }
      
      const dbUser: Record<string, any> = {
        name: normalizeNullableString(userData.name),
        birth_date: normalizeNullableString(userData.birthDate),
        birth_time: normalizeNullableString(userData.birthTime),
        birth_place: normalizeNullableString(userData.birthPlace),
        is_setup: !!userData.isSetup,
        language: userData.language || 'ru',
        theme: userData.theme || 'light',
      };
      if (userData.selectedZodiacSign !== undefined || userData.selected_zodiac_sign !== undefined) {
        dbUser.selected_zodiac_sign = normalizeNullableString(
          userData.selectedZodiacSign ?? userData.selected_zodiac_sign
        );
      }
      if (userData.gender !== undefined) {
        const g = String(userData.gender ?? '');
        dbUser.gender = ['male', 'female', 'unspecified'].includes(g) ? g : null;
      }
      if (!existingUser && !appUser.isGuest) {
        const trial = getNewUserTrialWindow();
        dbUser.trial_started_at = trial.trialStartedAt;
        dbUser.premium_until = trial.premiumUntil;
      }

      const savedUser = await db.users.set(userId, dbUser);
      await saveNotificationFrequency(userId, userData.notificationFrequency);
      const refreshedUser = await db.users.get(userId);
      const notificationFrequency = await getNotificationFrequency(userId);

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
        premiumUntil: (savedUser.premium_until ?? refreshedUser?.premium_until)
          ? new Date(savedUser.premium_until ?? refreshedUser?.premium_until).toISOString()
          : null,
        trialStartedAt: (savedUser.trial_started_at ?? refreshedUser?.trial_started_at)
          ? new Date(savedUser.trial_started_at ?? refreshedUser?.trial_started_at).toISOString()
          : null,
        selectedZodiacSign: savedUser.selected_zodiac_sign ?? refreshedUser?.selected_zodiac_sign ?? null,
        gender: savedUser.gender ?? refreshedUser?.gender ?? null,
        createdAt: (savedUser.created_at ?? refreshedUser?.created_at)
          ? new Date(savedUser.created_at ?? refreshedUser?.created_at).toISOString()
          : null,
        updatedAt: (savedUser.updated_at ?? refreshedUser?.updated_at)
          ? new Date(savedUser.updated_at ?? refreshedUser?.updated_at).toISOString()
          : null,
        isAdmin: resolveIsAdmin(userId, savedUser.is_admin),
        evolution: null,
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
    if (error instanceof AdminAuthError) {
      return handleAdminError(res, error);
    }
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
