import {
  UserProfile,
  NatalChartData,
} from "../types";
import { toDateInputValue } from "../lib/date-utils";
import { isValidUserId } from "../lib/userId";
import { ensureWebGuestSession, getTelegramInitDataHeaders } from "./sessionService";
import { apiFetch, clearNativeSession, isNativeAppRuntime } from "./apiClient";
import { clearNativeProviderCredentialState } from './accountAuthService';
import { normalizeBirthClockTime, type BirthTimeMode } from '../lib/birthTime';
import { isReadableNatalChart } from '../lib/readableNatalChart';

export class ProfileLoadError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message?: string) {
    super(message || code);
    this.name = 'ProfileLoadError';
    this.status = status;
    this.code = code;
  }
}

export function isProfileAuthenticationError(error: unknown): boolean {
  return error instanceof ProfileLoadError && error.status === 401;
}

export function isProfileBlockedError(error: unknown): boolean {
  return error instanceof ProfileLoadError
    && error.status === 403
    && error.code === 'ACCOUNT_BLOCKED';
}

export async function deleteCurrentAccount(): Promise<void> {
  const response = await apiFetch('/api/users/account', { method: 'DELETE' });
  if (!response.ok) throw new Error('ACCOUNT_DELETION_FAILED');
}

export async function logoutCurrentAccount(): Promise<void> {
  let failure: unknown = null;
  try {
    const response = await apiFetch('/api/users/session/logout', { method: 'POST' });
    if (!response.ok) failure = new Error('LOGOUT_FAILED');
  } catch (error) {
    failure = error;
  } finally {
    if (isNativeAppRuntime()) {
      await Promise.all([
        clearNativeSession().catch(() => undefined),
        clearNativeProviderCredentialState().catch(() => undefined),
      ]);
    }
  }
  // An offline Android logout still removes the local session immediately.
  // Web logout needs the server to clear its HttpOnly cookie, so surface errors.
  if (failure && !isNativeAppRuntime()) throw failure;
}

export async function startGuestAccount(): Promise<UserProfile> {
  const profile = await ensureWebGuestSession();
  if (!profile || !isValidUserId(profile.id)) {
    throw new Error('GUEST_SESSION_FAILED');
  }
  return profile as UserProfile;
}

const PROFILE_FETCH_TIMEOUT_MS = 20_000;
const PROFILE_SAVE_TIMEOUT_MS = 90_000;
const CHART_GET_TIMEOUT_MS = 25_000;
const PROFILE_FETCH_ATTEMPTS = 3;
const PROFILE_FETCH_RETRY_DELAYS_MS = [0, 700, 1600];

export type ProfileLoadOptions = {
  maxAttempts?: number;
  timeoutMs?: number;
};

// Next.js API base URL - используем локальные API routes
// Diagnostics are opt-in and never enabled in a production/store bundle.
// Profile saves include sensitive natal data, so they must not reach device logs.
const diagnosticsEnabled =
  process.env.NODE_ENV !== 'production' &&
  process.env.NEXT_PUBLIC_DEBUG_STORAGE_LOGS === '1';

