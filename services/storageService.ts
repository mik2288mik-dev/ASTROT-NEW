import {
  UserProfile,
  NatalChartData,
  LumiWalletData,
  DailyLumiTaskKey,
  DailyLumiTasksStatus,
} from "../types";
import { toDateInputValue } from "../lib/date-utils";
import { fetchWithTimeout } from "../lib/fetchWithTimeout";
import { isValidUserId } from "../lib/userId";

const PROFILE_FETCH_TIMEOUT_MS = 20_000;
const PROFILE_SAVE_TIMEOUT_MS = 45_000;
const CHART_GET_TIMEOUT_MS = 25_000;
const PROFILE_FETCH_ATTEMPTS = 3;
const PROFILE_FETCH_RETRY_DELAYS_MS = [0, 700, 1600];

// Next.js API base URL - используем локальные API routes
const API_BASE_URL = typeof window !== 'undefined' ? '' : process.env.NEXT_PUBLIC_API_URL || '';

// Logging utility
const log = {
  info: (message: string, data?: any) => {
    console.log(`[StorageService] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[StorageService] ERROR: ${message}`, error || '');
  },
  warn: (message: string, data?: any) => {
    console.warn(`[StorageService] WARNING: ${message}`, data || '');
  }
};

log.info('StorageService initialized', { 
  isClient: typeof window !== 'undefined',
  apiBaseUrl: API_BASE_URL || '/api'
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
    const url = `${API_BASE_URL}/api/users/${userId}`;
    log.info(`[saveProfile] Sending POST request to: ${url}`);
    
    const requestBody = JSON.stringify(profile);
    log.info(`[saveProfile] Request body size: ${requestBody.length} bytes`);
    
    // Логируем содержимое requestBody для отладки
    try {
      const parsedBody = JSON.parse(requestBody);
      log.info(`[saveProfile] Request body.weatherCity:`, parsedBody.weatherCity);
      log.info(`[saveProfile] Request body.hasGeneratedContent:`, !!parsedBody.generatedContent);
      log.info(`[saveProfile] Request body.generatedContent keys:`, parsedBody.generatedContent ? Object.keys(parsedBody.generatedContent) : []);
      log.info(`[saveProfile] Request body.generatedContent.natalIntro exists:`, !!parsedBody.generatedContent?.natalIntro);
    } catch (e) {
      log.warn(`[saveProfile] Failed to parse request body for logging:`, e);
    }

    const startTime = Date.now();
    const response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    if (responseData) {
      log.info(`[saveProfile] responseData.weatherCity:`, responseData.weatherCity);
      log.info(`[saveProfile] responseData.hasGeneratedContent:`, !!responseData.generatedContent);
      log.info(`[saveProfile] responseData.generatedContent keys:`, responseData.generatedContent ? Object.keys(responseData.generatedContent) : []);
      log.info(`[saveProfile] responseData.generatedContent.natalIntro exists:`, !!responseData.generatedContent?.natalIntro);
    }
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
export const getProfile = async (): Promise<UserProfile | null> => {
  const tg = (window as any).Telegram?.WebApp;
  const tgId = tg?.initDataUnsafe?.user?.id;
  
  if (!tgId) {
      log.warn('[getProfile] No Telegram ID found, cannot fetch profile from DB');
      return null;
  }
  
  const userId = tgId;
  
  log.info(`[getProfile] Starting fetch for user: ${userId}`, { userId, tgId });

  const url = `${API_BASE_URL}/api/users/${userId}`;

  for (let attempt = 0; attempt < PROFILE_FETCH_ATTEMPTS; attempt++) {
    const delay = PROFILE_FETCH_RETRY_DELAYS_MS[attempt] ?? 0;
    if (delay > 0) {
      await new Promise((r) => setTimeout(r, delay));
    }

    try {
      log.info(`[getProfile] GET attempt ${attempt + 1}/${PROFILE_FETCH_ATTEMPTS}: ${url}`);

      const startTime = Date.now();
      const response = await fetchWithTimeout(url, { method: 'GET' }, PROFILE_FETCH_TIMEOUT_MS);
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
          userId,
          hasName: !!profile.name,
          isSetup: profile.isSetup,
        });
        return profile;
      }

      if (response.status === 404) {
        log.info(`[getProfile] Profile not found in database (404), returning null`);
        return null;
      }

      log.warn(`[getProfile] HTTP ${response.status}, will retry if attempts left`);
    } catch (error: any) {
      log.warn('[getProfile] Request failed, will retry if attempts left', {
        error: error?.message || error,
        attempt: attempt + 1,
        userId,
      });
    }
  }

  log.error('[getProfile] All fetch attempts failed', { userId });
  return null;
};

