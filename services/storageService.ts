import { UserProfile, NatalChartData } from "../types";

// Railway Database API base URL
const DB_API_URL = process.env.DATABASE_URL || '';

const PROFILE_KEY = 'astrot_profile';
const CHART_KEY = 'astrot_chart';

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

// Check if DATABASE_URL is configured
if (!DB_API_URL) {
  log.warn('DATABASE_URL is not set. All data will be saved to localStorage only.');
} else {
  log.info(`DATABASE_URL configured: ${DB_API_URL.substring(0, 30)}...`);
}

/**
 * Save profile to Railway Database
 */
export const saveProfile = async (profile: UserProfile): Promise<void> => {
  const userId = profile.id || 'current';
  log.info(`[saveProfile] Starting save for user: ${userId}`, { 
    userId, 
    hasName: !!profile.name,
    isPremium: profile.isPremium 
  });

  try {
    if (DB_API_URL) {
      const url = `${DB_API_URL}/api/users/${userId}`;
      log.info(`[saveProfile] Sending POST request to: ${url}`);
      
      const requestBody = JSON.stringify(profile);
      log.info(`[saveProfile] Request body size: ${requestBody.length} bytes`);

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
      log.info(`[saveProfile] Successfully saved profile to database`, {
        userId,
        responseData: responseData ? 'Received' : 'No response body'
      });
      return;
    } else {
      // Fallback to localStorage if DATABASE_URL is not set
      log.warn('[saveProfile] DATABASE_URL not set, using localStorage fallback');
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      log.info('[saveProfile] Profile saved to localStorage');
    }
  } catch (error: any) {
    log.error('[saveProfile] Error occurred during save', {
      error: error.message,
      stack: error.stack,
      userId
    });
    
    // Fallback to localStorage on error
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      log.info('[saveProfile] Fallback: Profile saved to localStorage');
    } catch (localStorageError) {
      log.error('[saveProfile] Failed to save to localStorage as well', localStorageError);
      throw new Error('Failed to save profile to both database and localStorage');
    }
  }
};

/**
 * Get profile from Railway Database
 */
export const getProfile = async (): Promise<UserProfile | null> => {
  const tg = (window as any).Telegram?.WebApp;
  const tgId = tg?.initDataUnsafe?.user?.id;
  const userId = tgId || 'current';
  
  log.info(`[getProfile] Starting fetch for user: ${userId}`, { userId, tgId });

  try {
    if (DB_API_URL) {
      const url = `${DB_API_URL}/api/users/${userId}`;
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
          isSetup: profile.isSetup
        });
        return profile;
      } else if (response.status === 404) {
        log.info(`[getProfile] Profile not found (404), will try localStorage`);
      } else {
        log.warn(`[getProfile] Unexpected status ${response.status}, will try localStorage`);
      }
    } else {
      log.warn('[getProfile] DATABASE_URL not set, using localStorage');
    }
  } catch (error: any) {
    log.error('[getProfile] Error occurred during fetch', {
      error: error.message,
      stack: error.stack,
      userId
    });
  }

  // Fallback to localStorage
  try {
    const data = localStorage.getItem(PROFILE_KEY);
    if (data) {
      const profile = JSON.parse(data) as UserProfile;
      log.info('[getProfile] Loaded profile from localStorage fallback');
      return profile;
    } else {
      log.info('[getProfile] No profile found in localStorage');
      return null;
    }
  } catch (parseError) {
    log.error('[getProfile] Error parsing localStorage data', parseError);
    return null;
  }
};

/**
 * Save chart data to Railway Database
 */
