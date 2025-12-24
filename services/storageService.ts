import { UserProfile, NatalChartData } from "../types";

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
  
  if (!userId) {
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
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: requestBody
    });

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

  try {
    // Always try to get from database via Next.js API
    const url = `${API_BASE_URL}/api/users/${userId}`;
    log.info(`[getProfile] Sending GET request to: ${url}`);

    const startTime = Date.now();
    const response = await fetch(url);
    const duration = Date.now() - startTime;

    log.info(`[getProfile] Response received in ${duration}ms`, {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });
    
    if (response.ok) {
      const profile = await response.json() as UserProfile;
      log.info(`[getProfile] Successfully loaded profile from database`, {
        userId,
        hasName: !!profile.name,
        isSetup: profile.isSetup,
        profileData: JSON.stringify(profile)
      });
      return profile;
    } else if (response.status === 404) {
      // Если данных нет в БД - возвращаем null (не используем localStorage)
      log.info(`[getProfile] Profile not found in database (404), returning null`);
      return null;
    } else {
      log.warn(`[getProfile] Unexpected status ${response.status}, returning null`);
    }
  } catch (error: any) {
    log.error('[getProfile] Error occurred during fetch', {
      error: error.message,
      stack: error.stack,
      userId
    });
  }

  return null;
};

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
    const response = await fetch(url);
    const duration = Date.now() - startTime;

    log.info(`[getChartData] Response received in ${duration}ms`, {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });
    
    if (response.ok) {
      const chartData = await response.json() as NatalChartData;
        log.info(`[getChartData] Successfully loaded chart from database`, {
          userId,
          hasSun: !!chartData.sun,
          hasMoon: !!chartData.moon,
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