/**
 * Process daily login bonus and streak.
 * Returns updated balance and streak. Safe to call every app load - backend prevents double-award.
 */
export const processDailyLogin = async (userId: string): Promise<{
  awardedToday: boolean;
  dailyReward?: number;
  streakBonus?: number;
  streak: number;
  newBalance: number;
}> => {
  if (!isValidUserId(userId)) throw new Error('UserId is required');
  const url = `${API_BASE_URL}/api/users/daily-login`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Daily login failed: ${res.status}`);
  }
  return res.json();
};

/**
 * Fetch current Lumi balance from API (for refresh after add/spend)
 */
export const getLumiBalance = async (userId: string): Promise<number> => {
  if (!isValidUserId(userId)) {
    throw new Error('UserId is required');
  }

  const url = `${API_BASE_URL}/api/users/lumi?userId=${encodeURIComponent(userId)}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || `Failed to fetch Lumi balance: ${res.status}`);
  }

  const data = await res.json();
  return data.lumi_balance ?? 0;
};

export const getLumiWallet = async (userId: string, limit = 30): Promise<LumiWalletData> => {
  if (!isValidUserId(userId)) {
    return { lumi_balance: 0, transactions: [] };
  }

  const url = `${API_BASE_URL}/api/users/lumi?userId=${encodeURIComponent(userId)}&includeHistory=true&limit=${encodeURIComponent(String(limit))}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || `Failed to fetch Lumi wallet: ${res.status}`);
  }

  const data = await res.json();
  return {
    lumi_balance: data.lumi_balance ?? 0,
    transactions: data.transactions ?? [],
  };
};

export type DailyRouletteStatus = {
  canSpin: boolean;
  nextAvailableAt: string | null;
  lastSpinAt: string | null;
  lastWinAmount: number | null;
  lastWinTier: string | null;
  lumiBalance: number;
};

export const getDailyRouletteStatus = async (
  userId: string
): Promise<DailyRouletteStatus> => {
  if (!isValidUserId(userId)) {
    return {
      canSpin: true,
      nextAvailableAt: null,
      lastSpinAt: null,
      lastWinAmount: null,
      lastWinTier: null,
      lumiBalance: 0,
    };
  }
  const url = `${API_BASE_URL}/api/users/lumi/daily-roulette?userId=${encodeURIComponent(userId)}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || `Roulette status failed: ${res.status}`);
  }
  const data = await res.json();
  return {
    canSpin: data.canSpin !== false,
    nextAvailableAt: data.nextAvailableAt ?? null,
    lastSpinAt: data.lastSpinAt ?? null,
    lastWinAmount: typeof data.lastWinAmount === 'number' ? data.lastWinAmount : null,
    lastWinTier: data.lastWinTier ?? null,
    lumiBalance: data.lumiBalance ?? 0,
  };
};

export type DailyRouletteSpinResult =
  | { ok: true; amount: number; tier: string; lumiBalance: number; nextAvailableAt: string | null }
  | { ok: false; code: 'COOLDOWN'; lumiBalance: number; nextAvailableAt: string | null };

export const postDailyRouletteSpin = async (userId: string): Promise<DailyRouletteSpinResult> => {
  if (!isValidUserId(userId)) throw new Error('UserId is required');
  const res = await fetch(`${API_BASE_URL}/api/users/lumi/daily-roulette`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || data.error || `Roulette spin failed: ${res.status}`);
  }
  if (data.ok === false && data.code === 'COOLDOWN') {
    return {
      ok: false,
      code: 'COOLDOWN',
      lumiBalance: data.lumiBalance ?? 0,
      nextAvailableAt: data.nextAvailableAt ?? null,
    };
  }
  if (data.ok === true) {
    return {
      ok: true,
      amount: data.amount,
      tier: data.tier,
      lumiBalance: data.lumiBalance,
      nextAvailableAt: data.nextAvailableAt ?? null,
    };
  }
  throw new Error(data.message || 'Unexpected roulette response');
};

