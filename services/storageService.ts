
import { UserProfile, NatalChartData } from "../types";

// In a real app, this would use: import { createClient } from '@supabase/supabase-js'

const PROFILE_KEY = 'astrot_profile';
const CHART_KEY = 'astrot_chart';

export const saveProfile = async (profile: UserProfile): Promise<void> => {
    // Simulate async network request
    await new Promise(resolve => setTimeout(resolve, 500));
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    console.log("Profile saved to local storage (simulating Supabase)");
};

export const getProfile = async (): Promise<UserProfile | null> => {
    await new Promise(resolve => setTimeout(resolve, 200));
    const data = localStorage.getItem(PROFILE_KEY);
    return data ? JSON.parse(data) : null;
};

export const saveChartData = async (data: NatalChartData): Promise<void> => {
    localStorage.setItem(CHART_KEY, JSON.stringify(data));
};

export const getChartData = async (): Promise<NatalChartData | null> => {
    const data = localStorage.getItem(CHART_KEY);
    return data ? JSON.parse(data) : null;
};

/**
 * MOCK function to simulate retrieving all users for Admin Panel
 */
export const getAllUsers = async (): Promise<UserProfile[]> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Return current user + some dummy data
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