const log = {
  info: (message: string, data?: any) => {
    if (diagnosticsEnabled) console.log(`[StorageService] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    if (diagnosticsEnabled) console.error(`[StorageService] ERROR: ${message}`, error || '');
  },
  warn: (message: string, data?: any) => {
    if (diagnosticsEnabled) console.warn(`[StorageService] WARNING: ${message}`, data || '');
  }
};

log.info('StorageService initialized', { 
  isClient: typeof window !== 'undefined',
  apiBaseUrl: '/api'
});

/**
 * Save profile to Railway Database
 * WARNING: This is the ONLY persistence layer. No local storage fallback.
 */
export const saveProfile = async (profile: UserProfile): Promise<void> => {
  const userId = profile.id;
  
  if (!isValidUserId(userId)) {
      log.error('[saveProfile] Cannot save profile without userId');
      throw new Error('User ID is required for saving');
  }

  log.info(`[saveProfile] ===== STARTING SAVE PROFILE =====`);
  log.info(`[saveProfile] userId: ${userId}`, { 
    userId, 
    hasName: !!profile.name,
    isPremium: profile.isPremium 
  });
  
  // ... rest of logging ...

  try {
    // Always try to save to database via Next.js API
    const url = `/api/users/${userId}`;
    log.info(`[saveProfile] Sending POST request to: ${url}`);
    
    const requestBody = JSON.stringify(profile);
    log.info(`[saveProfile] Request body size: ${requestBody.length} bytes`);
    
    const startTime = Date.now();
    const response = await apiFetch(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getTelegramInitDataHeaders() },
        body: requestBody,
      },
      PROFILE_SAVE_TIMEOUT_MS
    );

    const duration = Date.now() - startTime;
    log.info(`[saveProfile] Response received in ${duration}ms`, {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unable to read error response');
      log.error(`[saveProfile] Server returned error status ${response.status}`, {
        status: response.status,
        statusText: response.statusText,
        errorBody: errorText
      });
      throw new Error(`Failed to save profile to database: ${response.status} ${response.statusText}`);
    }

    const responseData = await response.json().catch(() => null);
    log.info(`[saveProfile] ===== PROFILE SAVED SUCCESSFULLY =====`);
    log.info(`[saveProfile] userId:`, userId);
    log.info(`[saveProfile] responseData exists:`, !!responseData);
    return;
  } catch (error: any) {
    log.error('[saveProfile] Error occurred during save', {
      error: error.message,
      stack: error.stack,
      userId
    });
    
    throw error;
  }
};

/**
 * Get profile from Railway Database
 * WARNING: This is the ONLY persistence layer. No local storage fallback.
 */
export const getProfile = async ({
  maxAttempts = PROFILE_FETCH_ATTEMPTS,
  timeoutMs = PROFILE_FETCH_TIMEOUT_MS,
}: ProfileLoadOptions = {}): Promise<UserProfile | null> => {
  const url = '/api/users/me';
  const attempts = Math.max(1, Math.floor(maxAttempts));
  const requestTimeoutMs = Math.max(1, Math.floor(timeoutMs));

  for (let attempt = 0; attempt < attempts; attempt++) {
    const delay = PROFILE_FETCH_RETRY_DELAYS_MS[attempt] ?? 0;
    if (delay > 0) {
      await new Promise((r) => setTimeout(r, delay));
    }

    try {
      log.info(`[getProfile] GET attempt ${attempt + 1}/${attempts}: ${url}`);

      const startTime = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
      let response: Response;
      try {
        response = await apiFetch(
          url,
          {
            method: 'GET',
            credentials: 'include',
            cache: 'no-store',
            headers: {
              Accept: 'application/json',
              'Cache-Control': 'no-cache',
              Pragma: 'no-cache',
            },
            signal: controller.signal,
          },
          requestTimeoutMs,
        );
      } finally {
        clearTimeout(timeout);
      }
      const duration = Date.now() - startTime;

      log.info(`[getProfile] Response received in ${duration}ms`, {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        attempt: attempt + 1,
      });

      if (response.ok) {
        const profile = await response.json() as UserProfile;
        log.info(`[getProfile] Successfully loaded profile from database`, {
          userId: profile.id,
          hasName: !!profile.name,
          isSetup: profile.isSetup,
        });
        return profile;
      }

      if (response.status === 404) {
        log.info(`[getProfile] Profile not found in database (404), returning null`);
        return null;
      }

      const payload = await response.json().catch(() => ({})) as {
        code?: string;
        error?: string;
        message?: string;
      };
      if (response.status === 401 || response.status === 403) {
        throw new ProfileLoadError(
          response.status,
          payload.code || payload.error || 'APP_AUTH_REQUIRED',
          payload.message,
        );
      }
      log.warn(`[getProfile] HTTP ${response.status}, will retry if attempts left`);
    } catch (error: any) {
      if (error instanceof ProfileLoadError) throw error;
      log.warn('[getProfile] Request failed, will retry if attempts left', {
        error: error?.message || error,
        attempt: attempt + 1,
      });
    }
  }

  log.error('[getProfile] All fetch attempts failed');
  throw new ProfileLoadError(503, 'PROFILE_LOAD_FAILED', 'Не удалось загрузить профиль.');
};

export type ReferralClaimApiResult = {
  ok: boolean;
  status: number;
  referralApplied?: boolean;
  code?: string;
};

export const postReferralClaim = async (userId: string, inviteCode: string): Promise<ReferralClaimApiResult> => {
  if (!userId || !inviteCode.trim()) {
    return { ok: false, status: 400, code: 'MISSING' };
  }
  const res = await apiFetch('/api/users/referral/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getTelegramInitDataHeaders() },
    body: JSON.stringify({ userId, inviteCode: inviteCode.trim() }),
  });
  const data = await res.json().catch(() => ({}));
  return {
    ok: res.ok,
    status: res.status,
    referralApplied: data.referralApplied,
    code: data.code,
  };
};

/**
 * One session attempt: read Telegram start_param and claim referral if present.
 */
export function runReferralFromStartParam(
  userId: string,
  onResult?: (r: ReferralClaimApiResult) => void
): void {
  if (typeof window === 'undefined' || !userId) return;
  const tg = (window as any).Telegram?.WebApp;
  const sp = typeof tg?.initDataUnsafe?.start_param === 'string' ? tg.initDataUnsafe.start_param.trim() : '';
  if (!sp) return;
  if (/^(card\d|today_|checkin_|chart_|natal_)/i.test(sp)) return;
  const k = `lumi_ref_${userId}`;
  try {
    if (sessionStorage.getItem(k)) return;
  } catch {
    return;
  }
  void postReferralClaim(userId, sp).then((r) => {
    try {
      sessionStorage.setItem(k, '1');
    } catch {
      /* ignore */
    }
    onResult?.(r);
  });
}

/**
 * Save chart data to Railway Database
 * WARNING: This is the ONLY persistence layer. No local storage fallback.
 */
export const saveChartData = async (data: NatalChartData): Promise<void> => {
  const currentProfile = await getProfile();
  const userId = currentProfile?.id;

  if (!isValidUserId(userId)) {
      log.error('[saveChartData] No authenticated account found, cannot save chart');
      throw new Error('User ID is required for saving chart');
  }

  log.info(`[saveChartData] Starting save for user: ${userId}`, {
    userId,
    hasSun: !!data.sun,
    hasMoon: !!data.moon,
    element: data.element
  });

  try {
    // Always try to save to database via Next.js API
    const url = `/api/charts/${userId}`;
    log.info(`[saveChartData] Sending POST request to: ${url}`);

    const requestBody = JSON.stringify(data);
    log.info(`[saveChartData] Request body size: ${requestBody.length} bytes`);

    const startTime = Date.now();
    const response = await apiFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getTelegramInitDataHeaders() },
      body: requestBody
    });

    const duration = Date.now() - startTime;
    log.info(`[saveChartData] Response received in ${duration}ms`, {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unable to read error response');
      log.error(`[saveChartData] Server returned error status ${response.status}`, {
        status: response.status,
        statusText: response.statusText,
        errorBody: errorText
      });
      throw new Error(`Failed to save chart to database: ${response.status} ${response.statusText}`);
    }

    const responseData = await response.json().catch(() => null);
    log.info(`[saveChartData] Successfully saved chart to database`, {
      userId,
      responseData: responseData ? 'Received' : 'No response body'
    });
    return;
  } catch (error: any) {
    log.error('[saveChartData] Error occurred during save', {
      error: error.message,
      stack: error.stack,
      userId
    });
    
    throw error;
  }
};

/**
 * Get chart data from Railway Database
 * WARNING: This is the ONLY persistence layer. No local storage fallback.
 */
export const getChartData = async (): Promise<NatalChartData | null> => {
  const currentProfile = await getProfile();
  const userId = currentProfile?.id;

  if (!isValidUserId(userId)) {
      log.warn('[getChartData] No authenticated account found, cannot fetch chart');
      return null;
  }

  log.info(`[getChartData] Starting fetch for user: ${userId}`, { userId });

  try {
    // Always try to get from database via Next.js API
    const url = `/api/charts/${userId}`;
    log.info(`[getChartData] Sending GET request to: ${url}`);

    const startTime = Date.now();
    const response = await apiFetch(
      url,
      { method: 'GET', credentials: 'include', headers: { ...getTelegramInitDataHeaders() } },
      CHART_GET_TIMEOUT_MS
    );
    const duration = Date.now() - startTime;

    log.info(`[getChartData] Response received in ${duration}ms`, {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });
    
    if (response.ok) {
      const chartData: unknown = await response.json();
      
      // Валидация данных карты перед возвратом
      if (!isReadableNatalChart(chartData)) {
        const diagnosticChart = chartData as Partial<NatalChartData> | null;
        log.error(`[getChartData] Invalid chart data received from database`, {
          userId,
          hasData: !!chartData,
          hasSun: !!diagnosticChart?.sun,
          hasMoon: !!diagnosticChart?.moon,
          hasRising: !!diagnosticChart?.rising,
        });
        return null;
      }
      
      log.info(`[getChartData] Successfully loaded chart from database`, {
        userId,
        hasSun: !!chartData.sun,
        hasMoon: !!chartData.moon,
        hasRising: !!chartData.rising,
        element: chartData.element
      });
      return chartData;
    } else if (response.status === 404) {
      // Если данных нет в БД - возвращаем null (не используем localStorage)
      log.info(`[getChartData] Chart not found in database (404), returning null`);
      return null;
    } else {
      log.warn(`[getChartData] Unexpected status ${response.status}, returning null`);
    }
  } catch (error: any) {
    log.error('[getChartData] Error occurred during fetch', {
      error: error.message,
      stack: error.stack,
      userId
    });
  }

  return null;
};

// --- Multi-chart API (live entitlement policy) ---

export interface ChartListItem {
  id: number;
  user_id: string;
  name: string;
  chart_data: NatalChartData;
  birth_date: string;
  birth_time: string | null;
  birth_place: string;
  input_hash?: string | null;
  calculation_version?: string | null;
  is_primary: boolean;
  subject_type?: 'self' | 'saved_person';
  relation_label?: string | null;
  archived_at?: string | null;
  access_locked?: boolean;
  created_at?: string;
}

export interface ChartsResponse {
  charts: ChartListItem[];
  chartSlots: number;
  canAddMore: boolean;
  canAddSavedPeople?: boolean;
  isPremium?: boolean;
}

export const normalizeChartListItem = (chart: ChartListItem): ChartListItem => ({
  ...chart,
  birth_date: toDateInputValue(chart.birth_date) || chart.birth_date,
  birth_time: normalizeBirthClockTime(chart.birth_time),
});

/**
 * Get all charts for user (multi-chart flow)
 */
export const getCharts = async (
  userId: string,
  options: { repairPrimary?: boolean } = {},
): Promise<ChartsResponse> => {
  if (!isValidUserId(userId)) throw new Error('UserId is required');
  const url = options.repairPrimary === false ? '/api/charts?repairPrimary=0' : '/api/charts';
  const res = await apiFetch(url, { headers: getTelegramInitDataHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to fetch charts: ${res.status}`);
  }
  const data = await res.json() as ChartsResponse;
  return {
    ...data,
    charts: (data.charts || []).map(normalizeChartListItem),
  };
};