export const saveChartData = async (data: NatalChartData): Promise<void> => {
  const tg = (window as any).Telegram?.WebApp;
  const tgId = tg?.initDataUnsafe?.user?.id;
  const userId = tgId || 'current';

  log.info(`[saveChartData] Starting save for user: ${userId}`, {
    userId,
    hasPlanets: !!data.planets,
    hasHouses: !!data.houses
  });

  try {
    if (DB_API_URL) {
      const url = `${DB_API_URL}/api/charts/${userId}`;
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
    } else {
      // Fallback to localStorage
      log.warn('[saveChartData] DATABASE_URL not set, using localStorage fallback');
      localStorage.setItem(CHART_KEY, JSON.stringify(data));
      log.info('[saveChartData] Chart saved to localStorage');
    }
  } catch (error: any) {
    log.error('[saveChartData] Error occurred during save', {
      error: error.message,
      stack: error.stack,
      userId
    });
    
    // Fallback to localStorage on error
    try {
      localStorage.setItem(CHART_KEY, JSON.stringify(data));
      log.info('[saveChartData] Fallback: Chart saved to localStorage');
    } catch (localStorageError) {
      log.error('[saveChartData] Failed to save to localStorage as well', localStorageError);
      throw new Error('Failed to save chart to both database and localStorage');
    }
  }
};

/**
 * Get chart data from Railway Database
 */
export const getChartData = async (): Promise<NatalChartData | null> => {
  const tg = (window as any).Telegram?.WebApp;
  const tgId = tg?.initDataUnsafe?.user?.id;
  const userId = tgId || 'current';

  log.info(`[getChartData] Starting fetch for user: ${userId}`, { userId, tgId });

  try {
    if (DB_API_URL) {
      const url = `${DB_API_URL}/api/charts/${userId}`;
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
          hasPlanets: !!chartData.planets,
          hasHouses: !!chartData.houses
        });
        return chartData;
      } else if (response.status === 404) {
        log.info(`[getChartData] Chart not found (404), will try localStorage`);
      } else {
        log.warn(`[getChartData] Unexpected status ${response.status}, will try localStorage`);
      }
    } else {
      log.warn('[getChartData] DATABASE_URL not set, using localStorage');
    }
  } catch (error: any) {
    log.error('[getChartData] Error occurred during fetch', {
      error: error.message,
      stack: error.stack,
      userId
    });
  }

  // Fallback to localStorage
  try {
    const data = localStorage.getItem(CHART_KEY);
    if (data) {
      const chartData = JSON.parse(data) as NatalChartData;
      log.info('[getChartData] Loaded chart from localStorage fallback');
      return chartData;
    } else {
      log.info('[getChartData] No chart found in localStorage');
      return null;
    }
  } catch (parseError) {
    log.error('[getChartData] Error parsing localStorage data', parseError);
    return null;
  }
};

/**
 * Get all users for Admin Panel from Railway Database
 */
export const getAllUsers = async (): Promise<UserProfile[]> => {
  log.info('[getAllUsers] Starting fetch for all users');

  try {
    if (DB_API_URL) {
      const url = `${DB_API_URL}/api/users`;
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
    } else {
      log.warn('[getAllUsers] DATABASE_URL not set, using mock data');
    }
  } catch (error: any) {
    log.error('[getAllUsers] Error occurred during fetch', {
      error: error.message,
      stack: error.stack
    });
  }

  // Fallback to mock data
  log.info('[getAllUsers] Using mock data fallback');
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const currentUserStr = localStorage.getItem(PROFILE_KEY);
  const currentUser = currentUserStr ? JSON.parse(currentUserStr) : null;
  
  const mockUsers: UserProfile[] = [
    {
      name: "Elena V.",
      birthDate: "1995-04-12",
      birthTime: "14:30",
      birthPlace: "Moscow",
      isSetup: true,
      language: "ru",
      theme: "dark",
      isPremium: true,
      id: "987654321",
      isAdmin: false
    },
    {
      name: "Alex M.",
      birthDate: "1990-11-23",
      birthTime: "09:15",
      birthPlace: "London",
      isSetup: true,
      language: "en",
      theme: "light",
      isPremium: false,
      id: "1122334455",
      isAdmin: false
    },
    {
      name: "Dmitry K.",
      birthDate: "1988-01-05",
      birthTime: "22:00",
      birthPlace: "Saint Petersburg",
      isSetup: true,
      language: "ru",
      theme: "dark",
      isPremium: false,
      id: "5566778899",
      isAdmin: false
    }
  ];

  if (currentUser) {
    return [currentUser, ...mockUsers];
  }
  return mockUsers;
};