export type DailyLumiTaskCompletionResult = DailyLumiTasksStatus & {
  taskKey: DailyLumiTaskKey;
  awarded: boolean;
  amountAwarded: number;
};

export const getDailyLumiTasksStatus = async (userId: string): Promise<DailyLumiTasksStatus> => {
  if (!isValidUserId(userId)) {
    return {
      date: '',
      totalReward: 0,
      earnedToday: 0,
      completedCount: 0,
      tasks: [],
      lumiBalance: 0,
    };
  }

  const url = `${API_BASE_URL}/api/users/lumi/daily-tasks?userId=${encodeURIComponent(userId)}`;
  const res = await fetch(url, { cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || data.error || `Daily tasks status failed: ${res.status}`);
  }

  return {
    date: data.date ?? '',
    totalReward: data.totalReward ?? 0,
    earnedToday: data.earnedToday ?? 0,
    completedCount: data.completedCount ?? 0,
    tasks: Array.isArray(data.tasks) ? data.tasks : [],
    lumiBalance: data.lumiBalance ?? 0,
  };
};

export const completeDailyLumiTask = async (
  userId: string,
  taskKey: DailyLumiTaskKey
): Promise<DailyLumiTaskCompletionResult> => {
  if (!isValidUserId(userId)) throw new Error('UserId is required');

  const res = await fetch(`${API_BASE_URL}/api/users/lumi/daily-tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, taskKey }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || data.error || `Daily task completion failed: ${res.status}`);
  }

  return {
    taskKey,
    awarded: !!data.awarded,
    amountAwarded: data.amountAwarded ?? 0,
    date: data.date ?? '',
    totalReward: data.totalReward ?? 0,
    earnedToday: data.earnedToday ?? 0,
    completedCount: data.completedCount ?? 0,
    tasks: Array.isArray(data.tasks) ? data.tasks : [],
    lumiBalance: data.lumiBalance ?? 0,
  };
};

export type ReferralClaimApiResult = {
  ok: boolean;
  status: number;
  newBalance?: number;
  code?: string;
};

export const postReferralClaim = async (userId: string, inviteCode: string): Promise<ReferralClaimApiResult> => {
  if (!userId || !inviteCode.trim()) {
    return { ok: false, status: 400, code: 'MISSING' };
  }
  const res = await fetch(`${API_BASE_URL}/api/users/referral/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, inviteCode: inviteCode.trim() }),
  });
  const data = await res.json().catch(() => ({}));
  return {
    ok: res.ok,
    status: res.status,
    newBalance: data.newBalance,
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
  const tg = (window as any).Telegram?.WebApp;
  const tgId = tg?.initDataUnsafe?.user?.id;
  
  if (!tgId) {
      log.error('[saveChartData] No Telegram ID found, cannot save chart');
      throw new Error('User ID is required for saving chart');
  }

  const userId = tgId;

  log.info(`[saveChartData] Starting save for user: ${userId}`, {
    userId,
    hasSun: !!data.sun,
    hasMoon: !!data.moon,
    element: data.element
  });

  try {
    // Always try to save to database via Next.js API
    const url = `${API_BASE_URL}/api/charts/${userId}`;
    log.info(`[saveChartData] Sending POST request to: ${url}`);

    const requestBody = JSON.stringify(data);
    log.info(`[saveChartData] Request body size: ${requestBody.length} bytes`);

    const startTime = Date.now();
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
  const tg = (window as any).Telegram?.WebApp;
  const tgId = tg?.initDataUnsafe?.user?.id;
  
  if (!tgId) {
      log.warn('[getChartData] No Telegram ID found, cannot fetch chart');
      return null;
  }
  
  const userId = tgId;

  log.info(`[getChartData] Starting fetch for user: ${userId}`, { userId, tgId });

  try {
    // Always try to get from database via Next.js API
    const url = `${API_BASE_URL}/api/charts/${userId}`;
    log.info(`[getChartData] Sending GET request to: ${url}`);

    const startTime = Date.now();
    const response = await fetchWithTimeout(url, { method: 'GET' }, CHART_GET_TIMEOUT_MS);
    const duration = Date.now() - startTime;

    log.info(`[getChartData] Response received in ${duration}ms`, {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });
    
    if (response.ok) {
      const chartData = await response.json() as NatalChartData;
      
      // Валидация данных карты перед возвратом
      if (!chartData || !chartData.sun || !chartData.moon || !chartData.rising) {
        log.error(`[getChartData] Invalid chart data received from database`, {
          userId,
          hasData: !!chartData,
          hasSun: !!chartData?.sun,
          hasMoon: !!chartData?.moon,
          hasRising: !!chartData?.rising,
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

// --- Multi-chart API (chart slots flow) ---

export interface ChartListItem {
  id: number;
  user_id: string;
  name: string;
  chart_data: any;
  birth_date: string;
  birth_time: string;
  birth_place: string;
  is_primary: boolean;
  created_at?: string;
}

export interface ChartsResponse {
  charts: ChartListItem[];
  chartSlots: number;
  canAddMore: boolean;
  slotCost?: number;
}

const normalizeChartListItem = (chart: ChartListItem): ChartListItem => ({
  ...chart,
  birth_date: toDateInputValue(chart.birth_date) || chart.birth_date,
});

/**
 * Get all charts for user (multi-chart flow)
 */
export const getCharts = async (userId: string): Promise<ChartsResponse> => {
  if (!isValidUserId(userId)) throw new Error('UserId is required');
  const url = `${API_BASE_URL}/api/charts?userId=${encodeURIComponent(userId)}`;
  const res = await fetch(url);
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
 * Create a new chart (enforces chart_slots limit)
 */
export const createChart = async (
  userId: string,
  data: { name: string; birthDate: string; birthTime?: string; birthPlace: string; chartData?: any; language?: string }
): Promise<ChartListItem> => {
  if (!isValidUserId(userId)) throw new Error('UserId is required');
  const url = `${API_BASE_URL}/api/charts`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, ...data }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || `Failed to create chart: ${res.status}`);
  }
  const chart = await res.json() as ChartListItem;
  return normalizeChartListItem(chart);
};

/**
 * Buy one additional chart slot with Lumi
 */
export const buyChartSlot = async (userId: string): Promise<{ newBalance: number; chartSlots: number }> => {
  if (!isValidUserId(userId)) throw new Error('UserId is required');
  const url = `${API_BASE_URL}/api/charts`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, action: 'buy-slot' }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || `Failed to buy slot: ${res.status}`);
  }
  const data = await res.json();
  return { newBalance: data.newBalance, chartSlots: data.chartSlots };
};

/**
 * Delete a chart (reassigns primary if needed)
 */
export const deleteChart = async (chartId: number, userId: string): Promise<void> => {
  if (!isValidUserId(userId)) throw new Error('UserId is required');
  const url = `${API_BASE_URL}/api/charts/chart/${chartId}?userId=${encodeURIComponent(userId)}`;
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to delete chart: ${res.status}`);
  }
};

/**
 * Set a chart as primary
 */
export const setPrimaryChart = async (chartId: number, userId: string): Promise<void> => {
  if (!isValidUserId(userId)) throw new Error('UserId is required');
  const url = `${API_BASE_URL}/api/charts/set-primary`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chartId, userId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to set primary: ${res.status}`);
  }
};

/**
 * Get all users for Admin Panel from Railway Database
 */
export const getAllUsers = async (): Promise<UserProfile[]> => {
  log.info('[getAllUsers] Starting fetch for all users');

  try {
    // Always try to get from database via Next.js API
    const url = `${API_BASE_URL}/api/users`;
    log.info(`[getAllUsers] Sending GET request to: ${url}`);

    const startTime = Date.now();
    const response = await fetch(url);
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