/**
 * Create a saved-person chart (server derives the limit from live entitlement)
 */
export const createChart = async (
  userId: string,
  data: {
    name: string;
    birthDate: string;
    birthTime?: string;
    birthTimeMode?: BirthTimeMode;
    birthTimeUncertaintyMinutes?: number | null;
    birthTimeRangeStart?: string | null;
    birthTimeRangeEnd?: string | null;
    birthPlace: string;
    latitude?: number | null;
    longitude?: number | null;
    timezone?: string | null;
    chartData?: any;
    language?: string;
    relationLabel?: string | null;
  }
): Promise<ChartListItem> => {
  if (!isValidUserId(userId)) throw new Error('UserId is required');
  const url = '/api/charts';
  const res = await apiFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getTelegramInitDataHeaders() },
    body: JSON.stringify({ ...data, subjectType: 'saved_person' }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || `Failed to create chart: ${res.status}`);
  }
  const chart = await res.json() as ChartListItem;
  return normalizeChartListItem(chart);
};

/**
 * Archive a saved person. The self chart is immutable.
 */
export const deleteChart = async (chartId: number, userId: string): Promise<void> => {
  if (!isValidUserId(userId)) throw new Error('UserId is required');
  const url = `/api/charts/chart/${chartId}`;
  const res = await apiFetch(url, { method: 'DELETE', headers: getTelegramInitDataHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to delete chart: ${res.status}`);
  }
};

/**
 * Get all users for Admin Panel from Railway Database
 */
export const getAllUsers = async (): Promise<UserProfile[]> => {
  log.info('[getAllUsers] Starting fetch for all users');

  try {
    // Always try to get from database via Next.js API
    const url = '/api/users';
    log.info(`[getAllUsers] Sending GET request to: ${url}`);

    const startTime = Date.now();
    const response = await apiFetch(url, { headers: getTelegramInitDataHeaders() });
    const duration = Date.now() - startTime;

    log.info(`[getAllUsers] Response received in ${duration}ms`, {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });
    
    if (response.ok) {
      const users = await response.json() as UserProfile[];
      log.info(`[getAllUsers] Successfully loaded ${users.length} users from database`);
      return users;
    } else {
      const errorText = await response.text().catch(() => 'Unable to read error response');
      log.error(`[getAllUsers] Server returned error status ${response.status}`, {
        status: response.status,
        statusText: response.statusText,
        errorBody: errorText
      });
    }
  } catch (error: any) {
    log.error('[getAllUsers] Error occurred during fetch', {
      error: error.message,
      stack: error.stack
    });
  }

  log.warn('[getAllUsers] Returning empty list due to fetch failure');
  return [];
};
