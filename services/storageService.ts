import { UserProfile, NatalChartData } from "../types";

// Railway Database API base URL
const DB_API_URL = process.env.DATABASE_URL || '';

const PROFILE_KEY = 'astrot_profile';
const CHART_KEY = 'astrot_chart';

/**
 * Save profile to Railway Database
 */
export const saveProfile = async (profile: UserProfile): Promise<void> => {
  try {
    if (DB_API_URL) {
      // Save to Railway Database via API
      const response = await fetch(`${DB_API_URL}/api/users/${profile.id || 'current'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      });

      if (!response.ok) {
        throw new Error('Failed to save profile to database');
      }
    } else {
      // Fallback to localStorage if DATABASE_URL is not set
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      console.log("Profile saved to local storage (fallback)");
    }
  } catch (error) {
    console.error('Error saving profile:', error);
    // Fallback to localStorage on error
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  }
};

/**
 * Get profile from Railway Database
 */
export const getProfile = async (): Promise<UserProfile | null> => {
  try {
    if (DB_API_URL) {
      // Get from Railway Database via API
      const tg = (window as any).Telegram?.WebApp;
      const tgId = tg?.initDataUnsafe?.user?.id;
      const userId = tgId || 'current';

      const response = await fetch(`${DB_API_URL}/api/users/${userId}`);
      
      if (response.ok) {
        return await response.json() as UserProfile;
      }
    }
  } catch (error) {
    console.error('Error getting profile from database:', error);
  }

  // Fallback to localStorage
  const data = localStorage.getItem(PROFILE_KEY);
  return data ? JSON.parse(data) : null;
};

/**
 * Save chart data to Railway Database
 */
export const saveChartData = async (data: NatalChartData): Promise<void> => {
  try {
    if (DB_API_URL) {
      const tg = (window as any).Telegram?.WebApp;
      const tgId = tg?.initDataUnsafe?.user?.id;
      const userId = tgId || 'current';

      const response = await fetch(`${DB_API_URL}/api/charts/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error('Failed to save chart to database');
      }
    } else {
      // Fallback to localStorage
      localStorage.setItem(CHART_KEY, JSON.stringify(data));
    }
  } catch (error) {
    console.error('Error saving chart:', error);
    // Fallback to localStorage
    localStorage.setItem(CHART_KEY, JSON.stringify(data));
  }
};

/**
 * Get chart data from Railway Database
 */
export const getChartData = async (): Promise<NatalChartData | null> => {
  try {
    if (DB_API_URL) {
      const tg = (window as any).Telegram?.WebApp;
      const tgId = tg?.initDataUnsafe?.user?.id;
      const userId = tgId || 'current';

      const response = await fetch(`${DB_API_URL}/api/charts/${userId}`);
      
      if (response.ok) {
        return await response.json() as NatalChartData;
      }
    }
  } catch (error) {
    console.error('Error getting chart from database:', error);
  }

  // Fallback to localStorage
  const data = localStorage.getItem(CHART_KEY);
  return data ? JSON.parse(data) : null;
};

/**
 * Get all users for Admin Panel from Railway Database
 */
export const getAllUsers = async (): Promise<UserProfile[]> => {
  try {
    if (DB_API_URL) {
      const response = await fetch(`${DB_API_URL}/api/users`);
      
      if (response.ok) {
        return await response.json() as UserProfile[];
      }
    }
  } catch (error) {
    console.error('Error getting all users from database:', error);
  }

  // Fallback to mock data
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
